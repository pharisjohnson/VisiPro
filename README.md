# VisiPro

Visitor check-in/out for companies that still use a paper book at the gate.
Multi-tenant SaaS: each company gets its own private workspace.

**Stack:** React + Vite + Tailwind · [Convex](https://convex.dev) (database, realtime, server functions) · [Clerk](https://clerk.com) (auth + organizations) · Gemini (optional AI assistant, called server-side)

## What it does

- **Walk-in and appointment check-in**, with unambiguous 6-character appointment codes (single use)
- **Check-out**, by guards or by the host themselves
- **Live updates**: when a guard checks a visitor in, the host's screen and notification update instantly
- **SMS alerts** (Africa's Talking): the host is texted when their visitor arrives; visitors with a phone number on their appointment are texted their check-in code
- **Self check-in**: a public link + QR code (printable poster) so visitors can check in on their own phone or a gate tablet, with or without an appointment code
- **Visitor badges**: print a badge after check-in, or reprint from the log
- **Auto check-out**: forgotten visitors and staff are closed after a threshold you set, and marked "auto"
- **Employee attendance**, custom fields (e.g. vehicle plate, national ID) with server-side required checks
- **Logs** with search and CSV/JSON export (spreadsheet-formula safe), announcements, 7-day traffic chart
- **Roles**: Admin (everything), Guard (check-in/out, logs), Host (only their own visitors and appointments)

## Setup

You need free accounts at Clerk and Convex.

### 1. Clerk

1. Create an application. Under **Configure → Organizations**, enable organizations (and "Allow users to create organizations").
2. **Configure → JWT templates → New template → Convex** (or add a template named `convex`). Make sure the claims include the organization:

   ```json
   {
     "aud": "convex",
     "org_id": "{{org.id}}",
     "org_role": "{{org.role}}"
   }
   ```

   The app trusts the organization from this signed token, never from the browser. If `org_id` is missing the app shows "No active organization" after sign-in. (Clerk's compact session-token claim `o.id`/`o.rol` is also understood.)
3. Copy the **Publishable key** and your **Frontend API URL** (the JWT issuer, e.g. `https://xxx.clerk.accounts.dev`).

### 2. Convex

```bash
npm install
npx convex dev          # log in, creates the project, pushes the functions, regenerates convex/_generated
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://xxx.clerk.accounts.dev
npx convex env set GEMINI_API_KEY <your key>     # optional, enables the AI assistant
```

### 3. SMS (optional, Africa's Talking)

Create an Africa's Talking account (use the sandbox to test) and set on the Convex deployment:

```bash
npx convex env set AT_USERNAME <username>        # "sandbox" for the sandbox
npx convex env set AT_API_KEY <api key>
npx convex env set AT_SANDBOX true               # only while testing
npx convex env set AT_SENDER_ID <approved id>    # optional
```

Without these the SMS options in Admin Settings do nothing (the admin page says so). Each organization is capped at 100 SMS per day (`SMS_DAILY_CAP` in `convex/lib/sms.ts`); SMS costs real money, so decide how you pass that cost on in your pricing.
Hosts add their number under **My Profile**; numbers like `0712 345 678` are stored as `+254712345678`.

### 4. Clerk webhook (optional, recommended)

So that people removed from an organization in Clerk also disappear from the Team list: in Clerk go to **Webhooks → Add endpoint**, URL `https://<your-deployment>.convex.site/clerk-webhook`, subscribe to **organizationMembership.deleted**, then:

```bash
npx convex env set CLERK_WEBHOOK_SECRET whsec_...
```

### 5. Frontend

```bash
cp .env.example .env.local   # fill in VITE_CONVEX_URL and VITE_CLERK_PUBLISHABLE_KEY
npm run dev                  # http://localhost:3000
```

Sign up, create an organization, and you're its admin. Invite colleagues from **Admin Settings → Team**, then set their role (Guard / Host).

### Self check-in link

Admin Settings → **Visitor self check-in → Enable**. You get a link like `https://your-app/k/<secret>` and a QR code with a printable poster. The link is the only credential, so treat it like a key: **rotate** it if it leaks (the old link and printed posters stop working at once) or turn it off. Hosting must serve `index.html` for `/k/*` (the included `vercel.json` does; on Netlify/Cloudflare add the equivalent SPA rewrite).

> `convex/_generated/` was bootstrapped by hand (no deployment was reachable when it was written). The first `npx convex dev` regenerates it; commit whatever changes.

## Scripts

| | |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run convex:dev` | Convex dev backend (run alongside `dev`) |
| `npm run typecheck` | Type-check the app and the backend |
| `npm test` | Backend tests (tenant isolation, roles, validation) |
| `npm run build` | Type-check and build the frontend |

## How tenant isolation works

Convex has no row-level security, so isolation is enforced in code, in one place:

- Every table has an `orgId`, and every index starts with it.
- The one public, unauthenticated surface is the kiosk (`convex/kiosk.ts`). It resolves the organization **only** from the secret token, can only *create* visits (it never reads visitor or appointment data back), is rate-limited to 60 submissions/hour per organization, and counts wrong appointment codes against that limit (expected failures are returned, not thrown, because a thrown error would roll the counter back).
- Visitor-typed text is stripped of links and control characters before it goes into an SMS, and exported cells that start with `=`, `+`, `-`, `@` are neutralized so they can't run as spreadsheet formulas.
- Every public function is built with `orgQuery(roles)` / `orgMutation(roles)` from `convex/lib/tenancy.ts`. These take the org from the verified JWT, require a member row in that org, check the role, and give the handler `ctx.orgId`.
- `tests/tenancy.test.ts` proves an org can't read or touch another org's data, and **fails if any new file uses the raw `query`/`mutation` builders**, so a forgotten check can't ship silently.
- The Gemini key lives only in the Convex environment. The AI action loads the caller's own org data server-side (admin-only).

## Deploying

1. `npx convex deploy` creates the production deployment. Set `CLERK_JWT_ISSUER_DOMAIN` (and `GEMINI_API_KEY`) on it with `npx convex env set --prod ...`.
2. Host the frontend (Vercel / Cloudflare Pages / Netlify) with build command `npx convex deploy --cmd 'npm run build'` and the env vars `CONVEX_DEPLOY_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`. Use a Clerk **production** instance and update the issuer.

## Known gaps (planned)

- Deleting an organization in Clerk doesn't delete its data here. That's deliberate until you decide a retention policy (an accidental delete shouldn't be irreversible).
- The kiosk link is a shared secret, not per-person: anyone who photographs your poster can check in (rate-limited, and you can rotate it). If that's not acceptable for a customer, add a "pending guard approval" step.
- No email notifications, no QR *scanning* at the gate, no visitor photo or ID capture, no pre-registration emails.
- No billing/plans, no pagination beyond the latest 500 log rows, no rate limit on the AI assistant.
- No offline queue: the app warns when offline but can't save until reconnected.
- Auto-check-out marks forgotten visits closed at the time the sweep runs (hourly), not the time the person actually left; the log shows them as "auto" for that reason.
