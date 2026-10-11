import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const db = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});
const categories = [
  ["design", "التصميم", "Design"],
  ["technology", "التقنية", "Technology"],
  ["business", "الأعمال", "Business"],
  ["photography", "التصوير", "Photography"],
  ["languages", "اللغات", "Languages"],
  ["personal", "تطوير الذات", "Personal growth"],
];
const topics = [
  [
    "visual-design",
    "أساسيات-التصميم-البصري",
    "أساسيات التصميم البصري",
    "Visual design foundations",
  ],
  [
    "web-interfaces",
    "بناء-واجهات-الويب",
    "بناء واجهات الويب",
    "Building web interfaces",
  ],
  [
    "business-ideas",
    "من-الفكرة-إلى-المشروع",
    "من الفكرة إلى المشروع",
    "From idea to business",
  ],
  [
    "photography-basics",
    "أساسيات-التصوير",
    "أساسيات التصوير",
    "Photography foundations",
  ],
  [
    "english-speaking",
    "الإنجليزية-للمحادثة",
    "الإنجليزية للمحادثة",
    "Conversational English",
  ],
  ["time-management", "إدارة-الوقت", "إدارة الوقت", "Time management"],
  [
    "ui-design",
    "تصميم-واجهات-المستخدم",
    "تصميم واجهات المستخدم",
    "User interface design",
  ],
  [
    "javascript",
    "جافاسكربت-للمبتدئين",
    "جافاسكربت للمبتدئين",
    "JavaScript for beginners",
  ],
  ["marketing", "التسويق-الرقمي", "التسويق الرقمي", "Digital marketing"],
  [
    "video-editing",
    "مونتاج-الفيديو",
    "مونتاج الفيديو",
    "Video editing foundations",
  ],
  [
    "business-english",
    "الإنجليزية-للأعمال",
    "الإنجليزية للأعمال",
    "Business English",
  ],
  ["public-speaking", "مهارات-الإلقاء", "مهارات الإلقاء", "Public speaking"],
];
async function main() {
  if (!process.env.DATABASE_URL?.startsWith("mysql://"))
    throw Error("Use a MySQL database");
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim(),
    password = process.env.SEED_ADMIN_PASSWORD;
  if (
    !email ||
    !password ||
    password.length < 12 ||
    password.length > 128 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    throw Error(
      "Set SEED_ADMIN_EMAIL and a private 12–128 character SEED_ADMIN_PASSWORD",
    );
  const admin = await db.role.upsert({
    where: { slug: "administrator" },
    update: {},
    create: {
      slug: "administrator",
      name: "Administrator",
      permissions: [
        "catalog.manage",
        "users.manage",
        "orders.manage",
        "content.manage",
        "settings.manage",
        "reports.read",
      ],
    },
  });
  await db.role.upsert({
    where: { slug: "support" },
    update: {},
    create: {
      slug: "support",
      name: "Support",
      permissions: ["users.read", "orders.read", "contact.manage"],
    },
  });
  await db.role.upsert({
    where: { slug: "learner" },
    update: {},
    create: {
      slug: "learner",
      name: "Learner",
      permissions: ["learning.read"],
    },
  });
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: process.env.SEED_ADMIN_NAME || "Academy Administrator",
      passwordHash: await hash(password, {
        algorithm: 2,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      }),
      emailVerified: new Date(),
      image: "/avatars/navy.svg",
    },
  });
  await db.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: admin.id } },
    update: {},
    create: { userId: user.id, roleId: admin.id },
  });
  const cats = [];
  for (const [key, title_ar, title_en] of categories)
    cats.push(
      await db.category.upsert({
        where: { key },
        update: {},
        create: {
          key,
          title_ar,
          title_en,
          description_ar: `دورات عملية في ${title_ar}`,
          description_en: `Practical courses in ${title_en.toLowerCase()}`,
          position: cats.length,
          tone: cats.length % 2 ? "sky" : "gold",
        },
      }),
    );
  const people = [];
  for (const [key, name_ar, name_en] of [
    ["sara", "سارة محمد", "Sara Mohammed"],
    ["khalid", "خالد أحمد", "Khalid Ahmed"],
    ["noura", "نورة علي", "Noura Ali"],
  ])
    people.push(
      await db.instructor.upsert({
        where: { key },
        update: {},
        create: {
          key,
          name_ar,
          name_en,
          bio_ar:
            "مدرّس نموذجي لأغراض عرض الأكاديمية. يمكنك تعديل هذه البيانات.",
          bio_en:
            "Fictional instructor for academy demonstration. Edit these details before offering real instruction.",
          initials: name_en.slice(0, 1),
        },
      }),
    );
  const upload = resolve(process.env.UPLOAD_DIR || ".local/uploads");
  await mkdir(upload, { recursive: true, mode: 0o700 });
  const sample = Buffer.from(
    "Alabbas Academy — Sample lesson notes\nThese are demonstration course materials. Replace from the admin panel.\n1. Review the lesson.\n2. Complete the activity.\n3. Take the exam.\n",
  );
  await writeFile(resolve(upload, "sample-notes.txt"), sample, { mode: 0o600 });
  const asset = await db.mediaAsset.upsert({
    where: { storageKey: "sample-notes.txt" },
    update: {},
    create: {
      kind: "FILE",
      status: "READY",
      storageKey: "sample-notes.txt",
      originalName: "sample-notes.txt",
      mimeType: "text/plain",
      bytes: BigInt(sample.length),
      isPublic: false,
      uploadedById: user.id,
    },
  });
  for (let i = 0; i < topics.length; i++) {
    const [key, slug_ar, title_ar, title_en] = topics[i];
    if (await db.course.findUnique({ where: { key } })) continue;
    const course = await db.course.create({
      data: {
        key,
        slug_ar,
        slug_en: key,
        title_ar,
        title_en,
        description_ar: `دورة نموذجية للتعلّم العملي في ${title_ar}. تضم فيديوهات وأنشطة واختبارًا. هذه بيانات تجريبية قابلة للتعديل من لوحة الإدارة.`,
        description_en: `A sample practical course in ${title_en.toLowerCase()}, with videos, activities and an exam. All demonstration content can be replaced from the admin panel.`,
        outcomes_ar: "فهم الأساسيات\nتطبيق مهارة جديدة\nإنجاز مشروع بسيط",
        outcomes_en:
          "Understand the foundations\nApply a new skill\nComplete a simple project",
        requirements_ar: "رغبة في التعلّم واتصال بالإنترنت",
        requirements_en: "An interest in learning and an internet connection",
        status: "PUBLISHED",
        categoryId: cats[i % 6].id,
        priceHalalas: 14900 + (i % 4) * 5000,
        minutes: 90,
        featured: i < 3,
        isSample: true,
        coverStyle: ["design", "code", "business", "photo"][i % 4],
        previewUrl: "https://www.youtube.com/embed/PkZNo7MFNFg",
        publishedAt: new Date(),
        instructors: { create: { instructorId: people[i % 3].id } },
      },
    });
    for (let j = 0; j < 2; j++) {
      const section = await db.section.create({
        data: {
          courseId: course.id,
          position: j,
          title_ar: j ? "المشروع والتطبيق" : "المقدمة والأساسيات",
          title_en: j ? "Project and practice" : "Introduction and foundations",
        },
      });
      for (let k = 0; k < 3; k++) {
        const lesson = await db.lesson.create({
          data: {
            sectionId: section.id,
            position: k,
            kind: "VIDEO",
            minutes: 15,
            isPublished: true,
            isPreview: j === 0 && k === 0,
            title_ar: [
              "مرحبًا بك في الدورة",
              "المفاهيم الأساسية",
              "تطبيق عملي",
            ][k],
            title_en: [
              "Welcome to the course",
              "Key concepts",
              "Practical activity",
            ][k],
            body_ar:
              "شاهد الفيديو النموذجي ودوّن الأفكار الأساسية. استبدل هذا المحتوى من لوحة الإدارة.",
            body_en:
              "Watch the sample video and note the main ideas. Replace this material from the administration panel.",
            videoUrl: "https://www.youtube.com/embed/PkZNo7MFNFg",
          },
        });
        await db.lessonAttachment.create({
          data: {
            lessonId: lesson.id,
            mediaAssetId: asset.id,
            labelAr: "ملف تدريبي نموذجي",
            labelEn: "Sample practice notes",
          },
        });
      }
    }
    const exam = await db.exam.create({
      data: {
        courseId: course.id,
        title_ar: "اختبار مراجعة الدورة",
        title_en: "Course review exam",
        isPublished: true,
        isRequired: true,
        passingBasisPoints: 5000,
        timeLimitMinutes: 10,
        maximumAttempts: 5,
        instructions_ar: "اختر الإجابة الصحيحة لكل سؤال.",
        instructions_en: "Choose the correct answer for each question.",
      },
    });
    for (let q = 0; q < 2; q++)
      await db.examQuestion.create({
        data: {
          examId: exam.id,
          position: q,
          prompt_ar: q
            ? "ما أفضل طريقة لتثبيت المهارة؟"
            : "ماذا تفعل بعد مشاهدة الدرس؟",
          prompt_en: q
            ? "What is the best way to retain a skill?"
            : "What should you do after watching a lesson?",
          explanation_ar: "الممارسة والمراجعة تساعدان على التعلّم.",
          explanation_en: "Practice and review support learning.",
          options: {
            create: [
              {
                position: 0,
                label_ar: q
                  ? "الممارسة المنتظمة"
                  : "تطبيق النشاط ومراجعة الملاحظات",
                label_en: q
                  ? "Regular practice"
                  : "Complete the activity and review notes",
                isCorrect: true,
              },
              {
                position: 1,
                label_ar: "تجنّب التدريب",
                label_en: "Avoid practice",
                isCorrect: false,
              },
              {
                position: 2,
                label_ar: "الاعتماد على الحفظ فقط",
                label_en: "Only memorize",
                isCorrect: false,
              },
            ],
          },
        },
      });
  }
  for (const [code, percentageBasisPoints] of [
    ["WELCOME10", 1000],
    ["SAMPLE20", 2000],
  ] as const)
    await db.coupon.upsert({
      where: { code },
      update: {},
      create: {
        code,
        kind: "PERCENTAGE",
        percentageBasisPoints,
        usageLimit: 100,
        perUserLimit: 1,
      },
    });
  const pages = [
    [
      "home",
      "العباس: تعلّم خطوة بخطوة",
      "Alabbas: learn step by step",
      "دورات عملية، في وقتك وبطريقتك.",
      "Practical courses, at your pace and in your own way.",
    ],
    [
      "about",
      "عن الأكاديمية",
      "About the academy",
      "أكاديمية العباس مساحة للتعلّم العملي. جميع الدورات الحالية نموذجية ويمكن تعديلها قبل تقديم المحتوى الحقيقي.",
      "Alabbas Academy is a place for practical learning. Current courses are demonstrations that the academy can replace with real content.",
    ],
    [
      "privacy",
      "سياسة الخصوصية",
      "Privacy policy",
      "نستخدم بيانات حسابك لتقديم التعلّم وإدارة طلباتك. لا نبيع بياناتك. تواصل معنا لطلب الوصول أو الحذف. تُخزّن بيانات المصادقة بصورة آمنة.",
      "We use account information to provide learning and manage orders. We do not sell your data. Contact the academy for access or deletion requests. Authentication information is stored securely.",
    ],
    [
      "terms",
      "الشروط والأحكام",
      "Terms of service",
      "يجب تقديم معلومات صحيحة وعدم مشاركة بيانات حسابك. المحتوى التدريبي مخصص للاستخدام الشخصي. الطلبات المعلّقة لا تمنح وصولًا حتى يؤكدها المسؤول.",
      "Provide accurate account information and keep your account private. Learning materials are for personal use. Pending orders do not grant access until confirmed by the academy.",
    ],
    [
      "refund-policy",
      "سياسة الاسترداد",
      "Refund policy",
      "تواصل مع الأكاديمية لطلب الاسترداد. يُراجع المسؤول كل طلب ويؤكد النتيجة. الدفع الإلكتروني غير متاح حاليًا.",
      "Contact the academy to request a refund. Administrators review requests and confirm the outcome. Online payment is currently unavailable.",
    ],
  ];
  for (const [key, title_ar, title_en, body_ar, body_en] of pages)
    await db.page.upsert({
      where: { key },
      update: {},
      create: {
        key,
        title_ar,
        title_en,
        body_ar,
        body_en,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  const home = await db.page.findUniqueOrThrow({ where: { key: "home" } });
  await db.contentBlock.upsert({
    where: { pageId_key: { pageId: home.id, key: "hero" } },
    update: {},
    create: {
      pageId: home.id,
      key: "hero",
      kind: "HERO",
      position: 0,
      settings: {},
      title_ar: "خطوة صغيرة اليوم.",
      title_en: "A small step today.",
      body_ar:
        "دورات عملية تساعدك على اكتساب مهارات جديدة. ابدأ الآن بطلب الدورة، وسيؤكد المسؤول تسجيلك.",
      body_en:
        "Practical courses for new skills. Submit your course order and the academy will confirm enrollment.",
    },
  });
  if (!(await db.faq.count()))
    for (const [i, qa, qe, aa, ae] of [
      [
        0,
        "كيف أشتري دورة؟",
        "How do I buy a course?",
        "أنشئ حسابًا وأكّد بريدك ثم أرسل طلب الدورة. يؤكد المسؤول الطلب يدويًا.",
        "Create and verify your account, then submit your order. An administrator confirms it manually.",
      ],
      [
        1,
        "هل الدفع الإلكتروني متاح؟",
        "Are online payments available?",
        "سيتوفر الدفع قريبًا. يمكنك تقديم طلب معلّق الآن.",
        "Payments will be available soon. You can submit a pending order now.",
      ],
      [
        2,
        "هل المحتوى تجريبي؟",
        "Is this sample content?",
        "نعم، الدورات والمدرّسون الحاليون أمثلة يمكن تعديلها من الإدارة.",
        "Yes. Current courses and instructors are editable demonstrations.",
      ],
    ])
      await db.faq.create({
        data: {
          key: `faq-${i}`,
          position: Number(i),
          question_ar: String(qa),
          question_en: String(qe),
          answer_ar: String(aa),
          answer_en: String(ae),
          isPublished: true,
        },
      });
  if (!(await db.testimonial.count()))
    for (const [name, quote_ar, quote_en] of [
      [
        "متعلّم نموذجي",
        "واجهة واضحة وخطوات تعلّم بسيطة.",
        "Clear navigation and simple learning steps.",
      ],
      [
        "طالبة نموذجية",
        "أستطيع متابعة الدروس في وقتي.",
        "I can follow lessons at my own pace.",
      ],
      [
        "متعلّم تجريبي",
        "التعلّم والتطبيق في مكان واحد.",
        "Learning and practice in one place.",
      ],
    ])
      await db.testimonial.create({
        data: {
          name,
          quote_ar,
          quote_en,
          source: "SAMPLE",
          consentAt: new Date(),
          isPublished: true,
        },
      });
  for (const [key, value] of Object.entries({
    name_ar: "أكاديمية العباس",
    name_en: "Alabbas Academy",
    logo: "/logo.svg",
    contact_email: process.env.ADMIN_EMAIL || email,
    contact_phone: "",
    instagram: "",
    x: "",
    payments_enabled: true,
    seo_ar: "تعلّم مهارات جديدة مع أكاديمية العباس",
    seo_en: "Learn new skills with Alabbas Academy",
  }))
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  for (const locale of ["ar", "en"]) {
    const messages = JSON.parse(
      await readFile(resolve(`src/messages/${locale}.json`), "utf8"),
    );
    const flat: Record<string, string> = {};
    function flatten(value: Record<string, unknown>, prefix = "") {
      for (const [key, item] of Object.entries(value)) {
        if (typeof item === "string") flat[prefix + key] = item;
        else flatten(item as Record<string, unknown>, prefix + key + ".");
      }
    }
    flatten(messages.Home);
    await db.setting.upsert({
      where: { key: `home_content_${locale}` },
      create: { key: `home_content_${locale}`, value: flat },
      update: {},
    });
  }
  console.log(
    JSON.stringify({
      seed: "complete",
      courses: await db.course.count(),
      categories: await db.category.count(),
      instructors: await db.instructor.count(),
      admin:
        "Configured through private environment variables; no password printed",
      run: randomUUID(),
    }),
  );
}
main()
  .catch((error) => {
    console.error(
      "Seed failed. Check MySQL connectivity and private admin configuration.",
      {
        type: error.constructor.name,
        code: error.code,
        fields: error.meta?.field_name,
      },
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
