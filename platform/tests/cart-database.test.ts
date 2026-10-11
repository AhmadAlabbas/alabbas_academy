import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

vi.mock('server-only', () => ({}));
const testUrl = process.env.CART_TEST_DATABASE_URL;
const token = randomUUID();
const userA = `cart-test-a-${token}`;
const userB = `cart-test-b-${token}`;
const categoryId = `cart-test-category-${token}`;
const prefix = `cart-${token}`;
let database: PrismaClient;
vi.mock('@/lib/db', () => ({ getDatabase: () => database }));
const { updateAccountCart } = await import('@/lib/cart/service');

describe.skipIf(!testUrl)('cart PostgreSQL integration (explicit local test database only)', () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('Cart integration tests require a local database.');
    database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl, max: 10 }) });
    await database.user.createMany({ data: [userA, userB].map((id, index) => ({ id, email: `cart-${index}-${token}@example.test` })) });
    await database.category.create({ data: { id: categoryId, key: categoryId } });
    for (const [key, status, priceHalalas] of [['one', 'PUBLISHED', 12901], ['two', 'PUBLISHED', 9999],
      ['draft', 'DRAFT', 500], ['owned', 'PUBLISHED', 500], ['complete', 'PUBLISHED', 500], ['revoked', 'PUBLISHED', 500]] as const) {
      await database.course.create({ data: { id: `${prefix}-${key}`, key: `${prefix}-${key}`, categoryId, status, priceHalalas,
        translations: { create: [{ locale: 'ar', title: `اختبار ${key}`, description: 'اختبار السلة', slug: `${prefix}-${key}-ar` }, { locale: 'en', title: `Test ${key}`, description: 'Cart test', slug: `${prefix}-${key}-en` }] } } });
    }
    await database.enrollment.createMany({ data: [
      { userId: userA, courseId: `${prefix}-owned`, status: 'ACTIVE' },
      { userId: userA, courseId: `${prefix}-complete`, status: 'COMPLETED' },
      { userId: userA, courseId: `${prefix}-revoked`, status: 'REVOKED' },
    ] });
  }, 20_000);

  afterAll(async () => {
    if (!database) return;
    await database.cart.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await database.enrollment.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await database.course.deleteMany({ where: { categoryId } });
    await database.category.deleteMany({ where: { id: categoryId } });
    await database.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await database.$disconnect();
  });

  it('serializes simultaneous first merges without duplicates or lost courses', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => updateAccountCart(userA, {
      action: 'merge', courseIds: [`${prefix}-${index % 2 ? 'one' : 'two'}`, `${prefix}-${index % 2 ? 'one' : 'two'}`],
    })));
    expect(results.every(result => result.cart.count <= 2)).toBe(true);
    const final = await updateAccountCart(userA, { action: 'read' });
    expect(final.cart.count).toBe(2);
    expect(final.cart.subtotalHalalas).toBe(22_900);
    expect(await database.cart.count({ where: { userId: userA } })).toBe(1);
  }, 20_000);

  it('rejects owned/draft courses while permitting revoked enrollment repurchase', async () => {
    const result = await updateAccountCart(userA, { action: 'merge', courseIds: ['owned', 'complete', 'draft', 'revoked'].map(key => `${prefix}-${key}`) });
    expect(result.rejected).toEqual(expect.arrayContaining([
      { courseId: `${prefix}-owned`, reason: 'OWNED' }, { courseId: `${prefix}-complete`, reason: 'OWNED' },
      { courseId: `${prefix}-draft`, reason: 'UNAVAILABLE' },
    ]));
    expect(result.cart.items.some(item => item.courseId === `${prefix}-revoked`)).toBe(true);
  });

  it('uses edited database prices and removes newly archived items', async () => {
    await database.course.update({ where: { key: `${prefix}-one` }, data: { priceHalalas: 11_001 } });
    const changed = await updateAccountCart(userA, { action: 'read' });
    expect(changed.cart.items.find(item => item.courseId === `${prefix}-one`)?.priceHalalas).toBe(11_001);
    await database.course.update({ where: { key: `${prefix}-two` }, data: { status: 'ARCHIVED' } });
    const archived = await updateAccountCart(userA, { action: 'read' });
    expect(archived.cart.items.some(item => item.courseId === `${prefix}-two`)).toBe(false);
    expect(archived.rejected).toContainEqual({ courseId: `${prefix}-two`, reason: 'UNAVAILABLE' });
  });

  it('never reads or deletes a different account’s cart', async () => {
    expect((await updateAccountCart(userB, { action: 'read' })).cart.count).toBe(0);
    await updateAccountCart(userB, { action: 'add', courseId: `${prefix}-one` });
    await updateAccountCart(userB, { action: 'remove', courseId: `${prefix}-revoked` });
    expect((await updateAccountCart(userA, { action: 'read' })).cart.items.some(item => item.courseId === `${prefix}-revoked`)).toBe(true);
    expect((await updateAccountCart(userB, { action: 'read' })).cart.items.map(item => item.courseId)).toEqual([`${prefix}-one`]);
  });
});
