import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

// Optional browser tooling is provided by the development environment, not the
// customer runtime. Point these variables at an installed Playwright/Chromium.
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.ACADEMY_PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.env.ACADEMY_TEST_BASE_URL || 'http://localhost:3001');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Browser checks only target a local preview.');
const artifactDir = process.env.ACADEMY_UI_ARTIFACT_DIR;
if (artifactDir) await mkdir(artifactDir, {recursive: true});
const browser = await chromium.launch({executablePath: process.env.ACADEMY_BROWSER_PATH, headless: true});
const checks = [];
const errors = [];
function observe(page) { page.on('pageerror', error => errors.push(error.message)); }
async function assertFits(page, description) {
  const dimensions = await page.evaluate(() => ({width: window.innerWidth, content: document.documentElement.scrollWidth}));
  assert.ok(dimensions.content <= dimensions.width + 1, description + ': horizontal overflow ' + JSON.stringify(dimensions));
}
try {
  for (const locale of ['ar', 'en']) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, colorScheme: 'light'});
    const page = await context.newPage();
    observe(page);
    const menu = page.locator('button[aria-controls="mobile-navigation"]');
    const darkName = locale === 'ar' ? 'تفعيل المظهر الداكن' : 'Switch to dark theme';
    const lightName = locale === 'ar' ? 'تفعيل المظهر الفاتح' : 'Switch to light theme';
    await page.goto(new URL('/' + locale, base).href);
    await page.getByRole('button', {name: darkName, exact: true}).tap();
    await page.getByRole('button', {name: lightName, exact: true}).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('alabbas.theme')), 'dark');
    assert.equal(await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(9, 12, 17)');
    await page.reload();
    await page.getByRole('button', {name: lightName, exact: true}).waitFor();
    checks.push(locale + ': dark preference survives reload');

    const second = await context.newPage();
    observe(second);
    await second.goto(new URL('/' + locale + '/courses', base).href);
    await second.getByRole('button', {name: lightName, exact: true}).tap();
    await page.getByRole('button', {name: darkName, exact: true}).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    await second.close();
    await page.getByRole('button', {name: darkName, exact: true}).tap();
    checks.push(locale + ': theme changes synchronize between tabs');

    // Safari/touch devices can blur the initially focused link to a null target
    // on pointerdown. Navigation must remain mounted until the click finishes.
    await menu.tap();
    const courses = page.locator(`#mobile-navigation a[href="/${locale}/courses"]`);
    await courses.dispatchEvent('pointerdown', {pointerType: 'touch', bubbles: true});
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(50);
    assert.equal(await page.locator('#mobile-navigation').count(), 1, 'Touch focus loss must not unmount links');
    await courses.tap();
    await page.waitForURL(url => url.pathname === `/${locale}/courses`);
    assert.equal(await page.locator('#mobile-navigation').count(), 0);
    checks.push(locale + ': touch focus-loss regression and course navigation');

    for (const route of ['/', '/about', '/my-courses', '/cart', '/login', '/signup']) {
      await page.goto(new URL('/' + locale, base).href);
      await menu.tap();
      await page.locator(`#mobile-navigation a[href="/${locale}${route === '/' ? '' : route}"]`).tap();
      await page.waitForURL(url => url.pathname === `/${locale}${route === '/' ? '' : route === '/my-courses' ? '/login' : route}`);
      assert.equal(await page.locator('#mobile-navigation').count(), 0);
      checks.push(locale + ': mobile ' + route);
    }

    await menu.tap();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#mobile-navigation').count(), 0);
    assert.equal(await menu.evaluate(node => node === document.activeElement), true);
    await menu.tap();
    await page.locator('footer a').first().focus();
    assert.equal(await page.locator('#mobile-navigation').count(), 0, 'Keyboard focus outside must close the menu');
    await menu.tap();
    await page.touchscreen.tap(4, 800);
    assert.equal(await page.locator('#mobile-navigation').count(), 0, 'Outside touch must close the menu');
    await menu.tap();
    await page.setViewportSize({width: 1440, height: 900});
    await page.waitForTimeout(50);
    assert.equal(await page.locator('#mobile-navigation').count(), 0, 'Desktop resize must close the menu');
    checks.push(locale + ': Escape, keyboard focus, outside touch and desktop resize');

    for (const width of [320, 390, 440, 640, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({width, height: 900});
      for (const route of ['', '/courses', '/login', '/signup', '/cart']) {
        await page.goto(new URL('/' + locale + route, base).href);
        await assertFits(page, `${locale}${route} dark ${width}px`);
      }
    }
    checks.push(locale + ': five dark pages fit eight viewport widths');
    assert.equal(await page.locator('footer [role="img"]').count(), 4, 'Four social icons remain visible without configured URLs');
    assert.equal(await page.locator('footer a[href="#"]').count(), 0, 'No fake social destinations');
    checks.push(locale + ': unconfigured social icons');
    await page.setViewportSize({width: 320, height: 568});
    await page.goto(new URL('/' + locale, base).href);
    await menu.tap();
    const height = await page.locator('#mobile-navigation').evaluate(node => node.getBoundingClientRect().height);
    assert.ok(height <= 472, 'Menu must fit below the header on a short phone screen');
    await page.locator(`#mobile-navigation a[href="/${locale}/signup"]`).tap();
    await page.waitForURL(url => url.pathname === `/${locale}/signup`);
    checks.push(locale + ': signup remains reachable on a 320x568 phone');
    if (artifactDir) {
      await page.setViewportSize({width: 1440, height: 900});
      await page.goto(new URL('/' + locale, base).href);
      await page.screenshot({path: path.join(artifactDir, locale + '-dark-desktop.png'), fullPage: true, animations: 'disabled'});
      await page.setViewportSize({width: 390, height: 844});
      await menu.tap();
      await page.screenshot({path: path.join(artifactDir, locale + '-dark-mobile-menu.png'), animations: 'disabled'});
    }
    await context.close();
  }

  const systemContext = await browser.newContext({colorScheme: 'dark', viewport: {width: 390, height: 844}});
  const systemPage = await systemContext.newPage();
  observe(systemPage);
  await systemPage.goto(new URL('/en', base).href);
  assert.equal(await systemPage.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await systemPage.getByRole('button', {name: 'Switch to light theme', exact: true}).click();
  await systemPage.reload();
  assert.equal(await systemPage.evaluate(() => document.documentElement.dataset.theme), 'light', 'Explicit choice overrides system preference');
  await systemPage.goto(new URL('/en/no-such-page', base).href);
  await systemPage.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  assert.equal(await systemPage.evaluate(() => document.documentElement.dataset.theme), 'light', 'Separate 404 document keeps saved preference');
  await systemContext.close();
  checks.push('System preference, explicit override and global 404');

  const blockedContext = await browser.newContext({colorScheme: 'dark'});
  await blockedContext.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() { throw new Error('Storage blocked'); }}));
  const blockedPage = await blockedContext.newPage();
  observe(blockedPage);
  await blockedPage.goto(new URL('/en', base).href);
  await blockedPage.getByRole('button', {name: 'Switch to light theme', exact: true}).click();
  assert.equal(await blockedPage.evaluate(() => document.documentElement.dataset.theme), 'light');
  await blockedContext.close();
  checks.push('Theme toggle works with blocked storage');
  assert.deepEqual(errors, [], 'No browser runtime or hydration errors');
  console.log(JSON.stringify({checks: checks.length, passed: checks}, null, 2));
} finally {
  await browser.close();
}
