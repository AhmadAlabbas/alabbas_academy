# Platform architecture

Phase 1 establishes the application and persistence foundation. The subsequent integrations below are approved design decisions, not completed services. The current PHP/MySQL application remains separate until a tested migration and domain cutover.

## Runtime and presentation

The platform uses Next.js App Router, TypeScript, React 19, Tailwind CSS 4, and `next-intl` 4. Arabic is the default locale. Public routes have an explicit `/ar` or `/en` prefix; Arabic layouts set RTL direction. Locale changes keep the corresponding page when a translation exists. Shared design tokens use the academy logo's navy, light blue, and gold, with neutral surfaces, course cards, readable typography, and visible focus states.

Server-rendered catalog pages use bilingual demonstration content while the persistence layer is established. Only implemented destinations belong in active navigation. Authentication and checkout links must not imply functioning account or payment flows before those features are delivered.

Amounts are stored as integer halalas and displayed as SAR with locale-aware formatting. A translated label never changes the underlying amount. Checkout will calculate totals on the server; browser-submitted prices will not be authoritative.

## Data and service boundaries

PostgreSQL 17 is the persistence service. Prisma 7 uses the PostgreSQL driver adapter, `@prisma/adapter-pg`; generated types and the schema provide a shared contract. Apply versioned migrations through a release job. Runtime processes should not race to migrate or seed a database.

| Area | Intended records and responsibilities |
| --- | --- |
| Accounts | Users, OAuth accounts, verification and reset tokens, roles, revocable sessions |
| Catalog | Courses and localized content, categories, tags, instructors, sections, lessons |
| Media | Video assets, thumbnails, private attachments, provider references |
| Commerce | Carts, orders, immutable purchase items, payments, webhook events, refunds |
| Discounts | Coupons, reservations, redemptions, usage constraints |
| Learning | Enrollments, progress, exams, attempts, certificates, reviews |
| Content | Localized pages and blocks, FAQs, testimonials, navigation, settings |
| Operations | Audits, redirects, background jobs, delivery and reconciliation status |

Arabic and English content use translation records rather than a language-dependent price or payment identity. Localized slugs resolve to the same course. Orders will snapshot the title, amount, tax, and discount applied at purchase so later catalog changes do not rewrite historical receipts. Unique constraints will guard enrollment identity and duplicate provider processing. The existence of a model in Phase 1 does not mean its feature has been implemented.

## Planned integrations

- **Auth.js:** hashed passwords, verified email, Google sign-in, password reset, session revocation, and centralized authorization. Linking a Google account to an existing email account requires proof of ownership.
- **Resend:** Arabic and English account emails and receipts, processed through a persisted delivery queue. Message templates contain the correct locale and public origin.
- **Moyasar:** server-calculated SAR totals, verified payment callbacks, authenticated webhook handling, and duplicate-safe fulfillment. Access follows server-confirmed payment; a redirect or client response is insufficient. Refund status must be verified before entitlement changes.
- **Bunny Stream:** a video provider boundary with enrollment checks and short-lived playback authorization. Public YouTube videos can remain course previews. Paid lesson assets require private delivery.
- **Private object storage:** enrollment-gated attachments, short-lived download access, content-type/size restrictions, and server-side object keys. Public browser variables never contain storage access keys.
- **PostgreSQL-backed jobs:** durable email, reconciliation, and certificate tasks with retries, idempotency, and observable failure state. Multiple workers must claim work safely.

Server secrets stay in runtime environment settings. `NEXT_PUBLIC_` values are public configuration and can enter JavaScript bundles. The local sample database password in `compose.yaml` is restricted to development; use distinct production credentials and the database provider's supported TLS verification.

## Deployment and migration

The Next.js standalone build runs on Node.js 24 LTS, or a compatible Node.js 22.18+ runtime. Production hosting requires Node.js and PostgreSQL. The existing Hostinger PHP plan can continue serving the PHP site; a VPS or compatible Node hosting and a PostgreSQL service are required for the new runtime.

The release workflow will build once, apply migrations separately, start the application behind an HTTPS reverse proxy, and verify the release before changing the domain. Seed data is optional development content and never an automatic production boot action.

The final phase will read the existing PHP/MySQL schema and export/import records into PostgreSQL with explicit ownership and status mappings. Password hash compatibility, verified-email status, course identifiers, payment history, enrollments, and media references need migration checks. Rehearse the import against a database copy, compare record counts and representative accounts, and establish a rollback window before a production cutover.
