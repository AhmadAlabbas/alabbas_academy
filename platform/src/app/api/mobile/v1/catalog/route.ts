import {publicCatalog} from '@/lib/public-data';

export const dynamic = 'force-dynamic';

/** Public discovery feed. Never includes user data, lesson bodies or private media. */
export async function GET() {
  try {
    const {courses, categories, instructors} = await publicCatalog();
    return Response.json({
      version: 1,
      courses: courses.map(course => ({
        id: course.id,
        title: course.title,
        description: course.description,
        slug: course.slug,
        categorySlug: course.categorySlug,
        instructorId: course.instructorId,
        level: course.level,
        minutes: course.minutes,
        lessonCount: course.lessonCount,
        featured: course.featured,
        thumbnailUrl: course.thumbnailUrl?.startsWith('https://') ? course.thumbnailUrl : null,
        // Intentionally no sales actions or private course content in mobile v1.
      })),
      categories: categories.map(category => ({
        id: category.slug,
        title: category.title,
      })),
      instructors: instructors.map(instructor => ({
        id: instructor.id,
        name: instructor.name,
      })),
    }, {headers: {'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'}});
  } catch {
    return Response.json({error: 'Catalog temporarily unavailable'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
}
