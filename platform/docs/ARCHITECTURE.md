# Platform architecture

The platform contains the bilingual foundation, accounts and course carts. The PHP/MySQL application and its Hostinger deployment remain separate until a tested migration and domain cutover. A schema model is not a delivered feature: payments, protected learning and full administration remain planned.

## Runtime and presentation

The platform uses Next.js App Router, TypeScript, React 19, Tailwind CSS 4, and `next-intl` 4. Arabic is the default locale. Public routes have an explicit `/ar` or `/en` prefix; Arabic layouts set RTL direction. Locale changes keep the corresponding page when a translation exists. Shared design tokens use the academy logo's navy, light blue, and gold, with neutral surfaces, course cards, readable typography, and visible focus states.

Public catalog pages currently use bilingual demonstration content. Course cards and detail pages offer real add-to-cart controls. Login, signup, recovery, verification, cart and account settings have localized routes. Missing production services produce an unavailable-service message rather than a successful registration.

Amounts are integer halalas, displayed as SAR. Guest carts store course identifiers; account carts use current published database courses and prices. Browser prices and user identities are not authoritative. Database-backed public catalog administration, search and filters belong to Phase 3.

## Accounts and authorization

Auth.js `5.0.0-beta.32` supplies the Next.js 16 authentication integration. Passwords use Argon2id. Registration assigns the learner role; browser input cannot assign administrator privileges. Account settings support name, preferred language, preset avatars, password changes and verification resend.

JWT sessions contain a random session anchor whose hash is stored in PostgreSQL. Server account reads check the anchor, expiry, user status and session version. Password reset and change revoke existing sessions. Verification/reset tokens are stored as hashes, expire and are consumed atomically; visiting a link does not consume it before explicit submission.

Google is optional. New verified Google identities can register. Linking to an existing email account requires a recent, verified password session for the same account. Manual linking and ownership checks avoid linking solely because provider emails match.

Unsafe account requests require an explicit allowed origin and bounded JSON. Persistent rate limits use HMAC-derived identity keys and atomic database updates. Vercel's controlled client-address header is trusted on Vercel; other proxies require `AUTH_TRUSTED_PROXY=1` and must replace client-supplied forwarding headers. Private account/cart responses are not publicly cached.

## Cart persistence

Guest storage contains whitelisted demonstration course identifiers. After login, selections merge into the account cart and the guest copy is cleared after confirmation. Account reads/mutations recheck publication, enrollment and database prices. Active/completed enrollments are excluded; revoked access does not imply ownership.

Transactions serialize first-cart creation and concurrent changes. Client mutations are scoped to the initiating account; session changes clear stale state so one user's cart cannot be copied into another account or guest storage. Account carts persist through PostgreSQL. Cross-tab events refresh account/cart state.

The current cart offers login/verification guidance and reports that checkout is coming. Cart membership never grants enrollment or creates an order/payment.

## Account email and jobs

Registration, recovery and verification resend commit tokens and email jobs in one transaction. Queue payloads use AES-256-GCM with a key derived from `AUTH_SECRET`; token plaintext is not stored in readable queue JSON. Bilingual templates escape user content and use a configured application origin.

Resend is the production transport. Local development can explicitly choose `EMAIL_TRANSPORT=outbox`, writing private ignored files; production rejects this mode. Delivery runs after account responses, with a retry worker for pending jobs. Workers claim leased jobs with `SKIP LOCKED`, use provider idempotency keys, back off failures, and discard expired, consumed or exhausted jobs while clearing sensitive payloads.

`POST /api/jobs/email` authenticates a separate `JOB_WORKER_SECRET` in a bearer header and delivers a bounded batch. A scheduler must support POST and that header; Vercel cron GET requests are not an equivalent integration. `npm run email:work` can process a batch on a trusted Node host. Never log transport credentials or account links/tokens.

Keep `AUTH_SECRET` stable. Rotation invalidates sessions and makes previous queued payloads unreadable; drain the queue and plan recovery before rotation.

## Data and service boundaries

PostgreSQL 17 is the persistence service. Prisma 7 uses the PostgreSQL driver adapter, `@prisma/adapter-pg`; generated types and the schema provide a shared contract. Apply versioned migrations through a release job. Runtime processes should not race to migrate or seed a database.

| Area | Records and delivery state |
| --- | --- |
| Accounts | Implemented users, OAuth identities, verification/reset token hashes, roles, session revocation and rate limits |
| Catalog | Courses and localized content, categories, tags, instructors, sections, lessons |
| Media | Video assets, thumbnails, private attachments, provider references |
| Commerce | Implemented guest/account carts; orders, immutable purchase items, payments, webhooks and refunds remain planned |
| Discounts | Coupons, reservations, redemptions, usage constraints |
| Learning | Enrollments, progress, exams, attempts, certificates, reviews |
| Content | Localized pages and blocks, FAQs, testimonials, navigation, settings |
| Operations | Implemented account email jobs; broader audits, reconciliation and reporting remain planned |

Arabic and English content use translation records rather than a language-dependent price or payment identity. Localized slugs resolve to the same course. Orders will snapshot the title, amount, tax, and discount applied at purchase so later catalog changes do not rewrite historical receipts. Unique constraints will guard enrollment identity and duplicate provider processing. The existence of a model in Phase 1 does not mean its feature has been implemented.

## Planned integrations

- **Receipts and additional jobs:** bilingual purchase receipts, payment reconciliation and certificates, with durable retries, idempotency and observable failure state. Account email delivery is already implemented.
- **Moyasar:** server-calculated SAR totals, verified payment callbacks, authenticated webhook handling, and duplicate-safe fulfillment. Access follows server-confirmed payment; a redirect or client response is insufficient. Refund status must be verified before entitlement changes.
- **Bunny Stream:** a video provider boundary with enrollment checks and short-lived playback authorization. Public YouTube videos can remain course previews. Paid lesson assets require private delivery.
- **Private object storage:** enrollment-gated attachments, short-lived download access, content-type/size restrictions, and server-side object keys. Public browser variables never contain storage access keys.

Server secrets stay in runtime environment settings. `NEXT_PUBLIC_` values are public configuration and can enter JavaScript bundles. The local sample database password in `compose.yaml` is restricted to development; use distinct production credentials and the database provider's supported TLS verification.

## Deployment and migration

Node.js 24 LTS is preferred; compatible Node.js 22.18+ is supported. Vercel deploys the `platform` branch, root directory `platform`, framework Next.js, with PostgreSQL. Accounts/email need the settings and migrated schema described in [Vercel setup](VERCEL_SETUP.md). The existing Hostinger PHP site stays on its separate deployment branch.

The standalone Docker build remains available for a Node host behind HTTPS. Migrations run separately from replicas. Demo seeding is explicit and preserves existing course edits; it is not a production boot action. Do not deploy this application into the PHP site's `public_html`.

The final phase will read the existing PHP/MySQL schema and export/import records into PostgreSQL with explicit ownership and status mappings. Password hash compatibility, verified-email status, course identifiers, payment history, enrollments, and media references need migration checks. Rehearse the import against a database copy, compare record counts and representative accounts, and establish a rollback window before a production cutover.
