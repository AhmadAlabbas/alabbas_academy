import {z} from 'zod';
export function validateAdminPricing(entity: string, row: Record<string, unknown>) {
  const issues: z.core.$ZodIssue[] = [];
  const invalid = (field: string, message: string) => issues.push({code: 'custom', path: [field], message});
  if (entity === 'courses' && row.compareAtHalalas != null && Number(row.compareAtHalalas) <= Number(row.priceHalalas)) invalid('compareAtHalalas', 'Original price must be higher than the current price. Clear it when there is no sale.');
  if (entity === 'coupons') {
    if (row.kind === 'PERCENTAGE' && !(Number(row.percentageBasisPoints) > 0 && Number(row.percentageBasisPoints) <= 10000)) invalid('percentageBasisPoints', 'Enter a percentage above 0 and no higher than 100.');
    if (row.kind === 'FIXED_AMOUNT' && !(Number(row.amountHalalas) > 0)) invalid('amountHalalas', 'Enter a discount amount above 0.');
    if (!Number.isInteger(row.perUserLimit) || Number(row.perUserLimit) < 1) invalid('perUserLimit', 'Allow at least one use per customer.');
    if (row.usageLimit != null && Number(row.usageLimit) < 1) invalid('usageLimit', 'Enter at least 1, or leave blank for no overall limit.');
    if (row.maximumDiscountHalalas != null && Number(row.maximumDiscountHalalas) <= 0) invalid('maximumDiscountHalalas', 'Enter a positive cap, or leave blank for no cap.');
    if (row.startsAt && row.expiresAt && new Date(String(row.expiresAt)) <= new Date(String(row.startsAt))) invalid('expiresAt', 'Expiry must be later than the start date.');
  }
  if (issues.length) throw new z.ZodError(issues);
}
