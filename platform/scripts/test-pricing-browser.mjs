import assert from 'node:assert/strict';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import mariadb from 'mariadb';
import {encode} from 'next-auth/jwt';

const base = new URL(process.env.ACADEMY_TEST_BASE_URL || 'http://localhost:3001');
const database = new URL(process.env.ACADEMY_TEST_DATABASE_URL || 'mysql://invalid');
const loopback = ['localhost', '127.0.0.1', '[::1]'];
assert.ok(loopback.includes(base.hostname) && database.protocol === 'mysql:' && loopback.includes(database.hostname), 'Pricing tests require a loopback preview and disposable local data.');
assert.ok(process.env.AUTH_SECRET, 'Preview session secret required');
const require = createRequire(import.meta.url), {chromium} = require(process.env.ACADEMY_PLAYWRIGHT_MODULE || 'playwright');
const db = await mariadb.createConnection({host: database.hostname, port: Number(database.port || 3306), user: decodeURIComponent(database.username), password: decodeURIComponent(database.password), database: decodeURIComponent(database.pathname.slice(1))});
const browser = await chromium.launch({executablePath: process.env.ACADEMY_BROWSER_PATH, headless: true});
const artifacts = process.env.ACADEMY_UI_ARTIFACT_DIR;
if (artifacts) await mkdir(artifacts, {recursive: true});
const userId = randomUUID(), categoryId = randomUUID(), courseId = randomUUID();
const courseKey = 'pricing-' + courseId, title = 'Pricing course ' + courseId.slice(0, 8);
const couponIds = [], checks = [], errors = [];
let page;
const route = pathname => new URL(pathname, base).href;
async function fits(label) {assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' fits');}
async function createCoupon(kind, amount) {
  await page.goto(route('/en/admin/coupons?create=1'));
  const code = ((kind === 'PERCENTAGE' ? 'SAVE20-' : 'FIX30-') + userId.slice(0, 8)).toUpperCase();
  await page.locator('[name="code"]').fill(' ' + code.toLowerCase() + ' ');
  await page.locator('[name="kind"]').selectOption(kind);
  const field = kind === 'PERCENTAGE' ? 'percentageBasisPoints' : 'amountHalalas';
  assert.equal(await page.locator('[name="' + (kind === 'PERCENTAGE' ? 'amountHalalas' : 'percentageBasisPoints') + '"]').count(), 0);
  await page.locator('[name="' + field + '"]').fill(amount);
  const pending = page.waitForResponse(response => response.url() === route('/api/admin/coupons') && response.request().method() === 'POST');
  await page.getByRole('button', {name: 'Save', exact: true}).click();
  const response = await pending, result = await response.json();
  assert.equal(response.status(), 200, JSON.stringify(result));
  couponIds.push(result.id);
  assert.equal(result.code, code);
  assert.equal(result.minimumOrderHalalas, 0);
  await page.getByRole('row').filter({hasText: code}).waitFor();
  return code;
}
async function apply(code, locale = 'en', expected = 200) {
  await page.getByLabel(locale === 'ar' ? 'رمز الخصم' : 'Coupon code', {exact: true}).fill(code);
  const pending = page.waitForResponse(response => response.url() === route('/api/checkout/quote') && response.request().method() === 'POST');
  await page.getByRole('button', {name: locale === 'ar' ? 'تطبيق الرمز' : 'Apply coupon', exact: true}).click();
  const response = await pending;
  assert.equal(response.status(), expected);
  return response.json();
}

