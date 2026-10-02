import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { fail, notify } from "./tenancy";
import { clean, required, validateExtraData } from "./validation";
import { loadSettings } from "./settings";
import { enqueueSms, sanitizeForSms } from "./sms";

export type VisitInput = {
  orgId: string;
  source: "staff" | "kiosk";
  checkedInBy: string; // member userId, or "kiosk"
  name: string;
  company?: string;
  purpose?: string;
  hostName: string;
  hostUserId?: string;
  appointmentId?: Id<"appointments">;
  extraData: Record<string, string>;
};

/**
 * The single path that creates a visit, shared by guards and the kiosk so the
 * rules can't drift. Everything is validated BEFORE the first write, so callers
 * may catch a ConvexError and the transaction stays clean.
 */
export async function createVisit(ctx: MutationCtx, input: VisitInput): Promise<{ id: Id<"visitors">; hostName: string }> {
  const { orgId } = input;
  const name = required(clean(input.name, 120, "Name"), "Name");
  const company = clean(input.company, 120, "Company");
  const purpose = clean(input.purpose, 60, "Purpose") || "Visit";

  // A host id is only trusted if it names a member of this org; the member's
  // name then wins over anything typed. Without one, a typed host name is required.
  let host: Doc<"members"> | null = null;
  if (input.hostUserId) {
    host = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", input.hostUserId!))
      .unique();
    if (!host) fail("Host not found");
  }
  const hostName = host ? host.name : required(clean(input.hostName, 120, "Host"), "Host");

  let appointment: Doc<"appointments"> | null = null;
  if (input.appointmentId) {
    appointment = await ctx.db.get(input.appointmentId);
    if (!appointment || appointment.orgId !== orgId) fail("Appointment not found");
    if (appointment.status !== "scheduled") fail("This appointment was already used or cancelled");
  }

  const fields = await ctx.db
    .query("customFields")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(100);
  const extraData = validateExtraData(fields, "visitor", input.extraData);

  // ---- all checks passed: writes start here ----
  if (appointment) await ctx.db.patch(appointment._id, { status: "arrived" });

  const id = await ctx.db.insert("visitors", {
    orgId,
    name,
    company,
    hostName,
    hostUserId: host?.userId,
    purpose,
    checkInTime: Date.now(),
    status: "in",
    appointmentId: input.appointmentId,
    checkedInBy: input.checkedInBy,
    source: input.source,
    extraData,
  });

  if (host) {
    const { settings } = await loadSettings(ctx, orgId);
    const who = `${sanitizeForSms(name, 40)}${company ? ` (${sanitizeForSms(company, 40)})` : ""}`;
    await notify(ctx, orgId, [host.userId], `${name}${company ? ` from ${company}` : ""} has arrived to see you.`);
    if (settings.smsHostOnArrival && host.phone) {
      const place = settings.companyName ? ` at ${sanitizeForSms(settings.companyName, 40)}` : "";
      await enqueueSms(ctx, orgId, {
        to: host.phone,
        message: `${who} has arrived${place} to see you.`,
        kind: "host_arrival",
      });
    }
  }
  return { id, hostName };
}
