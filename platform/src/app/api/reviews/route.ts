import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth/session";
import { enrollmentFor } from "@/lib/learning/service";
import { readJson, accountErrorResponse } from "@/lib/security/request";
const schema = z
  .object({
    courseId: z.string().max(191),
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(5).max(3000),
    locale: z.enum(["ar", "en"]),
  })
  .strict();
export async function POST(r: Request) {
  try {
    const user = await requireVerifiedUser(),
      b = await readJson(r, schema);
    await enrollmentFor(user.id, b.courseId);
    await getDatabase().review.upsert({
      where: { userId_courseId: { userId: user.id, courseId: b.courseId } },
      create: { userId: user.id, ...b },
      update: {
        rating: b.rating,
        body: b.body,
        locale: b.locale,
        status: "PENDING",
      },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return accountErrorResponse(e);
  }
}
