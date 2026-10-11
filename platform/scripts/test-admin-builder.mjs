import assert from 'node:assert/strict';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {mkdir, readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import mariadb from 'mariadb';
import {encode} from 'next-auth/jwt';

// Author a real course through the production UI, then study it. Fixtures and
// cleanup are restricted to this run's own records on a loopback database.
const base = new URL(process.env.ACADEMY_TEST_BASE_URL || 'http://localhost:3001');
const database = new URL(process.env.ACADEMY_TEST_DATABASE_URL || 'mysql://invalid');
const loopback = ['localhost', '127.0.0.1', '[::1]'];
assert.ok(loopback.includes(base.hostname) && database.protocol === 'mysql:' && loopback.includes(database.hostname), 'Course-builder checks require a local preview and database.');
assert.ok(process.env.AUTH_SECRET, 'The preview and browser fixture must share an ephemeral AUTH_SECRET.');
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.ACADEMY_PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = process.env.ACADEMY_UI_ARTIFACT_DIR;
if (artifacts) await mkdir(artifacts, {recursive: true});
const db = await mariadb.createConnection({host: database.hostname, port: Number(database.port || 3306), user: decodeURIComponent(database.username), password: decodeURIComponent(database.password), database: decodeURIComponent(database.pathname.slice(1))});
const browser = await chromium.launch({executablePath: process.env.ACADEMY_BROWSER_PATH, headless: true});
const userId = randomUUID();
const title = 'Browser course ' + randomUUID().slice(0, 8);
const checks = [];
const errors = [];
let courseId;
let page;
const route = pathname => new URL(pathname, base).href;
async function save(entity) {
  const pending = page.waitForResponse(response => response.url() === route('/api/admin/' + entity) && response.request().method() === 'POST');
  await page.getByRole('button', {name: 'Save', exact: true}).click();
  const response = await pending;
  const result = await response.json();
  assert.equal(response.status(), 200, entity + ' saves: ' + JSON.stringify(result));
  await page.getByRole('heading', {name: /^(Create|Edit):/}).waitFor({state: 'detached'});
  return result;
}
async function follow(link) {
  const href = await link.getAttribute('href');
  await link.click();
  await page.waitForURL(url => url.pathname + url.search === href);
}
async function fillTitles(ar, en) {
  await page.locator('[name="title_ar"]').fill(ar);
  await page.locator('[name="title_en"]').fill(en);
}
async function fits(description) {
  const dimensions = await page.evaluate(() => ({viewport: innerWidth, content: document.documentElement.scrollWidth}));
  assert.ok(dimensions.content <= dimensions.viewport + 1, description + ': ' + JSON.stringify(dimensions));
}
async function actionDialog(button, choice) {
  await button.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  if (choice) await dialog.getByRole('combobox').selectOption({label: choice});
  else await dialog.getByRole('combobox').selectOption({index: 1});
  const pending = page.waitForResponse(response => response.url() === route('/api/admin/action') && response.request().method() === 'POST');
  await dialog.getByRole('button', {name: 'Save', exact: true}).click();
  assert.equal((await pending).status(), 200, 'Named action saves');
  await dialog.waitFor({state: 'detached'});
}
try {
  const [role] = await db.query("SELECT id FROM roles WHERE slug='administrator'");
  assert.ok(role, 'Seed the local database first.');
  await db.query('INSERT INTO users (id,email,name,emailVerified,updatedAt) VALUES (?,?,?,NOW(),NOW())', [userId, `builder-${userId}@example.test`, 'Course Builder Test']);
  await db.query('INSERT INTO user_roles (userId,roleId) VALUES (?,?)', [userId, role.id]);
  const sessionId = randomUUID();
  const sessionSecret = randomBytes(32).toString('hex');
  await db.query('INSERT INTO sessions (id,tokenHash,userId,expires,sessionVersion) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR),0)', [sessionId, createHash('sha256').update(sessionSecret).digest('hex'), userId]);
  const cookieName = 'authjs.session-token';
  const token = await encode({secret: process.env.AUTH_SECRET, salt: cookieName, token: {sub: userId, sessionId, sessionSecret, sessionVersion: 0}, maxAge: 3600});
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
  await context.addCookies([{name: cookieName, value: token, url: base.href}]);
  // External video delivery is independent of course authoring. Verify the
  // actual embed URL below without contacting YouTube during local tests.
  await context.route(/youtube-nocookie\.com/, request => request.fulfill({status: 200, contentType: 'text/html', body: '<html><body>Video preview</body></html>'}));
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(route('/en/admin/courses?create=1'));
  await page.getByRole('heading', {name: 'Create: Courses', exact: true}).waitFor();
  await fillTitles('دورة اختبار المتصفح', title);
  await page.locator('[name="description_ar"]').fill('تعلم من خلال دورة أنشئت بالمحرر.');
  await page.locator('[name="description_en"]').fill('A course authored through the actual editor.');
  await page.locator('[name="categoryId"]').selectOption({index: 1});
  await page.locator('[name="priceHalalas"]').fill('199.95');
  await page.locator('[name="compareAtHalalas"]').fill('249.00');
  const upload = page.waitForResponse(response => response.url() === route('/api/admin/upload'));
  await page.getByLabel('Upload file: Thumbnail URL', {exact: true}).setInputFiles(path.join(root, 'public/apple-touch-icon.png'));
  assert.equal((await upload).status(), 200);
  await page.getByText('Uploaded and selected: apple-touch-icon.png', {exact: true}).waitFor();
  const createdCourse = await save('courses');
  courseId = createdCourse.id;
  const [course] = await db.query('SELECT * FROM courses WHERE id=?', [courseId]);
  assert.equal(course.priceHalalas, 19995);
  assert.equal(course.compareAtHalalas, 24900);
  assert.match(course.slug_en, /^browser-course-/);
  assert.match(course.thumbnailUrl, /^\/api\/media\//);
  checks.push('Create course with automatic reference/slugs, exact SAR prices and inline thumbnail upload');

  const courseRow = page.getByRole('row').filter({hasText: title});
  await follow(courseRow.getByRole('link', {name: 'Manage content', exact: true}));
  await page.getByRole('heading', {name: title, exact: true}).waitFor();
  await follow(page.getByRole('link', {name: 'Add section', exact: true}));
  assert.equal(await page.locator('[name="courseId"]').inputValue(), courseId);
  await fillTitles('القسم الأول', 'First section');
  const section = await save('sections');
  assert.equal(section.position, 0);
  await follow(page.getByRole('link', {name: 'Back to course content', exact: true}));
  await follow(page.getByRole('link', {name: 'Add lesson', exact: true}));
  assert.equal(await page.locator('[name="sectionId"]').inputValue(), section.id);
  await fillTitles('الدرس الأول', 'First lesson');
  await page.locator('[name="videoUrl"]').fill('https://www.youtube.com/watch?v=aircAruvnKk');
  await page.locator('[name="isPublished"]').check();
  const lesson = await save('lessons');
  assert.equal(lesson.position, 0);
  assert.equal(lesson.body_en, '');
  checks.push('Create a section and published video lesson with preselected names and automatic ordering');

  // Starting another editor must clear values from the previously saved lesson.
  await page.getByRole('button', {name: 'Add new', exact: true}).click();
  assert.equal(await page.locator('[name="title_en"]').inputValue(), '');
  assert.equal(await page.locator('[name="sectionId"]').inputValue(), section.id);
  await page.getByRole('button', {name: 'Close editor', exact: true}).click();
  await follow(page.getByRole('link', {name: 'Back to course content', exact: true}));
  await follow(page.getByRole('link', {name: 'Lesson files', exact: true}));
  await page.getByRole('button', {name: 'Add new', exact: true}).click();
  assert.equal(await page.locator('[name="lessonId"]').inputValue(), lesson.id);
  await page.locator('[name="labelAr"]').fill('ملخص الدرس');
  await page.locator('[name="labelEn"]').fill('Lesson notes');
  const document = page.waitForResponse(response => response.url() === route('/api/admin/upload'));
  await page.getByLabel('Upload file: File', {exact: true}).setInputFiles({name: 'lesson-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Course builder attachment check.\n')});
  assert.equal((await document).status(), 200);
  await page.getByText('Uploaded and selected: lesson-notes.txt', {exact: true}).waitFor();
  const attachment = await save('attachments');
  assert.equal(attachment.position, 0);
  checks.push('Attach an uploaded lesson document without copying a file or lesson ID');

  await follow(page.getByRole('link', {name: 'Back to course content', exact: true}));
  await follow(page.getByRole('link', {name: 'Add exam', exact: true}));
  assert.equal(await page.locator('[name="passingBasisPoints"]').inputValue(), '70.00');
  await fillTitles('اختبار الإتمام', 'Completion exam');
  await page.locator('[name="isPublished"]').check();
  await page.locator('[name="isRequired"]').check();
  const exam = await save('exams');
  assert.equal(exam.passingBasisPoints, 7000);
  await follow(page.getByRole('link', {name: 'Questions', exact: true}));
  await page.getByRole('button', {name: 'Add new', exact: true}).click();
  assert.equal(await page.locator('[name="examId"]').inputValue(), exam.id);
  await page.locator('[name="prompt_ar"]').fill('ما الإجابة الصحيحة؟');
  await page.locator('[name="prompt_en"]').fill('Which answer is correct?');
  const question = await save('questions');
  assert.equal(question.points, 1);
  await follow(page.getByRole('link', {name: 'Answers', exact: true}));
  for (const [arabic, english, correct] of [['الأولى', 'First answer', true], ['الثانية', 'Second answer', false]]) {
    await page.getByRole('button', {name: 'Add new', exact: true}).click();
    await page.getByRole('heading', {name: 'Create: Answer options', exact: true}).waitFor();
    await page.locator('[name="label_ar"]').fill(arabic);
    await page.locator('[name="label_en"]').fill(english);
    if (correct) await page.locator('[name="isCorrect"]').check();
    await save('options');
  }
  await page.getByRole('row').filter({hasText: 'Second answer'}).getByRole('button', {name: 'Edit', exact: true}).click();
  await page.locator('[name="isCorrect"]').check();
  await save('options');
  const answers = await db.query('SELECT * FROM question_options WHERE questionId=? ORDER BY position', [question.id]);
  assert.deepEqual(answers.map(answer => Boolean(answer.isCorrect)), [false, true]);
  await follow(page.getByRole('link', {name: 'Back to course content', exact: true}));
  await page.getByText('Questions and answers are ready', {exact: true}).waitFor();
  checks.push('Build a required exam with a percentage pass mark and switch its only correct answer');

  if (artifacts) await page.screenshot({path: path.join(artifacts, 'course-builder-desktop.png'), fullPage: true});
  await follow(page.getByRole('link', {name: 'Edit course details', exact: true}));
  assert.equal(await page.locator('[name="priceHalalas"]').inputValue(), '199.95');
  await page.locator('[name="status"]').selectOption('PUBLISHED');
  await save('courses');
  const updatedRow = page.getByRole('row').filter({hasText: title});
  await actionDialog(updatedRow.getByRole('button', {name: 'Add instructor', exact: true}));
  assert.equal((await db.query('SELECT * FROM course_instructors WHERE courseId=?', [courseId])).length, 1);
  checks.push('Edit and publish a course without changing its price; assign an instructor by name');

  await page.goto(route('/en/admin/users?q=' + encodeURIComponent(`builder-${userId}@example.test`)));
  await actionDialog(page.getByRole('button', {name: 'Free enrollment', exact: true}), title);
  checks.push('Enroll a verified learner using a named course picker');

  // Verify small-screen editors, dialogs and the Arabic course workspace.
  for (const locale of ['en', 'ar']) {
    await page.goto(route(`/${locale}/admin/courses/${courseId}`));
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({width, height: 900});
      await fits(locale + ' course workspace ' + width);
    }
    await page.setViewportSize({width: 390, height: 844});
    if (artifacts) await page.screenshot({path: path.join(artifacts, 'course-builder-' + locale + '-mobile.png'), fullPage: true});
  }
  await page.goto(route(`/en/admin/lessons?sectionId=${section.id}&edit=${lesson.id}`));
  await page.setViewportSize({width: 320, height: 900});
  await fits('320px lesson editor');
  await page.getByRole('button', {name: 'Switch to dark theme', exact: true}).click();
  await fits('320px dark lesson editor');
  if (artifacts) await page.screenshot({path: path.join(artifacts, 'course-builder-dark-editor.png'), fullPage: true});
  await page.goto(route('/en/admin/users?q=' + encodeURIComponent(`builder-${userId}@example.test`)));
  await page.getByRole('button', {name: 'Free enrollment', exact: true}).click();
  await page.getByRole('dialog').waitFor();
  await fits('320px dark named-course dialog');
  await page.getByRole('dialog').getByRole('button', {name: 'Cancel', exact: true}).click();
  checks.push('English/Arabic content workspaces and dark editors/dialogs fit phone and tablet widths');

  await page.setViewportSize({width: 1280, height: 900});
  await page.goto(route(`/en/learn/${courseId}/${lesson.id}`));
  await page.getByRole('heading', {name: 'First lesson', exact: true}).waitFor();
  assert.match(await page.locator('iframe').getAttribute('src'), /youtube-nocookie\.com\/embed\/aircAruvnKk/);
  const download = await page.request.get(route('/api/media/' + attachment.mediaAssetId));
  assert.equal(download.status(), 200);
  assert.equal(await download.text(), 'Course builder attachment check.\n');
  await page.getByRole('button', {name: 'Mark complete', exact: true}).click();
  await page.getByText('Your progress was saved', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Start exam', exact: true}).click();
  await page.getByRole('radio', {name: 'Second answer', exact: true}).check();
  await page.getByRole('button', {name: 'Submit answers', exact: true}).click();
  await page.getByText('Passed — 1/1', {exact: true}).waitFor();
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download completion certificate', exact: true}).click();
  const pdf = await pdfDownload;
  assert.equal(await pdf.failure(), null);
  const data = await readFile(await pdf.path());
  assert.equal(data.subarray(0, 5).toString(), '%PDF-');
  checks.push('Study the newly authored lesson, download its file, complete the exam and download the PDF certificate');
  assert.deepEqual(errors, [], 'No browser runtime or hydration errors');
  console.log(JSON.stringify({checks: checks.length, passed: checks}, null, 2));
  await context.close();
} catch (error) {
  console.error(JSON.stringify({runtimeErrors: errors, completed: checks, page: page?.url(), headings: page ? await page.getByRole('heading').allTextContents() : []}));
  if (page && artifacts) await page.screenshot({path: path.join(artifacts, 'course-builder-failure.png'), fullPage: true}).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await db.query('DELETE c FROM certificates c JOIN enrollments e ON c.enrollmentId=e.id WHERE e.userId=?', [userId]);
  await db.query('DELETE a FROM exam_attempts a JOIN enrollments e ON a.enrollmentId=e.id WHERE e.userId=?', [userId]);
  await db.query('DELETE FROM enrollments WHERE userId=?', [userId]);
  if (courseId) await db.query('DELETE FROM courses WHERE id=?', [courseId]);
  await db.query('DELETE FROM media_assets WHERE uploadedById=?', [userId]);
  await db.query('DELETE FROM audit_logs WHERE actorId=?', [userId]);
  await db.query('DELETE FROM sessions WHERE userId=?', [userId]);
  await db.query('DELETE FROM users WHERE id=?', [userId]);
  await db.end();
}
