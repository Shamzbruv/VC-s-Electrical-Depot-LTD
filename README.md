# VC’s Electrical Depot LTD

Public electrical supply and contracting site, backed by Supabase. Customers can browse products selected for publication, submit enquiries and request a bulk quotation.

The staff portal is at `/admin`. It includes supervisor-led deliveries, customer email updates, operational reports, enquiries, private product management, a visual website editor and Owner/Admin access.

## Deployment

Railway builds and deploys from the GitHub `main` branch. Use `pnpm run build:railway` for a production build and `pnpm start` to serve it. The web application uses the Supabase publishable key and authenticated staff JWTs. The Supabase service key stays inside the staff setup Edge Function.

Run the Supabase migrations in order for an uninitialized project. Deploy `vc-staff-setup` from `supabase/functions` with gateway JWT verification disabled. The function verifies the user with Supabase Auth and authorizes the owner through the staff permissions RPC before generating a setup link.

Bootstrap the first owner using an explicitly confirmed email. Approve the address in `staff_activation` with role `owner` and `active=true`, then generate a one-time invite link from Supabase. If a verified Auth user already exists, assign the `owner` role to its user ID in `staff_roles`. From then on the owner can approve staff and generate one-time links in the portal.

The inventory supervisor works as an Admin with Delivery supervision permission. They copy an existing order reference, enter the customer and item quantities, check loading, release the truck and confirm arrival. The platform keeps an order summary and status history for operational use.

Departure and arrival events create immutable email jobs in the same database transaction. The Edge Function sends branded summaries through Resend. It uses provider idempotency keys, leases, limited retries and a minute-by-minute cron schedule. The interface distinguishes queued, failed, sent-to-provider and review-required states. Old accounting data remains in the database, and the navigation now uses operational reports and manifests.

Run `python scripts/configure-delivery-automation.py` from the repository root with a current management token for this project, a Resend API key and a verified sender address. It applies migration 009 when needed, deploys the Edge Function, stores credentials as Supabase secrets and installs the retry schedule using Vault. The web application displays a setup notice and preserves existing delivery records until the upgrade is installed.

## Checks

Run `pnpm exec tsc --noEmit` and `pnpm run build:railway`. Test delivery GPS using an HTTPS deployment and the phone's location permission. Staff setup, role assignment, products and draft publishing all require an authenticated test session.
