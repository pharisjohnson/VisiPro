import { convexTest } from "convex-test";
import schema from "../convex/schema";

// "use node" actions can't run in convex-test; the AI action is exercised separately.
const modules = import.meta.glob(["../convex/**/*.*s", "!../convex/ai.ts"]);

export const setup = () => convexTest(schema, modules);
export type T = ReturnType<typeof setup>;

type AppRole = "admin" | "guard" | "host";

/**
 * Signs in as a user of an org the way Clerk's JWT would present them, runs the
 * `ensure` bootstrap, then (optionally) sets the in-app role directly.
 */
export async function signIn(
  t: T,
  orgId: string,
  userId: string,
  opts: { clerkRole?: string; role?: AppRole; name?: string } = {},
) {
  const { api } = await import("../convex/_generated/api");
  const asUser = t.withIdentity({
    subject: userId,
    org_id: orgId,
    org_role: opts.clerkRole ?? "org:member",
  });
  const memberId = await asUser.mutation(api.members.ensure, {
    name: opts.name ?? userId,
    email: `${userId}@example.com`,
  });
  if (opts.role) {
    await t.run(async (ctx) => {
      await ctx.db.patch(memberId, { role: opts.role });
    });
  }
  return asUser;
}
