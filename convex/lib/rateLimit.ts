import type { MutationCtx } from "../_generated/server";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/**
 * Fixed-window counter. Returns true if the action may proceed (and counts it),
 * false if `max` was already reached in the current window.
 *
 * NB: a mutation that throws rolls its writes back, including this counter.
 * Callers that need failed attempts to count must return a result instead of throwing.
 */
export async function hit(
  ctx: MutationCtx,
  orgId: string,
  key: string,
  windowMs: number,
  max: number,
): Promise<boolean> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_org_key", (q) => q.eq("orgId", orgId).eq("key", key))
    .unique();
  if (!row) {
    await ctx.db.insert("rateLimits", { orgId, key, windowStart, count: 1 });
    return max >= 1;
  }
  if (row.windowStart !== windowStart) {
    await ctx.db.patch(row._id, { windowStart, count: 1 });
    return true;
  }
  if (row.count >= max) return false;
  await ctx.db.patch(row._id, { count: row.count + 1 });
  return true;
}
