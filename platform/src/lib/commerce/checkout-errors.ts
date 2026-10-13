export function checkoutErrorMessage(code: string | undefined, arabic: boolean) {
  const messages: Record<string, [string, string]> = {
    INVALID_COUPON: ['رمز الخصم غير صحيح.', 'This coupon code is not valid.'],
    COUPON_INACTIVE: ['رمز الخصم غير نشط.', 'This coupon is inactive.'],
    COUPON_EXPIRED: ['انتهت صلاحية رمز الخصم.', 'This coupon has expired.'],
    COUPON_NOT_STARTED: ['لم يبدأ عرض هذا الرمز بعد.', 'This coupon offer has not started yet.'],
    COUPON_COURSES: ['هذا الرمز لا يشمل جميع الدورات في سلتك.', 'This coupon does not cover every course in your cart.'],
    COUPON_MINIMUM: ['لم تصل قيمة الطلب إلى الحد الأدنى المطلوب لهذا الرمز.', 'Your order does not meet this coupon’s minimum amount.'],
    COUPON_LIMIT: ['تم بلوغ حد استخدام هذا الرمز.', 'The usage limit for this coupon has been reached.'],
    COUPON_NO_SAVINGS: ['هذا الرمز لا يخفض قيمة الطلب الحالي.', 'This coupon does not reduce the current order total.'],
    EMPTY_CART: ['أضف دورة إلى السلة أولاً.', 'Add a course to your cart first.'],
    COURSE_UNAVAILABLE: ['إحدى الدورات لم تعد متاحة أو سبق تسجيلك فيها. حدّث السلة.', 'A course is unavailable or already owned. Refresh your cart.'],
    VERIFICATION_REQUIRED: ['أكد بريدك الإلكتروني قبل إتمام الطلب.', 'Verify your email before checkout.'],
    UNAUTHORIZED: ['سجّل الدخول مجددًا لإتمام الطلب.', 'Sign in again to continue checkout.'],
    FORBIDDEN: ['تعذر إتمام الطلب بهذا الحساب. تحقق من تسجيل الدخول وتأكيد البريد.', 'Check your sign-in and email verification before checkout.'],
  };
  return messages[code || '']?.[arabic ? 0 : 1] || (arabic ? 'تعذر إتمام الطلب الآن. حاول مجددًا.' : 'Unable to complete this request. Try again.');
}
