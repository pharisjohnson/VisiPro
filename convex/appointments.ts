import { v } from "convex/values";
import { fail, notify, orgMutation, orgQuery } from "./lib/tenancy";
import { clean, required } from "./lib/validation";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreads at the gate

/** Admins/guards see all appointments; hosts see only their own. */
export const list = orgQuery()({
  args: {},
  handler: async (ctx) => {
    if (ctx.member.role === "host") {
      return await ctx.db
        .query("appointments")
        .withIndex("by_org_host_time", (q) =>
          q.eq("orgId", ctx.orgId).eq("hostUserId", ctx.member.userId),
        )
        .order("desc")
        .take(500);
    }
    return await ctx.db
      .query("appointments")
      .withIndex("by_org_time", (q) => q.eq("orgId", ctx.orgId))
      .order("desc")
      .take(500);
  },
});

/** Appointments still waiting for their visitor within [from, to) — the gate's lookup list. */
export const expected = orgQuery(["admin", "guard"])({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("appointments")
      .withIndex("by_org_time", (q) =>
        q.eq("orgId", ctx.orgId).gte("scheduledTime", args.from).lt("scheduledTime", args.to),
      )
      .take(500);
    return rows.filter((a) => a.status === "scheduled");
  },
});

export const create = orgMutation()({
  args: {
    visitorName: v.string(),
    visitorCompany: v.string(),
    hostName: v.string(),
    hostUserId: v.optional(v.string()),
    scheduledTime: v.number(),
  },
  handler: async (ctx, args) => {
    const visitorName = required(clean(args.visitorName, 120, "Visitor name"), "Visitor name");
    const visitorCompany = clean(args.visitorCompany, 120, "Company");
    let hostName = required(clean(args.hostName, 120, "Host"), "Host");
    let hostUserId = args.hostUserId;

    if (ctx.member.role === "host") {
      // Hosts can only book appointments for themselves.
      hostUserId = ctx.member.userId;
      hostName = ctx.member.name;
    } else if (hostUserId) {
      const host = await ctx.db
        .query("members")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", ctx.orgId).eq("userId", hostUserId!),
        )
        .unique();
      if (!host) fail("Host not found");
      hostName = host.name;
    }

    let checkInCode = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      let candidate = "";
      for (let i = 0; i < 6; i++) {
        candidate += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      }
      const clash = await ctx.db
        .query("appointments")
        .withIndex("by_org_code", (q) => q.eq("orgId", ctx.orgId).eq("checkInCode", candidate))
        .first();
      if (!clash) {
        checkInCode = candidate;
        break;
      }
    }
    if (!checkInCode) fail("Could not generate a unique check-in code, please retry");

    const id = await ctx.db.insert("appointments", {
      orgId: ctx.orgId,
      visitorName,
      visitorCompany,
      hostName,
      hostUserId,
      scheduledTime: args.scheduledTime,
      checkInCode,
      status: "scheduled",
      createdBy: ctx.member.userId,
    });

    if (ctx.member.role === "host") {
      const admins = await ctx.db
        .query("members")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
        .filter((q) => q.eq(q.field("role"), "admin"))
        .take(50);
      await notify(
        ctx,
        ctx.orgId,
        admins.map((a) => a.userId),
        `${ctx.member.name} scheduled an appointment for ${visitorName}.`,
      );
    }
    return { id, checkInCode, hostName };
  },
});

export const cancel = orgMutation()({
  args: { id: v.id("appointments") },
  handler: async (ctx, args) => {
    const appt = await ctx.db.get(args.id);
    if (!appt || appt.orgId !== ctx.orgId) fail("Appointment not found");
    if (ctx.member.role === "host" && appt.hostUserId !== ctx.member.userId) fail("Not allowed");
    if (appt.status === "scheduled") await ctx.db.patch(appt._id, { status: "cancelled" });
  },
});
