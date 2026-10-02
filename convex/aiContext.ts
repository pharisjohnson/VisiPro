import { v } from "convex/values";
import { ADMIN, orgQuery } from "./lib/tenancy";

export const get = orgQuery(ADMIN)({
  args: { dayStart: v.number(), dayEnd: v.number() },
  handler: async (ctx, args) => {
    const onPremise = await ctx.db
      .query("visitors")
      .withIndex("by_org_status", (q) => q.eq("orgId", ctx.orgId).eq("status", "in"))
      .take(200);
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_org_time", (q) =>
        q.eq("orgId", ctx.orgId).gte("scheduledTime", args.dayStart).lt("scheduledTime", args.dayEnd),
      )
      .take(200);
    return { onPremise, appointments };
  },
});
