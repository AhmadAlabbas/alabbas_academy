export type Field = {
  key: string;
  ar: string;
  en: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "money"
    | "percentage"
    | "boolean"
    | "json"
    | "date"
    | "select";
  options?: string[];
  required?: boolean;
  max?: number;
};
export type Entity = {
  model: string;
  ar: string;
  en: string;
  fields: Field[];
  search: string[];
  readonly?: boolean;
  identity?: string;
};
const f = (
  key: string,
  ar: string,
  en: string,
  type: Field["type"] = "text",
  required = false,
  options?: string[],
): Field => ({ key, ar, en, type, required, options });
const bilingual = (prefix: string, ar: string, en: string, long = false, required = true) => [
  f(
    prefix + "_ar",
    ar + " (العربية)",
    en + " (Arabic)",
    long ? "textarea" : "text",
    required,
  ),
  f(
    prefix + "_en",
    ar + " (الإنجليزية)",
    en + " (English)",
    long ? "textarea" : "text",
    required,
  ),
];
const position = f("position", "الترتيب (تلقائي عند تركه فارغًا)", "Order (automatic when empty)", "number");
const defaultPosition = f("position", "الترتيب (الافتراضي 0)", "Order (default 0)", "number");
const published = f("isPublished", "منشور", "Published", "boolean");
export const entities: Record<string, Entity> = {
  courses: {
    model: "course",
    ar: "الدورات",
    en: "Courses",
    search: ["title_ar", "title_en", "key"],
    fields: [
      f("key", "معرّف ثابت", "Key", "text", true),
      ...bilingual("title", "العنوان", "Title", false, false),
      ...bilingual("slug", "الرابط", "Slug", false, false),
      f("categoryId", "التصنيف", "Category", "text", true),
      f("status", "الحالة", "Status", "select", true, [
        "DRAFT",
        "PUBLISHED",
        "ARCHIVED",
      ]),
      f("level", "المستوى", "Level", "select", true, [
        "BEGINNER",
        "INTERMEDIATE",
        "ALL_LEVELS",
      ]),
      f(
        "priceHalalas",
        "السعر بالريال السعودي",
        "Price (SAR)",
        "money",
        true,
      ),
      f(
        "compareAtHalalas",
        "السعر السابق بالريال السعودي",
        "Previous price (SAR)",
        "money",
      ),
      f("minutes", "المدة بالدقائق", "Duration in minutes", "number"),
      ...bilingual("description", "الوصف", "Description", true, false),
      ...bilingual("outcomes", "ما ستتعلمه", "Learning outcomes", true, false),
      ...bilingual("requirements", "المتطلبات", "Requirements", true, false),
      ...bilingual("seo", "وصف محركات البحث", "SEO description", true, false),
      f("previewUrl", "رابط المعاينة", "Preview video URL"),
      f("thumbnailUrl", "رابط الصورة", "Thumbnail URL"),
      f("languages", "لغة محتوى الدورة", "Course content language", "select", true, ['ar', 'en', 'ar,en']),
      f("featured", "مميزة", "Featured", "boolean"),
      f("isSample", "دورة تجريبية", "Sample course", "boolean"),
    ],
  },
  categories: {
    model: "category",
    ar: "التصنيفات",
    en: "Categories",
    search: ["title_ar", "title_en", "key"],
    fields: [
      f("key", "المعرّف", "Key", "text", true),
      ...bilingual("title", "العنوان", "Title"),
      ...bilingual("description", "الوصف", "Description", true),
      defaultPosition,
      f("tone", "لون البطاقة", "Card tone", "select", true, [
        "sky",
        "gold",
        "navy",
        "sage",
      ]),
      f("isActive", "نشط", "Active", "boolean"),
    ],
  },
  instructors: {
    model: "instructor",
    ar: "المدربون",
    en: "Instructors",
    search: ["name_ar", "name_en"],
    fields: [
      f("key", "المعرّف", "Key", "text", true),
      ...bilingual("name", "الاسم", "Name"),
      ...bilingual("bio", "نبذة", "Biography", true),
      f("initials", "الأحرف المختصرة", "Initials", "text", true),
      f("imageUrl", "الصورة", "Image URL"),
      f("isActive", "نشط", "Active", "boolean"),
    ],
  },
  sections: {
    model: "section",
    ar: "أقسام الدورات",
    en: "Course sections",
    search: ["title_ar", "title_en", "courseId"],
    fields: [
      f("courseId", "الدورة", "Course", "text", true),
      ...bilingual("title", "العنوان", "Title", false, false),
      position,
    ],
  },
  lessons: {
    model: "lesson",
    ar: "الدروس",
    en: "Lessons",
    search: ["title_ar", "title_en", "sectionId"],
    fields: [
      f("sectionId", "قسم الدورة", "Course section", "text", true),
      ...bilingual("title", "العنوان", "Title", false, false),
      position,
      f("kind", "النوع", "Type", "select", true, ["VIDEO", "ARTICLE"]),
      f("minutes", "الدقائق", "Minutes", "number"),
      f(
        "videoUrl",
        "رابط YouTube / Vimeo / Bunny",
        "YouTube / Vimeo / Bunny URL",
      ),
      f("videoFileId", "فيديو مرفوع", "Uploaded video"),
      ...bilingual("body", "المحتوى", "Content", true, false),
      published,
      f("notesEnabled", "الملاحظات", "Notes enabled", "boolean"),
    ],
  },
  attachments: {
    model: "lessonAttachment",
    ar: "ملفات الدروس",
    en: "Lesson attachments",
    search: ["labelAr", "labelEn", "lessonId"],
    fields: [
      f("lessonId", "الدرس", "Lesson", "text", true),
      f(
        "mediaAssetId",
        "الملف",
        "File",
        "text",
        true,
      ),
      f("labelAr", "العنوان العربي", "Arabic label"),
      f("labelEn", "العنوان الإنجليزي", "English label"),
      position,
    ],
  },
  exams: {
    model: "exam",
    ar: "الاختبارات",
    en: "Exams",
    search: ["title_ar", "title_en", "courseId"],
    fields: [
      f("courseId", "الدورة", "Course", "text", true),
      ...bilingual("title", "العنوان", "Title", false, false),
      ...bilingual("instructions", "التعليمات", "Instructions", true, false),
      position,
      published,
      f("isRequired", "مطلوب للشهادة", "Required for certificate", "boolean"),
      f(
        "passingBasisPoints",
        "درجة النجاح (%)",
        "Pass mark (%)",
        "percentage",
        true,
      ),
      f(
        "timeLimitMinutes",
        "الوقت بالدقائق",
        "Time limit in minutes",
        "number",
      ),
      f(
        "maximumAttempts",
        "الحد الأقصى للمحاولات",
        "Maximum attempts",
        "number",
      ),
    ],
  },
  questions: {
    model: "examQuestion",
    ar: "أسئلة الاختبارات",
    en: "Exam questions",
    search: ["prompt_ar", "prompt_en", "examId"],
    fields: [
      f("examId", "الاختبار", "Exam", "text", true),
      ...bilingual("prompt", "السؤال", "Question", true, false),
      ...bilingual("explanation", "التفسير", "Explanation", true, false),
      position,
      f("points", "النقاط", "Points", "number", true),
      f("kind", "النوع", "Type", "select", true, ["SINGLE_CHOICE"]),
    ],
  },
  options: {
    model: "questionOption",
    ar: "خيارات الإجابة",
    en: "Answer options",
    search: ["label_ar", "label_en", "questionId"],
    fields: [
      f("questionId", "السؤال", "Question", "text", true),
      ...bilingual("label", "الإجابة", "Answer", false, false),
      position,
      f("isCorrect", "إجابة صحيحة", "Correct answer", "boolean"),
    ],
  },
  coupons: {
    model: "coupon",
    ar: "القسائم",
    en: "Coupons",
    search: ["code"],
    fields: [
      f("code", "الرمز", "Code", "text", true),
      f("kind", "النوع", "Type", "select", true, [
        "PERCENTAGE",
        "FIXED_AMOUNT",
      ]),
      f(
        "percentageBasisPoints",
        "النسبة (%)",
        "Percentage (%)",
        "percentage",
      ),
      f("amountHalalas", "المبلغ بالريال السعودي", "Amount (SAR)", "money"),
      f(
        "minimumOrderHalalas",
        "الحد الأدنى بالريال السعودي",
        "Minimum order (SAR)",
        "money",
      ),
      f(
        "maximumDiscountHalalas",
        "أقصى خصم بالريال السعودي",
        "Maximum discount (SAR)",
        "money",
      ),
      f("usageLimit", "حد الاستخدام", "Usage limit", "number"),
      f("perUserLimit", "الحد لكل مستخدم", "Per-user limit", "number", true),
      f("isActive", "نشط", "Active", "boolean"),
      f("startsAt", "يبدأ", "Starts at", "date"),
      f("expiresAt", "ينتهي", "Expires at", "date"),
    ],
  },
  reviews: {
    model: "review",
    ar: "التقييمات",
    en: "Reviews",
    search: ["body", "userId", "courseId"],
    fields: [
      f("status", "الحالة", "Status", "select", true, [
        "PENDING",
        "APPROVED",
        "REJECTED",
      ]),
    ],
  },
  pages: {
    model: "page",
    ar: "الصفحات",
    en: "Pages",
    search: ["key", "title_ar", "title_en"],
    fields: [
      f(
        "key",
        "الرابط (about,privacy,terms,refund-policy)",
        "Path (about,privacy,terms,refund-policy)",
        "text",
        true,
      ),
      ...bilingual("title", "العنوان", "Title"),
      ...bilingual("body", "المحتوى", "Content", true),
      f("status", "الحالة", "Status", "select", true, ["DRAFT", "PUBLISHED"]),
    ],
  },
  blocks: {
    model: "contentBlock",
    ar: "أقسام الصفحة الرئيسية",
    en: "Homepage blocks",
    search: ["key", "title_ar", "title_en"],
    fields: [
      f("pageId", "الصفحة", "Page", "text", true),
      f("key", "المعرّف (hero)", "Key (hero)", "text", true),
      f("kind", "النوع", "Type", "text", true),
      ...bilingual("title", "العنوان", "Title"),
      ...bilingual("body", "المحتوى", "Content", true),
      position,
      f("settings", "إعدادات JSON", "JSON settings", "json", true),
    ],
  },
  faqs: {
    model: "faq",
    ar: "الأسئلة الشائعة",
    en: "FAQ",
    search: ["question_ar", "question_en", "key"],
    fields: [
      f("key", "المعرّف", "Key", "text", true),
      ...bilingual("question", "السؤال", "Question"),
      ...bilingual("answer", "الإجابة", "Answer", true),
      defaultPosition,
      published,
    ],
  },
  testimonials: {
    model: "testimonial",
    ar: "آراء المتعلمين",
    en: "Testimonials",
    search: ["name", "quote_ar", "quote_en"],
    fields: [
      f("name", "الاسم", "Name", "text", true),
      ...bilingual("quote", "الرأي", "Quote", true),
      f("source", "المصدر (SAMPLE للتجريبي)", "Source (SAMPLE for examples)"),
      f("consentAt", "تاريخ الموافقة", "Consent date", "date", true),
      defaultPosition,
      published,
    ],
  },
  settings: {
    model: "setting",
    ar: "إعدادات الموقع",
    en: "Site settings",
    identity: "key",
    search: ["key"],
    fields: [
      f("key", "المفتاح", "Key", "text", true),
      f(
        "value",
        "القيمة JSON (النص بين علامتي اقتباس)",
        "JSON value (quote strings)",
        "json",
        true,
      ),
    ],
  },
  users: {
    model: "user",
    ar: "المستخدمون",
    en: "Users",
    search: ["name", "email"],
    readonly: true,
    fields: [],
  },
  orders: {
    model: "order",
    ar: "الطلبات",
    en: "Orders",
    search: ["number", "buyerEmail", "buyerName"],
    readonly: true,
    fields: [],
  },
  contacts: {
    model: "contactMessage",
    ar: "الرسائل",
    en: "Contact messages",
    search: ["name", "email", "subject"],
    fields: [
      f("status", "الحالة", "Status", "select", true, [
        "NEW",
        "READ",
        "RESOLVED",
      ]),
    ],
  },
  audit: {
    model: "auditLog",
    ar: "سجل التدقيق",
    en: "Audit log",
    search: ["action", "entityType", "entityId"],
    readonly: true,
    fields: [],
  },
  jobs: {
    model: "backgroundJob",
    ar: "تسليم البريد",
    en: "Email delivery",
    search: ["kind", "status"],
    readonly: true,
    fields: [],
  },
  tags: {
    model: "tag",
    ar: "الوسوم",
    en: "Tags",
    search: ["key", "title_ar", "title_en"],
    fields: [
      f("key", "المعرّف", "Key", "text", true),
      ...bilingual("title", "العنوان", "Title"),
    ],
  },
};

