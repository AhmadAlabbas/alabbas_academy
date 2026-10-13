import {beforeAll, afterAll, describe, it, expect, vi} from 'vitest';
import {randomUUID} from 'node:crypto';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/session', () => ({requireVerifiedUser: vi.fn()}));
import {getDatabase} from '@/lib/db';
import {mutateAdmin, listAdmin, adminLookups} from '@/lib/admin/service';
import {initialDraft, serializeDraft, type AdminRow} from '@/lib/admin/forms';
import {CourseDeletionBlocked, CourseDeletionChanged, CourseCleanupUnavailable} from '@/lib/admin/deletion';
import {courseDeletionPreview} from '@/lib/admin/course-deletion';

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
    const fixtureQuery = (await db.course.findUniqueOrThrow({where: {id: courseId}, select: {key: true}})).key.slice('builder-'.length);
    await db.course.update({where: {id: courseId}, data: {languages: 'ar'}});
    await db.course.update({where: {id: secondCourseId}, data: {languages: 'en'}});
    const arabic = await listAdmin('courses', new URLSearchParams({language: 'ar', q: fixtureQuery}));
    const english = await listAdmin('courses', new URLSearchParams({language: 'en', q: fixtureQuery}));
    expect(arabic.total).toBe(1); expect((arabic.rows as AdminRow[]).map(row => row.id)).toEqual([courseId]);
    expect(english.total).toBe(1); expect((english.rows as AdminRow[]).map(row => row.id)).toEqual([secondCourseId]);
    await db.course.update({where: {id: courseId}, data: {languages: ' AR , en '}});
    expect((await listAdmin('courses', new URLSearchParams({language: 'en', q: 'Editor course'}))).total).toBe(1);
    await db.course.update({where: {id: secondCourseId}, data: {languages: 'french'}});
    expect((await listAdmin('courses', new URLSearchParams({language: 'en', q: fixtureQuery}))).total).toBe(1);
  });
  it('deletes an unused course with section exams and audits the deletion atomically', async () => {
    const db = getDatabase(), unique = randomUUID();
    const course = await db.course.create({data: {key: unique, slug_ar: 'حذف-' + unique, slug_en: 'delete-' + unique, categoryId, priceHalalas: 0}});
    try {
      const section = await db.section.create({data: {courseId: course.id, position: 0}});
      const lesson = await db.lesson.create({data: {sectionId: section.id, position: 0, kind: 'ARTICLE'}});
      const exam = await db.exam.create({data: {courseId: course.id, sectionId: section.id, position: 0, passingBasisPoints: 7000}});
      await mutateAdmin('courses', course.id, {}, actorId, true);
      expect(await db.course.findUnique({where: {id: course.id}})).toBeNull();
      expect(await db.lesson.findUnique({where: {id: lesson.id}})).toBeNull();
      expect(await db.exam.findUnique({where: {id: exam.id}})).toBeNull();
      expect(await db.auditLog.count({where: {actorId, entityId: course.id, action: 'DELETE'}})).toBe(1);
    } finally {await db.exam.deleteMany({where: {courseId: course.id}}); await db.course.deleteMany({where: {id: course.id}});}
  });
  it('explains every course deletion blocker and keeps curriculum and history intact', async () => {
    const db = getDatabase(), unique = randomUUID();
    const course = await db.course.create({data: {key: unique, slug_ar: 'محفوظ-' + unique, slug_en: 'retained-' + unique, categoryId, priceHalalas: 0, status: 'ARCHIVED'}});
    const section = await db.section.create({data: {courseId: course.id, position: 0}});
    const exam = await db.exam.create({data: {courseId: course.id, sectionId: section.id, position: 0, passingBasisPoints: 7000}});
    const order = await db.order.create({data: {number: unique, userId: actorId, subtotalHalalas: 0, totalHalalas: 0, buyerEmail: 'builder@example.test', buyerName: 'Builder', locale: 'en', checkoutKey: unique}});
    const coupon = await db.coupon.create({data: {code: unique, kind: 'PERCENTAGE', percentageBasisPoints: 1000}});
    try {
      const relations = [
        ['enrollments', () => db.enrollment.create({data: {courseId: course.id, userId: actorId}})],
        ['orderItems', () => db.orderItem.create({data: {courseId: course.id, orderId: order.id, titleAr: 'عنوان', titleEn: 'Title', unitPriceHalalas: 0, totalHalalas: 0}})],
        ['reviews', () => db.review.create({data: {courseId: course.id, userId: actorId, rating: 5, body: 'Review', locale: 'en'}})],
        ['couponCourses', () => db.couponCourse.create({data: {courseId: course.id, couponId: coupon.id}})],
      ] as const;
      const counts = {enrollments: 0, orderItems: 0, reviews: 0, couponCourses: 0};
      for (const [key, add] of relations) {
        await add(); counts[key] = 1;
        try {await mutateAdmin('courses', course.id, {}, actorId, true); expect.fail('Linked course must not be deleted');}
        catch (error) {expect(error).toBeInstanceOf(CourseDeletionBlocked); expect((error as CourseDeletionBlocked).blockers).toEqual(counts);}
        expect(await db.exam.findUnique({where: {id: exam.id}})).not.toBeNull();
        expect(await db.course.findUnique({where: {id: course.id}})).not.toBeNull();
        if (counts.orderItems) {
          const preview = await courseDeletionPreview(course.id);
          expect(preview.canDeleteTestData).toBe(false);
          await expect(mutateAdmin('courses', course.id, {}, actorId, true, {confirmedTestData: true, previewToken: preview.previewToken})).rejects.toBeInstanceOf(CourseCleanupUnavailable);
        }
      }
      expect(await db.auditLog.count({where: {actorId, entityId: course.id, action: 'DELETE'}})).toBe(0);
    } finally {
      await db.enrollment.deleteMany({where: {courseId: course.id}});
      await db.orderItem.deleteMany({where: {orderId: order.id}});
      await db.order.delete({where: {id: order.id}});
      await db.review.deleteMany({where: {courseId: course.id}});
      await db.coupon.delete({where: {id: coupon.id}});
      await db.exam.deleteMany({where: {courseId: course.id}});
      await db.course.delete({where: {id: course.id}});
    }
  });
  it('previews and deletes test learning records while retaining the account and other course records', async () => {
    const db = getDatabase(), unique = randomUUID();
    const course = await db.course.create({data: {key: unique, slug_ar: 'تجربة-' + unique, slug_en: 'test-' + unique, categoryId, priceHalalas: 0, status: 'ARCHIVED'}});
    const other = await db.enrollment.create({data: {courseId: secondCourseId, userId: actorId, source: 'admin'}});
    try {
      const section = await db.section.create({data: {courseId: course.id, position: 0}});
      const lesson = await db.lesson.create({data: {sectionId: section.id, position: 0, kind: 'VIDEO'}});
      const exam = await db.exam.create({data: {courseId: course.id, sectionId: section.id, position: 0}});
      const enrollment = await db.enrollment.create({data: {courseId: course.id, userId: actorId, source: 'admin'}});
      await db.lessonProgress.create({data: {enrollmentId: enrollment.id, lessonId: lesson.id, note: 'Private test notes'}});
      await db.examAttempt.create({data: {enrollmentId: enrollment.id, examId: exam.id, number: 1, examVersion: 1, locale: 'en', questionSnapshot: [], maximumPoints: 1}});
      await db.certificate.create({data: {enrollmentId: enrollment.id, serial: unique, verificationHash: unique.replaceAll('-', '').padEnd(64, '0'), learnerName: 'Test student', courseTitleAr: 'اختبار', courseTitleEn: 'Test'}});
      await db.review.create({data: {courseId: course.id, userId: actorId, rating: 5, body: 'Test review', locale: 'en'}});
      const preview = await courseDeletionPreview(course.id);
      expect(preview).toMatchObject({canDeleteTestData: true, blockers: {enrollments: 1, reviews: 1}, learning: {progress: 1, attempts: 1, certificates: 1}});
      await mutateAdmin('courses', course.id, {}, actorId, true, {confirmedTestData: true, previewToken: preview.previewToken});
      expect(await db.user.findUnique({where: {id: actorId}})).not.toBeNull();
      expect(await db.enrollment.findUnique({where: {id: other.id}})).not.toBeNull();
      expect(await db.course.findUnique({where: {id: course.id}})).toBeNull();
      expect(await db.enrollment.findUnique({where: {id: enrollment.id}})).toBeNull();
      expect(await db.lessonProgress.count({where: {enrollmentId: enrollment.id}})).toBe(0);
      expect(await db.examAttempt.count({where: {enrollmentId: enrollment.id}})).toBe(0);
      expect(await db.certificate.count({where: {enrollmentId: enrollment.id}})).toBe(0);
      expect(await db.review.count({where: {courseId: course.id}})).toBe(0);
      const audit = await db.auditLog.findFirstOrThrow({where: {actorId, entityId: course.id, action: 'DELETE'}});
      expect(audit.changes).toMatchObject({testDataConfirmed: true, removed: {enrollments: 1, reviews: 1, certificates: 1}});
    } finally {
      await db.certificate.deleteMany({where: {enrollment: {courseId: course.id}}});
      await db.examAttempt.deleteMany({where: {enrollment: {courseId: course.id}}});
      await db.enrollment.deleteMany({where: {courseId: course.id}});
      await db.enrollment.delete({where: {id: other.id}});
      await db.review.deleteMany({where: {courseId: course.id}});
      await db.exam.deleteMany({where: {courseId: course.id}});
      await db.course.deleteMany({where: {id: course.id}});
    }
  });
  it('rejects stale previews, published-course cleanup and coupon-linked cleanup without deleting any records', async () => {
    const db = getDatabase(), unique = randomUUID();
    const course = await db.course.create({data: {key: unique, slug_ar: 'تأكيد-' + unique, slug_en: 'confirm-' + unique, categoryId, priceHalalas: 0, status: 'PUBLISHED'}});
    const coupon = await db.coupon.create({data: {code: unique, kind: 'PERCENTAGE', percentageBasisPoints: 1000}});
    try {
      const published = await courseDeletionPreview(course.id);
      expect(published.reason).toBe('ARCHIVE_FIRST');
      await expect(mutateAdmin('courses', course.id, {}, actorId, true, {confirmedTestData: true, previewToken: published.previewToken})).rejects.toBeInstanceOf(CourseCleanupUnavailable);
      await db.course.update({where: {id: course.id}, data: {status: 'ARCHIVED'}});
      const stale = await courseDeletionPreview(course.id);
      await db.review.create({data: {courseId: course.id, userId: actorId, rating: 5, body: 'New test record', locale: 'en'}});
      await expect(mutateAdmin('courses', course.id, {}, actorId, true, {confirmedTestData: true, previewToken: stale.previewToken})).rejects.toBeInstanceOf(CourseDeletionChanged);
      await db.couponCourse.create({data: {courseId: course.id, couponId: coupon.id}});
      const linked = await courseDeletionPreview(course.id);
      expect(linked.reason).toBe('COUPON_LINKS');
      await expect(mutateAdmin('courses', course.id, {}, actorId, true, {confirmedTestData: true, previewToken: linked.previewToken})).rejects.toBeInstanceOf(CourseCleanupUnavailable);
      expect(await db.review.count({where: {courseId: course.id}})).toBe(1);
      expect(await db.course.findUnique({where: {id: course.id}})).not.toBeNull();
      await expect(mutateAdmin('sections', sectionId, {}, actorId, true, {confirmedTestData: true, previewToken: linked.previewToken})).rejects.toThrow('INVALID_INPUT');
    } finally {await db.review.deleteMany({where: {courseId: course.id}}); await db.coupon.delete({where: {id: coupon.id}}); await db.course.delete({where: {id: course.id}});}
  });
  it('rolls back all test cleanup if another course still references an exam', async () => {
    const db = getDatabase(), unique = randomUUID();
    const course = await db.course.create({data: {key: unique, slug_ar: 'تراجع-' + unique, slug_en: 'rollback-' + unique, categoryId, priceHalalas: 0, status: 'ARCHIVED'}});
    const enrollment = await db.enrollment.create({data: {courseId: course.id, userId: actorId, source: 'admin'}});
    const other = await db.enrollment.create({data: {courseId: secondCourseId, userId: actorId, source: 'admin'}});
    try {
      const exam = await db.exam.create({data: {courseId: course.id, position: 0}});
      await db.examAttempt.create({data: {enrollmentId: other.id, examId: exam.id, number: 1, examVersion: 1, locale: 'en', questionSnapshot: [], maximumPoints: 1}});
      const certificate = await db.certificate.create({data: {enrollmentId: enrollment.id, serial: unique, verificationHash: unique.replaceAll('-', '').padEnd(64, '1'), learnerName: 'Test', courseTitleAr: 'اختبار', courseTitleEn: 'Test'}});
      await db.review.create({data: {courseId: course.id, userId: actorId, rating: 5, body: 'Test', locale: 'en'}});
      const preview = await courseDeletionPreview(course.id);
      await expect(mutateAdmin('courses', course.id, {}, actorId, true, {confirmedTestData: true, previewToken: preview.previewToken})).rejects.toMatchObject({code: 'P2003'});
      expect(await db.enrollment.findUnique({where: {id: enrollment.id}})).not.toBeNull();
      expect(await db.certificate.findUnique({where: {id: certificate.id}})).not.toBeNull();
      expect(await db.review.count({where: {courseId: course.id}})).toBe(1);
      expect(await db.auditLog.count({where: {entityId: course.id, action: 'DELETE'}})).toBe(0);
    } finally {
      await db.examAttempt.deleteMany({where: {exam: {courseId: course.id}}});
      await db.certificate.deleteMany({where: {enrollmentId: enrollment.id}});
      await db.enrollment.deleteMany({where: {id: {in: [enrollment.id, other.id]}}});
      await db.review.deleteMany({where: {courseId: course.id}});
      await db.exam.deleteMany({where: {courseId: course.id}});
      await db.course.delete({where: {id: course.id}});
    }
  });
});
