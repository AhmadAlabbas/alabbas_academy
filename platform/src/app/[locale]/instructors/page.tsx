import Image from "next/image";
import { publicCatalog } from "@/lib/public-data";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return pageMetadata(
    locale,
    "/instructors",
    locale === "ar" ? "مدربونا" : "Our instructors",
    locale === "ar"
      ? "تعرّف على مدربي أكاديمية العباس."
      : "Meet the instructors at Alabbas Academy.",
  );
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    { instructors } = await publicCatalog();
  return (
    <div className="container-shell py-12">
      <h1 className="mb-8 text-3xl font-semibold">
        {locale === "ar" ? "مدربونا" : "Our instructors"}
      </h1>
      <div className="grid gap-5 md:grid-cols-3">
        {instructors.map((i) => (
          <article className="card p-7" key={i.id}>
            {i.imageUrl ? (
              <Image
                unoptimized
                src={i.imageUrl}
                alt=""
                width={64}
                height={64}
                className="mb-6 size-16 rounded-2xl object-cover"
              />
            ) : (
              <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-goldsoft text-xl">
                {i.initials}
              </div>
            )}
            <h2 className="mb-4 text-xl font-semibold">{i.name[locale]}</h2>
            <p className="whitespace-pre-wrap leading-8 text-muted">
              {i.bio[locale]}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
