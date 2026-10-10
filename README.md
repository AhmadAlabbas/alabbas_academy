# Hostinger deployment — PHP + MySQL

Requires PHP 8.1+ with PDO MySQL, Apache/LiteSpeed rewrite support, and MySQL 8 or MariaDB 10.5+. No Node.js is needed on Hostinger.

1. In hPanel, create a MySQL database and database user, and enable HTTPS for your domain.
2. In Hostinger File Manager, upload the CONTENTS of `public_html/` into your domain's `public_html` directory. Include the hidden `.htaccess` file. Keep an archive of existing site files before replacing anything.
3. The schema and sample courses are bundled in `setup-data.php`; no additional database fixture upload is required.
4. Copy `config.example.php` to `config.php` one directory ABOVE `public_html`. Enter your database host/name/user/password there. Choose a random installation key of at least 32 characters for `setup_key`. Do not share these credentials in chat or commit this file.
5. Visit `https://YOUR-DOMAIN/install.php`. Enter your installation key and create the administrator account. The installer creates the tables and four fictional courses. It refuses to run again once an administrator exists.
6. Delete `public_html/install.php` and clear `setup_key` from `config.php`. Log in at your domain with your new administrator account. Open Dashboard to manage courses, direct HTTPS video URLs, downloadable files, and three-option exam questions.
7. Verify: sign up a separate student; confirm it cannot access Dashboard; enroll in a sample course; open a lesson and take its exam. Create/edit a course as the administrator and confirm it appears for the student.

Public registrations create STUDENT accounts only. Passwords use PHP password_hash/password_verify. Session cookies use HttpOnly, SameSite Strict and Secure on HTTPS; login attempts are throttled; queries are parameterized; exam answers are hidden from catalog responses and attempts are persisted.

Enrollment remains explicitly demo-only. This version does not charge customers. Real sales require a payment provider, server-verified payment webhooks, and purchase-controlled enrollment before launch. Password recovery/email verification are not yet implemented. Lesson video files should be hosted on a suitable media service; the editor accepts direct HTTPS video links. Downloadable files (5 MB each) are stored in course JSON in MySQL; use object storage for a larger production catalog. Set PHP post_max_size to at least 20M if uploading several resources.

Files are prepared for deployment; this does not mean they are uploaded or live on your Hostinger account.

## Git deployment

Select branch `hostinger` and keep destination `public_html` in Hostinger. The deployment branch contains only the PHP website at its root. It never includes database credentials or live user data. After deployment, use File Manager to create the private config.php above public_html, then visit /install.php. If Hostinger left its placeholder index.php or default.php in public_html, remove only that known placeholder so index.html is displayed.
