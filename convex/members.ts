import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { roleValidator } from "./schema";
import {
  ADMIN,
  fail,
  orgMutation,
  orgQuery,
  readOrgClaims,
  requireIdentity,
} from "./lib/tenancy";
import { clean } from "./lib/validation";
import { normalizePhone } from "./lib/sms";
import { DEFAULT_SETTINGS } from "./lib/settings";

// `me` and `ensure` are the only functions that run before a members row
// exists, so they use the raw builders (allowlisted in tests/tenancy.test.ts).

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const org = readOrgClaims(identity);
    if (!org) return null;
    return await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", org.orgId).eq("userId", identity.subject),
      )
      .unique();
  },
});

/**
 * Called once after sign-in with an active organization. Creates the caller's
 * member row on first visit: Clerk org admins start as `admin`, everyone else
 * as `host`. The role is NEVER taken from client arguments, and an existing
 * row's role is never overwritten here. Name/email/photo are display-only.
 */
export const ensure = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    photoUrl: v.optional(v.string()),
    orgName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity, orgId, clerkOrgRole } = await requireIdentity(ctx);

    // First visit for this organization: seed its settings with the Clerk org name.
    // Only ever creates the row; later changes are admin-only (settings.update).
    const settingsRow = await ctx.db
      .query("orgSettings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();
    if (!settingsRow) {
      await ctx.db.insert("orgSettings", {
        orgId,
        companyName: clean(args.orgName, 80, "Company name"),
        utcOffsetMinutes: DEFAULT_SETTINGS.utcOffsetMinutes,
        autoCheckoutHours: DEFAULT_SETTINGS.autoCheckoutHours,
        smsHostOnArrival: DEFAULT_SETTINGS.smsHostOnArrival,
        smsVisitorCode: DEFAULT_SETTINGS.smsVisitorCode,
      });
    }
    const name = clean(args.name, 120, "Name") || "User";
    const email = clean(args.email, 200, "Email");
    // Shown to teammates as <img src>, so only accept plain https URLs.
    const photoUrl =
      args.photoUrl && args.photoUrl.length <= 500 && /^https:\/\//.test(args.photoUrl)
        ? args.photoUrl
        : undefined;
    const existing = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", orgId).eq("userId", identity.subject),
      )
      .unique();
    if (existing) {
      if (
        existing.name !== name ||
        existing.email !== email ||
        existing.photoUrl !== photoUrl
      ) {
        await ctx.db.patch(existing._id, { name, email, photoUrl });
      }
      return existing._id;
    }
    return await ctx.db.insert("members", {
      orgId,
      userId: identity.subject,
      name,
      email,
      photoUrl,
      role: clerkOrgRole?.endsWith("admin") ? "admin" : "host",
    });
  },
});

export const list = orgQuery()({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(500),
});

export const setRole = orgMutation(ADMIN)({
  args: { memberId: v.id("members"), role: roleValidator },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.memberId);
    if (!target || target.orgId !== ctx.orgId) fail("Member not found");
    if (target.role === "admin" && args.role !== "admin") {
      const admins = await ctx.db
        .query("members")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
        .filter((q) => q.eq(q.field("role"), "admin"))
        .take(2);
      if (admins.length < 2) fail("An organization needs at least one admin");
    }
    await ctx.db.patch(target._id, { role: args.role });
  },
});

/** A member sets their own mobile number (for arrival SMS); admins can set anyone's. Empty clears it. */
export const setPhone = orgMutation()({
  args: { memberId: v.id("members"), phone: v.string() },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.memberId);
    if (!target || target.orgId !== ctx.orgId) fail("Member not found");
    if (target._id !== ctx.member._id && ctx.member.role !== "admin") fail("Not allowed");
    const raw = clean(args.phone, 30, "Phone number");
    if (!raw) {
      await ctx.db.patch(target._id, { phone: undefined });
      return;
    }
    const phone = normalizePhone(raw);
    if (!phone) fail("Enter a valid phone number, e.g. 0712 345 678 or +254 712 345 678");
    await ctx.db.patch(target._id, { phone });
  },
});

/** Clerk webhook: someone was removed from the organization. Their appointments and visits keep their saved host names. */
export const removeFromOrg = internalMutation({
  args: { orgId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", args.userId))
      .unique();
    if (member) await ctx.db.delete(member._id);
    const notes = await ctx.db
      .query("notifications")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", args.userId))
      .take(500);
    for (const n of notes) await ctx.db.delete(n._id);
  },
});
