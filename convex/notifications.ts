import { v } from "convex/values";
import { fail, orgMutation, orgQuery } from "./lib/tenancy";

export const mine = orgQuery()({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("notifications")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", ctx.orgId).eq("userId", ctx.member.userId),
      )
      .order("desc")
      .take(50),
});

export const markRead = orgMutation()({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const n = await ctx.db.get(args.id);
    if (!n || n.orgId !== ctx.orgId || n.userId !== ctx.member.userId) {
      fail("Notification not found");
    }
    if (!n.read) await ctx.db.patch(n._id, { read: true });
  },
});
