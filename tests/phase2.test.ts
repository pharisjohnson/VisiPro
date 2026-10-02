import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { formatLocal, normalizePhone, sanitizeForSms } from "../convex/lib/sms";
import { verifySvix } from "../convex/lib/svix";
import { setup, signIn } from "./helpers";
import type { T } from "./helpers";

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AT_USERNAME = "sandbox";
  process.env.AT_API_KEY = "test-key";
  delete process.env.AT_SANDBOX;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.AT_USERNAME;
  delete process.env.AT_API_KEY;
  delete process.env.CLERK_WEBHOOK_SECRET;
});

const visitor = (o: Record<string, unknown> = {}) => ({
  name: "Alice", company: "Acme", hostName: "x", purpose: "Meeting", extraData: {}, ...o,
});

async function outbox(t: T) {
  return await t.run(async (ctx) => await ctx.db.query("smsOutbox").collect());
}
async function setHostPhone(t: T, userId: string, phone: string) {
  await t.run(async (ctx) => {
    const m = await ctx.db.query("members").filter((q) => q.eq(q.field("userId"), userId)).unique();
    await ctx.db.patch(m!._id, { phone });
  });
}
const okFetch = (statusCode = 101) =>
  vi.fn(async () => new Response(JSON.stringify({ SMSMessageData: { Recipients: [{ statusCode, status: statusCode === 101 ? "Success" : "InvalidPhoneNumber" }] } }), { status: 201 }));

describe("phone and SMS text helpers", () => {
  test("normalizePhone handles Kenyan local formats and international numbers", () => {
    expect(normalizePhone("0712 345 678")).toBe("+254712345678");
    expect(normalizePhone("+254 712-345-678")).toBe("+254712345678");
    expect(normalizePhone("254712345678")).toBe("+254712345678");
    expect(normalizePhone("712345678")).toBe("+254712345678");
    expect(normalizePhone("0110123456")).toBe("+254110123456");
    expect(normalizePhone("+1 (415) 555-2671")).toBe("+14155552671");
    expect(normalizePhone("00256 772 123456")).toBe("+256772123456");
  });
  test("normalizePhone rejects junk", () => {
    for (const bad of ["", "abc", "0712", "+0123456789", "12", "+254 7123 45678 9012 3456"]) {
      expect(normalizePhone(bad)).toBeNull();
    }
  });
  test("sanitizeForSms strips links, control characters and truncates", () => {
    expect(sanitizeForSms("Pay now at http://evil.com/x ok", 80)).toBe("Pay now at [link] ok");
    expect(sanitizeForSms("visit www.evil.com", 80)).toBe("visit [link]");
    expect(sanitizeForSms("a\nb\r\nc\u0000d", 80)).toBe("a b c d");
    expect(sanitizeForSms("x".repeat(100), 10)).toBe("xxxxxxxxx…");
  });
  test("formatLocal applies the org's fixed UTC offset", () => {
    // 2026-10-02T11:30Z is 14:30 in UTC+3 (a Friday)
    expect(formatLocal(Date.UTC(2026, 9, 2, 11, 30), 180)).toBe("Fri 2 Oct, 14:30");
    expect(formatLocal(Date.UTC(2026, 9, 2, 23, 0), 180)).toBe("Sat 3 Oct, 02:00");
  });
});

