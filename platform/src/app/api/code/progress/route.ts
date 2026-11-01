import {z} from 'zod';
import {lessonMap} from '@/code/lessons';
import {getCurrentUser, requireVerifiedUser} from '@/lib/auth/session';
import {getDatabase} from '@/lib/db';
import {readJson, accountErrorResponse} from '@/lib/security/request';

export const dynamic = 'force-dynamic';

const progressSchema = z.object({
  lessonId: z.string().min(1).max(100).refine(value => lessonMap.has(value), 'Unknown lesson'),
}).strict();

/** Uses the existing Academy account. Anonymous students keep progress locally. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({authenticated: false, completed: []}, {
      headers: {'Cache-Control': 'no-store'},
    });
    const rows = await getDatabase().codeProgress.findMany({
      where: {userId: user.id},
      select: {lessonId: true},
      take: lessonMap.size,
    });
    return Response.json({authenticated: true, completed: rows.map(row => row.lessonId)}, {
      headers: {'Cache-Control': 'no-store'},
    });
  } catch {
    return Response.json({error: 'Progress unavailable'}, {
      status: 503, headers: {'Cache-Control': 'no-store'},
    });
  }
}

/** Low-stakes exercise completion: NOT a secure grade, entitlement or certificate. */
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const {lessonId} = await readJson(request, progressSchema, 512);
    await getDatabase().codeProgress.upsert({
      where: {userId_lessonId: {userId: user.id, lessonId}},
      update: {},
      create: {userId: user.id, lessonId},
    });
    return Response.json({ok: true, lessonId}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return accountErrorResponse(error);
  }
}
