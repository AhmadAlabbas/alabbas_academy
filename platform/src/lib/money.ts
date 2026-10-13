export const MAX_HALALAS = 2_147_483_647;
export function sarToHalalas(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new Error('Invalid SAR amount');
  const [whole, fraction = ''] = value.trim().split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > MAX_HALALAS) throw new Error('Amount exceeds supported limit');
  return amount;
}
export function formatSAR(halalas: number, locale: 'ar' | 'en'): string {
  if (!Number.isSafeInteger(halalas) || halalas < 0 || halalas > MAX_HALALAS) throw new Error('Invalid halala amount');
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {style:'currency',currency:'SAR',minimumFractionDigits:0,maximumFractionDigits:2}).format(halalas / 100);
}
export function formatSARNumber(halalas: number, locale: 'ar' | 'en'): string {
  if (!Number.isSafeInteger(halalas) || halalas < 0 || halalas > MAX_HALALAS) throw new Error('Invalid halala amount');
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {minimumFractionDigits: halalas % 100 ? 2 : 0, maximumFractionDigits: 2}).format(halalas / 100);
}
export function saleDetails(price: number, original?: number | null) {
  if (!original || original <= price) return null;
  formatSARNumber(price, 'en'); formatSARNumber(original, 'en');
  return {savedHalalas: original - price, percentage: Math.floor((original - price) * 100 / original)};
}