describe("SMS: arrival alerts to hosts", () => {
  async function world() {
    const t = setup();
    const guard = await signIn(t, "orgA", "g1", { role: "guard" });
    const host = await signIn(t, "orgA", "h1", { role: "host", name: "Hana Host" });
    await setHostPhone(t, "h1", "+254712345678");
    await t.run(async (ctx) => {
      const row = await ctx.db.query("orgSettings").first();
      await ctx.db.patch(row!._id, { companyName: "Acme Ltd" });
    });
    return { t, guard, host };
  }

  test("a check-in queues one SMS to the host and delivery marks it sent", async () => {
    const { t, guard } = await world();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h1" }));
    const queued = await outbox(t);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ to: "+254712345678", kind: "host_arrival", status: "queued", orgId: "orgA" });
    expect(queued[0].message).toBe("Alice (Acme) has arrived at Acme Ltd to see you.");

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await outbox(t))[0].status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.africastalking.com/version1/messaging");
    expect((init.headers as Record<string, string>).apiKey).toBe("test-key");
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(body.get("username")).toBe("sandbox");
    expect(body.get("to")).toBe("+254712345678");
  });

  test("the sandbox API is used when AT_SANDBOX=true", async () => {
    const { t, guard } = await world();
    process.env.AT_SANDBOX = "true";
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h1" }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://api.sandbox.africastalking.com/version1/messaging");
  });

  test("visitor-typed text can't smuggle links into the host's SMS", async () => {
    const { t, guard } = await world();
    await guard.mutation(api.visitors.checkIn, visitor({ name: "Pay https://evil.example/x now", hostUserId: "h1" }));
    expect((await outbox(t))[0].message).not.toContain("evil.example");
    expect((await outbox(t))[0].message).toContain("[link]");
  });

  test("no SMS without a host phone, with the setting off, or without provider credentials", async () => {
    const { t, guard } = await world();
    await signIn(t, "orgA", "h2", { role: "host" }); // no phone
    await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h2" }));
    expect(await outbox(t)).toHaveLength(0);

    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    const s = await admin.query(api.settings.get, {});
    await admin.mutation(api.settings.update, { ...s, smsHostOnArrival: false });
    await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h1" }));
    expect(await outbox(t)).toHaveLength(0);

    await admin.mutation(api.settings.update, { ...s, smsHostOnArrival: true });
    delete process.env.AT_API_KEY;
    await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h1" }));
    expect(await outbox(t)).toHaveLength(0);
  });

  test("a provider rejection marks the message failed without retrying", async () => {
    const { t, guard } = await world();
    const fetchMock = okFetch(403);
    vi.stubGlobal("fetch", fetchMock);
    await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h1" }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [row] = await outbox(t);
    expect(row.status).toBe("failed");
    expect(row.error).toBe("InvalidPhoneNumber");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("network errors are retried with backoff and then succeed", async () => {
    const { t, guard } = await world();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockImplementation(okFetch());
    vi.stubGlobal("fetch", fetchMock);
    await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h1" }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [row] = await outbox(t);
    expect(row.status).toBe("sent");
    expect(row.attempts).toBe(2);
  });

  test("gives up after three failed attempts", async () => {
    const { t, guard } = await world();
    const fetchMock = vi.fn().mockRejectedValue(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h1" }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((await outbox(t))[0].status).toBe("failed");
  });

  test("the daily cap stops runaway sending", async () => {
    const { t, guard } = await world();
    vi.stubGlobal("fetch", okFetch());
    for (let i = 0; i < 103; i++) await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h1" }));
    expect(await outbox(t)).toHaveLength(100);
  });

  test("admins see recent messages with masked numbers; others can't", async () => {
    const { t, guard } = await world();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h1" }));
    const recent = await admin.query(api.sms.recent, {});
    expect(recent).toHaveLength(1);
    expect(recent[0].to).toBe("+2547••••678");
    await expect(guard.query(api.sms.recent, {})).rejects.toThrow("Not allowed");
    const other = await signIn(t, "orgB", "b1", { role: "admin" });
    expect(await other.query(api.sms.recent, {})).toEqual([]);
  });
});

describe("SMS: appointment codes to visitors", () => {
  test("texts the visitor their code with the local time, and rejects bad numbers", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin", name: "Ann Admin" });
    const when = Date.UTC(2026, 9, 2, 11, 30);
    const { checkInCode } = await admin.mutation(api.appointments.create, {
      visitorName: "Bob Builder", visitorCompany: "", hostName: "Ann Admin", scheduledTime: when, visitorPhone: "0722 000 111",
    });
    const [row] = await outbox(t);
    expect(row.to).toBe("+254722000111");
    expect(row.kind).toBe("visitor_code");
    expect(row.message).toContain("Hi Bob");
    expect(row.message).toContain("Fri 2 Oct, 14:30");
    expect(row.message).toContain(`Check-in code: ${checkInCode}`);

    await expect(
      admin.mutation(api.appointments.create, { visitorName: "X", visitorCompany: "", hostName: "H", scheduledTime: when, visitorPhone: "nope" }),
    ).rejects.toThrow("valid phone number");
  });

  test("no phone, no SMS", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    await admin.mutation(api.appointments.create, { visitorName: "X", visitorCompany: "", hostName: "H", scheduledTime: Date.now() + HOUR });
    expect(await outbox(t)).toHaveLength(0);
  });
});

