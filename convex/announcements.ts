import { v } from "convex/values";
import { ADMIN, orgMutation, orgQuery } from "./lib/tenancy";
import { clean, required } from "./lib/validation";

export const list = orgQuery()({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("announcements")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .order("desc")
      .take(20),
});

export const post = orgMutation(ADMIN)({
  args: { title: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("announcements", {
      orgId: ctx.orgId,
      title: required(clean(args.title, 120, "Title"), "Title"),
      content: required(clean(args.content, 2000, "Content"), "Content"),
      authorName: ctx.member.name,
      authorRole: ctx.member.role,
    });
  },
});
