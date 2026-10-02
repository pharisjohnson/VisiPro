import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { ADMIN, orgQuery } from "./lib/tenancy";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 30_000, 5 * 60_000];

/**
 * Delivers one queued SMS through Africa's Talking. Server env:
 *   AT_USERNAME, AT_API_KEY   (required)
 *   AT_SENDER_ID              (optional approved sender id)
 *   AT_SANDBOX=true           (use the sandbox API)
 */
export const deliver = internalAction({
  args: { id: v.id("smsOutbox") },
  handler: async (ctx, args): Promise<void> => {
    const row = await ctx.runQuery(internal.sms.getQueued, { id: args.id });
    if (!row) return; // already sent/failed, or gone

    const username = process.env.AT_USERNAME;
    const apiKey = process.env.AT_API_KEY;
    if (!username || !apiKey) {
      await ctx.runMutation(internal.sms.finish, { id: args.id, ok: false, retry: false, error: "SMS provider is not configured" });
      return;
    }

    const base = process.env.AT_SANDBOX === "true" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
    const body = new URLSearchParams({ username, to: row.to, message: row.message });
    if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);

    try {
      const res = await fetch(`${base}/version1/messaging`, {
        method: "POST",
        headers: { apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        // 5xx / 429 are worth retrying; other 4xx (bad credentials, bad request) are not.
        const retry = res.status >= 500 || res.status === 429;
        await ctx.runMutation(internal.sms.finish, { id: args.id, ok: false, retry, error: `Provider returned HTTP ${res.status}` });
        return;
      }
      const data = (await res.json()) as {
        SMSMessageData?: { Message?: string; Recipients?: { statusCode?: number; status?: string }[] };
      };
      const recipient = data.SMSMessageData?.Recipients?.[0];
      // 100 Processed, 101 Sent, 102 Queued are accepted; anything else is a delivery failure.
      if (recipient && recipient.statusCode !== undefined && recipient.statusCode >= 100 && recipient.statusCode <= 102) {
        await ctx.runMutation(internal.sms.finish, { id: args.id, ok: true, retry: false });
      } else {
        const reason = recipient?.status ?? data.SMSMessageData?.Message ?? "Rejected by provider";
        await ctx.runMutation(internal.sms.finish, { id: args.id, ok: false, retry: false, error: reason.slice(0, 200) });
      }
    } catch {
      // Network failure: transient.
      await ctx.runMutation(internal.sms.finish, { id: args.id, ok: false, retry: true, error: "Network error contacting provider" });
    }
  },
});

export const getQueued = internalQuery({
  args: { id: v.id("smsOutbox") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    return row && row.status === "queued" ? row : null;
  },
});

export const finish = internalMutation({
  args: { id: v.id("smsOutbox"), ok: v.boolean(), retry: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "queued") return;
    const attempts = row.attempts + 1;
    if (args.ok) {
      await ctx.db.patch(row._id, { status: "sent", attempts, error: undefined });
    } else if (args.retry && attempts < MAX_ATTEMPTS) {
      await ctx.db.patch(row._id, { attempts, error: args.error });
      await ctx.scheduler.runAfter(BACKOFF_MS[attempts] ?? 5 * 60_000, internal.sms.deliver, { id: row._id });
    } else {
      await ctx.db.patch(row._id, { status: "failed", attempts, error: args.error });
    }
  },
});

/** Admin: the latest messages and whether they went out. Numbers are masked. */
export const recent = orgQuery(ADMIN)({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("smsOutbox")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .order("desc")
      .take(30);
    return rows.map((r) => ({
      id: r._id,
      sentAt: r._creationTime,
      to: `${r.to.slice(0, 5)}••••${r.to.slice(-3)}`,
      kind: r.kind,
      status: r.status,
      error: r.error,
    }));
  },
});
