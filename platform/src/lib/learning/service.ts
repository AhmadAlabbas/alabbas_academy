import {contentText} from '@/lib/course-content';
import "server-only";
import { randomUUID, createHmac } from "node:crypto";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { AccountError } from "@/lib/auth/errors";
import type { Prisma } from "@/generated/prisma/client";
export const learningSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("progress"),
      courseId: z.string().max(191),
      lessonId: z.string().max(191),
      completed: z.boolean().optional(),
      position: z.number().int().min(0).max(86400).optional(),
      note: z.string().max(10000).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("start-exam"),
      courseId: z.string().max(191),
      examId: z.string().max(191),
      locale: z.enum(["ar", "en"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("submit-exam"),
      courseId: z.string().max(191),
      attemptId: z.string().max(191),
      answers: z.record(z.string().max(191), z.string().max(191)),
    })
    .strict(),
  z
    .object({ action: z.literal("certificate"), courseId: z.string().max(191) })
    .strict(),
]);
export async function enrollmentFor(userId: string, courseId: string) {
  const enrollment = await getDatabase().enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: {
      course: {
        include: {
          sections: {
            orderBy: { position: "asc" },
            include: {
              lessons: {
                where: { isPublished: true },
                orderBy: { position: "asc" },
                include: {
                  attachments: {
                    include: {
                      mediaAsset: { select: { id: true, originalName: true } },
                    },
                  },
                },
              },
            },
          },
          exams: { where: { isPublished: true }, orderBy: { position: "asc" } },
        },
      },
      progress: true,
      examAttempts: {
        select: {
          id: true,
          examId: true,
          status: true,
          passed: true,
          scorePoints: true,
          maximumPoints: true,
          number: true,
        },
      },
      certificate: true,
    },
  });
  if (
    !enrollment ||
    !["ACTIVE", "COMPLETED"].includes(enrollment.status) ||
    enrollment.revokedAt
  )
    throw new AccountError("FORBIDDEN", 403);
  return enrollment;
}
type Snapshot = {
  id: string;
  prompt_ar: string;
  prompt_en: string;
  points: number;
  options: {
    id: string;
    label_ar: string;
    label_en: string;
    isCorrect: boolean;
  }[];
}[];
function publicQuestions(snapshot: Snapshot) {
  return snapshot.map((q) => ({
    ...q,
    options: q.options.map(({ id, label_ar, label_en }) => ({
      id,
      label_ar,
      label_en,
    })),
  }));
}
async function requireActive(
  tx: Prisma.TransactionClient,
  userId: string,
  courseId: string,
) {
  await tx.$queryRaw`SELECT id FROM users WHERE id=${userId} FOR UPDATE`;
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.status !== "ACTIVE" || !user.emailVerified)
    throw new AccountError("FORBIDDEN", 403);
  const enrollment = await tx.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (
    !enrollment ||
    !["ACTIVE", "COMPLETED"].includes(enrollment.status) ||
    enrollment.revokedAt
  )
    throw new AccountError("FORBIDDEN", 403);
  await tx.$queryRaw`SELECT id FROM enrollments WHERE id=${enrollment.id} FOR UPDATE`;
  return enrollment;
}
export async function mutateLearning(
  userId: string,
  b: z.infer<typeof learningSchema>,
) {
  return getDatabase().$transaction(
    async (tx) => {
      const enrollment = await requireActive(tx, userId, b.courseId);
      if (b.action === "progress") {
        const lesson = await tx.lesson.findUnique({
          where: { id: b.lessonId },
          include: { section: true },
        });
        if (!lesson?.isPublished || lesson.section.courseId !== b.courseId)
          throw new AccountError("FORBIDDEN", 403);
        const position = Math.min(
          b.position ?? 0,
          Math.max(60, lesson.minutes * 60),
        );
        const data = {
          ...(b.completed ? { completedAt: new Date() } : {}),
          ...(b.position !== undefined
            ? { lastPositionSeconds: position, watchedSeconds: position }
            : {}),
          ...(b.note !== undefined && lesson.notesEnabled
            ? { note: b.note }
            : {}),
        };
        return tx.lessonProgress.upsert({
          where: {
            enrollmentId_lessonId: {
              enrollmentId: enrollment.id,
              lessonId: b.lessonId,
            },
          },
          create: {
            enrollmentId: enrollment.id,
            lessonId: b.lessonId,
            ...data,
          },
          update: data,
        });
      }
      if (b.action === "start-exam") {
        const exam = await tx.exam.findUnique({
          where: { id: b.examId },
          include: {
            questions: {
              orderBy: { position: "asc" },
              include: { options: { orderBy: { position: "asc" } } },
            },
          },
        });
        if (
          !exam?.isPublished ||
          exam.courseId !== b.courseId ||
          !exam.questions.length ||
          exam.questions.some(
            (q) =>
              q.points < 1 ||
              q.options.length < 2 ||
              q.options.filter((o) => o.isCorrect).length !== 1,
          )
        )
          throw new AccountError("INVALID_INPUT", 400);
        const previous = await tx.examAttempt.findMany({
          where: { enrollmentId: enrollment.id, examId: exam.id },
          orderBy: { number: "desc" },
        });
        const active = previous.find(
          (a) =>
            a.status === "IN_PROGRESS" &&
            (!a.expiresAt || a.expiresAt > new Date()),
        );
        if (active)
          return {
            id: active.id,
            expiresAt: active.expiresAt,
            questions: publicQuestions(
              active.questionSnapshot as unknown as Snapshot,
            ),
          };
        if (
          exam.maximumAttempts !== null &&
          previous.length >= exam.maximumAttempts
        )
          throw new AccountError("FORBIDDEN", 403);
        const snapshot: Snapshot = exam.questions.map((q) => ({
          id: q.id,
          prompt_ar: q.prompt_ar,
          prompt_en: q.prompt_en,
          points: q.points,
          options: q.options.map((o) => ({
            id: o.id,
            label_ar: o.label_ar,
            label_en: o.label_en,
            isCorrect: o.isCorrect,
          })),
        }));
        const attempt = await tx.examAttempt.create({
          data: {
            enrollmentId: enrollment.id,
            examId: exam.id,
            number: (previous[0]?.number ?? 0) + 1,
            examVersion: exam.version,
            passingBasisPoints: exam.passingBasisPoints,
            locale: b.locale,
            questionSnapshot: snapshot,
            maximumPoints: snapshot.reduce((n, q) => n + q.points, 0),
            expiresAt: new Date(
              Date.now() + (exam.timeLimitMinutes ?? 60) * 60000,
            ),
          },
        });
        return {
          id: attempt.id,
          expiresAt: attempt.expiresAt,
          questions: publicQuestions(snapshot),
        };
      }
      if (b.action === "submit-exam") {
        const attempt = await tx.examAttempt.findUnique({
          where: { id: b.attemptId },
          include: { exam: true },
        });
        if (!attempt || attempt.enrollmentId !== enrollment.id)
          throw new AccountError("FORBIDDEN", 403);
        if (attempt.status !== "IN_PROGRESS")
          return {
            passed: attempt.passed,
            score: attempt.scorePoints,
            total: attempt.maximumPoints,
          };
        if (attempt.expiresAt && attempt.expiresAt < new Date())
          throw new AccountError("INVALID_TOKEN", 400);
        const questions = attempt.questionSnapshot as unknown as Snapshot;
        if (
          Object.keys(b.answers).some(
            (id) => !questions.some((q) => q.id === id),
          ) ||
          questions.some(
            (q) =>
              b.answers[q.id] &&
              !q.options.some((o) => o.id === b.answers[q.id]),
          )
        )
          throw new AccountError("INVALID_INPUT", 400);
        const score = questions.reduce(
            (n, q) =>
              n +
              (q.options.some((o) => o.id === b.answers[q.id] && o.isCorrect)
                ? q.points
                : 0),
            0,
          ),
          passed =
            score * 10000 >= attempt.maximumPoints * attempt.passingBasisPoints;
        await tx.examAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "GRADED",
            answerSnapshot: b.answers,
            scorePoints: score,
            passed,
            submittedAt: new Date(),
            gradedAt: new Date(),
          },
        });
        return { passed, score, total: attempt.maximumPoints };
      }
      const lessons = await tx.lesson.findMany({
        where: { isPublished: true, section: { courseId: b.courseId } },
        select: { id: true },
      });
      const done = await tx.lessonProgress.count({
        where: {
          enrollmentId: enrollment.id,
          lessonId: { in: lessons.map((l) => l.id) },
          completedAt: { not: null },
        },
      });
      const required = await tx.exam.findMany({
        where: { courseId: b.courseId, isPublished: true, isRequired: true },
        select: { id: true },
      });
      const passed = await tx.examAttempt.findMany({
        where: {
          enrollmentId: enrollment.id,
          passed: true,
          examId: { in: required.map((e) => e.id) },
        },
        select: { examId: true },
      });
      if (
        !lessons.length ||
        done !== lessons.length ||
        required.some((e) => !passed.some((a) => a.examId === e.id))
      )
        throw new AccountError("FORBIDDEN", 403);
      const [user, course] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { id: userId } }),
        tx.course.findUniqueOrThrow({ where: { id: b.courseId } }),
      ]);
      const serial = "AA-" + randomUUID().toUpperCase();
      const certificate = await tx.certificate.upsert({
        where: { enrollmentId: enrollment.id },
        create: {
          enrollmentId: enrollment.id,
          serial,
          verificationHash: createHmac("sha256", process.env.AUTH_SECRET!)
            .update(serial)
            .digest("hex"),
          learnerName: user.name || user.email,
          courseTitleAr: contentText(course, 'title', 'ar'),
          courseTitleEn: contentText(course, 'title', 'en'),
        },
        update: {},
      });
      if (certificate.revokedAt) throw new AccountError("FORBIDDEN", 403);
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return { id: certificate.id, url: `/api/certificates/${certificate.id}` };
    },
    { timeout: 15000 },
  );
}
