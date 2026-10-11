import { z } from 'zod';
import { MAX_CART_ITEMS } from './domain';

export const courseKeySchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/);
export const cartMutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('merge'), courseIds: z.array(courseKeySchema).max(MAX_CART_ITEMS) }).strict(),
  z.object({ action: z.literal('add'), courseId: courseKeySchema }).strict(),
]);
export const cartRemovalSchema = z.object({ courseId: courseKeySchema }).strict();
