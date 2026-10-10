import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  categories,
  instructors,
  sampleCourses,
  sampleCurricula,
  type LocalizedText,
} from "../src/content/catalog";
import { demoExamQuestions } from "./demo-answer-keys";

const locales = ["ar", "en"] as const;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed PostgreSQL.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });

class SeedConfigurationError extends Error {}

function translations(text: LocalizedText) {
  return locales.map((locale) => ({ locale, title: text[locale] }));
}

async function seed() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (Boolean(adminEmail) !== Boolean(adminPassword)) {
    throw new SeedConfigurationError("Provide both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD, or leave both unset.");
  }
  if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new SeedConfigurationError("SEED_ADMIN_EMAIL must be a valid email address.");
  }
  if (adminPassword && (adminPassword.length < 12 || adminPassword.length > 128)) {
    throw new SeedConfigurationError("SEED_ADMIN_PASSWORD must contain 12–128 characters.");
  }
  const passwordHash = adminPassword
    ? await hash(adminPassword, {
        // @node-rs/argon2's ambient const enum is incompatible with isolated
        // modules. Its documented Argon2id algorithm value is 2.
        algorithm: 2,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      })
    : undefined;

  const result = await prisma.$transaction(async (tx) => {
    // Serialize concurrent seed runs. This lock expires at transaction completion.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72839102)`;

    const administrator = await tx.role.upsert({
      where: { slug: "administrator" },
      update: {},
      create: {
        slug: "administrator",
        name: "Administrator",
        permissions: ["catalog.manage", "users.manage", "orders.manage", "content.manage", "settings.manage", "reports.read"],
      },
    });
    await tx.role.upsert({
      where: { slug: "learner" },
      update: {},
      create: { slug: "learner", name: "Learner", permissions: ["learning.read"] },
    });

    for (const [position, category] of categories.entries()) {
      await tx.category.upsert({
        where: { key: category.slug },
        update: {},
        create: {
          id: `category-${category.slug}`,
          key: category.slug,
          position,
          tone: category.tone,
          translations: {
            create: locales.map((locale) => ({
              locale,
              slug: category.slug,
              title: category.title[locale],
              description: category.description[locale],
            })),
          },
        },
      });
    }

    for (const instructor of instructors) {
      await tx.instructor.upsert({
        where: { key: instructor.id },
        update: {},
        create: {
          id: instructor.id,
          key: instructor.id,
          initials: instructor.initials,
          translations: {
            create: locales.map((locale) => ({
              locale,
              name: instructor.name[locale],
              bio: instructor.bio[locale],
            })),
          },
        },
      });
    }

    let coursesCreated = 0;
    for (const course of sampleCourses) {
      // Never replace course copy, curriculum, prices, or admin edits on reruns.
      if (await tx.course.findUnique({ where: { key: course.id }, select: { id: true } })) continue;
      const category = await tx.category.findUniqueOrThrow({ where: { key: course.categorySlug } });
      const instructor = await tx.instructor.findUniqueOrThrow({ where: { key: course.instructorId } });
      await tx.course.create({
        data: {
          id: course.id,
          key: course.id,
          categoryId: category.id,
          status: "PUBLISHED",
          level: course.level,
          priceHalalas: course.priceHalalas,
          currency: "SAR",
          minutes: course.minutes,
          coverStyle: course.cover,
          featured: course.featured,
          publishedAt: new Date(),
          instructors: { create: { instructorId: instructor.id, position: 0 } },
          translations: {
            create: locales.map((locale) => ({
              locale,
              slug: course.slug[locale],
              title: course.title[locale],
              description: course.description[locale],
              metaTitle: `${course.title[locale]} | ${locale === "ar" ? "أكاديمية العباس" : "Alabbas Academy"}`,
              metaDescription: course.description[locale],
            })),
          },
        },
      });

      const curriculum = sampleCurricula[course.id];
      if (!curriculum) throw new Error(`Demo curriculum is missing for ${course.id}.`);
      for (const [sectionPosition, section] of curriculum.entries()) {
        await tx.section.create({
          data: {
            id: section.id,
            courseId: course.id,
            position: sectionPosition,
            translations: { create: translations(section.title) },
            lessons: {
              create: section.lessons.map((lesson, lessonPosition) => ({
                id: lesson.id,
                position: lessonPosition,
                kind: "ARTICLE" as const,
                minutes: lesson.minutes,
                isPreview: lesson.preview,
                isPublished: true,
                translations: {
                  create: locales.map((locale) => ({
                    locale,
                    title: lesson.title[locale],
                    body: lesson.body?.[locale] ?? course.description[locale],
                  })),
                },
              })),
            },
          },
        });

        const questions = demoExamQuestions[section.exam.id];
        if (!questions || questions.length !== section.exam.questionCount) {
          throw new Error(`Demo exam question count does not match ${section.exam.id}.`);
        }
        await tx.exam.create({
          data: {
            id: section.exam.id,
            courseId: course.id,
            sectionId: section.id,
            position: sectionPosition,
            isPublished: true,
            isRequired: true,
            passingBasisPoints: section.exam.passPercent * 100,
            translations: {
              create: locales.map((locale) => ({
                locale,
                title: section.exam.title[locale],
                instructions: locale === "ar"
                  ? "اختر إجابة واحدة لكل سؤال. تحصل على نتيجة الاختبار والتوضيح بعد تسليم إجاباتك."
                  : "Choose one answer per question. Your score and explanations are shown after submission.",
              })),
            },
            questions: {
              create: questions.map((question, position) => ({
                id: question.id,
                position,
                kind: "SINGLE_CHOICE" as const,
                points: 1,
                translations: {
                  create: locales.map((locale) => ({
                    locale,
                    prompt: question.prompt[locale],
                    explanation: question.explanation[locale],
                  })),
                },
                options: {
                  create: question.options.map((option, optionPosition) => ({
                    position: optionPosition,
                    isCorrect: optionPosition === question.correctOption,
                    translations: { create: locales.map((locale) => ({ locale, label: option[locale] })) },
                  })),
                },
              })),
            },
          },
        });
      }
      coursesCreated++;
    }

    await tx.setting.upsert({
      where: { key: "academy" },
      update: {},
      create: { key: "academy", value: { nameAr: "أكاديمية العباس", nameEn: "Alabbas Academy", currency: "SAR", defaultLocale: "ar", timezone: "Asia/Riyadh" } },
    });

    let adminCreated = false;
    if (adminEmail && passwordHash) {
      const existing = await tx.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
      if (existing) {
        // A seed must never grant privileges to or reset an existing account.
        console.info("Administrator seed skipped: an account with that email already exists.");
      } else {
        await tx.user.create({
          data: {
            email: adminEmail,
            name: process.env.SEED_ADMIN_NAME?.trim() || "Academy administrator",
            passwordHash,
            preferredLocale: "ar",
            roles: { create: { roleId: administrator.id } },
          },
        });
        adminCreated = true;
      }
    }
    return { coursesCreated, adminCreated };
  }, { timeout: 60_000, maxWait: 15_000 });

  console.info(`Seed complete: ${result.coursesCreated} new demo courses. Existing content preserved.`);
  console.info(result.adminCreated ? "Administrator created; verify the email through the account flow when Phase 2 is enabled." : "No administrator account created or changed.");
}

seed()
  .catch((error: unknown) => {
    // Connection URLs, credential values, and Prisma parameter data stay private.
    console.error(error instanceof SeedConfigurationError
      ? error.message
      : "Seed failed. Check PostgreSQL connectivity and applied migrations.");
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
