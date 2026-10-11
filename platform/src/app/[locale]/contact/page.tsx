import { ContactForm } from "@/components/platform/contact-form";
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
    "/contact",
    locale === "ar" ? "تواصل معنا" : "Contact us",
    locale === "ar"
      ? "تواصل مع فريق أكاديمية العباس."
      : "Get in touch with the Alabbas Academy team.",
  );
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="container-shell py-12">
      <h1 className="mb-8 text-center text-3xl font-semibold">
        {locale === "ar" ? "تواصل معنا" : "Contact us"}
      </h1>
      <ContactForm />
    </div>
  );
}
