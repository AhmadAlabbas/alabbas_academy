import {getCurrentUser} from '@/lib/auth/session';
import {authConfigurationReady, googleConfigurationReady} from '@/lib/auth/config';
import {emailConfigurationReady} from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  const publicUser = user ? {id:user.id,name:user.name,email:user.email,emailVerified:user.emailVerified?.toISOString() ?? null,image:user.image,preferredLocale:user.preferredLocale,roles:user.roles} : null;
  return Response.json({user:publicUser,googleEnabled:googleConfigurationReady(),configured:authConfigurationReady(),emailConfigured:emailConfigurationReady()}, {headers:{'Cache-Control':'no-store'}});
}
