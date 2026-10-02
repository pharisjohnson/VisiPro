# VisiPro

Visitor check-in/out for companies that still use a paper book at the gate.
Multi-tenant SaaS: each company gets its own private workspace.

**Stack:** React + Vite + Tailwind · [Convex](https://convex.dev) (database, realtime, server functions) · [Clerk](https://clerk.com) (auth + organizations) · Gemini (optional AI assistant, called server-side)

## What it does

- **Walk-in and appointment check-in**, with unambiguous 6-character appointment codes (single use)
- **Check-out**, by guards or by the host themselves
- **Live updates**: when a guard checks a visitor in, the host's screen and notification update instantly
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

### 3. Frontend

```bash
cp .env.example .env.local   # fill in VITE_CONVEX_URL and VITE_CLERK_PUBLISHABLE_KEY
npm run dev                  # http://localhost:3000
```

Sign up, create an organization, and you're its admin. Invite colleagues from **Admin Settings → Team**, then set their role (Guard / Host).

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
- Every public function is built with `orgQuery(roles)` / `orgMutation(roles)` from `convex/lib/tenancy.ts`. These take the org from the verified JWT, require a member row in that org, check the role, and give the handler `ctx.orgId`.
- `tests/tenancy.test.ts` proves an org can't read or touch another org's data, and **fails if any new file uses the raw `query`/`mutation` builders**, so a forgotten check can't ship silently.
- The Gemini key lives only in the Convex environment. The AI action loads the caller's own org data server-side (admin-only).

## Deploying

1. `npx convex deploy` creates the production deployment. Set `CLERK_JWT_ISSUER_DOMAIN` (and `GEMINI_API_KEY`) on it with `npx convex env set --prod ...`.
2. Host the frontend (Vercel / Cloudflare Pages / Netlify) with build command `npx convex deploy --cmd 'npm run build'` and the env vars `CONVEX_DEPLOY_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`. Use a Clerk **production** instance and update the issuer.

## Known gaps (planned)

- Removing someone in Clerk doesn't delete their member row yet (they lose access immediately, but still appear in the Team list). Needs a Clerk webhook.
- No SMS/email notifications yet (in-app only), no QR self-check-in, no badge printing.
- No billing/plans, no auto-checkout of forgotten visitors at midnight, no pagination beyond the latest 500 log rows.
- No offline queue: the app warns when offline but can't save until reconnected.
- No rate limit on the AI assistant.
