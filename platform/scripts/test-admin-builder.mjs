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
const additionalCourses = [];
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
  await page.locator('[name="languages"]').selectOption('ar,en');
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
  await page.getByLabel('Your private notes', {exact: true}).fill('My automatically saved study note.');
  await page.getByText('Notes saved', {exact: true}).waitFor();
  await page.reload();
  assert.equal(await page.getByLabel('Your private notes', {exact: true}).inputValue(), 'My automatically saved study note.');
  let failNote = true;
  await page.route('**/api/learning', request => {if (failNote && request.request().postDataJSON()?.action === 'progress') {failNote = false; return request.abort();} return request.continue();});
  await page.getByLabel('Your private notes', {exact: true}).fill('Recovered after a network failure.');
  await page.getByText('Unable to save. Use Save notes to try again.', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Save notes', exact: true}).click();
  await page.getByText('Notes saved', {exact: true}).waitFor();
  await page.unroute('**/api/learning');
  await page.setViewportSize({width: 390, height: 844});
  assert.equal(await page.locator('#lesson-outline').isVisible(), false);
  await page.getByRole('button', {name: 'Lesson list', exact: true}).click();
  assert.equal(await page.locator('#lesson-outline').isVisible(), true);
  await fits('390px lesson player and outline');
  if (artifacts) await page.screenshot({path: path.join(artifacts, 'learning-player-mobile.png'), fullPage: true});
  await page.setViewportSize({width: 1280, height: 900});
  checks.push('Autosave notes, retain them on reload, recover after network failure and open the mobile lesson list');
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
  await page.goto(route('/en/my-courses'));
  await page.getByRole('heading', {name: 'My certificates', exact: true}).waitFor();
  await page.getByRole('link', {name: 'Download certificate', exact: true}).first().waitFor();
  await page.setViewportSize({width: 390, height: 844});
  await fits('390px learning dashboard');
  if (artifacts) await page.screenshot({path: path.join(artifacts, 'learning-dashboard-mobile.png'), fullPage: true});
  await page.setViewportSize({width: 1440, height: 1000});
  if (artifacts) await page.screenshot({path: path.join(artifacts, 'learning-dashboard-desktop.png'), fullPage: true});
  checks.push('Dashboard shows completed course progress and downloadable certificates on desktop and phone');

  for (const language of ['ar', 'en']) {
    const primaryTitle = (language === 'ar' ? 'دورة عربية فقط ' : 'English-only course ') + randomUUID().slice(0, 8);
    await page.goto(route('/en/admin/courses?create=1'));
    await page.locator('[name="languages"]').selectOption(language);
    const other = language === 'ar' ? 'en' : 'ar';
    assert.equal(await page.locator('[name="title_' + other + '"]').count(), 0);
    await page.locator('[name="title_' + language + '"]').fill(primaryTitle);
    await page.locator('[name="description_' + language + '"]').fill('A complete course in one language.');
    await page.locator('[name="categoryId"]').selectOption({index: 1});
    const singleCourse = await save('courses'); additionalCourses.push(singleCourse.id);
    assert.equal(singleCourse['title_' + other], '');
    await follow(page.getByRole('row').filter({hasText: primaryTitle}).getByRole('link', {name: 'Manage content', exact: true}));
    await page.getByRole('heading', {name: 'Publishing checklist', exact: true}).waitFor();
    await follow(page.getByRole('link', {name: 'Edit course details', exact: true}));
    await page.locator('[name="status"]').selectOption('PUBLISHED');
    const rejected = page.waitForResponse(response => response.url() === route('/api/admin/courses') && response.request().method() === 'POST');
    await page.getByRole('button', {name: 'Save', exact: true}).click();
    assert.equal((await rejected).status(), 400);
    await page.getByText('This course is not ready to publish. Save it as a draft and complete the checklist in Manage content.', {exact: true}).waitFor();
    await page.locator('[name="status"]').selectOption('DRAFT'); await save('courses');
    await follow(page.getByRole('row').filter({hasText: primaryTitle}).getByRole('link', {name: 'Manage content', exact: true}));
    await follow(page.getByRole('link', {name: 'Add section', exact: true}));
    await page.locator('[name="title_' + language + '"]').fill(language === 'ar' ? 'القسم العربي' : 'English section');
    assert.equal(await page.locator('[name="title_' + other + '"]').count(), 0);
    const singleSection = await save('sections');
    await follow(page.getByRole('link', {name: 'Back to course content', exact: true}));
    await follow(page.getByRole('link', {name: 'Add lesson', exact: true}));
    assert.equal(await page.locator('[name="sectionId"]').inputValue(), singleSection.id);
    await page.locator('[name="kind"]').selectOption('ARTICLE');
    await page.locator('[name="title_' + language + '"]').fill(language === 'ar' ? 'الدرس العربي' : 'English lesson');
    await page.locator('[name="body_' + language + '"]').fill(language === 'ar' ? 'هذا هو محتوى الدرس العربي.' : 'This is the English lesson content.');
    await page.locator('[name="isPublished"]').check();
    assert.equal(await page.locator('[name="body_' + other + '"]').count(), 0);
    const singleLesson = await save('lessons');
    await follow(page.getByRole('link', {name: 'Back to course content', exact: true}));
    await follow(page.getByRole('link', {name: 'Lesson files', exact: true}));
    await page.getByRole('button', {name: 'Add new', exact: true}).click();
    await page.locator('[name="' + (language === 'ar' ? 'labelAr' : 'labelEn') + '"]').fill(language === 'ar' ? 'ملف عربي' : 'English handout');
    assert.equal(await page.locator('[name="' + (language === 'ar' ? 'labelEn' : 'labelAr') + '"]').count(), 0);
    await page.locator('[name="mediaAssetId"]').selectOption({index: 1});
    await save('attachments');
    await follow(page.getByRole('link', {name: 'Back to course content', exact: true}));
    await follow(page.getByRole('link', {name: 'Add exam', exact: true}));
    await page.locator('[name="title_' + language + '"]').fill(language === 'ar' ? 'اختبار عربي' : 'English exam');
    await page.locator('[name="isPublished"]').check(); await page.locator('[name="isRequired"]').check();
    await save('exams');
    await follow(page.getByRole('link', {name: 'Questions', exact: true}));
    await page.getByRole('button', {name: 'Add new', exact: true}).click();
    await page.locator('[name="prompt_' + language + '"]').fill(language === 'ar' ? 'اختر الإجابة الصحيحة' : 'Choose the correct answer');
    await save('questions');
    await follow(page.getByRole('link', {name: 'Answers', exact: true}));
    for (const [answer, correct] of [[language === 'ar' ? 'الإجابة الصحيحة' : 'Correct answer', true], [language === 'ar' ? 'إجابة أخرى' : 'Another answer', false]]) {
      await page.getByRole('button', {name: 'Add new', exact: true}).click();
      await page.getByRole('heading', {name: 'Create: Answer options', exact: true}).waitFor();
      await page.locator('[name="label_' + language + '"]').fill(answer);
      if (correct) await page.locator('[name="isCorrect"]').check();
      await save('options');
    }
    await follow(page.getByRole('link', {name: 'Back to course content', exact: true}));
    await page.getByText('Content is ready to publish', {exact: true}).waitFor();
    if (artifacts) await page.screenshot({path: path.join(artifacts, 'single-' + language + '-course-checklist.png'), fullPage: true});
    await follow(page.getByRole('link', {name: 'Edit course details', exact: true}));
    await page.locator('[name="status"]').selectOption('PUBLISHED'); await save('courses');
    await page.goto(route('/en/courses?language=' + language));
    await page.locator('#search').fill(primaryTitle);
    await page.getByRole('heading', {name: primaryTitle, exact: true}).waitFor();
    await page.getByRole('button', {name: other === 'ar' ? 'Arabic courses' : 'English courses', exact: true}).click();
    await page.getByRole('heading', {name: primaryTitle, exact: true}).waitFor({state: 'detached'});
    await page.getByRole('button', {name: 'Clear filters', exact: true}).last().click();
    await page.getByRole('heading', {name: primaryTitle, exact: true}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('language'), null);
    const nonexistent = await page.request.get(route('/' + other + '/courses/' + singleCourse['slug_' + other]));
    assert.equal(nonexistent.status(), 404, 'No fictional translated course page');
    await page.goto(route('/en/admin/courses?language=' + other));
    assert.equal(await page.getByRole('row').filter({hasText: primaryTitle}).count(), 0);
    const added = await page.request.post(route('/api/cart'), {headers: {origin: base.origin}, data: {action: 'add', courseId: singleCourse.key}});
    assert.equal(added.status(), 200);
    const cart = (await added.json()).cart;
    assert.equal(cart.items.find(item => item.courseId === singleCourse.key).title.en, primaryTitle);
    await page.goto(route('/en/cart'));
    await page.getByRole('link', {name: primaryTitle, exact: true}).waitFor();
    assert.equal(await page.getByRole('link', {name: primaryTitle, exact: true}).getAttribute('href'), '/' + language + '/courses/' + singleCourse['slug_' + language]);
    const removed = await page.request.delete(route('/api/cart'), {headers: {origin: base.origin}, data: {courseId: singleCourse.key}});
    assert.equal(removed.status(), 200);
    await page.goto(route('/en/admin/users?q=' + encodeURIComponent(`builder-${userId}@example.test`)));
    await actionDialog(page.getByRole('button', {name: 'Free enrollment', exact: true}), primaryTitle);
    await page.goto(route(`/ar/learn/${singleCourse.id}/${singleLesson.id}`));
    await page.getByRole('heading', {name: language === 'ar' ? 'الدرس العربي' : 'English lesson', exact: true}).waitFor();
    await page.getByRole('button', {name: /English —/}).click();
    await page.waitForURL(url => url.pathname === `/en/learn/${singleCourse.id}/${singleLesson.id}`);
    await page.getByRole('heading', {name: language === 'ar' ? 'الدرس العربي' : 'English lesson', exact: true}).waitFor();
    await page.getByRole('button', {name: /العربية —/}).click();
    await page.waitForURL(url => url.pathname === `/ar/learn/${singleCourse.id}/${singleLesson.id}`);
    await page.getByRole('button', {name: 'تحديد كمكتمل', exact: true}).click();
    await page.getByText('تم حفظ تقدمك', {exact: true}).waitFor();
    await page.getByRole('button', {name: 'بدء الاختبار', exact: true}).click();
    await page.getByRole('radio', {name: language === 'ar' ? 'الإجابة الصحيحة' : 'Correct answer', exact: true}).check();
    await page.getByRole('button', {name: 'إرسال الإجابات', exact: true}).click();
    await page.getByText('ناجح — 1/1', {exact: true}).waitFor();
    const certificate = page.waitForEvent('download');
    await page.getByRole('button', {name: 'تنزيل شهادة الإتمام', exact: true}).click();
    const certificateFile = await certificate;
    assert.equal(await certificateFile.failure(), null);
    assert.equal((await readFile(await certificateFile.path())).subarray(0, 5).toString(), '%PDF-');
    checks.push(language + ': author, validate, publish, filter, study and certify a course without a second language version');
  }
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
  for (const id of [courseId, ...additionalCourses].filter(Boolean)) await db.query('DELETE FROM courses WHERE id=?', [id]);
  await db.query('DELETE FROM media_assets WHERE uploadedById=?', [userId]);
  await db.query('DELETE FROM audit_logs WHERE actorId=?', [userId]);
  await db.query('DELETE FROM sessions WHERE userId=?', [userId]);
  await db.query('DELETE FROM users WHERE id=?', [userId]);
  await db.end();
}
