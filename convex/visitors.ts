import { v } from "convex/values";
import { STAFF, fail, orgMutation, orgQuery } from "./lib/tenancy";
import { createVisit } from "./lib/visits";

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
  handler: async (ctx, args) =>
    (
      await createVisit(ctx, {
        orgId: ctx.orgId,
        source: "staff",
        checkedInBy: ctx.member.userId,
        ...args,
      })
    ).id,
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
