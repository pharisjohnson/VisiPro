import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type Settings = Omit<Doc<"orgSettings">, "_id" | "_creationTime" | "orgId" | "kioskToken">;

export const DEFAULT_SETTINGS: Settings = {
  companyName: "",
  utcOffsetMinutes: 180, // East Africa Time (Kenya, Uganda, Tanzania, Ethiopia)
  autoCheckoutHours: 12,
  smsHostOnArrival: true,
  smsVisitorCode: true,
};

/** The org's settings row (if any) merged over the defaults. Always scoped by orgId. */
export async function loadSettings(ctx: QueryCtx, orgId: string) {
  const row = await ctx.db
    .query("orgSettings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique();
  const settings: Settings = {
    companyName: row?.companyName ?? DEFAULT_SETTINGS.companyName,
    utcOffsetMinutes: row?.utcOffsetMinutes ?? DEFAULT_SETTINGS.utcOffsetMinutes,
    autoCheckoutHours: row?.autoCheckoutHours ?? DEFAULT_SETTINGS.autoCheckoutHours,
    smsHostOnArrival: row?.smsHostOnArrival ?? DEFAULT_SETTINGS.smsHostOnArrival,
    smsVisitorCode: row?.smsVisitorCode ?? DEFAULT_SETTINGS.smsVisitorCode,
  };
  return { settings, row };
}
