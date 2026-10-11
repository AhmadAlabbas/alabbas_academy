# Database

Current provider: **mysql**. Target: MySQL 8 / MariaDB 10.6+; verified in cloud against MariaDB 11.8.6. Run `npm run db:deploy` to apply the checked-in MySQL migrations through the official Prisma migration engine. Run `npm run db:seed` with private seed-admin credentials to initialize sample content.

Historical PostgreSQL migrations/tests are archived and must not be applied to the MySQL database. Preserve the legacy PHP database; create a separate platform database for the Node application. No automatic destructive migration from the old PHP or PostgreSQL schema occurs. See ../README.md.
