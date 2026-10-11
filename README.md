# Alabbas Academy

The current Vercel application is in **[platform/](platform/README.md)** on the `platform` branch. It uses Next.js, PostgreSQL, Arabic/English pages, the academy logo palette, SAR prices, accounts with email verification and password recovery, profile settings, and persistent guest/account carts. Set Vercel's root directory to `platform` and framework to **Next.js**.

Follow **[the browser-only Vercel setup guide](platform/docs/VERCEL_SETUP.md)** to connect PostgreSQL and verification email without downloading the project. A successful deployment does not activate accounts until those services and migrations are configured. Checkout, protected learning, and full administration remain later phases; see [delivery status](platform/docs/PHASES.md).

The PHP/MySQL site in [deploy/hostinger/](deploy/hostinger/README.md) and the `hostinger` branch are retained for the existing hosting deployment. The root-level Node application described below is the earlier demonstration, separate from the new Vercel platform.

## Earlier local demonstration

A black-and-white course academy with a responsive catalog, account signup/login, demo enrollment, lessons and downloadable resources, server-scored multiple-choice exams, and an administrator course editor.

Requires Node.js 22 or newer. No external packages are required.

```sh
npm start
npm test
```

The server listens on port 3000 (override with `PORT`). Register the first account to become the administrator; subsequent accounts are students. Open Dashboard to add/edit courses, lesson video URLs, uploaded resources, and exam questions. Video links can be YouTube watch/share links or direct playable HTTPS video files. Local resources are limited to 5 MB each.

Data is persisted in ignored `data/db.json`. Override its directory with `ACADEMY_DATA_DIR`. Passwords use salted scrypt hashes; session cookies are HttpOnly and SameSite Strict. Sessions expire after one day and are cleared on server restart.

This is a development demo. Catalog content is fictional and checkout does not collect payments. Before public deployment, configure HTTPS and secure cookies, a production database/file storage, rate limiting, password recovery/email verification, explicit administrator provisioning, and a payment provider with verified webhooks. Do not use first-account administrator registration on a publicly accessible production site.

For PHP/MySQL hosting, use [the Hostinger deployment](deploy/hostinger/README.md). It contains the same frontend with a PHP API, MySQL schema, and protected administrator installer. The Node.js version above remains available for local development.

The sample catalog includes 8 lessons, 4 public YouTube references, 4 practice worksheets and 20 exam questions with feedback. Existing untouched sample content upgrades while edited fields remain intact. The website uses the blue, gold and navy logo palette.
