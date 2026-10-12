import {beforeAll, afterAll, describe, it, expect, vi} from 'vitest';
import {randomUUID} from 'node:crypto';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/session', () => ({requireVerifiedUser: vi.fn()}));
import {getDatabase} from '@/lib/db';
import {mutateAdmin, listAdmin, adminLookups} from '@/lib/admin/service';
import {initialDraft, serializeDraft, type AdminRow} from '@/lib/admin/forms';

const configured = process.env.ACADEMY_TEST_DATABASE_URL;
describe.skipIf(!configured)('Admin course content editing', () => {
  let actorId: string, categoryId: string, courseId: string, secondCourseId: string, pageId: string;
  let sectionId: string, lessonId: string, examId: string, questionId: string;
  const assets: string[] = [];
  beforeAll(async () => {
    const url = new URL(configured!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/academy_test_')) throw Error('Isolated local database required');
    vi.stubEnv('DATABASE_URL', configured!);
    const db = getDatabase();
    actorId = (await db.user.create({data: {email: `builder-${randomUUID()}@example.test`, emailVerified: new Date()}})).id;
    categoryId = (await db.category.create({data: {key: randomUUID(), title_ar: 'تصنيف المحرر', title_en: 'Editor category'}})).id;
    pageId = (await db.page.create({data: {key: 'builder-' + randomUUID()}})).id;
    for (const [kind, mimeType] of [['IMAGE', 'image/png'], ['VIDEO', 'video/mp4'], ['DOCUMENT', 'text/plain']]) {
      assets.push((await db.mediaAsset.create({data: {kind, mimeType, bytes: 10, status: 'READY', storageKey: randomUUID(), originalName: 'builder-' + kind, isPublic: kind === 'IMAGE'}})).id);
    }
  });
  afterAll(async () => {
    const db = getDatabase();
    await db.course.deleteMany({where: {id: {in: [courseId, secondCourseId].filter(Boolean)}}});
    await db.mediaAsset.deleteMany({where: {id: {in: assets}}});
    await db.page.delete({where: {id: pageId}});
    await db.category.delete({where: {id: categoryId}});
    await db.user.delete({where: {id: actorId}});
    await db.$disconnect(); vi.unstubAllEnvs();
  });
  const create = async (entity: string, values: AdminRow) => await mutateAdmin(entity, null, values, actorId) as AdminRow;
  it('saves course editor SAR values to the database without requiring optional copy', async () => {
    const unique = randomUUID();
    const draft = initialDraft('courses', {key: 'builder-' + unique});
    Object.assign(draft, {title_ar: 'دورة المحرر', title_en: 'Editor course', slug_ar: 'دورة-' + unique, slug_en: 'editor-' + unique, categoryId, description_ar: 'وصف', description_en: 'Description', priceHalalas: '199.95'});
    courseId = String((await create('courses', serializeDraft('courses', draft))).id);
    const row = await getDatabase().course.findUniqueOrThrow({where: {id: courseId}});
    expect(row).toMatchObject({priceHalalas: 19995, status: 'DRAFT', requirements_ar: '', seo_en: '', minutes: 0});
    secondCourseId = (await getDatabase().course.create({data: {categoryId, key: 'other-' + unique, slug_ar: 'اخرى-' + unique, slug_en: 'other-' + unique, priceHalalas: 0}})).id;
  });
  it('appends simultaneous sections with distinct positions and scopes the content list', async () => {
    const sections = await Promise.all([create('sections', {courseId, title_ar: 'القسم الأول', title_en: 'First section'}), create('sections', {courseId, title_ar: 'القسم الثاني', title_en: 'Second section'})]);
    expect(sections.map(section => section.position).sort()).toEqual([0, 1]);
    sectionId = String(sections.find(section => section.title_en === 'First section')!.id);
    await create('sections', {courseId: secondCourseId, title_ar: 'قسم آخر', title_en: 'Another course section'});
    const data = await listAdmin('sections', new URLSearchParams({courseId}));
    expect(data.total).toBe(2);
    expect((data.rows as AdminRow[]).every(row => row.courseId === courseId)).toBe(true);
  });
  it('adds a video lesson and attachment without manually assigning their order', async () => {
    const draft = initialDraft('lessons', {}, sectionId);
    Object.assign(draft, {title_ar: 'درس فيديو', title_en: 'Video lesson', videoUrl: 'https://www.youtube.com/watch?v=aircAruvnKk'});
    const lesson = await create('lessons', serializeDraft('lessons', draft));
    lessonId = String(lesson.id);
    expect(lesson).toMatchObject({position: 0, kind: 'VIDEO', minutes: 0, body_en: ''});
    const attachment = await create('attachments', {lessonId, mediaAssetId: assets[2], labelAr: 'ملاحظات', labelEn: 'Notes'});
    expect(attachment.position).toBe(0);
    expect((await listAdmin('attachments', new URLSearchParams({lessonId}))).total).toBe(1);
  });
  it('creates exam questions and switches the single correct answer atomically', async () => {
    const draft = initialDraft('exams', {}, courseId);
    Object.assign(draft, {title_ar: 'اختبار المحرر', title_en: 'Editor exam', passingBasisPoints: '69.95'});
    examId = String((await create('exams', serializeDraft('exams', draft))).id);
    const question = await create('questions', {examId, prompt_ar: 'اختر الإجابة', prompt_en: 'Choose the answer', explanation_ar: '', explanation_en: '', points: 1, kind: 'SINGLE_CHOICE'});
    questionId = String(question.id);
    const first = await create('options', {questionId, label_ar: 'الأولى', label_en: 'First', isCorrect: true});
    const second = await create('options', {questionId, label_ar: 'الثانية', label_en: 'Second', isCorrect: true});
    let correct = await getDatabase().questionOption.findMany({where: {questionId, isCorrect: true}});
    expect(correct.map(option => option.id)).toEqual([second.id]);
    await mutateAdmin('options', String(first.id), {isCorrect: true}, actorId);
    correct = await getDatabase().questionOption.findMany({where: {questionId, isCorrect: true}});
    expect(correct.map(option => option.id)).toEqual([first.id]);
    expect((await getDatabase().exam.findUniqueOrThrow({where: {id: examId}})).passingBasisPoints).toBe(6995);
  });
  it('provides named course/lesson choices and separates image, video, and document uploads', async () => {
    const choices = await adminLookups();
    expect(choices.lessonId.find(item => item.id === lessonId)).toMatchObject({courseId, title_en: expect.stringContaining('Editor course')});
    expect(choices.questionId.find(item => item.id === questionId)?.title_en).toContain('Editor exam');
    expect(choices.mediaAssetId.some(item => item.id === assets[2])).toBe(true);
    expect(choices.mediaAssetId.some(item => item.id === assets[1])).toBe(false);
    expect(choices.videoFileId.some(item => item.id === assets[1])).toBe(true);
    expect(choices.videoFileId.some(item => item.id === assets[2])).toBe(false);
    expect(choices.thumbnailUrl.some(item => item.id === '/api/media/' + assets[0])).toBe(true);
  });
  it('appends page blocks without colliding with existing positions', async () => {
    const values = {pageId, kind: 'BANNER', title_ar: 'عنوان', title_en: 'Title', body_ar: 'محتوى', body_en: 'Body', settings: {}};
    const first = await create('blocks', {...values, key: 'first'});
    const second = await create('blocks', {...values, key: 'second'});
    expect([first.position, second.position]).toEqual([0, 1]);
  });
  it('filters complete course language codes before counting and paginating admin results', async () => {
    const db = getDatabase();
    await db.course.update({where: {id: courseId}, data: {languages: 'ar'}});
    await db.course.update({where: {id: secondCourseId}, data: {languages: 'en'}});
    const arabic = await listAdmin('courses', new URLSearchParams({language: 'ar'}));
    const english = await listAdmin('courses', new URLSearchParams({language: 'en'}));
    expect(arabic.total).toBe(1); expect((arabic.rows as AdminRow[]).map(row => row.id)).toEqual([courseId]);
    expect(english.total).toBe(1); expect((english.rows as AdminRow[]).map(row => row.id)).toEqual([secondCourseId]);
    await db.course.update({where: {id: courseId}, data: {languages: ' AR , en '}});
    expect((await listAdmin('courses', new URLSearchParams({language: 'en', q: 'Editor course'}))).total).toBe(1);
    await db.course.update({where: {id: secondCourseId}, data: {languages: 'french'}});
    expect((await listAdmin('courses', new URLSearchParams({language: 'en'}))).total).toBe(1);
  });
});
