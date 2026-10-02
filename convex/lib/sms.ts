import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { DAY_MS, hit } from "./rateLimit";

/** Max SMS an organization can trigger per day. SMS costs real money, so this bounds abuse and mistakes. */
export const SMS_DAILY_CAP = 100;

export const smsConfigured = () => !!process.env.AT_USERNAME && !!process.env.AT_API_KEY;

/**
 * Normalizes a phone number to E.164. Local numbers (0712..., 712...) get the
 * default country code (Kenya, 254). Returns null if it can't be a valid number.
 */
export function normalizePhone(input: string, defaultCountryCode = "254"): string | null {
  const raw = input.trim().replace(/[\s().-]/g, "");
  let digits: string;
  if (raw.startsWith("+")) digits = raw.slice(1);
  else if (raw.startsWith("00")) digits = raw.slice(2);
  else if (raw.startsWith("0")) digits = defaultCountryCode + raw.slice(1);
  else if (raw.length === 9) digits = defaultCountryCode + raw; // 712345678
  else digits = raw;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

/**
 * Visitors type their own names, and those land in an SMS to someone else.
 * Strip control characters and links so a "name" can't smuggle in a phishing
 * URL or break the message layout.
 */
export function sanitizeForSms(text: string, max: number): string {
  const cleaned = text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[link]")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Thu 2 Oct, 14:30" in the org's fixed UTC offset (the runtime has no tz database). */
export function formatLocal(ms: number, utcOffsetMinutes: number): string {
  const d = new Date(ms + utcOffsetMinutes * 60_000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm}`;
}

/**
 * Queues an SMS and schedules its delivery. Returns false (and sends nothing)
 * if the provider isn't configured or the org hit its daily cap.
 */
export async function enqueueSms(
  ctx: MutationCtx,
  orgId: string,
  sms: { to: string; message: string; kind: "host_arrival" | "visitor_code" },
): Promise<boolean> {
  if (!smsConfigured()) return false;
  if (!(await hit(ctx, orgId, "sms-day", DAY_MS, SMS_DAILY_CAP))) {
    console.warn(`SMS daily cap reached for org ${orgId}`);
    return false;
  }
  const id = await ctx.db.insert("smsOutbox", {
    orgId,
    to: sms.to,
    message: sms.message,
    kind: sms.kind,
    status: "queued",
    attempts: 0,
  });
  await ctx.scheduler.runAfter(0, internal.sms.deliver, { id });
  return true;
}
