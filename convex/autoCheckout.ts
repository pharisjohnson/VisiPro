import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { loadSettings } from "./lib/settings";
import { HOUR_MS } from "./lib/rateLimit";

/**
 * Closes visits that were never checked out (people forget). Each org sets its
 * own threshold (`autoCheckoutHours`, 0 = off); rows are flagged
 * `autoCheckedOut` so logs show they were closed by the system, not a person.
 *
 * Runs hourly over every still-"in" visit older than one hour, in pages. Each
 * write only touches the row's own org, using that org's own settings.
 */
const PAGE = 200;

async function thresholdFor(ctx: MutationCtx, cache: Map<string, number>, orgId: string) {
  let hours = cache.get(orgId);
  if (hours === undefined) {
    hours = (await loadSettings(ctx, orgId)).settings.autoCheckoutHours;
    cache.set(orgId, hours);
  }
  return hours;
}

export const sweepVisitors = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cache = new Map<string, number>();
    const page = await ctx.db
      .query("visitors")
      .withIndex("by_status_time", (q) => q.eq("status", "in").lt("checkInTime", now - HOUR_MS))
      .paginate({ numItems: PAGE, cursor: args.cursor ?? null });
    for (const visitor of page.page) {
      const hours = await thresholdFor(ctx, cache, visitor.orgId);
      if (hours > 0 && visitor.checkInTime < now - hours * HOUR_MS) {
        await ctx.db.patch(visitor._id, { status: "out", checkOutTime: now, autoCheckedOut: true });
      }
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.autoCheckout.sweepVisitors, { cursor: page.continueCursor });
  },
});

export const sweepEmployees = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cache = new Map<string, number>();
    const page = await ctx.db
      .query("employees")
      .withIndex("by_status_time", (q) => q.eq("status", "in").lt("checkInTime", now - HOUR_MS))
      .paginate({ numItems: PAGE, cursor: args.cursor ?? null });
    for (const employee of page.page) {
      const hours = await thresholdFor(ctx, cache, employee.orgId);
      if (hours > 0 && employee.checkInTime < now - hours * HOUR_MS) {
        await ctx.db.patch(employee._id, { status: "out", checkOutTime: now, autoCheckedOut: true });
      }
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.autoCheckout.sweepEmployees, { cursor: page.continueCursor });
  },
});
