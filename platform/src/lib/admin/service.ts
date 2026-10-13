import {courseLanguages} from '@/lib/catalog';
import "server-only";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth/session";
import { AccountError } from "@/lib/auth/errors";
import { entities } from "./registry";
import { socialLink, socialPlatforms } from "@/lib/social";
import {parentFields} from './forms';
import {courseReadiness, CourseNotReady, type ReadinessCourse} from './readiness';
import {courseEntities, missingContentFields, contentText, contentLocale} from '@/lib/course-content';
import {deleteCourse} from './course-deletion';
export async function requireAdmin() {
  const user = await requireVerifiedUser();
  if (!user.roles.includes("administrator"))
    throw new AccountError("FORBIDDEN", 403);
  return user;
}
type Row = Record<string, unknown>;
type Delegate = {
  findMany: (args: Row) => Promise<Row[]>;
  count: (args: Row) => Promise<number>;
  create: (args: Row) => Promise<Row>;
  update: (args: Row) => Promise<Row>;
  delete: (args: Row) => Promise<Row>;
};
function delegate(entity: string) {
  const config = entities[entity];
  if (!config) throw new AccountError("INVALID_INPUT", 404);
  return {
    config,
    db: (getDatabase() as unknown as Record<string, Delegate>)[config.model],
  };
}
export const serialize = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? String(v) : v)),
  );
