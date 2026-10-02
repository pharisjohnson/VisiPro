import { v } from "convex/values";
import { STAFF, fail, orgMutation, orgQuery } from "./lib/tenancy";
import { clean, required, validateExtraData } from "./lib/validation";

export const list = orgQuery(STAFF)({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("employees")
      .withIndex("by_org_time", (q) => q.eq("orgId", ctx.orgId))
      .order("desc")
      .take(500),
});

export const checkIn = orgMutation(STAFF)({
  args: { name: v.string(), extraData: v.record(v.string(), v.string()) },
  handler: async (ctx, args) => {
    const name = required(clean(args.name, 120, "Name"), "Name");
    const fields = await ctx.db
      .query("customFields")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(100);
    return await ctx.db.insert("employees", {
      orgId: ctx.orgId,
      name,
      checkInTime: Date.now(),
      status: "in",
      extraData: validateExtraData(fields, "employee", args.extraData),
    });
  },
});

export const checkOut = orgMutation(STAFF)({
  args: { id: v.id("employees") },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.id);
    if (!employee || employee.orgId !== ctx.orgId) fail("Employee not found");
    if (employee.status === "out") return;
    await ctx.db.patch(employee._id, { status: "out", checkOutTime: Date.now() });
  },
});
