# Validation — 2026-11-05

Passed:
- Real simultaneous two-request stock test: exactly one order succeeded, the other received out-of-stock; one unit was reserved. Fixtures were removed and original checkout settings restored.
- TypeScript no-emit checks.
- Production Vinext build (initial version; final build rerun during packaging).
- Four node:test CSV tests: quoted commas/escaped quotes, malformed data, exact JMD-to-cents conversion, duplicate and unsafe price/stock rejection.
- Direct Supabase REST: published sample catalog returns 8 products; anonymous order and staff-role reads denied; service access sees no live orders or assigned staff.
- RLS enabled across every authored public table; transaction functions are SECURITY INVOKER and restricted to service_role.
- SQL transactional assertions: authoritative online price, atomic stock reservation, retry idempotency, oversell rejection, unpaid fulfilment rejection, payment inventory commit, invoice creation and immutable order snapshot, valid pickup transitions.
- SQL promotion assertions: server quote total, percentage discount, redemption counter and release on cancellation.
- Multi-page PDF parsed using pypdf: 95 lines yielded 3 pages; final line preserved.
- Desktop storefront browser inspection. 390 px mobile hero/header/benefit layout and navigation drawer inspected.

Limits:
- Managed preview reports internal errors on outgoing Supabase fetches. Its environment has the configured keys; direct database requests succeed. Browser catalog/cart/quote and authenticated staff persistence could not be completed in that runtime.
- Private hosted deployment succeeded. The cloud browser reaches the normal ChatGPT sign-in gate. No signed-in browser session was available. Automatic review rejected using the Site's access token for hosted smoke checks without explicit user approval, so no claim of hosted end-to-end verification is made.
- Real merchant transactions, customer/staff account flows, auth email delivery, transactional mail, backup restoration and final user acceptance have not been verified.
- Sample products are purchase-blocked and checkout remains disabled by default. No real payments or messages were sent.
