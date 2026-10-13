import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowUpRight,
  BookOpen,
  Camera,
  Code2,
  Compass,
  Globe2,
  Layers3,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { CourseCard } from "@/components/ui/course-card";
import { CourseCover } from "@/components/ui/course-cover";
import {
  publicCatalog,
  publicContent,
  localText,
  siteSettings,
} from "@/lib/public-data";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {Price} from "@/components/ui/price";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Home" });
  return pageMetadata(
    locale,
    "/",
    `${t("title")} ${t("titleAccent")}`,
    t("description"),
  );
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [baseT, common] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Common"),
  ]);
  const settings = await siteSettings();
  const overrides = settings[`home_content_${locale}`] as
    | Record<string, string>
    | undefined;
  const t = (key: Parameters<typeof baseT>[0]) =>
    typeof overrides?.[key] === "string" ? overrides[key] : baseT(key);
  const {
    categories,
    instructors,
    courses: sampleCourses,
  } = await publicCatalog();
  const content = await publicContent();
  if (!sampleCourses.length)
    return (
      <div className="container-shell py-20">
        <h1 className="section-title">{t("title")}</h1>
        <p className="section-copy">{t("description")}</p>
        <Link href="/courses" className="button-primary mt-8">
          {t("primaryCta")}
        </Link>
      </div>
    );
  const hero = content.blocks.find((x) => x.key === "hero");
  const featured = sampleCourses.filter((course) => course.featured);
  const heroCourse = sampleCourses[0];
  const categoryIcons = [Layers3, Code2, TrendingUp, Camera];
  const toneClasses = [
    "bg-goldsoft",
    "bg-skysoft",
    "bg-[#e1f1ed] text-navy",
    "bg-[#ebe8f6] text-navy",
  ];
  const benefits = [
    {
      icon: BookOpen,
      title: "practicalTitle",
      description: "practicalDescription",
    },
    {
      icon: Compass,
      title: "flexibleTitle",
      description: "flexibleDescription",
    },
    {
      icon: Globe2,
      title: "bilingualTitle",
      description: "bilingualDescription",
    },
  ];

  return (
    <div className="container-shell pb-20">
      <section
        className="grid items-center gap-10 py-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-20"
        aria-labelledby="hero-title"
      >
        <div className="subtle-rise">
          <p className="eyebrow mb-5 flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#24778f]" />
            {t("eyebrow")}
          </p>
          <h1 id="hero-title" className="hero-title max-w-2xl">
            {hero ? localText(hero, "title", locale) : t("title")}
            <span className="hero-highlight mt-1 block">
              {t("titleAccent")}
            </span>
          </h1>
          <p className="section-copy mb-8 mt-6 max-w-lg">
            {hero ? localText(hero, "body", locale) : t("description")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className="button-primary" href="/courses">
              {t("primaryCta")}
              <ArrowUpRight className="logical-arrow size-4" />
            </Link>
            <Link className="button-secondary" href="/about">
              {t("secondaryCta")}
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-xs text-muted">
            <span className="flex items-center gap-2">
              <Globe2 className="size-4" />
              {t("languages")}
            </span>
            <span className="flex items-center gap-2">
              <Compass className="size-4" />
              {t("flexibility")}
            </span>
          </div>
        </div>
        <div className="relative isolate pb-24 pt-3">
          <div
            aria-hidden="true"
            className="absolute inset-x-8 inset-y-10 -z-10 rotate-6 rounded-[2.5rem] bg-blue/40"
          />
          <Link
            href={`/courses/${heroCourse.slug[locale]}`}
            className="card block overflow-hidden p-3 transition-transform hover:-translate-y-1"
          >
            <div className="relative">
              {heroCourse.thumbnailUrl ? (
                <Image
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  src={heroCourse.thumbnailUrl}
                  alt=""
                  width={600}
                  height={350}
                  className="h-64 w-full rounded-[1.1rem] object-cover sm:h-72"
                />
              ) : (
                <CourseCover
                  cover={heroCourse.cover}
                  className="h-64 rounded-[1.1rem] sm:h-72"
                />
              )}
              {heroCourse.isSample && (
                <span className="absolute start-4 top-4 rounded-full bg-surface px-3 py-1.5 text-[11px] text-muted">
                  {common("sampleCourse")}
                </span>
              )}
              <span
                aria-hidden="true"
                className="absolute bottom-4 end-4 flex size-12 items-center justify-center rounded-full bg-navy text-white"
              >
                <ArrowUpRight className="logical-arrow size-5" />
              </span>
            </div>
            <div className="px-4 pb-5 pt-6">
              <p className="eyebrow mb-2">{t("heroCardLabel")}</p>
              <h2 className="text-2xl font-semibold leading-relaxed">
                {heroCourse.title[locale]}
              </h2>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                <span className="text-xs text-muted">
                  {common("lessonCount", { count: heroCourse.lessonCount })}
                </span>
                <span className="text-lg font-semibold">
                  <Price amount={heroCourse.priceHalalas} locale={locale} />
                </span>
              </div>
            </div>
          </Link>
          <div className="card absolute -bottom-1 end-3 flex items-center gap-3 px-5 py-4 shadow-lg sm:end-7">
            <Image
              unoptimized
              src={String(settings.logo || "/logo.svg")}
              alt=""
              width={35}
              height={35}
              className="academy-logo"
            />
            <div>
              <p className="text-xs font-semibold">
                {String(settings[`name_${locale}`] || common("academy"))}
              </p>
              <p className="mt-1 text-[10px] text-muted">
                {t("heroCardCaption")}
              </p>
            </div>
            <Sparkles
              aria-hidden="true"
              className="ms-2 size-5 text-warning"
            />
          </div>
        </div>
      </section>

      <section
        className="grid gap-4 pb-16 md:grid-cols-3"
        aria-label={t("learningTitle")}
      >
        {benefits.map(({ icon: Icon, title, description }, index) => (
          <div className="card flex gap-4 p-6" key={title}>
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[index % toneClasses.length]}`}
            >
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="mb-2 text-base font-semibold">
                {t(`benefits.${title}`)}
              </h2>
              <p className="text-xs leading-6 text-muted">
                {t(`benefits.${description}`)}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="pb-16" aria-labelledby="featured-title">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow mb-2">{t("featuredEyebrow")}</p>
            <h2 id="featured-title" className="section-title">
              {t("featuredTitle")}
            </h2>
            <p className="section-copy mt-2 max-w-2xl">
              {t("featuredDescription")}
            </p>
          </div>
          <Link href="/courses" className="button-secondary">
            {t("viewAll")}
            <ArrowUpRight className="logical-arrow size-4" />
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              locale={locale}
              category={categories.find(
                (category) => category.slug === course.categorySlug,
              )}
              instructor={instructors.find(
                (instructor) => instructor.id === course.instructorId,
              )}
              labels={{
                view: common("viewCourse"),
                sample: common("sampleCourse"),
                lessons: common("lessonCount", { count: course.lessonCount }),
                duration: common("durationMinutes", { count: course.minutes }),
                level: common(
                  course.level === "BEGINNER"
                    ? "beginner"
                    : course.level === "INTERMEDIATE"
                      ? "intermediate"
                      : "allLevels",
                ),
              }}
            />
          ))}
        </div>
      </section>

      <section className="pb-16" aria-labelledby="categories-title">
        <div className="mb-7">
          <p className="eyebrow mb-2">{t("categoriesEyebrow")}</p>
          <h2 id="categories-title" className="section-title">
            {t("categoriesTitle")}
          </h2>
          <p className="section-copy mt-2">{t("categoriesDescription")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, index) => {
            const Icon = categoryIcons[index % categoryIcons.length];
            return (
              <Link
                key={category.slug}
                href={`/courses?category=${category.slug}`}
                className="card group p-6 transition-transform hover:-translate-y-1"
              >
                <div className="mb-6 flex items-center justify-between">
                  <span
                    className={`flex size-12 items-center justify-center rounded-xl ${toneClasses[index % toneClasses.length]}`}
                  >
                    <Icon aria-hidden="true" className="size-6 stroke-[1.5]" />
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="logical-arrow size-5 text-muted"
                  />
                </div>
                <h3 className="mb-3 text-lg font-semibold">
                  {category.title[locale]}
                </h3>
                <p className="text-xs leading-6 text-muted">
                  {category.description[locale]}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        className="card mb-16 bg-skysoft/40 p-7 sm:p-10"
        aria-labelledby="steps-title"
      >
        <p className="eyebrow mb-2">{t("howEyebrow")}</p>
        <h2 id="steps-title" className="section-title mb-8">
          {t("howTitle")}
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {["one", "two", "three"].map((step, index) => (
            <div key={step}>
              <span className="mb-5 flex size-10 items-center justify-center rounded-full border border-navy/15 text-sm font-medium">
                {new Intl.NumberFormat(locale).format(index + 1)}
              </span>
              <h3 className="mb-3 text-lg font-semibold">
                {t(`steps.${step}Title`)}
              </h3>
              <p className="text-sm leading-7 text-muted">
                {t(`steps.${step}Description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-16" aria-labelledby="instructors-title">
        <div className="mb-7">
          <p className="eyebrow mb-2">{t("instructorsEyebrow")}</p>
          <h2 id="instructors-title" className="section-title">
            {t("instructorsTitle")}
          </h2>
          <p className="section-copy mt-2">{t("instructorsDescription")}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {instructors.map((instructor, index) => (
            <article className="card p-6" key={instructor.id}>
              {instructor.imageUrl ? (
                <Image
                  sizes="64px"
                  src={instructor.imageUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="mb-5 size-16 rounded-2xl object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className={`mb-5 flex size-16 items-center justify-center rounded-2xl text-xl font-semibold ${toneClasses[index % toneClasses.length]}`}
                >
                  {instructor.name[locale].slice(0, 1)}
                </div>
              )}
              <p className="mb-2 text-[11px] text-muted">
                {t("sampleInstructor")}
              </p>
              <h3 className="mb-3 text-base font-semibold">
                {instructor.name[locale]}
              </h3>
              <p className="text-xs leading-6 text-muted">
                {instructor.bio[locale]}
              </p>
            </article>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: content.faqs.map((f) => ({
              "@type": "Question",
              name: localText(f, "question", locale),
              acceptedAnswer: {
                "@type": "Answer",
                text: localText(f, "answer", locale),
              },
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />
      {content.blocks
        .filter((b) => b.kind === "BANNER")
        .map((b) => (
          <section className="card mb-8 bg-goldsoft p-7" key={b.id}>
            <h2 className="section-title">{localText(b, "title", locale)}</h2>
            <p className="mt-4 whitespace-pre-wrap leading-8">
              {localText(b, "body", locale)}
            </p>
          </section>
        ))}
      <section className="grid gap-5 pb-16 md:grid-cols-3">
        {content.testimonials.map((item) => (
          <article className="card p-6" key={item.id}>
            <p className="text-sm leading-8">
              {localText(item, "quote", locale)}
            </p>
            <p className="mt-4 font-semibold">{item.name}</p>
          </article>
        ))}
      </section>
      <section
        className="grid gap-7 pb-16 lg:grid-cols-[.8fr_1.2fr]"
        aria-labelledby="faq-title"
      >
        <div>
          <p className="eyebrow mb-2">{t("faqEyebrow")}</p>
          <h2 id="faq-title" className="section-title">
            {t("faqTitle")}
          </h2>
        </div>
        <div className="space-y-3">
          {content.faqs.map((item) => (
            <details className="card faq-card p-6" key={item.id}>
              <summary className="text-sm font-semibold">
                {localText(item, "question", locale)}
                <Plus aria-hidden="true" className="size-4" />
              </summary>
              <p className="mt-4 text-sm leading-7 text-muted">
                {localText(item, "answer", locale)}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section
        className="card relative overflow-hidden bg-navy p-8 text-white sm:p-12"
        aria-labelledby="cta-title"
      >
        <div
          aria-hidden="true"
          className="absolute -end-16 -top-16 size-64 rounded-full border-[35px] border-white/5"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-7">
          <div>
            <h2 id="cta-title" className="section-title mb-3">
              {t("ctaTitle")}
            </h2>
            <p className="max-w-xl text-sm leading-7 text-white/75">
              {t("ctaDescription")}
            </p>
          </div>
          <Link
            href="/courses"
            className="button-secondary border-gold bg-gold text-navy hover:bg-gold/90"
          >
            {t("primaryCta")}
            <ArrowUpRight className="logical-arrow size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