describe("member phone numbers", () => {
  test("self-service, admin override, validation and isolation", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    const h1 = await signIn(t, "orgA", "h1", { role: "host" });
    const h2 = await signIn(t, "orgA", "h2", { role: "host" });
    const other = await signIn(t, "orgB", "b1", { role: "admin" });
    const id = async (u: typeof h1) => (await u.query(api.members.me, {}))!._id;

    await h1.mutation(api.members.setPhone, { memberId: await id(h1), phone: "0712 345 678" });
    expect((await h1.query(api.members.me, {}))?.phone).toBe("+254712345678");

    await expect(h1.mutation(api.members.setPhone, { memberId: await id(h2), phone: "0700000000" })).rejects.toThrow("Not allowed");
    await admin.mutation(api.members.setPhone, { memberId: await id(h2), phone: "0733 111 222" });
    expect((await h2.query(api.members.me, {}))?.phone).toBe("+254733111222");

    await expect(h1.mutation(api.members.setPhone, { memberId: await id(h1), phone: "abc" })).rejects.toThrow("valid phone number");
    await expect(other.mutation(api.members.setPhone, { memberId: await id(h1), phone: "0712345678" })).rejects.toThrow("not found");

    await h1.mutation(api.members.setPhone, { memberId: await id(h1), phone: "" });
    expect((await h1.query(api.members.me, {}))?.phone).toBeUndefined();
  });
});

describe("org settings", () => {
  test("seeded from the Clerk org name once, then admin-only", async () => {
    const t = setup();
    const { api: a } = { api };
    const u = t.withIdentity({ subject: "u1", org_id: "orgA", org_role: "org:admin" });
    await u.mutation(a.members.ensure, { name: "U", email: "u@x.com", orgName: "Acme Ltd" });
    await u.mutation(a.members.ensure, { name: "U", email: "u@x.com", orgName: "Hijacked" });
    const admin = await signIn(t, "orgA", "u1", { role: "admin" });
    expect((await admin.query(a.settings.get, {})).companyName).toBe("Acme Ltd");

    const guard = await signIn(t, "orgA", "g1", { role: "guard" });
    expect(await guard.query(a.settings.get, {})).not.toHaveProperty("kioskToken");
    await expect(guard.query(a.settings.getAdmin, {})).rejects.toThrow("Not allowed");
    const s = await admin.query(a.settings.get, {});
    await expect(guard.mutation(a.settings.update, s)).rejects.toThrow("Not allowed");
  });

  test("validates ranges and trims", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    const s = await admin.query(api.settings.get, {});
    await expect(admin.mutation(api.settings.update, { ...s, companyName: "  " })).rejects.toThrow("required");
    await expect(admin.mutation(api.settings.update, { ...s, companyName: "A", autoCheckoutHours: 100 })).rejects.toThrow("between 0 and 72");
    await expect(admin.mutation(api.settings.update, { ...s, companyName: "A", autoCheckoutHours: 1.5 })).rejects.toThrow("between 0 and 72");
    await expect(admin.mutation(api.settings.update, { ...s, companyName: "A", utcOffsetMinutes: 24 * 60 })).rejects.toThrow("time zone");
    await admin.mutation(api.settings.update, { ...s, companyName: "  Acme  ", autoCheckoutHours: 6 });
    const after = await admin.query(api.settings.get, {});
    expect(after.companyName).toBe("Acme");
    expect(after.autoCheckoutHours).toBe(6);
  });

  test("settings are per organization", async () => {
    const t = setup();
    const a = await signIn(t, "orgA", "a1", { role: "admin" });
    const b = await signIn(t, "orgB", "b1", { role: "admin" });
    const s = await a.query(api.settings.get, {});
    await a.mutation(api.settings.update, { ...s, companyName: "A Corp", autoCheckoutHours: 3 });
    expect((await b.query(api.settings.get, {})).autoCheckoutHours).toBe(12);
    expect((await b.query(api.settings.get, {})).companyName).not.toBe("A Corp");
  });
});

