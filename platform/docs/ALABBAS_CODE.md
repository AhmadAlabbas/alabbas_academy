# ALABBAS Code — interactive programming laboratory

ALABBAS Code is a **native-to-the-Academy**, bilingual learning experience with its own layout at:

- `https://alabbasacademy.com/code/ar` — Arabic
- `https://alabbasacademy.com/code/en` — English

This is a functional first release, not a clone of Codecademy and not yet certified training or a production subdomain deployment. The customer-facing site remains unchanged until approved deployment.

## What works

- A distinct, responsive public dashboard with three learning tracks and **13 authored exercises**.
- HTML structure, CSS design, and introductory JavaScript lessons in Arabic and English.
- Source code editing with HTML/CSS/JavaScript tabs, line numbers, Tab-to-indent, and keyboard shortcuts.
- **Run** executes a preview only in an opaque-origin sandboxed iframe, never on the Academy server.
- HTML DOM, CSS declarations and JavaScript source structure are checked to give immediate **formative** learner feedback.
- Hints, retries, pass/fail feedback, next lesson, saved code drafts, and progress counts.
- Guests keep progress and drafts locally. Verified Academy users get durable completed-lesson status in a new database table.
- Academy navigation links to the coding product. The sitemap advertises the two Code landing pages.

## Developer setup

Use the existing Next.js `platform/` deployment and database, not the retired PHP app.

```sh
cd platform
npm ci
npm run db:generate
npm run db:deploy
npm run lint
npm run typecheck
npm test
npm run build
```

A production database migration creates `code_lesson_progress`. Back up the database, review the migration, and deploy it using the existing production migration procedure **before** releasing the new app. No new external NPM package was added.

## Security boundaries

The untrusted code editor is client-only and limited to 40,000 characters per file. User-supplied JavaScript executes in `<iframe sandbox="allow-scripts">` without `allow-same-origin`. The iframe sends cosmetic console output to the parent; the parent validates the message source and run ID. A restrictive CSP blocks `fetch`, frames, forms, objects, and standard resource origins inside the preview. The parent origin never `eval`s student code and the server **never executes arbitrary student code**. Some malicious/infinite-loop learner scripts can still hang a browser tab; isolate such workloads further before inviting untrusted code contests.

Checks are deliberately low-stakes source/DOM/CSS rules; they do **not** guarantee semantic correctness, block cheating, qualify for certificates, or unlock paid content. Do not attach certificates or payments to this mechanism. Future proctored testing would require a separate sandboxed, server-verified assessment service.

The new API `/api/code/progress` uses the existing verified-account session, same-origin request validation, Zod input validation and a lesson allowlist. Progress rows are per-user and cascade-delete with the user. Unauthorized requests cannot read others' progress. Browser drafts stay on device, are not uploaded as student-authored source code, and may be lost if browser storage is cleared.

## Subdomain rollout plan — do not attach DNS blindly

The intended public domain is **code.alabbasacademy.com**, but it is **not configured** by these repository changes. The first release is safely served under `alabbasacademy.com/code/{locale}` with the original Academy authentication cookies. Once tested, create a host-level subdomain route or proxy to this existing application, preserve HTTPS and same-origin protections, then decide whether to support a shared login across sibling domains with explicit secure cookie/SSO design.

Do **not** simply proxy a second hostname to existing Auth.js routes without verifying `AUTH_URL`, OAuth callbacks, cookie scope, sign-in redirects, and `assertSameOrigin`. A separate hostname may require a dedicated authenticated gateway or domain-wide SSO; opening it without testing can break login and progression. Update metadata canonical URLs only after the public subdomain is the canonical location. Keep paid Academy accounts and Code sessions protected.

## Next enhancements

1. Teacher/admin exercise creator and curriculum versioning.
2. Proper JavaScript sandbox tests with execution timeouts and richer telemetry.
3. Monaco editor and structured file trees after pinned dependency review.
4. New Python track using a securely isolated browser runtime.
5. Native Academy app integration and student identity-based cloud drafts.
6. Accessibility audits with screen readers, RTL layout, and tablet keyboards.

## Deployment approval

GitHub push and passing CI do not confirm a live site. Deploy only after reviewing the pull request, applying the database migration, testing real signup/login and browser sandboxing on staging, checking browser performance on mobile, then reviewing production change management.
