import { requireVerifiedUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Checkout } from "@/components/platform/checkout";
import { gatewayConfigured } from "@/lib/commerce/providers";
import { siteSettings } from "@/lib/public-data";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  try {
    await requireVerifiedUser();
  } catch {
    redirect(`/${locale}/account?callbackUrl=/${locale}/checkout`);
  }
  const settings = await siteSettings();
  return (
    <Checkout
      onlinePayments={
        gatewayConfigured() && settings.payments_enabled !== false
      }
    />
  );
}