describe("auto-checkout of forgotten visits", () => {
  async function seed(t: T, orgId: string, hoursAgo: number, n = 1) {
    await t.run(async (ctx) => {
      for (let i = 0; i < n; i++) {
        await ctx.db.insert("visitors", {
          orgId, name: `V${i}`, company: "", hostName: "H", purpose: "x",
          checkInTime: Date.now() - hoursAgo * HOUR, status: "in", checkedInBy: "g", extraData: {},
        });
      }
    });
  }
  const all = async (t: T, orgId: string) =>
    await t.run(async (ctx) => await ctx.db.query("visitors").filter((q) => q.eq(q.field("orgId"), orgId)).collect());

  test("each org's own threshold applies; 0 means off; recent visits are untouched", async () => {
    const t = setup();
    await signIn(t, "orgA", "a1", { role: "admin" });            // default 12h
    const b = await signIn(t, "orgB", "b1", { role: "admin" });  // off
    const c = await signIn(t, "orgC", "c1", { role: "admin" });  // 2h
    const sb = await b.query(api.settings.get, {});
    await b.mutation(api.settings.update, { ...sb, companyName: "B", autoCheckoutHours: 0 });
    const sc = await c.query(api.settings.get, {});
    await c.mutation(api.settings.update, { ...sc, companyName: "C", autoCheckoutHours: 2 });

    await seed(t, "orgA", 13); await seed(t, "orgA", 5);
    await seed(t, "orgB", 40);
    await seed(t, "orgC", 3); await seed(t, "orgC", 1.5);

    await t.mutation(internal.autoCheckout.sweepVisitors, {});
    const a = await all(t, "orgA");
    expect(a.filter((v) => v.status === "out")).toHaveLength(1);
    expect(a.find((v) => v.status === "out")?.autoCheckedOut).toBe(true);
    expect(a.find((v) => v.status === "out")?.checkOutTime).toBeTypeOf("number");
    expect((await all(t, "orgB")).every((v) => v.status === "in")).toBe(true);
    const cc = await all(t, "orgC");
    expect(cc.filter((v) => v.status === "out")).toHaveLength(1);
  });

  test("orgs that never opened the app still use the default threshold", async () => {
    const t = setup();
    await seed(t, "legacyOrg", 20);
    await t.mutation(internal.autoCheckout.sweepVisitors, {});
    expect((await all(t, "legacyOrg"))[0].status).toBe("out");
  });

  test("walks every page, not just the first", async () => {
    const t = setup();
    await seed(t, "orgBig", 30, 450);
    await t.mutation(internal.autoCheckout.sweepVisitors, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await all(t, "orgBig")).every((v) => v.status === "out")).toBe(true);
  });

  test("employees are swept the same way", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("employees", { orgId: "o", name: "E", checkInTime: Date.now() - 15 * HOUR, status: "in", extraData: {} });
      await ctx.db.insert("employees", { orgId: "o", name: "F", checkInTime: Date.now() - 2 * HOUR, status: "in", extraData: {} });
    });
    await t.mutation(internal.autoCheckout.sweepEmployees, {});
    const rows = await t.run(async (ctx) => await ctx.db.query("employees").collect());
    expect(rows.find((e) => e.name === "E")?.status).toBe("out");
    expect(rows.find((e) => e.name === "E")?.autoCheckedOut).toBe(true);
    expect(rows.find((e) => e.name === "F")?.status).toBe("in");
  });
});

