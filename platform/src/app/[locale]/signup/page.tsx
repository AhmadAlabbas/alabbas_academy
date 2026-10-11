import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AccountShell} from '@/components/account/account-shell';
import {SignupForm} from '@/components/account/auth-forms';
import {accountPageMetadata, firstQueryValue} from '@/components/account/page-metadata';
import type {AccountPageProps} from '@/components/account/page-metadata';
import {routing} from '@/i18n/routing';

export const generateMetadata = ({params}: AccountPageProps) => accountPageMetadata(params, 'signup');

export default async function SignupPage({params, searchParams}: AccountPageProps) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Account');
  const query = await searchParams;
  return <AccountShell title={t('signupTitle')} description={t('signupDescription')}><SignupForm callbackUrl={firstQueryValue(query.callbackUrl) ?? firstQueryValue(query.returnTo)} /></AccountShell>;
}