try {
  const [role] = await db.query("SELECT id FROM roles WHERE slug='administrator'");
  assert.ok(role, 'Seed the local database before pricing checks');
  await db.query('INSERT INTO users (id,email,name,emailVerified,updatedAt) VALUES (?,?,?,NOW(),NOW())', [userId, 'pricing-' + userId + '@example.test', 'Pricing test']);
  await db.query('INSERT INTO user_roles (userId,roleId) VALUES (?,?)', [userId, role.id]);
  await db.query('INSERT INTO categories (id, `key`, title_ar, title_en, updatedAt) VALUES (?, ?, ?, ?, NOW())', [categoryId, categoryId, 'اختبار الأسعار', 'Pricing checks']);
  await db.query('INSERT INTO courses (id, `key`, categoryId, slug_ar, slug_en, title_ar, title_en, description_ar, description_en, priceHalalas, compareAtHalalas, status, isSample, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 14900, 19900, ?, TRUE, NOW())', [courseId, courseKey, categoryId, 'عرض-' + courseId, courseKey, 'دورة اختبار الأسعار', title, 'وصف تجريبي', 'Pricing browser fixture', 'PUBLISHED']);
  const sessionId = randomUUID(), sessionSecret = randomBytes(32).toString('hex');
  await db.query('INSERT INTO sessions (id,tokenHash,userId,expires,sessionVersion) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR),0)', [sessionId, createHash('sha256').update(sessionSecret).digest('hex'), userId]);
  const cookieName = 'authjs.session-token';
  const token = await encode({secret: process.env.AUTH_SECRET, salt: cookieName, token: {sub: userId, sessionId, sessionSecret, sessionVersion: 0}, maxAge: 3600});
  const context = await browser.newContext({viewport: {width: 1280, height: 900}});
  await context.addCookies([{name: cookieName, value: token, url: base.href}]);
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  let releaseScripts;
  const heldScripts = new Promise(resolve => {releaseScripts = resolve;});
  await page.route('**/_next/static/**/*.js', async handler => {await heldScripts; await handler.continue();});
  await page.goto(route('/en/admin/coupons?create=1'), {waitUntil: 'commit'});
  try {
    await page.getByRole('button', {name: 'Loading editor…', exact: true}).waitFor();
    assert.equal(await page.getByRole('button', {name: 'Loading editor…', exact: true}).isDisabled(), true);
    assert.equal(await page.locator('[name="code"]').isDisabled(), true);
  } finally {releaseScripts();}
  await page.getByRole('button', {name: 'Save', exact: true}).waitFor();
  await page.unroute('**/_next/static/**/*.js');
  checks.push('Keep the editor disabled until scripts are ready, preventing native form submission');
  const percentage = await createCoupon('PERCENTAGE', '20');
  const fixed = await createCoupon('FIXED_AMOUNT', '30.00');
  checks.push('Author percentage and fixed-amount coupons with relevant fields, normalized codes and a usable default minimum');

  await page.goto(route('/en/admin/courses?edit=' + courseId));
  await page.getByText('Price preview', {exact: true}).waitFor();
  await page.getByText('25% off', {exact: true}).waitFor();
  const invalid = await page.request.post(route('/api/admin/courses'), {headers: {Origin: base.origin}, data: {id: courseId, data: {compareAtHalalas: 10000}}});
  assert.equal(invalid.status(), 400);
  assert.ok((await invalid.json()).fieldErrors.compareAtHalalas);
  checks.push('Preview the sale price and refuse a misleading original price');

  for (const locale of ['en', 'ar']) {
    await page.goto(route('/' + locale + '/courses/' + (locale === 'en' ? courseKey : encodeURIComponent('عرض-' + courseId))));
    await page.setViewportSize({width: 390, height: 844});
    await fits(locale + ' sale course');
    const symbol = page.locator('aside .riyal-symbol').first();
    await symbol.waitFor();
    assert.ok(await symbol.evaluate(element => {const style = getComputedStyle(element); return style.maskImage.includes('saudi-riyal.svg') && element.getBoundingClientRect().width > 8;}));
    if (locale === 'ar') await page.getByRole('button', {name: /Switch to dark theme|تفعيل المظهر الداكن/}).click();
    if (artifacts) await page.locator('aside').screenshot({path: path.join(artifacts, 'pricing-' + locale + '-sale.png')});
  }
  assert.equal((await page.request.get(route('/saudi-riyal.svg'))).status(), 200);
  checks.push('Official riyal artwork and sale savings render on English/Arabic mobile pages and in dark mode');

  const added = await page.request.post(route('/api/cart'), {headers: {Origin: base.origin}, data: {action: 'add', courseId: courseKey}});
  assert.equal(added.status(), 200);
  await page.goto(route('/en/checkout'));
  assert.equal((await apply('INVALID-' + userId.slice(0, 8), 'en', 400)).code, 'INVALID_COUPON');
  await page.getByText('This coupon code is not valid.', {exact: true}).waitFor();
  const fixedQuote = await apply(fixed);
  assert.equal(fixedQuote.discountHalalas, 3000); assert.equal(fixedQuote.totalHalalas, 11900);
  await page.getByText('Coupon applied: ' + fixed, {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Remove code', exact: true}).click();
  await page.getByText('Coupon applied: ' + fixed, {exact: true}).waitFor({state: 'detached'});
  await page.getByLabel('Coupon code', {exact: true}).fill(percentage);
  assert.equal(await page.getByRole('button', {name: 'Submit order', exact: true}).isDisabled(), true);
  const quote = await apply(percentage);
  assert.equal(quote.subtotalHalalas, 14900); assert.equal(quote.discountHalalas, 2980); assert.equal(quote.totalHalalas, 11920);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS count FROM orders WHERE userId=?', [userId]))[0].count), 0);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS count FROM coupon_reservations WHERE userId=?', [userId]))[0].count), 0);
  const tampered = await page.request.post(route('/api/checkout/quote'), {headers: {Origin: base.origin}, data: {coupon: percentage, subtotalHalalas: 1}});
  assert.equal(tampered.status(), 400);
  checks.push('Apply/remove both discount types, explain invalid codes and preview exact totals without orders or quota reservations');

  await page.goto(route('/ar/checkout'));
  await apply(percentage, 'ar');
  await page.setViewportSize({width: 320, height: 900}); await fits('320px Arabic checkout');
  if (artifacts) await page.screenshot({path: path.join(artifacts, 'pricing-ar-checkout.png'), fullPage: true});
  await page.goto(route('/en/checkout'));
  await page.route('**/api/checkout/quote', handler => handler.abort());
  await page.getByLabel('Coupon code', {exact: true}).fill(percentage);
  await page.getByRole('button', {name: 'Apply coupon', exact: true}).click();
  await page.getByText('Unable to connect. Try applying the code again.', {exact: true}).waitFor();
  await page.unroute('**/api/checkout/quote');
  await apply(percentage);
  await fits('320px English checkout');
  if (artifacts) await page.screenshot({path: path.join(artifacts, 'pricing-en-checkout.png'), fullPage: true});
  checks.push('Recover from coupon-preview connection failure and fit both language checkouts on a small phone');

  const orderResponse = page.waitForResponse(response => response.url() === route('/api/orders') && response.request().method() === 'POST');
  await page.getByRole('button', {name: 'Submit order', exact: true}).click();
  const submitted = await orderResponse;
  assert.equal(submitted.status(), 200);
  const orderId = (await submitted.json()).id;
  await page.waitForURL(url => url.pathname === '/en/orders/' + orderId);
  const [order] = await db.query('SELECT * FROM orders WHERE id=? AND userId=?', [orderId, userId]);
  assert.equal(order.status, 'PENDING'); assert.equal(order.provider, 'manual');
  assert.equal(order.couponCodeSnapshot, percentage); assert.equal(order.discountHalalas, 2980); assert.equal(order.totalHalalas, 11920);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS count FROM enrollments WHERE userId=? AND courseId=?', [userId, courseId]))[0].count), 0);
  assert.ok(await page.locator('.riyal-symbol').count() >= 3);
  checks.push('Create a pending order matching its quoted sale/coupon totals without charging or granting course access');
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log(JSON.stringify({checks: checks.length, passed: checks}, null, 2));
  await context.close();
} catch (error) {
  if (page && artifacts) await page.screenshot({path: path.join(artifacts, 'pricing-failure.png'), fullPage: true}).catch(() => {});
  console.error(JSON.stringify({checks, page: page?.url(), runtimeErrors: errors})); throw error;
} finally {
  await browser.close();
  await db.query('DELETE FROM coupon_redemptions WHERE userId=?', [userId]);
  await db.query('DELETE FROM coupon_reservations WHERE userId=?', [userId]);
  await db.query('DELETE i FROM order_items i JOIN orders o ON i.orderId=o.id WHERE o.userId=?', [userId]);
  await db.query('DELETE p FROM payment_attempts p JOIN orders o ON p.orderId=o.id WHERE o.userId=?', [userId]);
  await db.query('DELETE FROM orders WHERE userId=?', [userId]);
  await db.query('DELETE FROM carts WHERE userId=?', [userId]);
  for (const id of couponIds) await db.query('DELETE FROM coupons WHERE id=?', [id]);
  await db.query('DELETE FROM courses WHERE id=?', [courseId]);
  await db.query('DELETE FROM categories WHERE id=?', [categoryId]);
  await db.query('DELETE FROM audit_logs WHERE actorId=?', [userId]);
  await db.query('DELETE FROM sessions WHERE userId=?', [userId]);
  await db.query('DELETE FROM users WHERE id=?', [userId]);
  await db.end();
}