describe("Clerk webhook", () => {
  const secretBytes = new Uint8Array(32).map((_, i) => i + 1);
  const secret = "whsec_" + btoa(String.fromCharCode(...secretBytes));

  async function sign(id: string, ts: string, body: string, key = secretBytes) {
    const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${id}.${ts}.${body}`)));
    return "v1," + btoa(String.fromCharCode(...sig));
  }
  const nowSec = () => String(Math.floor(Date.now() / 1000));

  test("verifySvix accepts a good signature and rejects bad ones", async () => {
    const body = '{"type":"x"}';
    const ts = nowSec();
    const good = await sign("msg_1", ts, body);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: good }, body)).toBe(true);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: `v1,AAAA ${good}` }, body)).toBe(true); // multiple sigs
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: good }, body + " ")).toBe(false);
    expect(await verifySvix(secret, { id: "msg_2", timestamp: ts, signature: good }, body)).toBe(false);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: await sign("msg_1", ts, body, new Uint8Array(32)) }, body)).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: old, signature: await sign("msg_1", old, body) }, body)).toBe(false);
    expect(await verifySvix(secret, { id: null, timestamp: ts, signature: good }, body)).toBe(false);
    expect(await verifySvix("not base64 !!", { id: "msg_1", timestamp: ts, signature: good }, body)).toBe(false);
  });

  async function post(t: T, body: string, headers: Record<string, string>) {
    return await t.fetch("/clerk-webhook", { method: "POST", headers, body });
  }
  const removal = (orgId: string, userId: string) =>
    JSON.stringify({ type: "organizationMembership.deleted", data: { organization: { id: orgId }, public_user_data: { user_id: userId } } });

  test("a signed membership.deleted removes only that org's member and notifications", async () => {
    process.env.CLERK_WEBHOOK_SECRET = secret;
    const t = setup();
    const guard = await signIn(t, "orgA", "g1", { role: "guard" });
    await signIn(t, "orgA", "h1", { role: "host" });
    const sameUserOtherOrg = await signIn(t, "orgB", "h1", { role: "host" });
    await guard.mutation(api.visitors.checkIn, visitor({ hostUserId: "h1" })); // creates a notification for h1 in orgA

    const body = removal("orgA", "h1");
    const ts = nowSec();
    const res = await post(t, body, { "svix-id": "m1", "svix-timestamp": ts, "svix-signature": await sign("m1", ts, body) });
    expect(res.status).toBe(200);

    const members = await t.run(async (ctx) => await ctx.db.query("members").collect());
    expect(members.filter((m) => m.orgId === "orgA").map((m) => m.userId)).toEqual(["g1"]);
    expect(await sameUserOtherOrg.query(api.members.me, {})).not.toBeNull();
    const notes = await t.run(async (ctx) => await ctx.db.query("notifications").collect());
    expect(notes.filter((n) => n.orgId === "orgA" && n.userId === "h1")).toHaveLength(0);
  });

  test("unsigned, badly signed and unconfigured requests change nothing", async () => {
    const t = setup();
    await signIn(t, "orgA", "h1", { role: "host" });
    const body = removal("orgA", "h1");

    expect((await post(t, body, {})).status).toBe(503); // no secret configured

    process.env.CLERK_WEBHOOK_SECRET = secret;
    expect((await post(t, body, {})).status).toBe(401);
    const ts = nowSec();
    expect((await post(t, body, { "svix-id": "m", "svix-timestamp": ts, "svix-signature": "v1,AAAA" })).status).toBe(401);
    expect(await t.run(async (ctx) => (await ctx.db.query("members").collect()).length)).toBe(1);
  });

  test("other event types are acknowledged and ignored", async () => {
    process.env.CLERK_WEBHOOK_SECRET = secret;
    const t = setup();
    await signIn(t, "orgA", "h1", { role: "host" });
    const body = JSON.stringify({ type: "user.updated", data: {} });
    const ts = nowSec();
    const res = await post(t, body, { "svix-id": "m", "svix-timestamp": ts, "svix-signature": await sign("m", ts, body) });
    expect(res.status).toBe(200);
    expect(await t.run(async (ctx) => (await ctx.db.query("members").collect()).length)).toBe(1);
  });
});

describe("kiosk self-check-in", () => {
  const TOKEN_A = "tokenA-tokenA-tokenA-tokenA-1234";
  const TOKEN_B = "tokenB-tokenB-tokenB-tokenB-1234";

  async function world() {
    const t = setup();
    const adminA = await signIn(t, "orgA", "a1", { role: "admin", name: "Ann Admin" });
    await signIn(t, "orgA", "h1", { role: "host", name: "Hana Host" });
    await signIn(t, "orgA", "g1", { role: "guard", name: "Gus Guard" });
    await signIn(t, "orgB", "b1", { role: "admin", name: "Bea Admin" });
    await signIn(t, "orgB", "bh", { role: "host", name: "Bob Host" });
    await t.run(async (ctx) => {
      for (const [orgId, token] of [["orgA", TOKEN_A], ["orgB", TOKEN_B]] as const) {
        const row = await ctx.db.query("orgSettings").withIndex("by_org", (q) => q.eq("orgId", orgId)).unique();
        await ctx.db.patch(row!._id, { kioskToken: token });
      }
    });
    const hosts = async (token: string) => (await t.query(api.kiosk.info, { token }))!.hosts;
    const hostIdA = (await hosts(TOKEN_A)).find((h) => h.name === "Hana Host")!.id;
    const hostIdB = (await hosts(TOKEN_B)).find((h) => h.name === "Bob Host")!.id;
    return { t, adminA, hostIdA, hostIdB };
  }
  const walkIn = (token: string, o: Record<string, unknown> = {}) => ({
    token, name: "Wanda Walkin", company: "Acme", purpose: "Meeting", extraData: {}, ...o,
  });

  test("info needs a valid token and reveals only names, no emails/phones/ids of staff", async () => {
    const { t } = await world();
    expect(await t.query(api.kiosk.info, { token: "nope" })).toBeNull();
    expect(await t.query(api.kiosk.info, { token: "x".repeat(40) })).toBeNull();
    const info = await t.query(api.kiosk.info, { token: TOKEN_A });
    expect(info!.hosts.map((h) => h.name).sort()).toEqual(["Ann Admin", "Hana Host"]); // guards hidden
    expect(JSON.stringify(info)).not.toMatch(/example\.com|phone|userId|orgA/);
  });

  test("a walk-in creates a visit in the token's org only, and notifies the host", async () => {
    const { t, hostIdA } = await world();
    const res = await t.mutation(api.kiosk.checkIn, walkIn(TOKEN_A, { hostId: hostIdA }));
    expect(res).toMatchObject({ ok: true, name: "Wanda Walkin" });
    const visits = await t.run(async (ctx) => await ctx.db.query("visitors").collect());
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({ orgId: "orgA", source: "kiosk", checkedInBy: "kiosk", hostName: "Hana Host", hostUserId: "h1", status: "in" });
    const host = t.withIdentity({ subject: "h1", org_id: "orgA", org_role: "org:member" });
    expect((await host.query(api.notifications.mine, {}))[0].message).toContain("Wanda Walkin");
  });

  test("it can't reach another org's staff, guards, or unknown hosts", async () => {
    const { t, hostIdB } = await world();
    const cross = await t.mutation(api.kiosk.checkIn, walkIn(TOKEN_A, { hostId: hostIdB }));
    expect(cross).toMatchObject({ ok: false, reason: "details" });
    const guardId = await t.run(async (ctx) => (await ctx.db.query("members").filter((q) => q.eq(q.field("userId"), "g1")).unique())!._id);
    expect(await t.mutation(api.kiosk.checkIn, walkIn(TOKEN_A, { hostId: guardId }))).toMatchObject({ ok: false, reason: "details" });
    expect(await t.mutation(api.kiosk.checkIn, walkIn(TOKEN_A))).toMatchObject({ ok: false, reason: "details" }); // no host at all
    expect(await t.run(async (ctx) => (await ctx.db.query("visitors").collect()).length)).toBe(0);
  });

  test("a bad or revoked token does nothing", async () => {
    const { t, adminA, hostIdA } = await world();
    expect(await t.mutation(api.kiosk.checkIn, walkIn("bad-token-bad-token-bad-token", { hostId: hostIdA }))).toMatchObject({ ok: false, reason: "invalid" });
    await adminA.mutation(api.settings.disableKiosk, {});
    expect(await t.query(api.kiosk.info, { token: TOKEN_A })).toBeNull();
    expect(await t.mutation(api.kiosk.checkIn, walkIn(TOKEN_A, { hostId: hostIdA }))).toMatchObject({ ok: false, reason: "invalid" });
    // org B's kiosk is unaffected
    expect(await t.query(api.kiosk.info, { token: TOKEN_B })).not.toBeNull();
  });

  test("custom-field rules are enforced and reported without creating a visit", async () => {
    const { t, adminA, hostIdA } = await world();
    await adminA.mutation(api.customFields.add, { label: "National ID", target: "visitor", required: true });
    const res = await t.mutation(api.kiosk.checkIn, walkIn(TOKEN_A, { hostId: hostIdA }));
    expect(res).toMatchObject({ ok: false, reason: "details", message: "National ID is required" });
    expect(await t.mutation(api.kiosk.checkIn, walkIn(TOKEN_A, { hostId: hostIdA, extraData: { national_id: "123" } }))).toMatchObject({ ok: true });
  });

  test("submissions are rate limited per org, and other orgs aren't affected", async () => {
    const { t, hostIdA, hostIdB } = await world();
    for (let i = 0; i < 60; i++) {
      expect(await t.mutation(api.kiosk.checkIn, walkIn(TOKEN_A, { hostId: hostIdA }))).toMatchObject({ ok: true });
    }
    expect(await t.mutation(api.kiosk.checkIn, walkIn(TOKEN_A, { hostId: hostIdA }))).toMatchObject({ ok: false, reason: "busy" });
    expect(await t.mutation(api.kiosk.checkIn, walkIn(TOKEN_B, { hostId: hostIdB }))).toMatchObject({ ok: true });
  });

  describe("appointment codes", () => {
    async function withAppointment(offsetMs = HOUR) {
      const w = await world();
      const { checkInCode, id } = await w.adminA.mutation(api.appointments.create, {
        visitorName: "Pat Prebooked", visitorCompany: "Beta", hostName: "Hana Host", hostUserId: "h1", scheduledTime: Date.now() + offsetMs,
      });
      return { ...w, code: checkInCode, apptId: id };
    }

    test("checks in the visitor from the appointment, once", async () => {
      const { t, code } = await withAppointment();
      const res = await t.mutation(api.kiosk.checkInWithCode, { token: TOKEN_A, code: ` ${code.toLowerCase()} `, extraData: {} });
      expect(res).toMatchObject({ ok: true, name: "Pat Prebooked", hostName: "Hana Host" });
      const [visit] = await t.run(async (ctx) => await ctx.db.query("visitors").collect());
      expect(visit).toMatchObject({ name: "Pat Prebooked", company: "Beta", hostUserId: "h1", source: "kiosk", orgId: "orgA" });
      expect(await t.mutation(api.kiosk.checkInWithCode, { token: TOKEN_A, code, extraData: {} })).toMatchObject({ ok: false, reason: "code" });
    });

    test("a code only works at its own org's kiosk", async () => {
      const { t, code } = await withAppointment();
      expect(await t.mutation(api.kiosk.checkInWithCode, { token: TOKEN_B, code, extraData: {} })).toMatchObject({ ok: false, reason: "code" });
      expect(await t.run(async (ctx) => (await ctx.db.query("visitors").collect()).length)).toBe(0);
    });

    test("appointments outside the arrival window are refused", async () => {
      const early = await withAppointment(3 * 24 * HOUR);
      expect(await early.t.mutation(api.kiosk.checkInWithCode, { token: TOKEN_A, code: early.code, extraData: {} })).toMatchObject({ ok: false, reason: "code" });
      const late = await withAppointment(-2 * 24 * HOUR);
      expect(await late.t.mutation(api.kiosk.checkInWithCode, { token: TOKEN_A, code: late.code, extraData: {} })).toMatchObject({ ok: false, reason: "code" });
    });

    test("wrong guesses count against the limit (so codes can't be brute-forced)", async () => {
      const { t, code } = await withAppointment();
      for (let i = 0; i < 60; i++) {
        expect(await t.mutation(api.kiosk.checkInWithCode, { token: TOKEN_A, code: "ZZZZZZ", extraData: {} })).toMatchObject({ ok: false, reason: "code" });
      }
      // The real code is now locked out too until the window passes.
      expect(await t.mutation(api.kiosk.checkInWithCode, { token: TOKEN_A, code, extraData: {} })).toMatchObject({ ok: false, reason: "busy" });
      vi.setSystemTime(Date.now() + 61 * 60 * 1000);
      expect(await t.mutation(api.kiosk.checkInWithCode, { token: TOKEN_A, code, extraData: {} })).toMatchObject({ ok: true });
    });

    test("a missing required field leaves the appointment unused", async () => {
      const { t, adminA, code } = await withAppointment();
      await adminA.mutation(api.customFields.add, { label: "Vehicle Plate", target: "visitor", required: true });
      expect(await t.mutation(api.kiosk.checkInWithCode, { token: TOKEN_A, code, extraData: {} })).toMatchObject({ ok: false, reason: "details" });
      expect(await t.mutation(api.kiosk.checkInWithCode, { token: TOKEN_A, code, extraData: { vehicle_plate: "KDA 1" } })).toMatchObject({ ok: true });
    });
  });

  test("admins can create and rotate the link; rotating kills the old one; others can't", async () => {
    const t = setup();
    const admin = await signIn(t, "orgA", "a1", { role: "admin" });
    const guard = await signIn(t, "orgA", "g1", { role: "guard" });
    await expect(guard.action(api.kioskAdmin.rotateToken, {})).rejects.toThrow();

    const first = await admin.action(api.kioskAdmin.rotateToken, {});
    expect(first).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect((await admin.query(api.settings.getAdmin, {})).kioskToken).toBe(first);
    expect(await t.query(api.kiosk.info, { token: first })).not.toBeNull();

    const second = await admin.action(api.kioskAdmin.rotateToken, {});
    expect(second).not.toBe(first);
    expect(await t.query(api.kiosk.info, { token: first })).toBeNull();
    expect(await t.query(api.kiosk.info, { token: second })).not.toBeNull();

    // The token is bound to the admin's own org.
    const other = await signIn(t, "orgB", "b1", { role: "admin" });
    const otherToken = await other.action(api.kioskAdmin.rotateToken, {});
    const infoB = await t.query(api.kiosk.info, { token: otherToken });
    expect(infoB!.hosts.map((h) => h.name)).toEqual(["b1"]); // org B's own member only
    expect(JSON.stringify(await t.query(api.kiosk.info, { token: second }))).not.toContain("b1"); // never org A's kiosk
  });
});
