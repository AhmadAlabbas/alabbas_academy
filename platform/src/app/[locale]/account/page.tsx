import {hasLocale} from 'next-intl';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AccountDashboard} from '@/components/account/account-dashboard';
import {accountPageMetadata} from '@/components/account/page-metadata';
import type {AccountPageProps} from '@/components/account/page-metadata';
import {redirect} from '@/i18n/navigation';
import {routing} from '@/i18n/routing';
import {getCurrentUser} from '@/lib/auth/session';

export const generateMetadata = ({params}: AccountPageProps) => accountPageMetadata(params, 'account');

export default async function AccountPage({params}: AccountPageProps) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) return redirect({href: {pathname: '/login', query: {callbackUrl: `/${locale}/account`}}, locale});
  return <AccountDashboard initialUser={{id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified?.toISOString() ?? null, image: user.image, preferredLocale: user.preferredLocale, roles: user.roles}} />;
}
