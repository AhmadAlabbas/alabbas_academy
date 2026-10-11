import { requireAdmin } from "@/lib/admin/service";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
export const metadata = { robots: { index: false, follow: false } };
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  try {
    await requireAdmin();
  } catch {
    redirect(`/${locale}/login?callbackUrl=/${locale}/admin`);
  }
  return (
    <div className="container-shell py-10">
      <Link href="/admin" className="mb-6 block font-semibold">
        {locale === "ar" ? "لوحة الإدارة" : "Admin dashboard"}
      </Link>
      {children}
    </div>
  );
}
