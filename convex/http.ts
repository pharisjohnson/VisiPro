import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifySvix } from "./lib/svix";

/**
 * Clerk webhook (Clerk dashboard > Webhooks > add endpoint
 * https://<deployment>.convex.site/clerk-webhook, subscribe to
 * `organizationMembership.deleted`, then set CLERK_WEBHOOK_SECRET).
 * Removing someone from the organization in Clerk drops their member row here.
 * Without it they lose access immediately anyway (their token no longer carries
 * the org) but would linger in the Team list.
 */
const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) return new Response("Webhook not configured", { status: 503 });

    const body = await request.text();
    const ok = await verifySvix(
      secret,
      {
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signature: request.headers.get("svix-signature"),
      },
      body,
    );
    if (!ok) return new Response("Invalid signature", { status: 401 });

    let event: { type?: string; data?: { organization?: { id?: string }; public_user_data?: { user_id?: string } } };
    try {
      event = JSON.parse(body);
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    if (event.type === "organizationMembership.deleted") {
      const orgId = event.data?.organization?.id;
      const userId = event.data?.public_user_data?.user_id;
      if (orgId && userId) {
        await ctx.runMutation(internal.members.removeFromOrg, { orgId, userId });
      }
    }
    return new Response(null, { status: 200 });
  }),
});

export default http;
