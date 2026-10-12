import {courseLanguages} from '@/lib/catalog';
import "server-only";
import {contentText} from "./course-content";
import { cache } from "react";
import { getDatabase } from "./db";
import type { Course, Category, Instructor } from "@/content/catalog";
export const publicCatalog = cache(async () => {
  if (!process.env.DATABASE_URL)
    return {
      courses: [] as Course[],
      categories: [] as Category[],
      instructors: [] as Instructor[],
    };
  const db = getDatabase();
  const [rows, categories, instructors] = await Promise.all([
    db.course.findMany({
      where: { status: "PUBLISHED" },
      take: 500,
      include: {
        reviews: { where: { status: "APPROVED" }, select: { rating: true } },
        category: true,
        instructors: { orderBy: { position: "asc" } },
        sections: {
          include: {
            lessons: { where: { isPublished: true }, select: { id: true } },
          },
        },
      },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
    }),
    db.instructor.findMany({ where: { isActive: true } }),
  ]);
  return {
    courses: rows.map((c) => ({
      id: c.key,
      slug: { ar: courseLanguages(c.languages).includes('ar') ? c.slug_ar : '', en: courseLanguages(c.languages).includes('en') ? c.slug_en : '' },
      title: { ar: contentText(c, 'title', 'ar'), en: contentText(c, 'title', 'en') },
      description: { ar: contentText(c, 'description', 'ar'), en: contentText(c, 'description', 'en') },
      categorySlug: c.category.key,
      instructorId: c.instructors[0]?.instructorId ?? "",
      level: (["BEGINNER", "INTERMEDIATE", "ALL_LEVELS"].includes(c.level)
        ? c.level
        : "BEGINNER") as Course["level"],
      priceHalalas: c.priceHalalas,
      compareAtHalalas: c.compareAtHalalas,
      minutes: c.minutes,
      lessonCount: c.sections.reduce((n, s) => n + s.lessons.length, 0),
      cover: (["design", "code", "business", "photo"].includes(c.coverStyle)
        ? c.coverStyle
        : "design") as Course["cover"],
      featured: c.featured,
      thumbnailUrl: c.thumbnailUrl,
      isSample: c.isSample,
      languages: c.languages,
      createdAt: c.createdAt.toISOString(),
      rating: c.reviews.length
        ? c.reviews.reduce((n, r) => n + r.rating, 0) / c.reviews.length
        : 0,
    })),
    categories: categories.map((c) => ({
      slug: c.key,
      title: { ar: contentText(c, 'title', 'ar'), en: contentText(c, 'title', 'en') },
      description: { ar: contentText(c, 'description', 'ar'), en: contentText(c, 'description', 'en') },
      tone: c.tone as Category["tone"],
    })),
    instructors: instructors.map((i) => ({
      id: i.id,
      name: { ar: i.name_ar, en: i.name_en },
      bio: { ar: i.bio_ar, en: i.bio_en },
      initials: i.initials,
      imageUrl: i.imageUrl,
    })),
  };
});
export const siteSettings = cache(async () => {
  if (!process.env.DATABASE_URL) return {} as Record<string, unknown>;
  return Object.fromEntries(
    (await getDatabase().setting.findMany()).map((x) => [x.key, x.value]),
  );
});
export const publicContent = cache(async () => {
  if (!process.env.DATABASE_URL)
    return { faqs: [], testimonials: [], blocks: [] };
  const db = getDatabase();
  return {
    faqs: await db.faq.findMany({
      where: { isPublished: true },
      orderBy: { position: "asc" },
    }),
    testimonials: await db.testimonial.findMany({
      where: { isPublished: true },
      orderBy: { position: "asc" },
    }),
    blocks: await db.contentBlock.findMany({
      where: { page: { key: "home", status: "PUBLISHED" } },
      orderBy: { position: "asc" },
    }),
  };
});
export function localText(
  row: Record<string, unknown>,
  field: string,
  locale: string,
) {
  return String(row[`${field}_${locale === "en" ? "en" : "ar"}`] ?? "");
}
