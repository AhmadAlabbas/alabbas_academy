# Alabbas Academy

The current full platform is in **[platform/](platform/README.md)** on the `platform` branch. It uses Next.js standalone with **MySQL/MariaDB**, Arabic/English pages, the academy logo palette, SAR, verified accounts, carts, pending checkout, protected learning/exams/certificates, and administration. **Payments remain OFF by default.**

The root `package.json` and `server.js` also launch the full platform: run `npm ci`, `npm run build`, then `npm start`. Installation uses the locked dependencies in `platform/`. The original local demo is preserved separately as `legacy-server.cjs`.

If Hostinger says “missing package.json”, ensure GitHub's **default branch is platform** (repository → Settings → General → Default branch), then refresh the repository import. The PHP `hostinger` branch has no Node package manifest. Keep its existing deployed branch unchanged.

Use the [Hostinger Node.js deployment instructions](platform/README.md). The `platform` branch requires a Node.js Web App; the historical PHP application on the `hostinger` branch is retained for rollback. Do not deploy the Next.js source into PHP `public_html`. Publishing requires actual Hostinger access and private database/SMTP settings; a Git push alone does not prove the customer domain changed.

## Earlier local demonstration

A black-and-white course academy with a responsive catalog, account signup/login, demo enrollment, lessons and downloadable resources, server-scored multiple-choice exams, and an administrator course editor.

Requires Node.js 22 or newer. No external packages are required.

```sh
npm run start:legacy
npm run test:legacy
```

The server listens on port 3000 (override with `PORT`). Register the first account to become the administrator; subsequent accounts are students. Open Dashboard to add/edit courses, lesson video URLs, uploaded resources, and exam questions. Video links can be YouTube watch/share links or direct playable HTTPS video files. Local resources are limited to 5 MB each.

Data is persisted in ignored `data/db.json`. Override its directory with `ACADEMY_DATA_DIR`. Passwords use salted scrypt hashes; session cookies are HttpOnly and SameSite Strict. Sessions expire after one day and are cleared on server restart.

This is a development demo. Catalog content is fictional and checkout does not collect payments. Before public deployment, configure HTTPS and secure cookies, a production database/file storage, rate limiting, password recovery/email verification, explicit administrator provisioning, and a payment provider with verified webhooks. Do not use first-account administrator registration on a publicly accessible production site.

For PHP/MySQL hosting, use [the Hostinger deployment](deploy/hostinger/README.md). It contains the same frontend with a PHP API, MySQL schema, and protected administrator installer. The Node.js version above remains available for local development.

The sample catalog includes 8 lessons, 4 public YouTube references, 4 practice worksheets and 20 exam questions with feedback. Existing untouched sample content upgrades while edited fields remain intact. The website uses the blue, gold and navy logo palette.
