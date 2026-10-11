# Hostinger release validation — 11 October 2026

The source release targets branch `platform`, application root `platform`, Node 22.18+ (validated on Node 24.19), and MySQL 8 / MariaDB 10.6+. The live Hostinger site has **not** been verified or configured from this environment. The user's publication authorization is recorded; hosting access/configuration remains the external prerequisite.

## Requirement checklist

| Requested area | Implementation and remaining activation |
|---|---|
| Hosting and database | Next standalone `server.js`, MySQL Prisma schema, two official fresh-database migrations, persistent `UPLOAD_DIR`; no Docker/Redis/daemon required |
| Bilingual design | Arabic default RTL, English LTR, remembered language, logical layouts, original navy/sky/gold cards, IBM Plex Sans Arabic/Inter via `next/font/local`, editable brand and homepage copy |
| Public pages | Database home/catalog/course/instructor/About/Contact/Privacy/Terms/Refund Policy; search/category/level/price/language/sort filters; contact persistence and encrypted email notification |
| Accounts | Argon2 credentials, verification/resend/reset, expiring single-use tokens, secure revocable sessions, profile/avatar/language/password, database rate limits and same-origin checks; Google ownership linking implemented but private OAuth keys required |
| Cart and checkout | Guest storage/account merge, owned-course exclusion, server prices/discounts, scoped coupon limits/reservations, retry-safe order snapshots and order summary |
| Manual payment | Default pending orders grant no access; administrator confirmation creates one enrollment/redemption/receipt; free verified-user enrollment and refund/revocation |
| Moyasar | Provider interface, local SDK/widget, bounded authenticated API verification, secret-protected deduplicated webhook/return verification and full refund reconciliation. **Disabled by default.** Actual provider payment/refund requires private keys and test-mode acceptance |
| Learning | Protected published lessons/files, YouTube/Vimeo/Bunny embeds and range-served uploaded MP4, lesson resume/private notes/progress, timed server-graded sample exams, attempt limits, completion gates, bilingual protected PDF, enrolled-only moderated reviews |
| Administration | Role-checked dashboard/chart; searchable paginated content/curriculum/exams/coupons/settings/contact/user/order/review/audit records, uploads, lesson/section reordering, bans/roles/free enrollment, confirmation/refund/CSV and bounded email retries |
| Content seed | Repeatable private-env administrator, 12 marked fake bilingual courses, 6 categories, 3 fictional instructors, sample videos/files/exams, FAQ/testimonials/home/policy text and 2 coupons. Existing editorial changes preserved |
| SEO | Public SSR, bilingual metadata/canonical/hreflang/x-default, generated OG/Twitter images, Course/Offer/Breadcrumb/Organization/WebSite/FAQ/rating JSON-LD, localized database sitemap, robots and private noindex |
| Security | Server validation and fresh roles/account status, protected filesystem paths/files, bounded uploads with signatures, safe embed providers, no public secret payloads, headers/CSP, encrypted database queues, atomic order/coupon/enrollment handling |
| Deployment deliverables | Complete source/lockfile, `.env.example`, exact Hostinger/SMTP/OAuth/payment/content-edit instructions in README, checked standalone runtime packaging and this checklist |

## Executed checks

