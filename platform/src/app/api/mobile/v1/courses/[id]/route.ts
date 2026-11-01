import {getDatabase} from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Public syllabus metadata only. Paid course text, media, exams and answers stay private. */
export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  if (id.length > 120 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return Response.json({error: 'Invalid course'}, {status: 400});
  }
  if (!process.env.DATABASE_URL) return Response.json({error: 'Unavailable'}, {status: 503});
  try {
    const course = await getDatabase().course.findFirst({
      where: {key: id, status: 'PUBLISHED'},
      select: {
        key: true,
        title_ar: true,
        title_en: true,
        description_ar: true,
        description_en: true,
        sections: {
          orderBy: {position: 'asc'},
          select: {
            id: true, title_ar: true, title_en: true,
            lessons: {
              where: {isPublished: true},
              orderBy: {position: 'asc'},
              select: {id: true, title_ar: true, title_en: true, minutes: true},
            },
          },
        },
      },
    });
    if (!course) return Response.json({error: 'Not found'}, {status: 404});
    return Response.json({
      id: course.key,
      title: {ar: course.title_ar, en: course.title_en},
      description: {ar: course.description_ar, en: course.description_en},
      sections: course.sections.map(section => ({
        id: section.id,
        title: {ar: section.title_ar, en: section.title_en},
        lessons: section.lessons.map(lesson => ({
          id: lesson.id,
          title: {ar: lesson.title_ar, en: lesson.title_en},
          minutes: lesson.minutes,
        })),
      })),
    }, {headers: {'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'}});
  } catch {
    return Response.json({error: 'Syllabus unavailable'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
}
