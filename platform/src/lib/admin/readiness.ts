import {courseLanguages} from '@/lib/catalog';
import {safeEmbed} from '@/lib/media/video';
export type ReadinessCourse = {
  languages: string; title_ar: string; title_en: string; description_ar: string; description_en: string; thumbnailUrl?: string | null;
  sections: Array<{title_ar: string; title_en: string; lessons: Array<{title_ar: string; title_en: string; kind: string; body_ar: string; body_en: string; isPublished: boolean; videoUrl?: string | null; videoFileId?: string | null}>}>;
  exams: Array<{title_ar: string; title_en: string; isPublished: boolean; isRequired: boolean; questions: Array<{prompt_ar: string; prompt_en: string; options: Array<{label_ar?: string; label_en?: string; isCorrect: boolean}>}>}>;
};
export type ReadinessItem = {key: string; ar: string; en: string; ready: boolean; required: boolean};
export function courseReadiness(course: ReadinessCourse): ReadinessItem[] {
  const languages = courseLanguages(course.languages);
  const has = (row: object, field: string) => languages.every(language => Boolean(String((row as Record<string, unknown>)[field + '_' + language] || '').trim()));
  const lessons = course.sections.flatMap(section => section.lessons).filter(lesson => lesson.isPublished);
  const exams = course.exams.filter(exam => exam.isPublished || exam.isRequired);
  return [
    {key: 'details', ar: 'العناوين والأوصاف بلغة الدورة', en: 'Titles and descriptions in the course language', ready: languages.length > 0 && has(course, 'title') && has(course, 'description'), required: true},
    {key: 'thumbnail', ar: 'صورة الدورة', en: 'Course thumbnail', ready: Boolean(course.thumbnailUrl), required: false},
    {key: 'lessons', ar: 'درس منشور واحد على الأقل', en: 'At least one published lesson', ready: lessons.length > 0, required: true},
    {key: 'content', ar: 'عناوين الأقسام ومحتوى الدروس المنشورة', en: 'Section titles and published lesson content', ready: lessons.length > 0 && course.sections.filter(section => section.lessons.some(lesson => lesson.isPublished)).every(section => has(section, 'title')) && lessons.every(lesson => has(lesson, 'title') && (lesson.kind === 'ARTICLE' ? has(lesson, 'body') : Boolean(lesson.videoFileId || (lesson.videoUrl && safeEmbed(lesson.videoUrl))))), required: true},
    {key: 'exams', ar: 'الاختبارات المطلوبة والمنشورة مكتملة', en: 'Required and published exams are complete', ready: exams.every(exam => exam.isPublished && has(exam, 'title') && exam.questions.length > 0 && exam.questions.every(question => has(question, 'prompt') && question.options.length >= 2 && question.options.filter(option => option.isCorrect).length === 1 && question.options.every(option => has(option, 'label')))), required: true},
  ];
}

export class CourseNotReady extends Error {
  constructor(public checks: ReadinessItem[]) {super('Course content is not ready to publish.');}
}
