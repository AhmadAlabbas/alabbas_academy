export type CourseDeletionBlockers = {enrollments: number; orderItems: number; reviews: number; couponCourses: number};
export type CleanupUnavailableReason = 'ARCHIVE_FIRST' | 'PURCHASE_HISTORY' | 'COUPON_LINKS';
export type CourseDeletionPreview = {
  id: string; title_ar: string; title_en: string; languages: string;
  blockers: CourseDeletionBlockers;
  learning: {progress: number; attempts: number; certificates: number};
  canDeleteTestData: boolean; reason: CleanupUnavailableReason | null; previewToken: string;
};
export class CourseCleanupUnavailable extends Error {
  constructor(public readonly reason: CleanupUnavailableReason) {super('COURSE_CLEANUP_UNAVAILABLE');}
}
export class CourseDeletionChanged extends Error {
  constructor() {super('COURSE_DELETE_CHANGED');}
}

export function cleanupUnavailableMessage(reason: CleanupUnavailableReason | null, arabic: boolean) {
  if (reason === 'ARCHIVE_FIRST') return arabic ? 'أرشف الدورة أولاً قبل حذف بيانات الاختبار.' : 'Archive the course before deleting test data.';
  if (reason === 'PURCHASE_HISTORY') return arabic ? 'لا يمكن حذف دورة لها طلبات أو تسجيلات مرتبطة بمشتريات. استخدم الأرشفة.' : 'Courses with orders or purchase-linked enrollments cannot be deleted. Use archiving.';
  return arabic ? 'أزل روابط الكوبونات قبل حذف الدورة. يجب ألا تتغير شروط الخصم تلقائيًا.' : 'Remove coupon links before deleting the course. Discount eligibility must stay unchanged.';
}

export class CourseDeletionBlocked extends Error {
  constructor(public readonly blockers: CourseDeletionBlockers) {
    super('COURSE_IN_USE');
    this.name = 'CourseDeletionBlocked';
  }
}

export function deletionErrorMessage(body: {code?: string; blockers?: Partial<CourseDeletionBlockers>; reason?: CleanupUnavailableReason}, arabic: boolean) {
  if (body.code === 'COURSE_DELETE_CHANGED') return arabic ? 'تغيرت بيانات الدورة. أغلق نافذة الحذف وافتحها مجددًا لمراجعة البيانات الحالية.' : 'Course data changed. Close and reopen the deletion preview to review the current records.';
  if (body.code === 'COURSE_CLEANUP_UNAVAILABLE') return cleanupUnavailableMessage(body.reason || 'PURCHASE_HISTORY', arabic);
  if (body.code === 'COURSE_IN_USE' && body.blockers) {
    const names = arabic
      ? {enrollments: 'تسجيلات طلاب', orderItems: 'بنود طلبات', reviews: 'تقييمات', couponCourses: 'روابط كوبونات'}
      : {enrollments: 'student enrollments', orderItems: 'order items', reviews: 'reviews', couponCourses: 'coupon links'};
    const reasons = (Object.keys(names) as Array<keyof CourseDeletionBlockers>)
      .filter(key => Number(body.blockers?.[key]) > 0)
      .map(key => `${body.blockers?.[key]} ${names[key]}`).join(arabic ? '، ' : ', ');
    return arabic ? `تعذر حذف الدورة لأنها مرتبطة بـ: ${reasons}. الأرشفة تخفيها من قائمة الدورات العامة.`
      : `Cannot delete this course: ${reasons}. Archive it to hide it from the public catalog.`;
  }
  if (body.code === 'INVALID_RELATION') return arabic ? 'السجل مرتبط ببيانات أخرى ويجب الاحتفاظ به أو إزالة الروابط أولاً.' : 'This record has linked data. Keep it or remove those links first.';
  if (body.code === 'UNAUTHORIZED' || body.code === 'FORBIDDEN') return arabic ? 'سجّل الدخول مجددًا بحساب المسؤول ثم أعد المحاولة.' : 'Sign in again with your administrator account, then retry.';
  return arabic ? 'تعذر الحذف. حاول مجددًا.' : 'Unable to delete. Try again.';
}