// Display readable bilingual labels while keeping stable database values.
const valueNames: Record<string, [string, string]> = {
  ar: ['العربية', 'Arabic'],
  en: ['الإنجليزية', 'English'],
  'ar,en': ['العربية والإنجليزية', 'Arabic and English'],
  DRAFT: ["مسودة", "Draft"],
  PUBLISHED: ["منشور", "Published"],
  ARCHIVED: ["مؤرشف", "Archived"],
  BEGINNER: ["مبتدئ", "Beginner"],
  INTERMEDIATE: ["متوسط", "Intermediate"],
  ALL_LEVELS: ["جميع المستويات", "All levels"],
  VIDEO: ["فيديو", "Video"],
  ARTICLE: ["مقال", "Article"],
  SINGLE_CHOICE: ["اختيار واحد", "Single choice"],
  PERCENTAGE: ["نسبة مئوية", "Percentage"],
  FIXED_AMOUNT: ["مبلغ ثابت", "Fixed amount"],
  PENDING: ["قيد الانتظار", "Pending"],
  APPROVED: ["معتمد", "Approved"],
  REJECTED: ["مرفوض", "Rejected"],
  PAID: ["مدفوع", "Paid"],
  REFUNDED: ["مسترد", "Refunded"],
  CANCELLED: ["ملغى", "Cancelled"],
  EXPIRED: ["منتهي", "Expired"],
  ACTIVE: ["نشط", "Active"],
  BANNED: ["محظور", "Banned"],
  NEW: ["جديد", "New"],
  READ: ["مقروء", "Read"],
  RESOLVED: ["تم الحل", "Resolved"],
  RUNNING: ["جارٍ التنفيذ", "Running"],
  SUCCEEDED: ["مكتمل", "Succeeded"],
  FAILED: ["فشل", "Failed"],
  sky: ["أزرق سماوي", "Sky blue"],
  gold: ["ذهبي", "Gold"],
  navy: ["كحلي", "Navy"],
  sage: ["أخضر هادئ", "Sage"],
};
export function adminValueLabel(value: string, arabic: boolean) {
  return valueNames[value]?.[arabic ? 0 : 1] || value;
}
export const adminStatusChoices: Record<string, string[]> = {
  courses: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  pages: ["DRAFT", "PUBLISHED"],
  users: ["ACTIVE", "BANNED"],
  orders: ["PENDING", "PAID", "REFUNDED", "CANCELLED", "EXPIRED"],
  reviews: ["PENDING", "APPROVED", "REJECTED"],
  contacts: ["NEW", "READ", "RESOLVED"],
  jobs: ["PENDING", "RUNNING", "SUCCEEDED", "FAILED"],
};
