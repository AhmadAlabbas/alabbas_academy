> Historical PostgreSQL/Phase 2 report. For the current MySQL Hostinger release, see [HOSTINGER_VALIDATION.md](HOSTINGER_VALIDATION.md).

# Phase 1 validation

This document records the foundation release. See [the accounts and carts validation](PHASE2_VALIDATION.md) for the current Phase 2 results and activation requirements.

Validated on the cloud runner on 2026-10-10 with Node.js 24.19.0, PostgreSQL 17, and the committed npm lockfile. This report concerns the new development platform; it does not certify authentication, commerce, private playback, administration, or production launch.

## Application

- A clean `npm ci` completed with package integrity and TLS verification enabled.
- Prisma client generation, TypeScript, ESLint, and the production Next.js build passed.
- All 50 automated foundation tests passed: exact SAR/halala conversion and limits, Arabic search normalization, combined catalog filters, price ordering without source mutation, translation-key/ICU validity, and encoded/localized course slug lookup.
- Browser checks passed for Arabic defaults, RTL/LTR, remembered language selection, corresponding course slugs, search/filter/sort, empty-state recovery, keyboard/mobile navigation, and responsive layouts. Production checks also covered canonical metadata, sitemap, robots, security headers, assets, and absence of public exam answer keys. No browser page errors or horizontal overflow were observed.
- Reflow checks at 320 CSS pixels passed in both languages for the home, catalog, about, and course-detail layouts.
- Home, about, and eight localized course-detail pages are statically generated; the catalog renders on the server. The sitemap contains 14 localized URLs. Unknown pages and missing courses return HTTP 404 with a translated recovery screen and `noindex`.

The catalog loading boundary is scoped to the browse route group. Complete localized router-level 404 documents use Next.js's experimental `globalNotFound` flag, while the static demonstration course route sets `dynamicParams=false`. Raw responses were checked for true HTTP 404, Arabic/English `lang` and RTL/LTR `dir`, translated recovery content, and `noindex`; this supports the dynamic locale root layout while preserving static public pages. Recheck these choices when upgrading Next.js or introducing database-backed courses. The production startup helper runs the supported standalone server and copies the public/static assets required by Next.js.

## Database

- Prisma's official matching schema WASM validated 61 models and 19 enums.
- The initial committed migration deployed through Prisma's official WASM engine. Clean and repeat deployments passed; concurrent deployment applied a migration exactly once; altered migration checksums were rejected.
- Seed repetition created four courses initially and zero on subsequent runs. Counts verified: four instructors, eight course translations, eight curriculum sections, 32 lessons, eight exams, 24 questions, and 72 options.
- Editorial changes survive seeding. Optional administrator checks verified Argon2id hashing, rejection of weak or incomplete credentials, and preservation of existing passwords and roles. The default seed creates no user, order, or enrollment.
- Eleven PostgreSQL constraint checks passed, covering negative prices, inconsistent totals, case-colliding email, cart ownership, unverified or duplicate captured payments, duplicate enrollments, protected financial history, ratings, and coupon parameters.

Native Prisma migration downloads returned an egress-policy denial. The reusable `db:migrate:wasm` command uses version-pinned official npm artifacts and the engine's migration history, locking, and checksum checks. Verification was never disabled. See [DATABASE.md](DATABASE.md).

## Deployment and dependency audit

The standalone Docker image runs as non-root UID 1001. Its test runtime contained no database URL, host proxy variables, trusted build certificate, or mounted build secret. Arabic/English home, catalog, course pages, sitemap, robots, and health responses were exercised. Build networking uses the runner's existing proxy and trusted CA through optional build arguments and a BuildKit secret; credentials and certificates are not baked into the runtime image.

The final Docker build exited successfully. Image `eedb2851da185` passed 18 response/content/asset/redirect checks, including raw localized 404 documents for unknown pages, unknown courses, and dotted paths, plus Googlebot and the default Arabic redirect. The isolated smoke container was healthy.

The full npm audit reports **nine high affected-package findings** across two tooling dependency chains. These represent three high underlying advisories and one moderate advisory, rather than nine independent advisories:

| Chain | Installed leaves | Status |
| --- | --- | --- |
| Next ESLint | `braces@3.0.3`, through micromatch/fast-glob | No patched braces release is published. The latest stable Next ESLint configuration retains the chain. |
| Prisma CLI/config | `deepmerge-ts@7.1.5`, `mysql2@3.15.3` | Patched leaf versions exist, but stable Prisma 7.10.0 pins these versions. A deepmerge upgrade changes its major version; overrides need separate compatibility validation. |

`npm audit --omit=dev` still reports four affected-package findings: `@prisma/client` declares Prisma as an optional peer, causing npm to retain the CLI chain in its production dependency graph despite the direct development declaration. This is **not a clean production-graph audit**.

Source review found no request-time import of the affected tooling paths. The actual Phase 1 standalone image was inspected: Prisma CLI/client, mysql2, deepmerge-ts, and ESLint packages are absent because the public sample pages do not access the database. Recheck tracing and audit results when later phases introduce database-backed requests. Upstream tooling advisories remain unresolved; do not downgrade Next or Prisma through `npm audit fix --force`.

## Remaining phases

The Thmanyah reference website was blocked by the current egress policy; this foundation uses original cards and assets, the academy logo palette, and free IBM Plex Sans Arabic/Inter fonts. It does not claim a verified reproduction of that site's exact typography or layout. Reference-domain additions and reusable install/start instructions are saved in the environment draft; saving does not publish or update the running network policy.

Authentication and Google linking, Resend email, Moyasar verification/webhooks/refunds, protected Bunny playback/downloads, real exams/certificates, full administration, PHP data migration, CSP/HSTS rollout, and measured Lighthouse targets belong to [the remaining delivery phases](PHASES.md). No external integration or Lighthouse 95+ result is claimed in Phase 1. The live PHP application and Hostinger deployment branch are retained.
