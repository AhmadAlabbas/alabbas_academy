import { notFound } from "next/navigation";
import Image from "next/image";
import { getDatabase } from "@/lib/db";
import { pageMetadata, siteOrigin } from "@/lib/seo";
import { formatSAR } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { AddToCartButton, BuyNowButton } from "@/components/cart/cart-controls";
import { Video } from "@/components/platform/player";
import { CourseCover } from "@/components/ui/course-cover";
import type { Locale } from "@/i18n/routing";
async function courseFor(locale: string, slug: string) {
  if (!process.env.DATABASE_URL) return null;
  try {
    slug = decodeURIComponent(slug).normalize("NFC");
  } catch {
    return null;
  }
  return getDatabase().course.findFirst({
    where: {
      [locale === "en" ? "slug_en" : "slug_ar"]: slug,
      status: "PUBLISHED",
    },
    include: {
      category: true,
      instructors: { include: { instructor: true } },
      sections: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { position: "asc" },
            select: { id: true, title_ar: true, title_en: true, minutes: true },
          },
        },
      },
      reviews: {
        where: { status: "APPROVED" },
        include: { user: { select: { name: true } } },
        take: 20,
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params,
    c = await courseFor(locale, slug);
  if (!c) return { title: "Course unavailable", robots: { index: false } };
  return pageMetadata(
    locale,
    `/courses/${locale === "ar" ? c.slug_ar : c.slug_en}`,
    locale === "ar" ? c.title_ar : c.title_en,
    (locale === "ar" ? c.seo_ar : c.seo_en) ||
      (locale === "ar" ? c.description_ar : c.description_en).slice(0, 160),
    `/courses/${locale === "ar" ? c.slug_en : c.slug_ar}`,
  );
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params,
    ar = locale === "ar",
    course = await courseFor(locale, slug);
  if (!course) notFound();
  const title = ar ? course.title_ar : course.title_en,
    description = ar ? course.description_ar : course.description_en,
    courseUrl = `${siteOrigin}/${locale}/courses/${encodeURIComponent(ar ? course.slug_ar : course.slug_en)}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: title,
    description,
    inLanguage: locale,
    provider: {
      "@type": "Organization",
      name: "Alabbas Academy",
      url: siteOrigin,
    },
    offers: {
      "@type": "Offer",
      price: course.priceHalalas / 100,
      priceCurrency: "SAR",
      availability: "https://schema.org/InStock",
      url: courseUrl,
    },
    ...(course.reviews.length
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue:
              course.reviews.reduce((n, r) => n + r.rating, 0) /
              course.reviews.length,
            reviewCount: course.reviews.length,
          },
        }
      : {}),
  };
  return (
    <div className="container-shell py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            schema,
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: ar ? "الرئيسية" : "Home",
                  item: `${siteOrigin}/${locale}`,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: ar ? "الدورات" : "Courses",
                  item: `${siteOrigin}/${locale}/courses`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: title,
                  item: courseUrl,
                },
              ],
            },
          ]).replace(/</g, "\\u003c"),
        }}
      />
      <nav className="mb-6 text-sm text-muted">
        <Link href="/">{ar ? "الرئيسية" : "Home"}</Link> /{" "}
        <Link href="/courses">{ar ? "الدورات" : "Courses"}</Link> / {title}
      </nav>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="card p-7">
            <p className="mb-4 text-sm text-accent">
              {ar ? course.category.title_ar : course.category.title_en}
            </p>
            <h1 className="text-3xl font-semibold leading-relaxed sm:text-4xl">
              {title}
            </h1>
            <p className="mt-5 whitespace-pre-wrap leading-8 text-muted">
              {description}
            </p>
            {course.isSample && (
              <p className="mt-5 rounded-xl bg-goldsoft p-3 text-sm">
                {ar
                  ? "دورة نموذجية بمحتوى تجريبي."
                  : "Sample course with demonstration content."}
              </p>
            )}
          </div>
          <Video url={course.previewUrl} title={title} />
          <section className="card p-6">
            <h2 className="mb-4 text-xl font-semibold">
              {ar ? "ما ستتعلمه" : "What you will learn"}
            </h2>
            <p className="whitespace-pre-wrap leading-8">
              {ar ? course.outcomes_ar : course.outcomes_en}
            </p>
            <h3 className="mb-3 mt-6 font-semibold">
              {ar ? "المتطلبات" : "Requirements"}
            </h3>
            <p className="whitespace-pre-wrap leading-8">
              {ar ? course.requirements_ar : course.requirements_en}
            </p>
          </section>
          <section className="card p-6">
            <h2 className="mb-4 text-xl font-semibold">
              {ar ? "محتوى الدورة" : "Curriculum"}
            </h2>
            {course.sections.map((s) => (
              <details
                className="mb-3 rounded-xl border border-line p-4"
                key={s.id}
              >
                <summary className="font-semibold">
                  {ar ? s.title_ar : s.title_en}
                </summary>
                <ul className="mt-4 space-y-4">
                  {s.lessons.map((l) => (
                    <li
                      className="flex justify-between gap-4 text-sm"
                      key={l.id}
                    >
                      <span>{ar ? l.title_ar : l.title_en}</span>
                      <span>
                        {l.minutes} {ar ? "دقيقة" : "min"}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
          {course.instructors.map(({ instructor: i }) => (
            <section className="card p-6" key={i.id}>
              <h2 className="mb-3 text-xl font-semibold">
                {ar ? i.name_ar : i.name_en}
              </h2>
              <p className="whitespace-pre-wrap leading-8 text-muted">
                {ar ? i.bio_ar : i.bio_en}
              </p>
            </section>
          ))}
          <section className="card p-6">
            <h2 className="mb-4 text-xl font-semibold">
              {ar ? "تقييمات المتعلمين" : "Learner reviews"}
            </h2>
            {course.reviews.map((r) => (
              <article className="mb-4 border-t border-line pt-4" key={r.id}>
                <b>
                  {r.user.name} — {r.rating}/5
                </b>
                <p className="mt-2 whitespace-pre-wrap leading-7">{r.body}</p>
              </article>
            ))}
            {!course.reviews.length && (
              <p className="text-muted">
                {ar
                  ? "لا توجد تقييمات منشورة بعد."
                  : "No published reviews yet."}
              </p>
            )}
          </section>
        </div>
        <aside className="card space-y-5 p-6 lg:sticky lg:top-28">
          {course.thumbnailUrl ? (
            <Image
              sizes="(min-width: 1024px) 340px, 100vw"
              src={course.thumbnailUrl}
              alt=""
              width={600}
              height={350}
              className="aspect-[1.7] w-full rounded-xl object-cover"
            />
          ) : (
            <CourseCover cover={course.coverStyle as "design"} />
          )}
          <h2 className="text-3xl font-semibold">
            {formatSAR(course.priceHalalas, locale)}
          </h2>
          {course.compareAtHalalas &&
            course.compareAtHalalas > course.priceHalalas && (
              <del className="text-muted">
                {formatSAR(course.compareAtHalalas, locale)}
              </del>
            )}
          <AddToCartButton courseId={course.key} className="w-full" />
          <BuyNowButton courseId={course.key} />
          <p className="text-sm leading-7 text-muted">
            {ar
              ? "دروس فيديو وملفات واختبارات وشهادة بعد الإتمام."
              : "Video lessons, files, exams and a certificate upon completion."}
          </p>
        </aside>
      </div>
    </div>
  );
}
