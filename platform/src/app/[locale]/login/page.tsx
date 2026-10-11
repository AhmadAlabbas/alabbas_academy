import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AccountShell} from '@/components/account/account-shell';
import {LoginForm} from '@/components/account/auth-forms';
import {accountPageMetadata, firstQueryValue} from '@/components/account/page-metadata';
import type {AccountPageProps} from '@/components/account/page-metadata';
import {routing} from '@/i18n/routing';

export const generateMetadata = ({params}: AccountPageProps) => accountPageMetadata(params, 'login');

export default async function LoginPage({params, searchParams}: AccountPageProps) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Account');
  const query = await searchParams;
  return <AccountShell title={t('loginTitle')} description={t('loginDescription')}><LoginForm callbackUrl={firstQueryValue(query.callbackUrl) ?? firstQueryValue(query.returnTo)} initialError={firstQueryValue(query.error)} passwordChanged={firstQueryValue(query.passwordChanged) === '1'} /></AccountShell>;
}
