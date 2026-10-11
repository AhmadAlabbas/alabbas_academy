# Current architecture

Next.js standalone Node process, Prisma/MySQL/MariaDB, Auth.js credentials/Google and next-intl Arabic/English. No Docker, Redis, cron or separate worker service is needed. The former PostgreSQL architecture is archived.

Prices are integer SAR halalas. Checkout locks the user/cart and coupon, snapshots order items and creates no enrollment until payment is verified or manually confirmed. Fulfillment locks the order and writes access plus the encrypted receipt job in one transaction.

Fresh session/user/role checks protect every private page and API; same-origin checks and bounded JSON protect browser mutations. File uploads live in an absolute private UPLOAD_DIR outside the build; only image assets are public. Protected lesson files require a published lesson and active enrollment. Exams retain private question snapshots; the server scores answers and checks time/attempt limits. Certificates require every published lesson and all required exam passes.

SMTP/Resend delivery uses encrypted persisted jobs and bounded request/admin batches. Atomic conditional updates claim jobs. SMTP has at-least-once delivery semantics after ambiguous provider failures.

See ../README.md for configuration, deployment, operational limits, sample replacement and integration prerequisites.
