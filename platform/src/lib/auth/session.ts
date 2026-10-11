import 'server-only';
import {auth} from '@/auth';
import {getDatabase} from '@/lib/db';
import {authConfigurationReady} from './config';
import {AccountError} from './errors';

export type AccountUser = {
  id:string;
  name:string|null;
  email:string;
  emailVerified:Date|null;
  image:string|null;
  preferredLocale:'ar'|'en';
  roles:string[];
  sessionId:string;
  sessionVersion:number;
};

export async function getCurrentUser():Promise<AccountUser|null> {
  if (!authConfigurationReady()) return null;
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.sessionId) return null;
    const anchor = await getDatabase().session.findUnique({where:{id:session.user.sessionId},include:{user:{include:{roles:{include:{role:true}}}}}});
    if (!anchor || anchor.userId !== session.user.id || anchor.revokedAt || anchor.expires.getTime() <= Date.now() || anchor.user.status !== 'ACTIVE' || anchor.sessionVersion !== session.user.sessionVersion || anchor.user.sessionVersion !== session.user.sessionVersion) return null;
    const user = anchor.user;
    return {id:user.id,name:user.name,email:user.email,emailVerified:user.emailVerified,image:user.image,preferredLocale:user.preferredLocale,roles:user.roles.map(item=>item.role.slug),sessionId:anchor.id,sessionVersion:user.sessionVersion};
  } catch { return null; }
}

export async function requireUser():Promise<AccountUser> {
  if (!authConfigurationReady()) throw new AccountError('SERVICE_UNAVAILABLE', 503);
  const user = await getCurrentUser();
  if (!user) throw new AccountError('UNAUTHORIZED', 401);
  return user;
}

export async function requireVerifiedUser():Promise<AccountUser> {
  const user = await requireUser();
  if (!user.emailVerified) throw new AccountError('FORBIDDEN', 403);
  return user;
}
