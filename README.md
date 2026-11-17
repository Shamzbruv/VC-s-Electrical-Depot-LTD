# VC’s Electrical Depot LTD

Public electrical supply and contracting site, backed by Supabase. Customers can browse products selected for publication, submit enquiries and request a bulk quotation.

The staff portal is at `/admin`. It includes accounting and JMD reporting, dispatch, a mobile driver workspace, enquiries, private product management, a visual website editor and role-based staff access.

## Deployment

Railway builds and deploys from the GitHub `main` branch. Use `pnpm run build:railway` for a production build and `pnpm start` to serve it. The web application uses the Supabase publishable key and authenticated staff JWTs. The Supabase service key stays inside the staff setup Edge Function.

Run the Supabase migrations in order for an uninitialized project. Deploy `vc-staff-setup` from `supabase/functions` with gateway JWT verification disabled. The function verifies the user with Supabase Auth and authorizes the owner through the staff permissions RPC before generating a setup link.

Bootstrap the first owner using an explicitly confirmed email. Approve the address in `staff_activation` with role `owner` and `active=true`, then generate a one-time invite link from Supabase. If a verified Auth user already exists, assign the `owner` role to its user ID in `staff_roles`. From then on the owner can approve staff and generate one-time links in the portal.

Drivers share location during an accepted delivery while their phone browser can provide updates. Dispatch displays the most recent position and its timestamp. Delivering, cancelling or reporting an issue removes the stored position. Status changes and staff notifications are retained.

## Checks

Run `pnpm exec tsc --noEmit` and `pnpm run build:railway`. Test delivery GPS using an HTTPS deployment and the phone's location permission. Staff setup, role assignment, products and draft publishing all require an authenticated test session.
