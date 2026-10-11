import { requireVerifiedUser } from "@/lib/auth/session";
import { learningSchema, mutateLearning } from "@/lib/learning/service";
import { readJson, accountErrorResponse } from "@/lib/security/request";
export async function POST(r: Request) {
  try {
    const user = await requireVerifiedUser();
    return Response.json(
      await mutateLearning(user.id, await readJson(r, learningSchema, 32768)),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return accountErrorResponse(e);
  }
}
