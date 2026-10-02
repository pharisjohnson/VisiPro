import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { ADMIN, fail, orgMutation, orgQuery } from "./lib/tenancy";
import { clean, required } from "./lib/validation";
import { loadSettings } from "./lib/settings";
import { smsConfigured } from "./lib/sms";

/** What every signed-in member needs (badges, UI): no secrets. */
export const get = orgQuery()({
  args: {},
  handler: async (ctx) => (await loadSettings(ctx, ctx.orgId)).settings,
});

/** Admin view: adds the kiosk secret and whether SMS is wired up on the server. */
export const getAdmin = orgQuery(ADMIN)({
  args: {},
  handler: async (ctx) => {
    const { settings, row } = await loadSettings(ctx, ctx.orgId);
    return {
      ...settings,
      kioskToken: row?.kioskToken ?? null,
      smsProviderConfigured: smsConfigured(),
    };
  },
});

export const update = orgMutation(ADMIN)({
  args: {
    companyName: v.string(),
    utcOffsetMinutes: v.number(),
    autoCheckoutHours: v.number(),
    smsHostOnArrival: v.boolean(),
    smsVisitorCode: v.boolean(),
  },
  handler: async (ctx, args) => {
    const companyName = required(clean(args.companyName, 80, "Company name"), "Company name");
    if (!Number.isInteger(args.utcOffsetMinutes) || Math.abs(args.utcOffsetMinutes) > 14 * 60) {
      fail("Invalid time zone offset");
    }
    if (!Number.isInteger(args.autoCheckoutHours) || args.autoCheckoutHours < 0 || args.autoCheckoutHours > 72) {
      fail("Auto-checkout must be between 0 and 72 hours");
    }
    const patch = {
      companyName,
      utcOffsetMinutes: args.utcOffsetMinutes,
      autoCheckoutHours: args.autoCheckoutHours,
      smsHostOnArrival: args.smsHostOnArrival,
      smsVisitorCode: args.smsVisitorCode,
    };
    const row = await ctx.db
      .query("orgSettings")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique();
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("orgSettings", { orgId: ctx.orgId, ...patch });
  },
});

export const disableKiosk = orgMutation(ADMIN)({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("orgSettings")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique();
    if (row?.kioskToken) await ctx.db.patch(row._id, { kioskToken: undefined });
  },
});

/** Called by kioskAdmin.rotateToken after it has verified the caller is an admin. */
export const setKioskToken = internalMutation({
  args: { orgId: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("orgSettings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();
    if (row) await ctx.db.patch(row._id, { kioskToken: args.token });
    else {
      await ctx.db.insert("orgSettings", {
        orgId: args.orgId,
        companyName: "",
        utcOffsetMinutes: 180,
        autoCheckoutHours: 12,
        smsHostOnArrival: true,
        smsVisitorCode: true,
        kioskToken: args.token,
      });
    }
  },
});
