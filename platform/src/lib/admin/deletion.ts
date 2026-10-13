export type CourseDeletionBlockers = {enrollments: number; orderItems: number; reviews: number; couponCourses: number};

export class CourseDeletionBlocked extends Error {
  constructor(public readonly blockers: CourseDeletionBlockers) {
    super('COURSE_IN_USE');
    this.name = 'CourseDeletionBlocked';
  }
}

export function deletionErrorMessage(body: {code?: string; blockers?: Partial<CourseDeletionBlockers>}, arabic: boolean) {
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
