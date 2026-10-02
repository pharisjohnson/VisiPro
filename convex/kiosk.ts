/**
 * Public self-check-in (no login). This is the ONLY unauthenticated write path,
 * so it is deliberately narrow:
 *   - the organization is resolved from the secret kiosk token and nothing else;
 *   - it can only create visits (never read visitor/appointment data back out);
 *   - every submission is rate-limited per organization;
 *   - expected failures RETURN a result (a thrown error would roll back the
 *     rate-limit counter and let someone guess appointment codes for free).
 * Admins can rotate or disable the token at any time (kioskAdmin / settings).
 */
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { HOUR_MS, hit } from "./lib/rateLimit";
import { createVisit } from "./lib/visits";
import { loadSettings } from "./lib/settings";

export const KIOSK_HOURLY_CAP = 60;
const CODE_WINDOW_PAST_MS = 12 * HOUR_MS;
const CODE_WINDOW_FUTURE_MS = 24 * HOUR_MS;

async function orgForToken(ctx: QueryCtx, token: string): Promise<string | null> {
  if (token.length < 20 || token.length > 100) return null;
  const row = await ctx.db
    .query("orgSettings")
    .withIndex("by_kiosk_token", (q) => q.eq("kioskToken", token))
    .unique();
  return row?.kioskToken === token ? row.orgId : null;
}

type Result =
  | { ok: true; name: string; hostName: string }
  | { ok: false; reason: "invalid" | "busy" | "code" | "details"; message?: string };

/** What the kiosk page needs to render its form. Names only: no emails, phones or ids of staff. */
export const info = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const orgId = await orgForToken(ctx, args.token);
    if (!orgId) return null;
    const { settings } = await loadSettings(ctx, orgId);
    const members = await ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(300);
    const fields = await ctx.db
      .query("customFields")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(100);
    return {
      companyName: settings.companyName,
      hosts: members.filter((m) => m.role !== "guard").map((m) => ({ id: m._id, name: m.name })),
      fields: fields.filter((f) => f.target === "visitor").map((f) => ({ key: f.key, label: f.label, required: f.required })),
    };
  },
});

export const checkIn = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    company: v.string(),
    hostId: v.optional(v.id("members")),
    hostName: v.optional(v.string()),
    purpose: v.string(),
    extraData: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args): Promise<Result> => {
    const orgId = await orgForToken(ctx, args.token);
    if (!orgId) return { ok: false, reason: "invalid" };
    if (!(await hit(ctx, orgId, "kiosk", HOUR_MS, KIOSK_HOURLY_CAP))) return { ok: false, reason: "busy" };

    let hostUserId: string | undefined;
    if (args.hostId) {
      const host = await ctx.db.get(args.hostId);
      if (!host || host.orgId !== orgId || host.role === "guard") return { ok: false, reason: "details", message: "Please choose who you're visiting." };
      hostUserId = host.userId;
    }
    try {
      const visit = await createVisit(ctx, {
        orgId,
        source: "kiosk",
        checkedInBy: "kiosk",
        name: args.name,
        company: args.company,
        purpose: args.purpose,
        hostName: args.hostName ?? "",
        hostUserId,
        extraData: args.extraData,
      });
      return { ok: true, name: args.name.trim(), hostName: visit.hostName };
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        return { ok: false, reason: "details", message: error.data };
      }
      throw error;
    }
  },
});

export const checkInWithCode = mutation({
  args: {
    token: v.string(),
    code: v.string(),
    extraData: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args): Promise<Result> => {
    const orgId = await orgForToken(ctx, args.token);
    if (!orgId) return { ok: false, reason: "invalid" };
    // Counted even when the code is wrong: this is what stops guessing.
    if (!(await hit(ctx, orgId, "kiosk", HOUR_MS, KIOSK_HOURLY_CAP))) return { ok: false, reason: "busy" };

    const code = args.code.trim().toUpperCase();
    const appt = code.length === 6
      ? await ctx.db.query("appointments").withIndex("by_org_code", (q) => q.eq("orgId", orgId).eq("checkInCode", code)).first()
      : null;
    const now = Date.now();
    if (
      !appt ||
      appt.status !== "scheduled" ||
      appt.scheduledTime < now - CODE_WINDOW_PAST_MS ||
      appt.scheduledTime > now + CODE_WINDOW_FUTURE_MS
    ) {
      return { ok: false, reason: "code" };
    }
    try {
      await createVisit(ctx, {
        orgId,
        source: "kiosk",
        checkedInBy: "kiosk",
        name: appt.visitorName,
        company: appt.visitorCompany,
        purpose: "Appointment",
        hostName: appt.hostName,
        hostUserId: appt.hostUserId,
        appointmentId: appt._id,
        extraData: args.extraData,
      });
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        return { ok: false, reason: "details", message: error.data };
      }
      throw error;
    }
    return { ok: true, name: appt.visitorName, hostName: appt.hostName };
  },
});