export async function listAdmin(entity: string, query: URLSearchParams) {
  const { config, db } = delegate(entity);
  const page = Math.max(1, Math.min(10000, Number(query.get("page")) || 1));
  const q = (query.get("q") || "").slice(0, 120);
  const status = (query.get("status") || "").slice(0, 30);
  const where: Row = {
    ...(parentFields[entity] && query.get(parentFields[entity])
      ? {[parentFields[entity]]: query.get(parentFields[entity])!.slice(0, 191)} : {}),
    ...(query.get('edit') ? {[config.identity || 'id']: query.get('edit')!.slice(0, 191)} : {}),
    ...(q
      ? { OR: config.search.map((field) => ({ [field]: { contains: q } })) }
      : {}),
    ...(status &&
    [
      "courses",
      "orders",
      "users",
      "reviews",
      "contacts",
      "jobs",
      "pages",
    ].includes(entity)
      ? { status }
      : {}),
  };
  const language = query.get('language');
  if (entity === 'courses' && (language === 'ar' || language === 'en')) {
    // Match complete CSV language codes, including whitespace in older records.
    const pattern = `(^|,)[[:space:]]*${language}[[:space:]]*(,|$)`;
    const matches = await getDatabase().$queryRaw<Array<{id: string}>>`SELECT id FROM courses WHERE LOWER(languages) REGEXP ${pattern}`;
    where.AND = [{id: {in: matches.map(course => course.id)}}];
  }
  const select =
    entity === "users"
      ? {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          status: true,
          preferredLocale: true,
          createdAt: true,
          roles: { select: { role: { select: { slug: true } } } },
        }
      : entity === "jobs"
        ? {
            id: true,
            kind: true,
            status: true,
            attempts: true,
            availableAt: true,
            lastError: true,
          }
        : undefined;
  const [rows, total] = await Promise.all([
    db.findMany({
      where,
      take: 25,
      skip: (page - 1) * 25,
      ...(select ? { select } : {}),
      orderBy: config.fields.some(field => field.key === 'position')
        ? [{position: 'asc'}, {[config.identity || 'id']: 'asc'}]
        : {[config.identity || 'id']: 'desc'},
    }),
    db.count({ where }),
  ]);
  return { rows: serialize(rows), total, page };
}
export function entitySchema(entity: string, partial = false) {
  const config = entities[entity];
  if (!config || config.readonly) throw new AccountError("FORBIDDEN", 403);
  const shape: Record<string, z.ZodType> = {};
  for (const field of config.fields) {
    let value: z.ZodType =
      field.type === "boolean"
        ? z.boolean()
        : ["number", "money", "percentage"].includes(field.type || '')
          ? z
              .number()
              .int()
              .min(['points', 'perUserLimit', 'timeLimitMinutes', 'maximumAttempts'].includes(field.key) ? 1 : 0)
              .max(
                field.key === "passingBasisPoints" ||
                  field.key === "percentageBasisPoints"
                  ? 10000
                  : 2000000000,
              )
          : field.type === "date"
            ? z.iso.datetime().transform((v) => new Date(v))
            : field.type === "json"
              ? z.json()
              : field.type === "select"
                ? z.enum(field.options as [string, ...string[]])
                : z
                    .string()
                    .trim()
                    .min(field.required ? 1 : 0)
                    .max(field.type === "textarea" ? 12000 : 191);
    if (field.key === "slug_ar" || field.key === "slug_en")
      value = z
        .string()
        .normalize()
        .min(1)
        .max(128)
        .regex(/^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*$/u).or(z.literal(""));
    if (["videoUrl", "previewUrl"].includes(field.key))
      value = z
        .string()
        .max(1000)
        .refine((v) => !v || Boolean(safeEmbed(v)), "Unsupported video URL");
    if (["thumbnailUrl", "imageUrl"].includes(field.key))
      value = z
        .string()
        .max(500)
        .refine(
          (v) => !v || /^\/api\/media\/[a-zA-Z0-9_-]+$/.test(v),
          "Use an uploaded image",
        );
    if (partial || !field.required) value = value.nullish();
    shape[field.key] = value;
  }
  return z.object(shape).strict();
}
import { safeEmbed } from "@/lib/media/video";
async function relatedLanguages(entity: string, parentId: string): Promise<string> {
  const db = getDatabase();
  if (['sections', 'exams'].includes(entity)) return (await db.course.findUniqueOrThrow({where: {id: parentId}})).languages;
  if (entity === 'lessons') return (await db.section.findUniqueOrThrow({where: {id: parentId}, include: {course: true}})).course.languages;
  if (entity === 'attachments') return (await db.lesson.findUniqueOrThrow({where: {id: parentId}, include: {section: {include: {course: true}}}})).section.course.languages;
  if (entity === 'questions') return (await db.exam.findUniqueOrThrow({where: {id: parentId}, include: {course: true}})).course.languages;
  if (entity === 'options') return (await db.examQuestion.findUniqueOrThrow({where: {id: parentId}, include: {exam: {include: {course: true}}}})).exam.course.languages;
  return 'ar,en';
}
export async function mutateAdmin(
  entity: string,
  id: string | null,
  data: unknown,
  actorId: string,
  remove = false,
  testData?: {confirmedTestData: true; previewToken: string},
) {
  const { config, db } = delegate(entity);
  if (config.readonly) throw new AccountError("FORBIDDEN", 403);
  const identity = config.identity || "id";
  if (remove && !id) throw new AccountError("INVALID_INPUT", 400);
  if (testData && (!remove || entity !== 'courses')) throw new AccountError('INVALID_INPUT', 400);
  if (remove && entity === 'courses') {
    return serialize(await deleteCourse(id!, actorId, testData));
  }
  const parsed = remove ? {} : entitySchema(entity, Boolean(id)).parse(data);
  if (!remove && courseEntities.has(entity)) {
    const existing = id ? (await db.findMany({where: {[identity]: id}, take: 1}))[0] || {} : {};
    const merged = {...existing, ...parsed};
    const languages = entity === 'courses' ? String(merged.languages || 'ar,en') : await relatedLanguages(entity, String(merged[parentFields[entity]] || ''));
    if (entity === 'courses') {
      for (const locale of ['ar', 'en']) {
        if (!merged['slug_' + locale] && !courseLanguages(languages).includes(locale as 'ar' | 'en')) {
          parsed['slug_' + locale] = `unavailable-${crypto.randomUUID()}`;
          merged['slug_' + locale] = parsed['slug_' + locale];
        }
      }
    }
    if (entity === 'attachments' && !id) {
      for (const key of ['labelAr', 'labelEn']) if (parsed[key] === undefined) {parsed[key] = ''; merged[key] = '';}
    }
    const missing = missingContentFields(entity, merged, languages);
    if (entity === 'lessons' && merged.isPublished && merged.kind === 'VIDEO' && !merged.videoFileId && !(merged.videoUrl && safeEmbed(String(merged.videoUrl)))) missing.push('videoUrl');
    if (entity === 'courses' && merged.status === 'PUBLISHED' && (existing.status !== 'PUBLISHED' || courseLanguages(String(existing.languages)).join(',') !== courseLanguages(languages).join(','))) {
      const content = id ? await getDatabase().course.findUniqueOrThrow({where: {id}, include: {sections: {include: {lessons: true}}, exams: {include: {questions: {include: {options: true}}}}}}) : {sections: [], exams: []};
      const checks = courseReadiness({...content, ...merged} as ReadinessCourse);
      if (checks.some(check => check.required && !check.ready)) throw new CourseNotReady(checks);
    }
    if (missing.length) throw new z.ZodError(missing.map(key => ({code: 'custom', path: [key], message: 'Required in the course content language.'})));
  }
  if (entity === "settings" && !remove) {
    const key = String(parsed.key || id);
    const allowed = [
      "name_ar",
      "name_en",
      "logo",
      "contact_email",
      "contact_phone",
      ...socialPlatforms.map(({key}) => key),
      "payments_enabled",
      "seo_ar",
      "seo_en",
      "home_content_ar",
      "home_content_en",
    ];
    if (!allowed.includes(key)) throw new AccountError("INVALID_INPUT", 400);
    const value = parsed.value;
    if (key === "payments_enabled" && typeof value !== "boolean")
      throw new AccountError("INVALID_INPUT", 400);
    if (
      key === "logo" &&
      (typeof value !== "string" ||
        !(
          value === "/logo.svg" || /^\/api\/media\/[a-zA-Z0-9_-]+$/.test(value)
        ))
    )
      throw new AccountError("INVALID_INPUT", 400);
    if (key === "contact_email" && !z.email().safeParse(value).success)
      throw new AccountError("INVALID_INPUT", 400);
    if (
      key.startsWith("home_content_") &&
      !z.record(z.string().max(100), z.string().max(4000)).safeParse(value)
        .success
    )
      throw new AccountError("INVALID_INPUT", 400);
    if (
      socialPlatforms.some((platform) => platform.key === key) &&
      value !== "" &&
      !socialLink(value)
    )
      throw new AccountError("INVALID_INPUT", 400);
  }
  const orderedParents: Record<string, [string, string]> = {
    sections: ['courseId', 'courses'], lessons: ['sectionId', 'sections'],
    exams: ['courseId', 'courses'], questions: ['examId', 'exams'],
    options: ['questionId', 'exam_questions'], attachments: ['lessonId', 'lessons'],
    blocks: ['pageId', 'pages'],
  };
  const ordered = orderedParents[entity];
  const write = async () => {
    const automaticOrder = !id && ordered && (parsed.position === undefined || parsed.position === null);
    const correctOption = entity === 'options' && parsed.isCorrect === true;
    if (!automaticOrder && !correctOption) return id ? db.update({where: {[identity]: id}, data: parsed}) : db.create({data: parsed});
    const [parent, table] = ordered;
    return getDatabase().$transaction(async tx => {
      const parentId = parsed[parent] ?? (id && correctOption ? (await tx.questionOption.findUniqueOrThrow({where: {id}})).questionId : undefined);
      await tx.$queryRawUnsafe(`SELECT id FROM \`${table}\` WHERE id = ? FOR UPDATE`, parentId);
      const model = (tx as unknown as Record<string, Delegate>)[config.model];
      if (correctOption) await tx.questionOption.updateMany({where: {questionId: String(parentId), ...(id ? {id: {not: id}} : {})}, data: {isCorrect: false}});
      if (automaticOrder) {
        const [last] = await model.findMany({where: {[parent]: parentId}, orderBy: {position: 'desc'}, take: 1, select: {position: true}});
        parsed.position = last ? Number(last.position) + 1 : 0;
      }
      return id ? model.update({where: {[identity]: id}, data: parsed}) : model.create({data: parsed});
    });
  };
  const row = remove
    ? await db.delete({ where: { [identity]: id } })
    : await write();
  await getDatabase().auditLog.create({
    data: {
      actorId,
      action: remove ? "DELETE" : id ? "UPDATE" : "CREATE",
      entityType: entity,
      entityId: String(row[identity]),
      changes: { fields: Object.keys(parsed) },
    },
  });
  return serialize(row);
}

