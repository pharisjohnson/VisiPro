import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { api } from "../convex/_generated/api";
import { setup, signIn } from "./helpers";

const visitor = (extra: Record<string, string> = {}) => ({
  name: "Alice",
  company: "Acme",
  hostName: "Someone",
  purpose: "Meeting",
  extraData: extra,
});

describe("authentication", () => {
  test("anonymous callers are rejected", async () => {
    const t = setup();
    await expect(t.query(api.visitors.onPremise, {})).rejects.toThrow("Not signed in");
  });

  test("a signed-in user with no active organization is rejected", async () => {
    const t = setup();
    const asUser = t.withIdentity({ subject: "u1" });
    await expect(asUser.query(api.visitors.onPremise, {})).rejects.toThrow("No active organization");
  });

  test("a user with an org but no member row is rejected until ensure runs", async () => {
    const t = setup();
    const asUser = t.withIdentity({ subject: "u1", org_id: "orgA", org_role: "org:admin" });
    await expect(asUser.query(api.visitors.onPremise, {})).rejects.toThrow("Not a member");
  });

  test("the compact session-token claim (o.id / o.rol) is understood too", async () => {
    const t = setup();
    const asUser = t.withIdentity({ subject: "u1", o: { id: "orgA", rol: "admin" } });
    await asUser.mutation(api.members.ensure, { name: "U", email: "u@x.com" });
    const me = await asUser.query(api.members.me, {});
    expect(me?.orgId).toBe("orgA");
    expect(me?.role).toBe("admin");
  });
});

describe("member bootstrap", () => {
  test("Clerk org admins become admins, other members become hosts", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "u1", { clerkRole: "org:admin" });
    const other = await signIn(t, "orgA", "u2");
    expect((await admin.query(api.members.me, {}))?.role).toBe("admin");
    expect((await other.query(api.members.me, {}))?.role).toBe("host");
  });

  test("ensure never overwrites an existing role", async () => {
    const t = setup();
    const u = await signIn(t, "orgA", "u1", { clerkRole: "org:admin", role: "guard" });
    await u.mutation(api.members.ensure, { name: "New Name", email: "n@x.com" });
    const me = await u.query(api.members.me, {});
    expect(me?.role).toBe("guard");
    expect(me?.name).toBe("New Name");
  });

  test("only plain https photo URLs are stored", async () => {
    const t = setup();
    const u = await signIn(t, "orgA", "u1");
    for (const bad of ["javascript:alert(1)", "http://x.com/a.png", "data:image/png;base64,AAAA", "https://x.com/" + "a".repeat(600)]) {
      await u.mutation(api.members.ensure, { name: "U", email: "u@x.com", photoUrl: bad });
      expect((await u.query(api.members.me, {}))?.photoUrl).toBeUndefined();
    }
    await u.mutation(api.members.ensure, { name: "U", email: "u@x.com", photoUrl: "https://img.clerk.com/a.png" });
    expect((await u.query(api.members.me, {}))?.photoUrl).toBe("https://img.clerk.com/a.png");
  });

  test("an organization cannot lose its last admin", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "u1", { role: "admin" });
    const me = await admin.query(api.members.me, {});
    await expect(
      admin.mutation(api.members.setRole, { memberId: me!._id, role: "guard" }),
    ).rejects.toThrow("at least one admin");
  });
});

