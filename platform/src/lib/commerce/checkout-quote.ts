import 'server-only';
import type {Prisma} from '@/generated/prisma/client';
import {getDatabase} from '@/lib/db';
import {calculateDiscount} from './totals';
export class CheckoutError extends Error {
  constructor(public readonly code: string, public readonly status = 400, public readonly minimumOrderHalalas?: number) {super(code);}
}

export async function checkoutCart(tx: Prisma.TransactionClient, userId: string) {
  const cart = await tx.cart.findUnique({where: {userId}, include: {items: {include: {course: {include: {enrollments: {where: {userId, status: {in: ['ACTIVE', 'COMPLETED']}}}}}}}}});
  if (!cart?.items.length || cart.items.length > 20) throw new CheckoutError('EMPTY_CART');
  if (cart.items.some(item => item.course.status !== 'PUBLISHED' || item.course.currency !== 'SAR' || item.course.enrollments.length)) throw new CheckoutError('COURSE_UNAVAILABLE');
  const subtotal = cart.items.reduce((sum, item) => sum + item.course.priceHalalas, 0);
  try {calculateDiscount(subtotal, null);} catch {throw new CheckoutError('INVALID_TOTAL');}
  return {cart, subtotal};
}

export async function checkoutCoupon(tx: Prisma.TransactionClient, userId: string, code: string | undefined, courseIds: string[], subtotal: number, reserve = false) {
  if (!code) return {coupon: null, discount: 0};
  let coupon = await tx.coupon.findUnique({where: {code: code.trim().toUpperCase()}});
  if (!coupon) throw new CheckoutError('INVALID_COUPON');
  if (reserve) {
    await tx.$queryRaw`SELECT id FROM coupons WHERE id=${coupon.id} FOR UPDATE`;
    coupon = await tx.coupon.findUniqueOrThrow({where: {id: coupon.id}});
  }
  const now = new Date();
  if (!coupon.isActive) throw new CheckoutError('COUPON_INACTIVE');
  if (coupon.startsAt && coupon.startsAt > now) throw new CheckoutError('COUPON_NOT_STARTED');
  if (coupon.expiresAt && coupon.expiresAt <= now) throw new CheckoutError('COUPON_EXPIRED');
  if ((coupon.kind === 'PERCENTAGE' && !(coupon.percentageBasisPoints && coupon.percentageBasisPoints > 0 && coupon.percentageBasisPoints <= 10000)) || (coupon.kind === 'FIXED_AMOUNT' && !(coupon.amountHalalas && coupon.amountHalalas > 0)) || !['PERCENTAGE', 'FIXED_AMOUNT'].includes(coupon.kind)) throw new CheckoutError('INVALID_COUPON');
  const scope = await tx.couponCourse.findMany({where: {couponId: coupon.id}, select: {courseId: true}});
  if (scope.length && courseIds.some(id => !scope.some(item => item.courseId === id))) throw new CheckoutError('COUPON_COURSES');
  if (reserve) await tx.couponReservation.updateMany({where: {couponId: coupon.id, status: 'RESERVED', expiresAt: {lte: now}}, data: {status: 'EXPIRED'}});
  const active = {couponId: coupon.id, OR: [{status: 'REDEEMED'}, {status: 'RESERVED', expiresAt: {gt: now}}]};
  const [all, own] = await Promise.all([tx.couponReservation.count({where: active}), tx.couponReservation.count({where: {...active, userId}})]);
  if ((coupon.usageLimit !== null && all >= coupon.usageLimit) || own >= coupon.perUserLimit) throw new CheckoutError('COUPON_LIMIT', 409);
  let discount: number;
  try {discount = calculateDiscount(subtotal, coupon);} catch {throw new CheckoutError('COUPON_MINIMUM', 400, coupon.minimumOrderHalalas);}
  if (!discount) throw new CheckoutError('COUPON_NO_SAVINGS');
  return {coupon, discount};
}

export async function quoteCheckout(userId: string, input: {coupon?: string}) {
  return getDatabase().$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({where: {id: userId}});
    if (user.status !== 'ACTIVE' || !user.emailVerified) throw new CheckoutError('VERIFICATION_REQUIRED', 403);
    const {cart, subtotal} = await checkoutCart(tx, userId);
    const {coupon, discount} = await checkoutCoupon(tx, userId, input.coupon, cart.items.map(item => item.courseId), subtotal);
    return {subtotalHalalas: subtotal, discountHalalas: discount, totalHalalas: subtotal - discount, currency: 'SAR' as const,
      coupon: coupon ? {code: coupon.code} : null,
      items: cart.items.map(item => ({courseId: item.course.key, priceHalalas: item.course.priceHalalas, compareAtHalalas: item.course.compareAtHalalas}))};
  });
}
