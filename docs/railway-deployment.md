# Railway deployment

Railway uses the tracked Dockerfile and railway.json, not the local Sites/Cloudflare emulator. Docker builds Next.js in standalone mode and runs its production Node server with HOSTNAME=0.0.0.0 and Railway's PORT. The /api/health endpoint checks process readiness without requiring a database secret.

Deployment follows GitHub main. No direct Railway code edits are needed. The existing Sites deployment remains a separate snapshot.

## Runtime variables

- SUPABASE_SERVICE_ROLE_KEY: private service-role key from this project's Supabase API settings. Set only in Railway Variables. Required for quote/contact submissions, server-side order operations and authenticated staff data operations. Never commit it to GitHub.
- SUPABASE_ANON_KEY: optional override for this dedicated project's public anonymous key. The committed fallback is a public RLS-restricted key, not an administrative secret.
- APP_ORIGIN: production origin; defaults to https://vc-s-electrical-depot-ltd-production.up.railway.app.
- PORT: use Railway's injected value.

The public catalog and published information pages read Supabase using its anonymous key. Sensitive tables remain protected; no service-role fallback is committed. Checkout stays disabled and sample products remain non-purchasable.

Supabase Auth URL configuration must include the Railway /account redirect before auth email links can be used on this deployment. Configure the initial owner account separately as described in implementation-status.md.

## Local production verification

Run pnpm run build:railway, then PORT=3000 pnpm start. The Docker runner uses the generated .next/standalone/server.js with public and .next/static copied alongside it. Confirm /api/health returns 200 and the homepage, product HTML, catalog JSON and assets load. The native Next.js build must pass TypeScript validation before pushing.
