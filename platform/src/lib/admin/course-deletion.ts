import 'server-only';
import {createHash} from 'node:crypto';
import type {Prisma} from '@/generated/prisma/client';
import {getDatabase} from '@/lib/db';
import {CourseCleanupUnavailable, CourseDeletionBlocked, CourseDeletionChanged, type CourseDeletionPreview, type CleanupUnavailableReason} from './deletion';

async function inventory(db: Prisma.TransactionClient, id: string): Promise<CourseDeletionPreview> {
  const course = await db.course.findUniqueOrThrow({where: {id}, select: {id: true, title_ar: true, title_en: true, languages: true, status: true, updatedAt: true, _count: {select: {enrollments: true, orderItems: true, reviews: true, couponCourses: true}}}});
  const enrollments = await db.enrollment.findMany({where: {courseId: id}, orderBy: {id: 'asc'}, select: {
    id: true, orderItemId: true,
    progress: {orderBy: {id: 'asc'}, select: {id: true}},
    examAttempts: {orderBy: {id: 'asc'}, select: {id: true}},
    certificate: {select: {id: true}},
  }});
  const reviews = await db.review.findMany({where: {courseId: id}, orderBy: {id: 'asc'}, select: {id: true}});
  const reason: CleanupUnavailableReason | null = course._count.orderItems || enrollments.some(item => item.orderItemId)
    ? 'PURCHASE_HISTORY' : course._count.couponCourses ? 'COUPON_LINKS' : course.status !== 'ARCHIVED' ? 'ARCHIVE_FIRST' : null;
  const previewToken = createHash('sha256').update(JSON.stringify({course, enrollments, reviews})).digest('hex');
  return {id, title_ar: course.title_ar, title_en: course.title_en, languages: course.languages, blockers: course._count, learning: {
    progress: enrollments.reduce((sum, item) => sum + item.progress.length, 0),
    attempts: enrollments.reduce((sum, item) => sum + item.examAttempts.length, 0),
    certificates: enrollments.filter(item => item.certificate).length,
  }, canDeleteTestData: !reason, reason, previewToken};
}

export async function courseDeletionPreview(id: string) {
  return getDatabase().$transaction(tx => inventory(tx, id));
}

export async function deleteCourse(id: string, actorId: string, testData?: {confirmedTestData: true; previewToken: string}) {
  return getDatabase().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM courses WHERE id = ${id} FOR UPDATE`;
    if (testData) await tx.$queryRaw`SELECT id FROM enrollments WHERE courseId = ${id} FOR UPDATE`;
    const preview = await inventory(tx, id);
    if (testData) {
      if (testData.confirmedTestData !== true || !testData.previewToken || preview.previewToken !== testData.previewToken) throw new CourseDeletionChanged();
      if (preview.reason) throw new CourseCleanupUnavailable(preview.reason);
      const enrollment = {courseId: id};
      await tx.certificate.deleteMany({where: {enrollment}});
      await tx.examAttempt.deleteMany({where: {enrollment}});
      // Progress cascades from enrollments. Keep student accounts, sessions,
      // every other course's learning records and shared uploaded media.
      await tx.enrollment.deleteMany({where: enrollment});
      await tx.review.deleteMany({where: {courseId: id}});
    } else if (Object.values(preview.blockers).some(count => count > 0)) throw new CourseDeletionBlocked(preview.blockers);
    // Section exams use a restrictive section link; remove them before the
    // section cascade. Any remaining restrictive relation rolls back cleanup.
    await tx.exam.deleteMany({where: {courseId: id}});
    const deleted = await tx.course.delete({where: {id}});
    await tx.auditLog.create({data: {actorId, action: 'DELETE', entityType: 'courses', entityId: id,
      changes: testData ? {testDataConfirmed: true, removed: {...preview.blockers, ...preview.learning}} : {fields: []}}});
    return deleted;
  });
}
