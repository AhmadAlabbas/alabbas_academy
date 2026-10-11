import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AccountShell} from '@/components/account/account-shell';
import {VerifyEmailForm} from '@/components/account/auth-forms';
import {accountPageMetadata, firstQueryValue} from '@/components/account/page-metadata';
import type {AccountPageProps} from '@/components/account/page-metadata';
import {routing} from '@/i18n/routing';

export const generateMetadata = ({params}: AccountPageProps) => accountPageMetadata(params, 'verify');

export default async function VerifyEmailPage({params, searchParams}: AccountPageProps) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Account');
  const query = await searchParams;
  return <AccountShell title={t('verifyTitle')} description={t('verifyDescription')}><VerifyEmailForm token={firstQueryValue(query.token) ?? ''} /></AccountShell>;
}
