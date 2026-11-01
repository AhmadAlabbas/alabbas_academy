import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.ACADEMY_PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.env.ACADEMY_TEST_BASE_URL || 'http://localhost:3001');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname), 'Tests must never touch a customer website.');

const browser = await chromium.launch({headless: true, executablePath: process.env.ACADEMY_BROWSER_PATH});
const results = [];
try {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(new URL('/code/en',base).href);
  await page.getByRole('heading',{name:'The future is something you build.'}).waitFor();
  assert.match(await page.locator('html').getAttribute('lang'), /^en$/);
  results.push('English Code homepage and language metadata');

  await page.getByRole('button',{name:'Start learning for free'}).click();
  await page.getByRole('heading',{name:'Your first heading'}).waitFor();
  const editor = page.locator('textarea');
  await editor.fill('<main><h1>Hello, World!</h1></main>');
  await page.getByRole('button',{name:'Check answer'}).click();
  await page.getByText('Nice work — all checks passed!').waitFor();
  assert.equal(await page.getByText('Your heading says Hello, World!').count(),1);
  await page.reload();
  await page.getByRole('heading',{name:'Your first heading'}).waitFor();
  assert.equal(await editor.inputValue(),'<main><h1>Hello, World!</h1></main>');
  results.push('HTML editor, browser-based checks, and draft persistence');

  await page.goto(new URL('/code/en?lesson=css-colors',base).href);
  await page.getByRole('heading',{name:'Make colour count'}).waitFor();
  await page.getByRole('button',{name:'style.css'}).click();
  await page.locator('textarea').fill('body { background-color: #f8fafc; } h1 { color: #2563eb; }');
  await page.getByRole('button',{name:'Check answer'}).click();
  await page.getByText('Nice work — all checks passed!').waitFor();
  results.push('CSS editing and structural rule evaluation');

  await page.goto(new URL('/code/en?lesson=js-variables',base).href);
  await page.getByRole('heading',{name:'Store a value'}).waitFor();
  await page.getByRole('button',{name:'script.js'}).click();
  await page.locator('textarea').fill('const name = "Ada"; console.log(name);');
  await page.getByRole('button',{name:'Run code'}).click();
  await page.getByRole('button',{name:'Console'}).click();
  await page.getByText('Ada',{exact:true}).waitFor({timeout:15000});
  await page.getByRole('button',{name:'Check answer'}).click();
  await page.getByText('Nice work — all checks passed!').waitFor();
  results.push('JavaScript iframe execution, console messaging and checks');

  await page.goto(new URL('/code/ar',base).href);
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  await page.getByRole('heading',{name:'المستقبل يبدأ بما تصنعه أنت.'}).waitFor();
  results.push('Arabic and right-to-left content');

  await page.setViewportSize({width:390,height:844});
  await page.reload();
  const size = await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(size.scroll <= size.inner+2, 'ALABBAS Code mobile layout must not scroll sideways: '+JSON.stringify(size));
  results.push('Responsive mobile width and no horizontal overflow');

  assert.deepEqual(errors,[], 'No uncaught JavaScript page errors');
  await page.close();
  console.log('ALABBAS Code browser checks passed: '+results.join('; '));
} finally {await browser.close();}
