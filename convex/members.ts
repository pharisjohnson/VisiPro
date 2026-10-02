import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
  },
  handler: async (ctx, args) => {
    const { identity, orgId, clerkOrgRole } = await requireIdentity(ctx);
    const name = clean(args.name, 120, "Name") || "User";
    const email = clean(args.email, 200, "Email");
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
        existing.photoUrl !== args.photoUrl
      ) {
        await ctx.db.patch(existing._id, { name, email, photoUrl: args.photoUrl });
      }
      return existing._id;
    }
    return await ctx.db.insert("members", {
      orgId,
      userId: identity.subject,
      name,
      email,
      photoUrl: args.photoUrl,
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