describe("tenant isolation", () => {
  test("org B can't see, check out, or reference org A's data", async () => {
    const t = setup();
    const a = await signIn(t, "orgA", "a-admin", { role: "admin" });
    const b = await signIn(t, "orgB", "b-admin", { role: "admin" });

    const visitorId = await a.mutation(api.visitors.checkIn, visitor());
    const { id: apptId } = await a.mutation(api.appointments.create, {
      visitorName: "Bob", visitorCompany: "", hostName: "H", scheduledTime: Date.now() + 1000,
    });
    await a.mutation(api.announcements.post, { title: "Hi", content: "A only" });
    await a.mutation(api.customFields.add, { label: "Plate", target: "visitor", required: false });
    await a.mutation(api.employees.checkIn, { name: "Emp", extraData: {} });

    expect(await b.query(api.visitors.log, {})).toEqual([]);
    expect(await b.query(api.visitors.onPremise, {})).toEqual([]);
    expect(await b.query(api.visitors.since, { since: 0 })).toEqual([]);
    expect(await b.query(api.appointments.list, {})).toEqual([]);
    expect(await b.query(api.announcements.list, {})).toEqual([]);
    expect(await b.query(api.customFields.list, {})).toEqual([]);
    expect(await b.query(api.employees.list, {})).toEqual([]);
    expect((await b.query(api.members.list, {})).map((m) => m.userId)).toEqual(["b-admin"]);

    await expect(b.mutation(api.visitors.checkOut, { id: visitorId })).rejects.toThrow("not found");
    await expect(
      b.mutation(api.visitors.checkIn, { ...visitor(), appointmentId: apptId }),
    ).rejects.toThrow("Appointment not found");
    await expect(b.mutation(api.appointments.cancel, { id: apptId })).rejects.toThrow("not found");

    // A host id from another org is not trusted.
    await expect(
      b.mutation(api.visitors.checkIn, { ...visitor(), hostUserId: "a-admin" }),
    ).rejects.toThrow("Host not found");

    // Org A is untouched.
    const still = await a.query(api.visitors.log, {});
    expect(still).toHaveLength(1);
    expect(still[0].status).toBe("in");
  });

  test("a member's org comes from their token, so switching org switches data", async () => {
    const t = setup();
    const aAsA = await signIn(t, "orgA", "shared-user", { role: "admin" });
    await aAsA.mutation(api.visitors.checkIn, visitor());
    // Same person, now acting in org B: they have no membership there yet.
    const inB = t.withIdentity({ subject: "shared-user", org_id: "orgB", org_role: "org:member" });
    await expect(inB.query(api.visitors.log, {})).rejects.toThrow("Not a member");
  });
});

describe("role enforcement", () => {
  test("hosts can't use staff or admin functions", async () => {
    const t = setup();
    const host = await signIn(t, "orgA", "h1", { role: "host" });
    await expect(host.query(api.visitors.log, {})).rejects.toThrow("Not allowed");
    await expect(host.mutation(api.visitors.checkIn, visitor())).rejects.toThrow("Not allowed");
    await expect(host.query(api.employees.list, {})).rejects.toThrow("Not allowed");
    await expect(
      host.mutation(api.customFields.add, { label: "X", target: "visitor", required: false }),
    ).rejects.toThrow("Not allowed");
    await expect(
      host.mutation(api.announcements.post, { title: "t", content: "c" }),
    ).rejects.toThrow("Not allowed");
  });

  test("guards can check people in but not administer", async () => {
    const t = setup();
    const guard = await signIn(t, "orgA", "g1", { role: "guard" });
    await guard.mutation(api.visitors.checkIn, visitor());
    await expect(
      guard.mutation(api.customFields.add, { label: "X", target: "visitor", required: false }),
    ).rejects.toThrow("Not allowed");
    const me = await guard.query(api.members.me, {});
    await expect(
      guard.mutation(api.members.setRole, { memberId: me!._id, role: "admin" }),
    ).rejects.toThrow("Not allowed");
  });

  test("the AI context query is admin-only", async () => {
    const t = setup();
    const guard = await signIn(t, "orgA", "g1", { role: "guard" });
    await expect(guard.query(api.aiContext.get, { dayStart: 0, dayEnd: 1 })).rejects.toThrow("Not allowed");
  });

  test("hosts only see and check out their own visitors", async () => {
    const t = setup();
    const guard = await signIn(t, "orgA", "g1", { role: "guard" });
    const h1 = await signIn(t, "orgA", "h1", { role: "host", name: "Hana Host" });
    const h2 = await signIn(t, "orgA", "h2", { role: "host", name: "Hugo Host" });

    const v1 = await guard.mutation(api.visitors.checkIn, { ...visitor(), hostName: "x", hostUserId: "h1" });
    const v2 = await guard.mutation(api.visitors.checkIn, { ...visitor(), hostName: "x", hostUserId: "h2" });

    expect((await h1.query(api.visitors.onPremise, {})).map((v) => v._id)).toEqual([v1]);
    expect((await h2.query(api.visitors.onPremise, {})).map((v) => v._id)).toEqual([v2]);
    expect(await guard.query(api.visitors.onPremise, {})).toHaveLength(2);

    await expect(h1.mutation(api.visitors.checkOut, { id: v2 })).rejects.toThrow("Not allowed");
    await h1.mutation(api.visitors.checkOut, { id: v1 });
    expect(await h1.query(api.visitors.onPremise, {})).toEqual([]);
  });

  test("a host is notified when their visitor arrives", async () => {
    const t = setup();
    const guard = await signIn(t, "orgA", "g1", { role: "guard" });
    const host = await signIn(t, "orgA", "h1", { role: "host", name: "Hana Host" });
    await guard.mutation(api.visitors.checkIn, { ...visitor(), hostName: "x", hostUserId: "h1" });
    const notes = await host.query(api.notifications.mine, {});
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain("Alice");
    expect(await guard.query(api.notifications.mine, {})).toEqual([]);
  });
});

