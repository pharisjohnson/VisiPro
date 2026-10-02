/**
 * Tenant isolation lives here and ONLY here.
 *
 * Convex has no row-level security, so isolation is enforced in code. Every
 * public function (except the bootstrap pair in members.ts) must be built with
 * `orgQuery(roles?)` or `orgMutation(roles?)`. These:
 *   1. require a signed-in user with an active Clerk organization,
 *   2. take the org id from the verified JWT (never from client arguments),
 *   3. require a `members` row for that org and check its role,
 *   4. hand the handler `ctx.orgId` and `ctx.member`.
 * Handlers must scope every db access with `ctx.orgId`. tests/tenancy.test.ts
 * fails if any other file uses the raw `query`/`mutation` builders.
 */
import { ConvexError } from "convex/values";
import type { UserIdentity } from "convex/server";
import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export type Role = "admin" | "guard" | "host";

export function fail(message: string): never {
  throw new ConvexError(message);
}

/**
 * Reads the active organization from the Clerk-issued JWT. Clerk exposes it as
 * `org_id`/`org_role` when the JWT template includes them, or as the compact
 * `o: { id, rol }` claim in session token v2. Both are signed by Clerk.
 */
export function readOrgClaims(
  identity: UserIdentity,
): { orgId: string; clerkOrgRole: string | undefined } | null {
  const claims = identity as unknown as Record<string, unknown>;
  const compact = claims.o as { id?: string; rol?: string } | undefined;
  const orgId = (claims.org_id as string | undefined) ?? compact?.id;
  if (!orgId) return null;
  const clerkOrgRole = (claims.org_role as string | undefined) ?? compact?.rol;
  return { orgId, clerkOrgRole };
}

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("Not signed in");
  const org = readOrgClaims(identity);
  if (!org) fail("No active organization");
  return { identity, ...org };
}

async function requireMember(
  ctx: QueryCtx | MutationCtx,
  roles: readonly Role[] | undefined,
): Promise<Doc<"members">> {
  const { identity, orgId } = await requireIdentity(ctx);
  const member = await ctx.db
    .query("members")
    .withIndex("by_org_user", (q) =>
      q.eq("orgId", orgId).eq("userId", identity.subject),
    )
    .unique();
  if (!member) fail("Not a member of this organization");
  if (roles && !roles.includes(member.role)) fail("Not allowed");
  return member;
}

const orgCtx = (roles?: readonly Role[]) =>
  customCtx(async (ctx: QueryCtx | MutationCtx) => {
    const member = await requireMember(ctx, roles);
    return { member, orgId: member.orgId };
  });

/** A query restricted to `roles` (any role when omitted), pinned to the caller's org. */
export const orgQuery = (roles?: readonly Role[]) =>
  customQuery(query, orgCtx(roles));

/** A mutation restricted to `roles` (any role when omitted), pinned to the caller's org. */
export const orgMutation = (roles?: readonly Role[]) =>
  customMutation(mutation, orgCtx(roles));

export const STAFF: readonly Role[] = ["admin", "guard"];
export const ADMIN: readonly Role[] = ["admin"];

export async function notify(
  ctx: MutationCtx,
  orgId: string,
  userIds: string[],
  message: string,
) {
  for (const userId of new Set(userIds)) {
    await ctx.db.insert("notifications", { orgId, userId, message, read: false });
  }
}
