import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
export default async function Page() {
  const locale = (await cookies()).get('ALABBAS_LOCALE')?.value === 'en' ? 'en' : 'ar';
  redirect(`/code/${locale}`);
}
