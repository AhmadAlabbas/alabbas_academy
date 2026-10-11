import {describe, expect, it, vi} from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/session', () => ({requireVerifiedUser: vi.fn()}));
import {initialDraft, serializeDraft, slugFromTitle, recordTitle} from '@/lib/admin/forms';
import {entitySchema} from '@/lib/admin/service';

describe('Course editor values', () => {
  it('round-trips stored course prices and accepts exact SAR amounts', () => {
    const draft = initialDraft('courses', {id: 'course', priceHalalas: 19995, compareAtHalalas: 24900});
    expect(draft.priceHalalas).toBe('199.95');
    expect(draft.compareAtHalalas).toBe('249.00');
    expect(serializeDraft('courses', draft)).toMatchObject({priceHalalas: 19995, compareAtHalalas: 24900});
    draft.priceHalalas = '0.29'; draft.compareAtHalalas = '';
    expect(serializeDraft('courses', draft)).toMatchObject({priceHalalas: 29, compareAtHalalas: null});
  });
  it.each(['1.001', '-1', '1e3', 'Infinity', '21474836.48'])('refuses an invalid SAR amount %s', amount => {
    const draft = initialDraft('courses', {}); draft.priceHalalas = amount;
    expect(() => serializeDraft('courses', draft)).toThrow();
  });
  it('uses readable percentages while preserving exact stored exam scores', () => {
    const draft = initialDraft('exams', {id: 'exam', passingBasisPoints: 7000});
    expect(draft.passingBasisPoints).toBe('70.00');
    draft.passingBasisPoints = '69.95';
    expect(serializeDraft('exams', draft).passingBasisPoints).toBe(6995);
    draft.passingBasisPoints = '100.01';
    expect(() => serializeDraft('exams', draft)).toThrow();
  });
  it('starts a video lesson in the selected section with optional body and automatic order', () => {
    const draft = initialDraft('lessons', {}, 'selected-section');
    expect(draft).toMatchObject({sectionId: 'selected-section', kind: 'VIDEO', minutes: '0', notesEnabled: true});
    const data = serializeDraft('lessons', draft);
    expect(data).toMatchObject({body_ar: '', body_en: '', videoUrl: null, videoFileId: null, minutes: 0});
    expect(data).not.toHaveProperty('position');
    draft.position = '3'; expect(serializeDraft('lessons', draft).position).toBe(3);
  });
  it('preserves a server-provided course reference during hydration', () => {
    expect(initialDraft('courses', {key: 'provided-course-reference'}).key).toBe('provided-course-reference');
  });
  it('preserves a disabled setting and a JSON string value when editing', () => {
    expect(initialDraft('categories', {id: 'category', isActive: false}).isActive).toBe(false);
    const draft = initialDraft('settings', {key: 'name_en', value: 'Alabbas Academy'});
    expect(draft.value).toBe('"Alabbas Academy"');
    expect(serializeDraft('settings', draft).value).toBe('Alabbas Academy');
  });
  it('keeps existing date values in the local datetime input timezone', () => {
    const value = '2026-10-12T00:30:00.000Z';
    const draft = initialDraft('testimonials', {id: 'testimonial', consentAt: value});
    expect(serializeDraft('testimonials', draft).consentAt).toBe(value);
  });
  it.each([
    ['  Visual Design & Color! ', 'visual-design-color'],
    ['أَساسِيّات الاختبار', 'اساسيات-الاختبار'],
    ['---', ''],
  ])('creates a URL-friendly slug from %s', (title, slug) => expect(slugFromTitle(title)).toBe(slug));
  it('displays the requested title language instead of always using Arabic', () => {
    const row = {title_ar: 'الدورة', title_en: 'Course'};
    expect(recordTitle(row, true)).toBe('الدورة');
    expect(recordTitle(row, false)).toBe('Course');
  });
  it('keeps the admin API contract in integer halalas and basis points', () => {
    expect(entitySchema('courses', true).safeParse({priceHalalas: 19995}).success).toBe(true);
    expect(entitySchema('courses', true).safeParse({priceHalalas: 199.95}).success).toBe(false);
    expect(entitySchema('exams', true).safeParse({passingBasisPoints: 6995}).success).toBe(true);
    expect(entitySchema('exams', true).safeParse({passingBasisPoints: 10001}).success).toBe(false);
  });
});