- Frozen `npm ci`: passed with the committed dependency versions.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed. Build generated the standalone application successfully.
- `npm test`: **199 passed**, **34 database-only tests explicitly skipped** by the unit-only command.
- `npm run test:database`: **34 passed** across six files, using an isolated loopback MariaDB database. Both official migrations applied from empty. The runner dropped only its generated `academy_test_*` database.
- Database invariants covered account ownership, tokens/revocation, concurrent carts/orders, coupon/price snapshots, repeated manual fulfillment/refund, notification deduplication, atomic rate limits, email retry/expiry, concurrent bounded retention, exam/certificate gates, and delayed verified payment after reservation expiry.
- Seed executed twice: both runs retained **12 courses / 6 categories / 3 instructors** and printed no password.
- Production browser smoke: **19 checks passed**, including public Arabic/English/encoded Arabic course routes, admin credentials, actual TXT upload/attachment, administrator/enrollment file denial, pending checkout, paid confirmation, learner player, protected download, lesson completion, server grading and completion PDF. Arabic layout checked at widths 320, 390, 768, 1024 and 1440 with no horizontal overflow. Generated Arabic social image and database sitemap returned success.
- Certificate downloaded through the protected production route and visually inspected: correct joined Arabic word order and embedded Latin text; revoked/unenrolled access stays protected.
- Standalone upload package: started independently; database health, bilingual pages, logo, generated OG image and sitemap succeeded with payments disabled. Package excludes private `.env`, uploads and local data.
- `npm audit --omit=dev`: **zero production vulnerabilities** after targeted dependency updates/overrides. Nodemailer 10.1.0 and patched MariaDB/MySQL2/deepmerge versions are locked; account/SMTP/database/build checks passed with them. No forced framework downgrade was used.
- Full development audit still reports **five high findings** in the single ESLint `fast-glob → micromatch → braces` chain. Registry reports all braces versions affected and offers an incompatible Next lint downgrade. These are build/lint tooling, excluded from the standalone runtime; no arbitrary customer glob patterns reach this chain. Recheck for an upstream fix before executing lint against untrusted pattern inputs.
- Lighthouse 13.5 mobile report on the local production Arabic homepage: **Performance 92 / Accessibility 100 / Best practices 100 / SEO 92**, FCP 0.9 s, LCP 3.3 s, TBT 40 ms, CLS 0. Accessible-label observations were corrected and rechecked. SEO's only failed audit was the loopback canonical hostname; final Hostinger-origin metadata must be checked on the actual domain. **The 95+ performance target is not yet achieved or claimed.** Report artifacts are retained privately in `/tmp/alabbas-lighthouse-final.json` and `/tmp/alabbas-hostinger-home.png`.

## Required hosting actions and unverified integrations

1. In the existing Hostinger **Node.js Web App**, select GitHub **platform** branch and **platform** root; Node 22+, build `npm run build`, start `npm start` / entry `server.js`. Do not install this app into the historical PHP site.
2. Configure a dedicated platform MySQL database/user, private auth secret, matching customer-domain origins, persistent uploads, SMTP mailbox/sender and private seed-admin variables. Apply `npm run db:deploy` and `npm run db:seed` from the source checkout. No live database or private mailbox was reachable here.
3. Verify signup → real verification email → login on staging/customer origin; verify uploads survive a redeploy and the host passes the full learner/admin flow. SMTP/Resend, Google login and Moyasar were tested with local logic/mocks, **not live credentials**.
4. Keep `PAYMENTS_ENABLED=false` today. Before enabling real payments, complete Moyasar test-mode payment/webhook/refund with the approved account. No real card charge/refund was performed.
5. Review sample/legal/contact material and back up the previous site/database before customer advertising. Measure performance on the final host; no live customer-readiness claim is made yet.

Native Git read/push is available through the existing GitHub authentication proxy. No Hostinger deployment connector/SSH binding is available. HTTPS inspection of `alabbasacademy.com` was denied by the current egress proxy (CONNECT 403); a saved network draft is not a running network change. Pushing source does not prove Hostinger deployed it. Publication must be confirmed by the deployed source commit and customer-domain checks.


## Repository import follow-up — 11 October 2026

The supplied Hostinger import PDF reported no `package.json`. Native Git confirmed GitHub's default HEAD remains `hostinger`, the PHP branch, which has no package manifest. The user must select/change the repository default to `platform` before refreshing the import; that metadata change cannot be performed through the available deployment tools.

The platform branch's root entry previously launched the historical Node demo. Root `package.json`/lockfile now install the platform's exact locked dependencies, forward build/check/database commands, and root `server.js` starts the full Next application. The demonstration is preserved as `legacy-server.cjs` and explicit legacy scripts. Next tracing/Turbopack roots are pinned to `platform` so a root npm lockfile does not move the standalone server output. Hostinger can use root `platform` (recommended) or `.` with this bootstrap. PHP deployment branch/files remain unchanged.

Executed root commands: `npm ci`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (199 passed / 34 DB-only skipped), `npm run test:legacy` (3 passed), `npm run prepare:hostinger`, and `npm start` with a dedicated test port. Ten Arabic/English home/catalog/login/signup/cart HTTP checks passed. MySQL health returned ready with payments disabled; the legacy `/api/me` endpoint correctly returned 404. The actual platform production audit still returned zero vulnerabilities (audit from a dependency-free root alone would not audit the nested application). Live Hostinger import/domain configuration remains unverified.
