/**
 * Seed-only exam material. Never import this file from application UI or API payloads.
 * Learner questions must be selected without correctOption or explanation until
 * the attempt has been submitted and grading has completed.
 */
import type { LocalizedText } from '../src/content/catalog';

export type ExamQuestion = {
  id: string;
  prompt: LocalizedText;
  explanation: LocalizedText;
  options: LocalizedText[];
  /** Zero-based index in options. Never send this field in a learner exam payload. */
  correctOption: number;
};

const t = (ar: string, en: string): LocalizedText => ({ ar, en });

export const demoExamQuestions: Record<string, ExamQuestion[]> = {
  'design-exam-principles': [
    {
      id: 'design-q-hierarchy', prompt: t('ما أفضل طريقة لإبراز عنوان بطاقة دورة؟', 'What is the best way to emphasize a course card’s heading?'),
      options: [t('جعل جميع النصوص بالحجم نفسه', 'Make every text element the same size'), t('استخدام حجم ووزن واضحين مع مساحة مناسبة', 'Use a clear size and weight with appropriate spacing'), t('إضافة خمسة ألوان مختلفة', 'Add five different colors')], correctOption: 1,
      explanation: t('يساعد اختلاف الحجم والوزن والمسافة على بناء تسلسل بصري واضح.', 'Differences in size, weight, and spacing establish a clear visual hierarchy.'),
    },
    {
      id: 'design-q-contrast', prompt: t('كيف نجعل حالة الخطأ مفهومة لمن لا يميّز اللون الأحمر؟', 'How can an error state be understood by someone who cannot distinguish red?'),
      options: [t('إضافة رسالة نصية ورمز واضح مع اللون', 'Add a clear text message and icon alongside color'), t('استخدام الأحمر فقط', 'Use red alone'), t('إخفاء الرسالة', 'Hide the message')], correctOption: 0,
      explanation: t('النص والرمز يقدمان معنى مستقلًا عن اللون، مما يحسن إمكانية الوصول.', 'Text and an icon communicate meaning independently of color, improving accessibility.'),
    },
    {
      id: 'design-q-type', prompt: t('ما الذي يجب فحصه عند استخدام خط واحد للعربية والإنجليزية؟', 'What should you check when using one typeface for Arabic and English?'),
      options: [t('اسم الخط فقط', 'Only the typeface name'), t('عدد ألوان الصفحة', 'The number of page colors'), t('دعم الحروف ووضوحها والتفاف النص في اللغتين', 'Character support, readability, and text wrapping in both languages')], correctOption: 2,
      explanation: t('قد يختلف عرض الحروف وارتفاعها بين اللغتين، لذا يلزم اختبارهما في السياق نفسه.', 'Character widths and heights can differ between languages, so both need testing in the same context.'),
    },
  ],
  'design-exam-project': [
    {
      id: 'design-q-brief', prompt: t('ما أول خطوة قبل تصميم بطاقة دورة؟', 'What is the first step before designing a course card?'),
      options: [t('اختيار الظل', 'Choose a shadow'), t('تحديد الهدف والجمهور والمحتوى', 'Define the goal, audience, and content'), t('تصدير الصورة', 'Export the image')], correctOption: 1,
      explanation: t('يوجه الموجز قرارات التصميم ويحدد المعلومات والإجراء المطلوب.', 'The brief guides design decisions and defines the content and requested action.'),
    },
    {
      id: 'design-q-grid', prompt: t('لماذا نستخدم هوامش متسقة في مجموعة بطاقات؟', 'Why use consistent margins across a group of cards?'),
      options: [t('لتحسين التنظيم وسهولة المقارنة', 'To improve organization and make comparison easier'), t('لمنع تغيير المحتوى', 'To prevent content changes'), t('لزيادة عدد الألوان', 'To increase the number of colors')], correctOption: 0,
      explanation: t('يساعد الاتساق في المسافات على القراءة والمقارنة بين العناصر.', 'Consistent spacing helps people read and compare items.'),
    },
    {
      id: 'design-q-review', prompt: t('أي مراجعة أهم قبل تسليم البطاقة؟', 'Which review matters before handing off the card?'),
      options: [t('فحصها بالحجم الكامل فقط', 'Inspect it only at full size'), t('التأكد من عدد الطبقات فقط', 'Check only the number of layers'), t('فحص القراءة والتباين والتخطيط على أحجام مختلفة', 'Check readability, contrast, and layout at different sizes')], correctOption: 2,
      explanation: t('يستخدم المتعلمون أجهزة مختلفة؛ يجب أن يظل المحتوى واضحًا في كل تخطيط.', 'Learners use different devices, so the content needs to remain clear in each layout.'),
    },
  ],
  'web-exam-structure': [
    {
      id: 'web-q-button', prompt: t('أي عنصر مناسب لتنفيذ إجراء داخل الصفحة؟', 'Which element is appropriate for performing an action on the page?'),
      options: [t('button', 'button'), t('div بلا سلوك إضافي', 'A div without additional behavior'), t('عنوان h1', 'An h1 heading')], correctOption: 0,
      explanation: t('يدعم button التفاعل بلوحة المفاتيح ويعبر دلاليًا عن الإجراء.', 'A button supports keyboard interaction and semantically represents an action.'),
    },
    {
      id: 'web-q-padding', prompt: t('ما الخاصية التي تضيف مساحة داخل حدود العنصر؟', 'Which property adds space inside an element’s border?'),
      options: [t('margin', 'margin'), t('padding', 'padding'), t('position', 'position')], correctOption: 1,
      explanation: t('تضيف padding مساحة داخل العنصر، بينما تضيف margin مساحة حوله.', 'Padding adds space inside the element, while margin adds space around it.'),
    },
    {
      id: 'web-q-label', prompt: t('لماذا نربط حقل الإدخال بعنصر label؟', 'Why associate an input with a label element?'),
      options: [t('لإخفاء الحقل', 'To hide the field'), t('لزيادة سرعة الإنترنت', 'To increase internet speed'), t('لتوضيح وظيفته ودعم أدوات الوصول', 'To explain its purpose and support assistive technology')], correctOption: 2,
      explanation: t('تمنح التسمية الحقل اسمًا مفهومًا للمتعلم ولقارئات الشاشة.', 'A label gives the field a meaningful name for learners and screen readers.'),
    },
  ],
  'web-exam-interaction': [
    {
      id: 'web-q-rtl', prompt: t('ما الخيار الأنسب لهامش يتبع اتجاه اللغة؟', 'Which is the best choice for a margin that follows text direction?'),
      options: [t('margin-left دائمًا', 'Always margin-left'), t('margin-inline-start', 'margin-inline-start'), t('عرض ثابت للصفحة', 'A fixed page width')], correctOption: 1,
      explanation: t('تتكيف الخصائص المنطقية مع الاتجاه بدل ربط التخطيط باليمين أو اليسار.', 'Logical properties adapt to direction instead of fixing layout to the left or right.'),
    },
    {
      id: 'web-q-empty', prompt: t('كيف تستجيب الواجهة عند عدم وجود دورات تطابق المرشح؟', 'How should the interface respond when no courses match a filter?'),
      options: [t('تعرض رسالة واضحة وخيارًا لتعديل المرشح', 'Show a clear message and an option to change the filter'), t('تترك الشاشة فارغة', 'Leave the screen empty'), t('تغير السعر تلقائيًا', 'Automatically change the price')], correctOption: 0,
      explanation: t('تشرح الحالة الفارغة سبب غياب المحتوى وتساعد المتعلم على الخطوة التالية.', 'An empty state explains why content is absent and helps the learner take the next step.'),
    },
    {
      id: 'web-q-keyboard', prompt: t('كيف نتحقق عمليًا من قابلية استخدام شريط التنقل بلوحة المفاتيح؟', 'How can you practically check whether navigation works with a keyboard?'),
      options: [t('تغيير لون الخلفية', 'Change the background color'), t('فحص لقطة شاشة فقط', 'Inspect only a screenshot'), t('التنقل بـ Tab وتفعيل الروابط والأزرار', 'Navigate with Tab and activate links and buttons')], correctOption: 2,
      explanation: t('يكشف الاختبار الفعلي ترتيب التركيز ووضوحه وإمكانية تشغيل العناصر.', 'A hands-on test reveals focus order, focus visibility, and whether controls can be activated.'),
    },
  ],
  'business-exam-validation': [
    {
      id: 'business-q-interview', prompt: t('أي سؤال يقدم دليلًا أفضل على مشكلة العميل؟', 'Which question gives better evidence about a customer’s problem?'),
      options: [t('ألا تبدو فكرتي رائعة؟', 'Doesn’t my idea sound great?'), t('حدثني عن آخر مرة واجهت فيها هذه المشكلة', 'Tell me about the last time you faced this problem'), t('هل تحب شعار المشروع؟', 'Do you like the business logo?')], correctOption: 1,
      explanation: t('التجربة الفعلية تكشف السلوك والسياق دون دفع العميل إلى إجابة مرغوبة.', 'A real experience reveals behavior and context without nudging the customer toward a desired answer.'),
    },
    {
      id: 'business-q-assumption', prompt: t('ما الذي يجعل التجربة الأولية مفيدة؟', 'What makes a first experiment useful?'),
      options: [t('افتراض محدد ومعيار نجاح مسبق', 'A specific assumption and a success criterion set beforehand'), t('ميزانية مفتوحة', 'An unlimited budget'), t('عدد كبير من المزايا بلا هدف', 'Many features without a goal')], correctOption: 0,
      explanation: t('يساعد التحديد المسبق على تفسير النتائج واتخاذ قرار واضح بعدها.', 'Setting criteria beforehand helps interpret the results and make a clear decision afterward.'),
    },
    {
      id: 'business-q-value', prompt: t('ما العناصر الأساسية لعرض القيمة؟', 'What are the essential parts of a value proposition?'),
      options: [t('لون الشعار والخط', 'Logo color and typeface'), t('عدد الموظفين فقط', 'Only the number of employees'), t('الجمهور والمشكلة والنتيجة المقترحة', 'The audience, problem, and proposed result')], correctOption: 2,
      explanation: t('يربط عرض القيمة ما تقدمه بحاجة واضحة لدى جمهور محدد.', 'A value proposition connects the offer to a clear need for a specific audience.'),
    },
  ],
  'business-exam-economics': [
    {
      id: 'business-q-margin', prompt: t('سعر الخدمة 200 ر.س وتكلفتها المتغيرة 80 ر.س. كم هامش المساهمة؟', 'A service costs SAR 200 and has a variable cost of SAR 80. What is its contribution margin?'),
      options: [t('120 ر.س', 'SAR 120'), t('280 ر.س', 'SAR 280'), t('80 ر.س', 'SAR 80')], correctOption: 0,
      explanation: t('هامش المساهمة = سعر البيع ناقص التكلفة المتغيرة: 200 − 80 = 120 ر.س.', 'Contribution margin equals selling price minus variable cost: 200 − 80 = SAR 120.'),
    },
    {
      id: 'business-q-break-even', prompt: t('التكاليف الثابتة 1,200 ر.س وهامش المساهمة 120 ر.س لكل طلب. كم طلبًا نحتاج للتعادل؟', 'Fixed costs are SAR 1,200 and contribution margin is SAR 120 per order. How many orders are needed to break even?'),
      options: [t('طلبان', '2 orders'), t('10 طلبات', '10 orders'), t('120 طلبًا', '120 orders')], correctOption: 1,
      explanation: t('نقسم 1,200 على 120، فنحتاج إلى 10 طلبات وفق هذه الافتراضات.', 'Divide 1,200 by 120: 10 orders are needed under these assumptions.'),
    },
    {
      id: 'business-q-metric', prompt: t('أي مؤشر أقرب لقياس نجاح تجربة بيع أولية؟', 'Which metric is more relevant to an initial sales experiment?'),
      options: [t('عدد الألوان في الشعار', 'The number of colors in the logo'), t('عدد الملفات على الكمبيوتر', 'The number of files on the computer'), t('عدد الطلبات المدفوعة من الجمهور المستهدف', 'The number of paid orders from the target audience')], correctOption: 2,
      explanation: t('تقيس الطلبات المدفوعة سلوك الشراء الفعلي، مع أهمية فهم التكلفة والسياق.', 'Paid orders measure actual buying behavior, while cost and context still matter.'),
    },
  ],
  'photo-exam-light': [
    {
      id: 'photo-q-light', prompt: t('كيف نخفف ظلًا قويًا على جانب المنتج قرب النافذة؟', 'How can you soften a strong shadow on the side of a product near a window?'),
      options: [t('باستخدام ورقة بيضاء لعكس الضوء', 'Use white paper to reflect light'), t('بزيادة المرشحات اللونية فقط', 'Only add more color filters'), t('بتغطية العدسة', 'Cover the lens')], correctOption: 0,
      explanation: t('تعكس الورقة البيضاء جزءًا من الضوء نحو الجانب المظلل وتخفف التباين.', 'White paper reflects some light toward the shadowed side and reduces contrast.'),
    },
    {
      id: 'photo-q-background', prompt: t('ما وظيفة الخلفية البسيطة في صورة منتج؟', 'What does a simple background do in a product photograph?'),
      options: [t('إخفاء المنتج', 'Hide the product'), t('توجيه الانتباه إلى المنتج', 'Direct attention to the product'), t('زيادة التشويش', 'Increase visual noise')], correctOption: 1,
      explanation: t('تقلل الخلفية الهادئة العناصر التي تنافس موضوع الصورة.', 'A calm background reduces elements that compete with the subject.'),
    },
    {
      id: 'photo-q-stability', prompt: t('ما إجراء عملي لتحسين حدة الصورة في إضاءة ضعيفة؟', 'What is a practical way to improve image sharpness in low light?'),
      options: [t('تحريك الهاتف أثناء الالتقاط', 'Move the phone during capture'), t('استخدام التقريب الرقمي دائمًا', 'Always use digital zoom'), t('تثبيت الهاتف وتحسين الضوء المتاح', 'Stabilize the phone and improve available light')], correctOption: 2,
      explanation: t('يقلل التثبيت اهتزاز الكاميرا، وقد تسمح الإضاءة الأفضل بزمن تعريض أقصر.', 'Stability reduces camera shake, and better light can allow a shorter exposure time.'),
    },
  ],
  'photo-exam-story': [
    {
      id: 'photo-q-edit', prompt: t('ما الهدف من تعديل صورة منتج؟', 'What is the goal of editing a product photograph?'),
      options: [t('تغيير لون المنتج ليبدو أغلى', 'Change the product’s color to make it look more expensive'), t('تحسين الوضوح مع الحفاظ على مظهر المنتج الحقيقي', 'Improve clarity while preserving the product’s real appearance'), t('إخفاء كل التفاصيل', 'Hide all details')], correctOption: 1,
      explanation: t('يجب أن يحسن التعديل جودة العرض دون تقديم صورة مضللة عن المنتج.', 'Editing should improve presentation without creating a misleading picture of the product.'),
    },
    {
      id: 'photo-q-original', prompt: t('لماذا نحتفظ بنسخة الصورة الأصلية؟', 'Why keep the original image file?'),
      options: [t('للعودة إليها وإنشاء نسخ بأبعاد مختلفة', 'To return to it and make versions with different dimensions'), t('لمنع نشر الصورة نهائيًا', 'To prevent the image from ever being published'), t('لإلغاء الحاجة إلى النسخ الاحتياطي', 'To remove the need for backups')], correctOption: 0,
      explanation: t('تتيح النسخة الأصلية تعديلًا جديدًا دون الاعتماد على ملف سبق ضغطه أو قصه.', 'The original allows new edits without relying on a file that has already been compressed or cropped.'),
    },
    {
      id: 'photo-q-alt', prompt: t('أي وصف بديل أنسب لصورة حقيبة زرقاء على طاولة؟', 'Which alternative text best suits a photo of a blue bag on a table?'),
      options: [t('صورة', 'Image'), t('أفضل منتج في العالم', 'The best product in the world'), t('حقيبة زرقاء بمقبض جلدي على طاولة خشبية', 'Blue bag with a leather handle on a wooden table')], correctOption: 2,
      explanation: t('يصف النص البديل المعلومات البصرية المهمة بوضوح ودون عبارات تسويقية غير مفيدة.', 'Alternative text clearly describes meaningful visual information without unhelpful marketing claims.'),
    },
  ]
};
