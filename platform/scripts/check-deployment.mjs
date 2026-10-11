import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';

// Read-only checks: never submit forms, create orders or modify customer data.
const {values} = parseArgs({options: {
  url: {type: 'string'},
  environment: {type: 'string', default: 'production'},
  'require-email': {type: 'boolean', default: false},
  'canonical-origin': {type: 'string'},
}});
assert.ok(values.url, 'Provide --url https://your-domain.example');
const base = new URL(values.url);
assert.ok(!base.username && !base.password && !base.search && !base.hash && base.pathname === '/', 'Use a public origin without credentials, a path, or a query.');
assert.ok(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)), 'Use HTTPS; HTTP is allowed only for a local preview.');
assert.ok(['production', 'staging'].includes(values.environment), 'Environment must be production or staging.');
// A local server can use an ephemeral port while the build has a fixed public
// origin. Hosted checks always require metadata to match the actual public site.
assert.ok(!values['canonical-origin'] || ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Canonical override is allowed only for local tests.');
const canonical = new URL(values['canonical-origin'] || base.origin);
assert.ok(!canonical.username && !canonical.password && !canonical.search && !canonical.hash && canonical.pathname === '/', 'Canonical origin must not include credentials, a path or a query.');
const checks = [];
async function request(route, status = 200) {
  const response = await fetch(new URL(route, base), {redirect: 'manual', signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, status, route + ' HTTP status');
  const indexing = response.headers.get('x-robots-tag') || '';
  if (values.environment === 'staging') assert.match(indexing, /noindex/, route + ' must block indexing');
  else assert.doesNotMatch(indexing, /noindex/, route + ' must not inherit staging headers');
  checks.push(route);
  return response;
}

for (const locale of ['ar', 'en']) {
  for (const route of ['', '/courses', '/about', '/login', '/signup', '/cart']) {
    const html = await (await request('/' + locale + route)).text();
    assert.match(html, /<h1[\s>]/, 'Page must render its heading');
    assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`), 'Page must use its requested language');
    assert.match(html, new RegExp(`<html[^>]*dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`), 'Page must use the correct text direction');
    if (['', '/courses', '/about'].includes(route)) {
      const href = html.match(/<link rel="canonical" href="([^"<>]+)"/);
      assert.ok(href, 'Public page must include a canonical URL');
      assert.equal(href[1], canonical.origin + '/' + locale + route, 'Canonical must match this deployment');
    }
    if (!route) {
      const stylesheet = html.match(/href="([^"<>]*\/_next\/static\/[^"<>]+\.css[^"<>]*)"/);
      assert.ok(stylesheet, 'Production stylesheet must be referenced');
      const cssUrl = new URL(stylesheet[1].replaceAll('&amp;', '&'), base);
      assert.equal(cssUrl.origin, base.origin, 'Assets must use the same origin');
      const css = await request(cssUrl.pathname + cssUrl.search);
      assert.match(css.headers.get('content-type') || '', /text\/css/);
      assert.ok((await css.text()).length > 100, 'Stylesheet must contain content');
    }
  }
}
for (const [route, mime] of [['/favicon.svg', 'image/svg+xml'], ['/favicon.ico', 'image/x-icon'], ['/apple-touch-icon.png', 'image/png']]) {
  const response = await request(route);
  assert.ok((response.headers.get('content-type') || '').includes(mime), route + ' content type');
  assert.ok((await response.arrayBuffer()).byteLength > 100, route + ' must contain image data');
}
const robots = await (await request('/robots.txt')).text();
if (values.environment === 'staging') {
  assert.match(robots, /^Disallow: \/\s*$/m);
  assert.doesNotMatch(robots, /^Sitemap:/m);
} else {
  assert.match(robots, /^Allow: \/\s*$/m);
  assert.match(robots, /^Disallow: \/ar\/admin\s*$/m);
  assert.ok(robots.includes(`Sitemap: ${canonical.origin}/sitemap.xml`), 'Sitemap origin must match this deployment');
}
await request('/en/no-such-release-check-page', 404);
const health = await (await request('/api/health')).json();
assert.equal(health.ok, true, 'Health must report ready');
assert.equal(health.database, 'ready', 'Database must be connected');
if (values['require-email']) assert.equal(health.emailConfigured, true, 'Mail must be configured; delivery still needs an inbox test');
if (values.environment === 'staging') assert.equal(health.paymentsEnabled, false, 'Staging checks expect payments disabled');
console.log(JSON.stringify({passed: checks.length, environment: values.environment, origin: base.origin, database: health.database, emailConfigured: health.emailConfigured, paymentsEnabled: health.paymentsEnabled}));