describe("validation", () => {
  test("required custom fields are enforced server-side and unknown keys are dropped", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    await admin.mutation(api.customFields.add, { label: "National ID", target: "visitor", required: true });
    await expect(admin.mutation(api.visitors.checkIn, visitor())).rejects.toThrow("National ID is required");
    const id = await admin.mutation(api.visitors.checkIn, visitor({ national_id: " 123 ", junk: "x" }));
    const row = (await admin.query(api.visitors.log, {})).find((v) => v._id === id);
    expect(row?.extraData).toEqual({ national_id: "123" });
  });

  test("duplicate custom fields are rejected", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    await admin.mutation(api.customFields.add, { label: "Vehicle Plate", target: "visitor", required: false });
    await expect(
      admin.mutation(api.customFields.add, { label: "vehicle plate", target: "visitor", required: false }),
    ).rejects.toThrow("already exists");
  });

  test("blank names and over-long text are rejected", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    await expect(admin.mutation(api.visitors.checkIn, { ...visitor(), name: "   " })).rejects.toThrow("required");
    await expect(admin.mutation(api.visitors.checkIn, { ...visitor(), name: "x".repeat(500) })).rejects.toThrow("too long");
  });

  test("checking out twice is harmless", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    const id = await admin.mutation(api.visitors.checkIn, visitor());
    await admin.mutation(api.visitors.checkOut, { id });
    const first = (await admin.query(api.visitors.log, {}))[0].checkOutTime;
    await admin.mutation(api.visitors.checkOut, { id });
    expect((await admin.query(api.visitors.log, {}))[0].checkOutTime).toBe(first);
  });
});

describe("appointments", () => {
  test("codes are 6 unambiguous characters and single-use", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    const { id, checkInCode } = await admin.mutation(api.appointments.create, {
      visitorName: "Bob", visitorCompany: "", hostName: "H", scheduledTime: Date.now() + 60_000,
    });
    expect(checkInCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    await admin.mutation(api.visitors.checkIn, { ...visitor(), appointmentId: id });
    await expect(
      admin.mutation(api.visitors.checkIn, { ...visitor(), appointmentId: id }),
    ).rejects.toThrow("already used");
    expect(await admin.query(api.appointments.expected, { from: 0, to: Date.now() + 1e9 })).toEqual([]);
  });

  test("hosts can only book for themselves, and admins are told", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    const host = await signIn(t, "orgA", "h1", { role: "host", name: "Hana Host" });
    await host.mutation(api.appointments.create, {
      visitorName: "Bob", visitorCompany: "", hostName: "Somebody Else", hostUserId: "a1",
      scheduledTime: Date.now() + 60_000,
    });
    const mine = await host.query(api.appointments.list, {});
    expect(mine).toHaveLength(1);
    expect(mine[0].hostUserId).toBe("h1");
    expect(mine[0].hostName).toBe("Hana Host");
    const adminNotes = await admin.query(api.notifications.mine, {});
    expect(adminNotes.some((n) => n.message.includes("Hana Host"))).toBe(true);
  });

  test("a host can't see another host's appointments", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    const h1 = await signIn(t, "orgA", "h1", { role: "host" });
    await signIn(t, "orgA", "h2", { role: "host" });
    await admin.mutation(api.appointments.create, {
      visitorName: "Bob", visitorCompany: "", hostName: "x", hostUserId: "h2", scheduledTime: Date.now() + 60_000,
    });
    expect(await h1.query(api.appointments.list, {})).toEqual([]);
  });
});

describe("guard rail: the tenancy wrapper can't be bypassed", () => {
  // Raw `query`/`mutation`/`action` builders skip the org + role check. Only
  // these files may use them.
  const ALLOWED = new Set(["members.ts", "ai.ts", path.join("lib", "tenancy.ts")]);

  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "_generated" ? [] : walk(p);
      return p.endsWith(".ts") ? [p] : [];
    });

  test("no convex module imports raw builders outside the allowlist", () => {
    const root = path.resolve(__dirname, "../convex");
    const offenders = walk(root)
      .filter((f) => !ALLOWED.has(path.relative(root, f)))
      .filter((f) => {
        const src = fs.readFileSync(f, "utf8");
        return /import\s*\{[^}]*\b(query|mutation|action|internalQuery|internalMutation|internalAction|httpAction)\b[^}]*\}\s*from\s*["'](\.\.?\/)+(_generated\/server|convex\/server)["']/.test(src);
      })
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });

  test("the AI action asserts admin access through the org-pinned context query", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../convex/ai.ts"), "utf8");
    expect(src).toContain("api.aiContext.get");
  });
});
