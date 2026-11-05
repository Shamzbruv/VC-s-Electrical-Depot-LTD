# VC’s Electrical Depot LTD — private staging handover

Date: 2026-11-05. Scope: Phase 1 e-commerce only.

## Architecture and hosting decision
The user's explicit Sites request selects Sites hosting and its dedicated Git source repository, rather than Railway/GitHub deployment described as the blueprint's default. The application uses the supported Vinext App Router starter, React/TypeScript and Supabase Postgres/Auth/Storage. It does not modify ForYou Skin Bar. Its package and checkout scripts were inspected for reference; no customer data, merchant settings or code were copied.

Supabase project: lfiasedcinrrikwkbbeb (VC's Electrical Depot LTD). Database was empty at initial inspection. Applied migrations are recorded in supabase/migrations. Only staging samples were seeded. No live product data was supplied.

## Working implementation
- Branded responsive storefront, sample product illustrations and generated illustrative hero image.
- Server-rendered catalog and product pages, technical specifications, unit labels, search/category/price/stock filtering and sorting.
- One sellable SKU per product record; individual SKU records represent different specifications. A product family can be grouped using the “Product family” specification, with each independently priced SKU represented by its own record; a spreadsheet-style matrix editor remains pending.
- Persistent browser cart; authoritative database order totals, separate online/store reference prices, guest orders and optional account association.
- Configurable pickup and delivery zones; disabled-by-default bank transfer.
- Atomic stock reservations, immutable order item snapshots, idempotent checkout retry, owner-only external bank verification, validated pickup/delivery transitions, cancellation and exactly-once stock release.
- Cryptographically random guest tracking token, hashed at rest; customer row isolation; protected staff APIs with explicit module permissions.
- Quote/enquiry submission and administrative response records. Outbox explicitly records email as not_configured.
- Admin catalog import with reviewed CSV data and validation, JPG/PNG/WebP uploads, stock adjustments with ledger/reason, orders, payment attempts, invoice records, delivery zones, quotes, enquiries, page content, date/minimum/usage-cap promotion validation with transactional redemption, purchase-checked reviews and moderation, role records, audit records and sales reporting.
- Invoice PDF endpoint requires staff authorization and configured legal seller details. PDF output wraps long lines and paginates. A 95-line, three-page document was parsed and checked for its final line.
- Read-only admin preview uses published sample products and no invented transaction statistics.
- Private-stage robots/noindex; sitemap excludes sample products. No fabricated ratings or verified brand claims.

## Staff bootstrap
No shared password or default administrator was created. In the dedicated Supabase project, invite the approved owner using Authentication > Users. After the owner confirms their account, insert their UUID into public.staff_roles with role='owner' and active=true using a controlled database change. The owner then signs in at /admin and can grant other existing authenticated users limited staff roles. Staff email invitations from within the store are not implemented. Customer sign-in/register/password-reset uses Supabase Auth. Production redirect URLs are configured for this Site. Auth email delivery still needs validation with an approved test account.

## Required inputs before live sales
Actual logo, store contact and pickup address, business hours, real catalog/photos/SKUs/prices/stock, approved shipping fees, legal policies, tax registration/treatment, named staff and owner assignments, approved bank instructions or verified gateway account, transactional sender/provider credentials and notification recipients.

## Explicitly incomplete features / release blockers
This is a private staging foundation, not accepted completion of all 20 blueprint criteria. No live payments or transactional emails are claimed.
- Verified hosted gateway, webhooks, refunds and reconciliation depend on merchant selection/credentials and remain disabled.
- Email delivery, email templates with tested provider delivery and retry worker remain pending provider configuration.
- Spreadsheet-style grouped variant editing, document galleries, rich CMS revision history, dedicated category/brand managers, customer address management, guest/customer invoice download UI with private-storage caching and extensive analytics are not complete in this version.
- Homepage hero text is editable in brand settings; other homepage sections currently remain source-defined. Page content supports draft/published status, not a complete revision system.
- Admin reporting uses all recorded data, not the blueprint's full date/custom range report suite. Customer details and spending summaries are available from order history; saved addresses and a standalone customer profile editor are pending.
- Expired holds are released before new order insertion; an unattended reservation expiry job remains required before live checkout.
- Concurrency locking is implemented. The concurrent staging test result is recorded in docs/validation.md.
- PDF and email handoff, backup/restore drill, real staff role browser tests, real customer account tests, final legal content and production launch signoff remain pending.

## Operations
Products: create a draft SKU; enter price in JMD cents (J$1,250 = 125000), in-store reference separately, initial stock, specs as JSON, image URL, sample flag. Publish when approved. For existing stock changes use Online inventory > Adjust stock, with reason. Never turn off sample flag merely to enable a purchase without validated real data.

Orders: externally confirm bank funds first; owner records the real reference. Advance through picking > packed > dispatched > delivered, or ready_for_pickup > collected. Unpaid orders cannot be fulfilled. Cancelling an unpaid order releases its hold. Paid refunds remain blocked pending reconciliation integration.

Quotes: review the customer request, store response and validity date. Communicate via an approved channel until email delivery is configured. A saved response does not mean an email was sent.

Backup/recovery: confirm Supabase backup plan and retention in the project's database settings; export schema/approved data before launch, restore into a separate test project and run the commerce assertions before pointing production at it. Restore was not performed in this session.

Search launch: replace staging policies, add verified canonical domain and real Product/Offer data, remove noindex only after owner approval; verify Search Console and submit sitemap. Search ranking and recrawl times are controlled by search engines.

## Acceptance summary
AC-01: desktop and 390 px storefront browser inspection and mobile navigation toggle performed. Other widths and assistive-technology checks pending.
AC-02/03/04/05: partial; basic SKU, price and catalog management implemented; full variant/media/import acceptance pending.
AC-06/09/11: transactional assertions and simultaneous two-request oversell test passed; full browser acceptance pending.
AC-07/08/10/12/13/14/15/16/17/18/19/20: partial or blocked as detailed above; not marked accepted merely because a screen exists.
