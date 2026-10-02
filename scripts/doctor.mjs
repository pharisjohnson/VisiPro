#!/usr/bin/env node
// Checks local setup and prints the exact commands still needed.  Usage: npm run doctor
import fs from 'node:fs';

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const parse = (text) =>
  Object.fromEntries(
    text.split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
  );

const env = { ...parse(read('.env')), ...parse(read('.env.local')), ...process.env };
let problems = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m, fix) => { problems++; console.log(`  ✗ ${m}${fix ? `\n      → ${fix}` : ''}`); };

console.log('\nFrontend (.env.local)');
const pk = env.VITE_CLERK_PUBLISHABLE_KEY;
let issuer = null;
if (!pk) bad('VITE_CLERK_PUBLISHABLE_KEY is missing', 'Clerk dashboard → API keys → Publishable key');
else if (!/^pk_(test|live)_/.test(pk)) bad('VITE_CLERK_PUBLISHABLE_KEY should start with pk_test_ or pk_live_ (did you paste the secret key?)');
else {
  ok(`Clerk publishable key (${pk.startsWith('pk_live_') ? 'production' : 'development'} instance)`);
  // The key is base64("<frontend-api-host>$"): that host is the JWT issuer Convex must trust.
  try {
    const host = Buffer.from(pk.split('_').slice(2).join('_'), 'base64').toString('utf8').replace(/\$$/, '');
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) issuer = `https://${host}`;
  } catch { /* fall through */ }
}
if (/^sk_/.test(pk ?? '')) bad('That is a Clerk SECRET key. Never put it in the frontend.');
if (!env.VITE_CONVEX_URL) bad('VITE_CONVEX_URL is missing', 'Run `npx convex dev`; it prints the URL (also in .env.local as CONVEX_URL)');
else if (!/^https:\/\/[a-z0-9-]+\.convex\.cloud\/?$/i.test(env.VITE_CONVEX_URL)) bad(`VITE_CONVEX_URL looks wrong: ${env.VITE_CONVEX_URL}`, 'Expected https://<name>.convex.cloud');
else ok('Convex URL');

console.log('\nConvex deployment (set with `npx convex env set`; I can\'t read these from here)');
if (issuer) {
  console.log(`  • npx convex env set CLERK_JWT_ISSUER_DOMAIN ${issuer}`);
  console.log('    (derived from your publishable key; must match the issuer of your Clerk "convex" JWT template)');
} else console.log('  • npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-clerk-frontend-api-host>');
console.log('  • optional  AI assistant:  npx convex env set GEMINI_API_KEY <key>');
console.log('  • optional  SMS (sandbox): npx convex env set AT_USERNAME sandbox && npx convex env set AT_API_KEY <key> && npx convex env set AT_SANDBOX true');
console.log('  • optional  webhook:       npx convex env set CLERK_WEBHOOK_SECRET whsec_...   (endpoint: https://<deployment>.convex.site/clerk-webhook)');
console.log('  • verify:                  npx convex env list');

console.log('\nClerk dashboard checklist (can\'t be checked from here)');
console.log('  [ ] Organizations enabled, and "Allow users to create organizations" on');
console.log('  [ ] JWT template named exactly "convex" with claims: "aud":"convex", "org_id":"{{org.id}}", "org_role":"{{org.role}}"');
console.log('  [ ] After sign-in the app says "No active organization"?  The org_id/org_role claims are missing.\n');

console.log(problems ? `${problems} problem(s) found above.\n` : 'Local setup looks complete.\n');
process.exit(problems ? 1 : 0);