export async function adminLookups() {
  const db = getDatabase();
  const [courses, categories, sections, lessons, exams, questions, files, instructors, tags, pages] = await Promise.all([
    db.course.findMany({take: 1000, orderBy: {title_en: 'asc'}, select: {id: true, title_ar: true, title_en: true, languages: true}}),
    db.category.findMany({take: 1000, orderBy: {position: 'asc'}, select: {id: true, title_ar: true, title_en: true}}),
    db.section.findMany({take: 1000, orderBy: [{courseId: 'asc'}, {position: 'asc'}], select: {id: true, title_ar: true, title_en: true, courseId: true, course: {select: {title_ar: true, title_en: true, languages: true}}}}),
    db.lesson.findMany({take: 1000, orderBy: [{sectionId: 'asc'}, {position: 'asc'}], select: {id: true, title_ar: true, title_en: true, section: {select: {title_ar: true, title_en: true, courseId: true, course: {select: {title_ar: true, title_en: true, languages: true}}}}}}),
    db.exam.findMany({take: 1000, orderBy: [{courseId: 'asc'}, {position: 'asc'}], select: {id: true, title_ar: true, title_en: true, courseId: true, course: {select: {title_ar: true, title_en: true, languages: true}}}}),
    db.examQuestion.findMany({take: 1000, orderBy: [{examId: 'asc'}, {position: 'asc'}], select: {id: true, prompt_ar: true, prompt_en: true, exam: {select: {title_ar: true, title_en: true, courseId: true, course: {select: {languages: true}}}}}}),
    db.mediaAsset.findMany({where: {status: 'READY'}, take: 1000, orderBy: {createdAt: 'desc'}, select: {id: true, originalName: true, kind: true}}),
    db.instructor.findMany({take: 1000, orderBy: {name_en: 'asc'}, select: {id: true, name_ar: true, name_en: true}}),
    db.tag.findMany({take: 1000, orderBy: {title_en: 'asc'}, select: {id: true, title_ar: true, title_en: true}}),
    db.page.findMany({take: 1000, orderBy: {key: 'asc'}, select: {id: true, title_ar: true, title_en: true}}),
  ]);
  const asset = (file: typeof files[number], asUrl = false) => ({id: asUrl ? `/api/media/${file.id}` : file.id, title_ar: file.originalName, title_en: file.originalName});
  const images = files.filter(file => file.kind === 'IMAGE').map(file => asset(file, true));
  return {
    courseId: courses.map(course => ({...course, title_ar: contentText(course, 'title', 'ar'), title_en: contentText(course, 'title', 'en')})),
    categoryId: categories,
    sectionId: sections.map(section => ({id: section.id, courseId: section.courseId, languages: section.course.languages, title_ar: `${contentText(section.course, 'title', 'ar')} — ${contentText(section, 'title', contentLocale(section.course.languages, 'ar'))}`, title_en: `${contentText(section.course, 'title', 'en')} — ${contentText(section, 'title', contentLocale(section.course.languages, 'en'))}`})),
    lessonId: lessons.map(lesson => ({id: lesson.id, courseId: lesson.section.courseId, languages: lesson.section.course.languages, title_ar: `${contentText(lesson.section.course, 'title', 'ar')} — ${contentText(lesson.section, 'title', 'ar')} — ${contentText(lesson, 'title', contentLocale(lesson.section.course.languages, 'ar'))}`, title_en: `${contentText(lesson.section.course, 'title', 'en')} — ${contentText(lesson.section, 'title', 'en')} — ${contentText(lesson, 'title', contentLocale(lesson.section.course.languages, 'en'))}`})),
    examId: exams.map(exam => ({id: exam.id, courseId: exam.courseId, languages: exam.course.languages, title_ar: `${contentText(exam.course, 'title', 'ar')} — ${contentText(exam, 'title', contentLocale(exam.course.languages, 'ar'))}`, title_en: `${contentText(exam.course, 'title', 'en')} — ${contentText(exam, 'title', contentLocale(exam.course.languages, 'en'))}`})),
    questionId: questions.map(question => ({id: question.id, courseId: question.exam.courseId, languages: question.exam.course.languages, title_ar: `${contentText(question.exam, 'title', 'ar')} — ${contentText(question, 'prompt', contentLocale(question.exam.course.languages, 'ar'))}`, title_en: `${contentText(question.exam, 'title', 'en')} — ${contentText(question, 'prompt', contentLocale(question.exam.course.languages, 'en'))}`})),
    mediaAssetId: files.filter(file => file.kind === 'DOCUMENT').map(file => asset(file)),
    videoFileId: files.filter(file => file.kind === 'VIDEO').map(file => asset(file)),
    thumbnailUrl: images, imageUrl: images,
    instructorId: instructors.map(instructor => ({id: instructor.id, title_ar: instructor.name_ar, title_en: instructor.name_en})),
    tagId: tags,
    pageId: pages,
  };
}
