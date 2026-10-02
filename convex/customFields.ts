import { v } from "convex/values";
import { ADMIN, fail, orgMutation, orgQuery } from "./lib/tenancy";
import { clean, required } from "./lib/validation";

export const list = orgQuery()({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("customFields")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(100),
});

export const add = orgMutation(ADMIN)({
  args: {
    label: v.string(),
    target: v.union(v.literal("visitor"), v.literal("employee")),
    required: v.boolean(),
  },
  handler: async (ctx, args) => {
    const label = required(clean(args.label, 60, "Label"), "Label");
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!key) fail("Label must contain letters or numbers");
    const existing = await ctx.db
      .query("customFields")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(100);
    if (existing.some((f) => f.key === key && f.target === args.target)) {
      fail("A field with that name already exists");
    }
    return await ctx.db.insert("customFields", {
      orgId: ctx.orgId,
      label,
      key,
      target: args.target,
      required: args.required,
    });
  },
});

export const remove = orgMutation(ADMIN)({
  args: { id: v.id("customFields") },
  handler: async (ctx, args) => {
    const field = await ctx.db.get(args.id);
    if (!field || field.orgId !== ctx.orgId) fail("Field not found");
    await ctx.db.delete(field._id);
  },
});
