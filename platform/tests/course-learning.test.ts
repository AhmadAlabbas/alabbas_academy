import {describe, it, expect} from 'vitest';
import {contentLocale, contentText, missingContentFields} from '@/lib/course-content';
import {learningProgress} from '@/lib/learning/progress';
import {courseReadiness, type ReadinessCourse} from '@/lib/admin/readiness';
import {initialDraft, serializeDraft} from '@/lib/admin/forms';

describe('Course content language', () => {
  it('requires only the selected language and preserves dormant translations on edits', () => {
    expect(missingContentFields('courses', {title_ar: 'عنوان', description_ar: 'وصف', slug_ar: 'عربي'}, 'ar')).toEqual([]);
    expect(missingContentFields('lessons', {title_en: 'Article', kind: 'ARTICLE', body_en: ''}, 'en')).toEqual(['body_en']);
    const draft = initialDraft('courses', {id: 'existing', priceHalalas: 0, languages: 'ar', title_ar: 'عربي', title_en: 'Old translation'});
    expect(serializeDraft('courses', draft)).not.toHaveProperty('title_en');
  });
  it('displays actual course content instead of an inactive translated version', () => {
    expect(contentLocale('en', 'ar')).toBe('en');
    expect(contentText({languages: 'ar', title_ar: 'عربي', title_en: 'Inactive'}, 'title', 'en')).toBe('عربي');
    expect(contentLocale(' ar , en ', 'en')).toBe('en');
  });
});
describe('Resume learning', () => {
  it('ignores hidden lessons and resumes the last unfinished published lesson', () => {
    const progress = [{lessonId: 'hidden', completedAt: null, updatedAt: '2026-10-12'}, {lessonId: 'second', completedAt: null, updatedAt: '2026-10-11'}, {lessonId: 'first', completedAt: '2026-10-10'}];
    expect(learningProgress([{id: 'first'}, {id: 'second'}], progress)).toMatchObject({completed: 1, percentage: 50, next: {id: 'second'}});
  });
  it('handles empty and fully completed curricula without duplicate progress counts', () => {
    expect(learningProgress([], [])).toMatchObject({percentage: 0, next: undefined});
    expect(learningProgress([{id: 'one'}], [{lessonId: 'one', completedAt: '2026-10-12'}, {lessonId: 'one', completedAt: '2026-10-12'}])).toMatchObject({completed: 1, percentage: 100, next: {id: 'one'}});
  });
});
describe('Publishing readiness', () => {
  const course: ReadinessCourse = {languages: 'en', title_ar: '', title_en: 'Course', description_ar: '', description_en: 'Description', sections: [{title_ar: '', title_en: 'Section', lessons: [{title_ar: '', title_en: 'Article', kind: 'ARTICLE', body_ar: '', body_en: 'Lesson content', isPublished: true}]}], exams: []};
  it('allows a single-language article and recommends a thumbnail without blocking publication', () => {
    expect(courseReadiness(course).filter(check => check.required && !check.ready)).toEqual([]);
    expect(courseReadiness(course).find(check => check.key === 'thumbnail')).toMatchObject({ready: false, required: false});
  });
  it('reports missing videos and an unpublished required exam', () => {
    const incomplete = {...course, sections: [{...course.sections[0], lessons: [{...course.sections[0].lessons[0], kind: 'VIDEO', videoUrl: 'https://example.test/not-a-video'}]}], exams: [{title_ar: '', title_en: 'Exam', isPublished: false, isRequired: true, questions: []}]};
    expect(courseReadiness(incomplete).filter(check => check.required && !check.ready).map(check => check.key)).toEqual(['content', 'exams']);
  });
});
