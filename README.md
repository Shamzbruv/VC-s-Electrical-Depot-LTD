# VC’s Electrical Depot LTD

Private staging storefront and e-commerce control panel. Built with the Sites Vinext starter, React, TypeScript and a dedicated Supabase project.

- `app/`: storefront, customer and admin pages; server API routes.
- `lib/`: database authorization, money display, CSV validation and PDF output.
- `supabase/migrations/`: applied schema and transaction functions.
- `supabase/seed.sql`: clearly labelled staging samples, blocked from purchase.
- `tests/`: transaction, promotion, CSV and concurrency assertions.
- `docs/implementation-status.md`: honest implementation limits, setup and operator notes.
- `docs/validation.md`: checks and verification limits.

Configure the three Supabase variables documented in `.env.example` through hosting secrets. Keep the service-role key on the server. Local secrets belong only in ignored `.dev.vars`.

Staff accounts require a verified Supabase Auth user and a separately assigned `staff_roles` record. There is no default admin password. See the handover notes for bootstrap and permissions.

Validation: `node node_modules/typescript/bin/tsc --noEmit` and `node --experimental-strip-types --test tests/import.test.mjs`. Build using the Sites build helper. SQL tests run inside rolled-back transactions against staging. The concurrency script creates disposable staging records and restores configuration in a finally block; do not run it against a live merchant store.

Private deployment: https://vcs-electrical-depot.shamzbruv.chatgpt.site

This is not an approved live-payment release. Merchant gateway, email sending, business/legal data, real catalog and full blueprint acceptance require the inputs and remaining work recorded in the handover.
