import 'server-only';
import { getDatabase } from '@/lib/db';
import { reconcileCart, type CartCandidate, type CartItem } from './domain';

type CartOperation = { action: 'read' } | { action: 'merge'; courseIds: string[] } |
  { action: 'add'; courseId: string } | { action: 'remove'; courseId: string };
const covers = new Set(['design', 'code', 'business', 'photo']);

/** Every read and mutation repairs stale items and serializes by authenticated owner. */
export async function updateAccountCart(userId: string, operation: CartOperation) {
  return getDatabase().$transaction(async tx => {
    // A transaction-scoped lock also protects the first simultaneous cart creation.
    // Values remain parameters; neither course identifiers nor user IDs become SQL.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const cart = await tx.cart.upsert({ where: { userId }, update: {}, create: { userId }, select: { id: true } });
    const stored = await tx.cartItem.findMany({
      where: { cartId: cart.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { course: { select: { key: true } } },
    });
    let keys = stored.map(item => item.course.key);
    if (operation.action === 'remove') keys = keys.filter(key => key !== operation.courseId);
    if (operation.action === 'merge') keys.push(...operation.courseIds);
    if (operation.action === 'add') keys.push(operation.courseId);
    keys = [...new Set(keys)];

    const courses = keys.length ? await tx.course.findMany({
      where: { key: { in: keys } },
      select: {
        id: true, key: true, status: true, currency: true, priceHalalas: true, compareAtHalalas: true, coverStyle: true,
        title_ar:true,title_en:true,slug_ar:true,slug_en:true,
        enrollments: { where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } }, select: { id: true } },
      },
    }) : [];
    const candidates: CartCandidate[] = courses.map(course => {
      return {
        published: course.status === 'PUBLISHED', owned: course.enrollments.length > 0, currency: course.currency,
        item: {
          courseId: course.key, title: { ar: course.title_ar, en: course.title_en },
          slug: { ar: course.slug_ar, en: course.slug_en },
          cover: (covers.has(course.coverStyle) ? course.coverStyle : 'design') as CartItem['cover'],
          priceHalalas: course.priceHalalas,
          compareAtHalalas: course.compareAtHalalas,
        },
      };
    });
    const result = reconcileCart(keys, candidates);
    const included = new Set(result.cart.items.map(item => item.courseId));
    const databaseIds = courses.filter(course => included.has(course.key)).map(course => course.id);
    await tx.cartItem.deleteMany({ where: { cartId: cart.id, ...(databaseIds.length ? { courseId: { notIn: databaseIds } } : {}) } });
    if (databaseIds.length) await tx.cartItem.createMany({
      data: databaseIds.map(courseId => ({ cartId: cart.id, courseId })), skipDuplicates: true,
    });
    // Use DB facts for all prices and labels. Never accept user IDs or totals from clients.
    return result;
  }, { maxWait: 10_000, timeout: 15_000, isolationLevel: 'ReadCommitted' });
}
