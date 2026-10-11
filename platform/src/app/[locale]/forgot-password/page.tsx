import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AccountShell} from '@/components/account/account-shell';
import {ForgotPasswordForm} from '@/components/account/auth-forms';
import {accountPageMetadata} from '@/components/account/page-metadata';
import type {AccountPageProps} from '@/components/account/page-metadata';
import {routing} from '@/i18n/routing';

export const generateMetadata = ({params}: AccountPageProps) => accountPageMetadata(params, 'forgot');

export default async function ForgotPasswordPage({params}: AccountPageProps) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Account');
  return <AccountShell title={t('forgotTitle')} description={t('forgotDescription')}><ForgotPasswordForm /></AccountShell>;
}
