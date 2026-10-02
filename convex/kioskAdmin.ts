import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { readOrgClaims } from "./lib/tenancy";

/**
 * Creates (or rotates) the secret in the public self-check-in link. This is an
 * action so the token comes from real cryptographic randomness: queries and
 * mutations run on a seeded, replayable RNG, which isn't fit for secrets.
 * Rotating invalidates the old link and QR immediately.
 */
export const rotateToken = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    // Throws unless the caller is a signed-in admin of their active organization.
    await ctx.runQuery(api.settings.getAdmin, {});
    const identity = await ctx.auth.getUserIdentity();
    const org = identity && readOrgClaims(identity);
    if (!org) throw new Error("No active organization");

    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await ctx.runMutation(internal.settings.setKioskToken, { orgId: org.orgId, token });
    return token;
  },
});
