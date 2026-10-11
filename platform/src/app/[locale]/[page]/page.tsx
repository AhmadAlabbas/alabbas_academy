import { notFound } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";
async function pageFor(key: string) {
  if (
    !["about", "privacy", "terms", "refund-policy"].includes(key) ||
    !process.env.DATABASE_URL
  )
    return null;
  return getDatabase().page.findFirst({ where: { key, status: "PUBLISHED" } });
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; page: string }>;
}) {
  const { locale, page } = await params,
    row = await pageFor(page);
  return row
    ? pageMetadata(
        locale,
        `/${page}`,
        locale === "ar" ? row.title_ar : row.title_en,
        (locale === "ar" ? row.body_ar : row.body_en).slice(0, 160),
      )
    : { robots: { index: false } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; page: string }>;
}) {
  const { locale, page } = await params,
    row = await pageFor(page);
  if (!row) notFound();
  return (
    <div className="container-shell max-w-3xl py-12">
      <article className="card p-7 sm:p-10">
        <h1 className="mb-6 text-3xl font-semibold">
          {locale === "ar" ? row.title_ar : row.title_en}
        </h1>
        <div className="whitespace-pre-wrap leading-9 text-muted">
          {locale === "ar" ? row.body_ar : row.body_en}
        </div>
      </article>
    </div>
  );
}
