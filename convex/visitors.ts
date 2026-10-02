import { v } from "convex/values";
import { STAFF, fail, notify, orgMutation, orgQuery } from "./lib/tenancy";
import { clean, required, validateExtraData } from "./lib/validation";

/** Visitors currently on site. Hosts only see visitors who came to see them. */
export const onPremise = orgQuery()({
  args: {},
  handler: async (ctx) => {
    if (ctx.member.role === "host") {
      return await ctx.db
        .query("visitors")
        .withIndex("by_org_host_status", (q) =>
          q.eq("orgId", ctx.orgId).eq("hostUserId", ctx.member.userId).eq("status", "in"),
        )
        .take(200);
    }
    return await ctx.db
      .query("visitors")
      .withIndex("by_org_status", (q) => q.eq("orgId", ctx.orgId).eq("status", "in"))
      .take(500);
  },
});

/** Visitors checked in since `since` (epoch ms). Feeds dashboard counts and charts. */
export const since = orgQuery(STAFF)({
  args: { since: v.number() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("visitors")
      .withIndex("by_org_time", (q) =>
        q.eq("orgId", ctx.orgId).gte("checkInTime", args.since),
      )
      .order("desc")
      .take(2000),
});

export const log = orgQuery(STAFF)({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("visitors")
      .withIndex("by_org_time", (q) => q.eq("orgId", ctx.orgId))
      .order("desc")
      .take(500),
});

export const checkIn = orgMutation(STAFF)({
  args: {
    name: v.string(),
    company: v.string(),
    hostName: v.string(),
    hostUserId: v.optional(v.string()),
    purpose: v.string(),
    extraData: v.record(v.string(), v.string()),
    appointmentId: v.optional(v.id("appointments")),
  },
  handler: async (ctx, args) => {
    const name = required(clean(args.name, 120, "Name"), "Name");
    const company = clean(args.company, 120, "Company");
    const purpose = clean(args.purpose, 60, "Purpose") || "Visit";
    let hostName = required(clean(args.hostName, 120, "Host"), "Host");

    // A hostUserId is only trusted if it names a member of this org.
    let hostUserId: string | undefined;
    if (args.hostUserId) {
      const host = await ctx.db
        .query("members")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", ctx.orgId).eq("userId", args.hostUserId!),
        )
        .unique();
      if (!host) fail("Host not found");
      hostUserId = host.userId;
      hostName = host.name;
    }

    if (args.appointmentId) {
      const appt = await ctx.db.get(args.appointmentId);
      if (!appt || appt.orgId !== ctx.orgId) fail("Appointment not found");
      if (appt.status !== "scheduled") fail("This appointment was already used or cancelled");
      await ctx.db.patch(appt._id, { status: "arrived" });
    }

    const fields = await ctx.db
      .query("customFields")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(100);

    const id = await ctx.db.insert("visitors", {
      orgId: ctx.orgId,
      name,
      company,
      hostName,
      hostUserId,
      purpose,
      checkInTime: Date.now(),
      status: "in",
      appointmentId: args.appointmentId,
      checkedInBy: ctx.member.userId,
      extraData: validateExtraData(fields, "visitor", args.extraData),
    });

    if (hostUserId) {
      await notify(ctx, ctx.orgId, [hostUserId], `${name}${company ? ` from ${company}` : ""} has arrived to see you.`);
    }
    return id;
  },
});

/** Guards/admins can check out anyone; a host can only check out their own visitors. */
export const checkOut = orgMutation()({
  args: { id: v.id("visitors") },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.id);
    if (!visitor || visitor.orgId !== ctx.orgId) fail("Visitor not found");
    if (ctx.member.role === "host" && visitor.hostUserId !== ctx.member.userId) {
      fail("Not allowed");
    }
    if (visitor.status === "out") return;
    await ctx.db.patch(visitor._id, { status: "out", checkOutTime: Date.now() });
  },
});
