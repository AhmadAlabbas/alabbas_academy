/**
 * Bilingual demonstration catalog for development and seed data.
 * All instructors are fictional sample personas. The lessons below do not
 * claim access to a licensed video library; video URLs are intentionally absent.
 * Store prices in integer halalas (100 halalas = 1 SAR).
 */
export type Locale = 'ar' | 'en';
export type LocalizedText = { ar: string; en: string };
export type CategoryTone = 'sky' | 'gold' | 'navy' | 'rose';
export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ALL_LEVELS';
export type CourseCover = 'design' | 'code' | 'business' | 'photo';

export type Category = {
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  tone: CategoryTone;
};

export type Instructor = {
  id: string;
  name: LocalizedText;
  bio: LocalizedText;
  initials: string;
};

export type Course = {
  id: string;
  slug: LocalizedText;
  title: LocalizedText;
  description: LocalizedText;
  categorySlug: string;
  instructorId: string;
  level: CourseLevel;
  priceHalalas: number;
  minutes: number;
  lessonCount: number;
  cover: CourseCover;
  featured: boolean;
};

export type Lesson = {
  id: string;
  title: LocalizedText;
  minutes: number;
  preview: boolean;
  videoUrl?: string;
  body?: LocalizedText;
};

export type CourseExam = {
  id: string;
  title: LocalizedText;
  passPercent: number;
  questionCount: number;
};

export type CourseSection = {
  id: string;
  title: LocalizedText;
  lessons: Lesson[];
  exam: CourseExam;
};

const t = (ar: string, en: string): LocalizedText => ({ ar, en });

export const categories: Category[] = [
  {
    slug: 'design',
    title: t('التصميم', 'Design'),
    description: t('حوّل الأفكار إلى تجارب بصرية واضحة وجذابة.', 'Turn ideas into clear, compelling visual experiences.'),
    tone: 'gold',
  },
  {
    slug: 'technology',
    title: t('التقنية والبرمجة', 'Technology & code'),
    description: t('ابنِ مهارات عملية لتصميم المواقع وتطويرها.', 'Build practical skills for designing and developing websites.'),
    tone: 'sky',
  },
  {
    slug: 'business',
    title: t('الأعمال', 'Business'),
    description: t('اختبر فكرتك وخطّط لمشروعك بخطوات قابلة للتطبيق.', 'Test your idea and plan your business with actionable steps.'),
    tone: 'navy',
  },
  {
    slug: 'photography',
    title: t('التصوير', 'Photography'),
    description: t('احكِ قصتك بالضوء والتكوين، باستخدام الأدوات المتاحة لديك.', 'Tell your story through light and composition, using the tools you have.'),
    tone: 'rose',
  },
];

export const instructors: Instructor[] = [
  {
    id: 'instructor-noura',
    name: t('نورة العتيبي', 'Noura Alotaibi'),
    bio: t('شخصية تعليمية تجريبية في محتوى الأكاديمية، متخصصة في أساسيات التصميم والهوية البصرية.', 'A fictional instructor for the academy’s sample content, specializing in visual design and brand foundations.'),
    initials: 'NA',
  },
  {
    id: 'instructor-faisal',
    name: t('فيصل السالم', 'Faisal Alsalem'),
    bio: t('شخصية تعليمية تجريبية في محتوى الأكاديمية، متخصصة في تطوير واجهات الويب وإمكانية الوصول.', 'A fictional instructor for the academy’s sample content, specializing in web interfaces and accessibility.'),
    initials: 'FA',
  },
  {
    id: 'instructor-sara',
    name: t('سارة الدوسري', 'Sara Aldossari'),
    bio: t('شخصية تعليمية تجريبية في محتوى الأكاديمية، متخصصة في اختبار أفكار المشاريع والتخطيط المالي الأولي.', 'A fictional instructor for the academy’s sample content, specializing in business validation and early financial planning.'),
    initials: 'SA',
  },
  {
    id: 'instructor-abdullah',
    name: t('عبدالله الحربي', 'Abdullah Alharbi'),
    bio: t('شخصية تعليمية تجريبية في محتوى الأكاديمية، متخصصة في تصوير المنتجات والسرد البصري.', 'A fictional instructor for the academy’s sample content, specializing in product photography and visual storytelling.'),
    initials: 'AH',
  },
];

export const sampleCurricula: Record<string, CourseSection[]> = {
  'course-design-foundations': [
    {
      id: 'design-section-principles',
      title: t('لغة التصميم البصري', 'The language of visual design'),
      lessons: [
        {
          id: 'design-lesson-observation', title: t('كيف نقرأ التصميم؟', 'How do we read a design?'), minutes: 12, preview: true,
          body: t('اختر إعلانًا بسيطًا وحدد الرسالة الرئيسية والجمهور المقصود. لاحظ أول عنصر تراه، ثم قارن ترتيب العناصر بهدف الإعلان.', 'Choose a simple advertisement and identify its main message and intended audience. Notice the first element you see, then compare the order of elements with the advertisement’s purpose.'),
        },
        {
          id: 'design-lesson-hierarchy', title: t('التسلسل البصري والمساحات', 'Visual hierarchy and spacing'), minutes: 18, preview: false,
          body: t('ابنِ ثلاثة مستويات واضحة: عنوان رئيسي، معلومات مساندة، وإجراء مطلوب. استخدم الحجم والمسافة والتباين لتوجيه القراءة بدلًا من تكبير كل العناصر.', 'Create three clear levels: a main heading, supporting information, and a requested action. Use size, spacing, and contrast to guide reading instead of enlarging every element.'),
        },
        {
          id: 'design-lesson-color', title: t('الألوان والتباين', 'Color and contrast'), minutes: 20, preview: false,
          body: t('اختر لونًا رئيسيًا ولونًا مساعدًا وخلفية هادئة. افحص تباين النص والخلفية، ولا تعتمد على اللون وحده لتوصيل حالة أو معلومة.', 'Choose a primary color, a supporting color, and a calm background. Check text contrast against the background, and do not rely on color alone to convey status or meaning.'),
        },
        {
          id: 'design-lesson-type', title: t('الخط العربي والإنجليزي', 'Arabic and English typography'), minutes: 22, preview: false,
          body: t('جرّب خطًا واضحًا للنصوص وآخر للعناوين عند الحاجة. اضبط حجم النص وارتفاع السطر، وافحص التفاف النص في اللغتين على شاشة صغيرة.', 'Try a readable body typeface and a heading typeface when needed. Adjust size and line height, and inspect text wrapping in both languages on a small screen.'),
        },
      ],
      exam: {
        id: 'design-exam-principles', title: t('اختبار مبادئ التصميم', 'Design principles check'), passPercent: 70,
        questionCount: 3,
      },
    },
    {
      id: 'design-section-project', title: t('من الفكرة إلى بطاقة جاهزة', 'From idea to a finished card'),
      lessons: [
        {
          id: 'design-lesson-brief', title: t('كتابة موجز تصميم', 'Writing a design brief'), minutes: 15, preview: false,
          body: t('اكتب هدف البطاقة وجمهورها ومحتواها الأساسي وقيودها. حدد الإجراء الذي تريد من القارئ اتخاذه قبل اختيار الألوان والصور.', 'Write down the card’s goal, audience, core content, and constraints. Decide what action the reader should take before selecting colors and images.'),
        },
        {
          id: 'design-lesson-grid', title: t('الشبكات والمحاذاة', 'Grids and alignment'), minutes: 24, preview: false,
          body: t('استخدم شبكة بسيطة وهوامش متسقة لتوزيع المحتوى. جرّب البطاقة في صف من ثلاث بطاقات وتأكد من وضوح العناوين والأسعار.', 'Use a simple grid and consistent margins to place content. Try the card in a row of three cards and check that titles and prices remain clear.'),
        },
        {
          id: 'design-lesson-card', title: t('مشروع: بطاقة دورة ثنائية اللغة', 'Project: a bilingual course card'), minutes: 28, preview: false,
          body: t('صمم بطاقة تحتوي على عنوان ووصف مختصر وصورة وسعر بالريال السعودي. أنشئ نسختين للعربية والإنجليزية مع الحفاظ على ترتيب معلومات واضح.', 'Design a card with a heading, short description, image, and price in Saudi riyals. Make Arabic and English versions with a clear information order.'),
        },
        {
          id: 'design-lesson-review', title: t('مراجعة التصميم وتسليمه', 'Reviewing and handing off a design'), minutes: 16, preview: false,
          body: t('راجع التباين والمحاذاة وأحجام النصوص على الهاتف. وثق الألوان والمسافات وحالات الأزرار حتى يستطيع المطور تنفيذ التصميم بدقة.', 'Review contrast, alignment, and text sizes on a phone. Document colors, spacing, and button states so a developer can implement the design accurately.'),
        },
      ],
      exam: {
        id: 'design-exam-project', title: t('اختبار تطبيق التصميم', 'Design application check'), passPercent: 70,
        questionCount: 3,
      },
    },
  ],
  'course-web-foundations': [
    {
      id: 'web-section-structure', title: t('بناء واجهة واضحة', 'Building a clear interface'),
      lessons: [
        {
          id: 'web-lesson-tools', title: t('أدواتك وأول صفحة ويب', 'Your tools and first web page'), minutes: 16, preview: true,
          body: t('جهز محرر نصوص ومتصفحًا وأنشئ ملف HTML محليًا. ابدأ بعنوان وفقرة ثم افحص الصفحة بأدوات المطور لمعرفة العلاقة بين الكود والمحتوى.', 'Prepare a text editor and browser, then create a local HTML file. Start with a heading and paragraph, and inspect the page with developer tools to understand how code relates to content.'),
        },
        {
          id: 'web-lesson-html', title: t('HTML الدلالي والنماذج', 'Semantic HTML and forms'), minutes: 24, preview: false,
          body: t('استخدم عناصر تصف وظيفة المحتوى مثل header وmain وbutton. اربط كل حقل نموذج بتسمية واضحة واختبر الانتقال بين الحقول بلوحة المفاتيح.', 'Use elements that describe content roles, such as header, main, and button. Give each form field a clear label and test moving between fields with the keyboard.'),
        },
        {
          id: 'web-lesson-css', title: t('أساسيات CSS والمسافات', 'CSS and spacing foundations'), minutes: 26, preview: false,
          body: t('عرف متغيرات للألوان والمسافات ثم طبقها على بطاقة بسيطة. قارن بين padding داخل العنصر وmargin حوله لفهم نموذج الصندوق.', 'Define variables for colors and spacing, then apply them to a simple card. Compare padding inside an element with margin around it to understand the box model.'),
        },
        {
          id: 'web-lesson-layout', title: t('التخطيط باستخدام Grid وFlexbox', 'Layouts with Grid and Flexbox'), minutes: 30, preview: false,
          body: t('استخدم Grid لشبكة البطاقات وFlexbox لترتيب عناصر شريط التنقل. اجعل الأعمدة تتكيف مع عرض الشاشة بدل الاعتماد على عرض ثابت لكل جهاز.', 'Use Grid for the card collection and Flexbox for navigation items. Let columns adapt to screen width instead of relying on fixed widths for each device.'),
        },
      ],
      exam: {
        id: 'web-exam-structure', title: t('اختبار HTML وCSS', 'HTML and CSS check'), passPercent: 70,
        questionCount: 3,
      },
    },
    {
      id: 'web-section-interaction', title: t('التفاعل والتصميم المتجاوب', 'Interaction and responsive design'),
      lessons: [
        {
          id: 'web-lesson-js', title: t('JavaScript: الأحداث وحالة الواجهة', 'JavaScript: events and interface state'), minutes: 28, preview: false,
          body: t('أضف مرشحًا للتصنيفات يستجيب للنقر ويحدث البطاقات المعروضة. افصل بيانات الدورات عن عناصر الصفحة لتسهيل تغيير المحتوى لاحقًا.', 'Add a category filter that responds to clicks and updates visible cards. Separate course data from page elements so content can be changed more easily later.'),
        },
        {
          id: 'web-lesson-responsive', title: t('واجهات مناسبة للهاتف', 'Interfaces that work on phones'), minutes: 22, preview: false,
          body: t('ابدأ بتخطيط عمود واحد ثم وسعه عندما تسمح المساحة. اختبر تكبير النص والأزرار الطويلة والعناوين العربية قبل إضافة نقاط توقف جديدة.', 'Start with a single-column layout and expand it when space allows. Test enlarged text, long buttons, and Arabic headings before adding new breakpoints.'),
        },
        {
          id: 'web-lesson-rtl', title: t('العربية واتجاه RTL', 'Arabic and RTL layouts'), minutes: 24, preview: false,
          body: t('حدد lang وdir على المستند واستخدم خصائص CSS المنطقية مثل margin-inline-start. افحص اتجاه الأيقونات مع إبقاء الأرقام والروابط مفهومة.', 'Set lang and dir on the document and use logical CSS properties such as margin-inline-start. Check directional icons while keeping numbers and links understandable.'),
        },
        {
          id: 'web-lesson-project', title: t('مشروع: معرض دورات متجاوب', 'Project: a responsive course catalog'), minutes: 35, preview: false,
          body: t('اجمع صفحة تحتوي على بطاقات ومرشح تصنيف ورسالة عند غياب النتائج. اختبرها بلوحة المفاتيح وعلى الهاتف، ووثق أي تحسينات تحتاجها.', 'Assemble a page with cards, a category filter, and a message when no results match. Test it with the keyboard and on a phone, and document needed improvements.'),
        },
      ],
      exam: {
        id: 'web-exam-interaction', title: t('اختبار التفاعل وإمكانية الوصول', 'Interaction and accessibility check'), passPercent: 70,
        questionCount: 3,
      },
    },
  ],
  'course-business-launch': [
    {
      id: 'business-section-validation', title: t('من المشكلة إلى فكرة قابلة للاختبار', 'From a problem to a testable idea'),
      lessons: [
        {
          id: 'business-lesson-problem', title: t('اختيار مشكلة تستحق الحل', 'Choosing a problem worth solving'), minutes: 14, preview: true,
          body: t('حدد جمهورًا واضحًا ومشكلة متكررة في يومه. اكتب ما يفعله الجمهور اليوم لحلها دون افتراض أن فكرتك هي الحل الأفضل.', 'Identify a clear audience and a recurring problem in their day. Write down how they solve it today without assuming your idea is the best solution.'),
        },
        {
          id: 'business-lesson-interviews', title: t('مقابلات العملاء دون توجيه الإجابات', 'Customer interviews without leading questions'), minutes: 22, preview: false,
          body: t('اسأل عن تجربة حديثة: ماذا حدث، وما التكلفة، وكيف تصرف العميل؟ تجنب سؤال «هل ستشتري فكرتي؟» وسجل أمثلة فعلية بدل المجاملات.', 'Ask about a recent experience: what happened, what it cost, and what the customer did. Avoid asking “Would you buy my idea?” and record concrete examples instead of compliments.'),
        },
        {
          id: 'business-lesson-value', title: t('صياغة عرض القيمة', 'Writing a value proposition'), minutes: 20, preview: false,
          body: t('اكتب لمن تقدم الخدمة، وما المشكلة التي تخففها، وما النتيجة المتوقعة. قارن العرض بالبدائل الحالية وحدد افتراضًا واحدًا يمكن اختباره.', 'Describe whom the service is for, the problem it reduces, and the expected result. Compare the offer with current alternatives and identify one assumption you can test.'),
        },
        {
          id: 'business-lesson-test', title: t('تصميم تجربة أولية صغيرة', 'Designing a small first experiment'), minutes: 26, preview: false,
          body: t('اختر تجربة محدودة مثل صفحة تعريف أو خدمة يدوية لعدد صغير من العملاء. حدد معيار نجاح وميزانية ومدة قبل التنفيذ، ولا تجمع بيانات أكثر من حاجتك.', 'Choose a limited experiment such as a landing page or a manually delivered service for a small group. Set a success criterion, budget, and time limit first, and collect only the data you need.'),
        },
      ],
      exam: {
        id: 'business-exam-validation', title: t('اختبار فهم العميل', 'Customer understanding check'), passPercent: 70,
        questionCount: 3,
      },
    },
    {
      id: 'business-section-economics', title: t('الأرقام وخطة الإطلاق', 'The numbers and launch plan'),
      lessons: [
        {
          id: 'business-lesson-costs', title: t('التكاليف الثابتة والمتغيرة', 'Fixed and variable costs'), minutes: 23, preview: false,
          body: t('قسم التكاليف إلى ثابتة مثل الاشتراك الشهري ومتغيرة مثل تكلفة تنفيذ الطلب. استخدم الريال السعودي وسجل افتراضاتك بجانب كل رقم.', 'Separate fixed costs such as a monthly subscription from variable costs such as fulfilling an order. Use Saudi riyals and record your assumptions beside each number.'),
        },
        {
          id: 'business-lesson-pricing', title: t('التسعير ونقطة التعادل', 'Pricing and the break-even point'), minutes: 28, preview: false,
          body: t('احسب هامش المساهمة بطرح التكلفة المتغيرة من سعر البيع. قسم التكاليف الثابتة على هذا الهامش لتقدير عدد الطلبات اللازم للتعادل، مع توضيح ما إذا كانت الضرائب داخلة في الأرقام.', 'Calculate contribution margin by subtracting variable cost from the selling price. Divide fixed costs by that margin to estimate the orders needed to break even, clearly stating whether the figures include taxes.'),
        },
        {
          id: 'business-lesson-launch', title: t('خطة إطلاق لمدة 30 يومًا', 'A 30-day launch plan'), minutes: 24, preview: false,
          body: t('وزع الخطة على اختبار العرض وتجهيز الخدمة والوصول للعملاء والمراجعة. اختر مؤشرًا واحدًا لكل مرحلة، وتحقق من المتطلبات النظامية المناسبة لنشاطك عبر الجهات الرسمية.', 'Split the plan into testing the offer, preparing delivery, reaching customers, and reviewing results. Choose one metric for each stage, and check the applicable regulatory requirements with official authorities.'),
        },
        {
          id: 'business-lesson-project', title: t('مشروع: صفحة واحدة لخطة مشروعك', 'Project: a one-page business plan'), minutes: 30, preview: false,
          body: t('اجمع الجمهور والمشكلة والعرض والتكاليف وتجربتك التالية في صفحة واحدة. هذه مادة تعليمية وليست استشارة مالية أو قانونية؛ تحقق من القرارات الخاصة بمشروعك مع مختص مناسب.', 'Combine the audience, problem, offer, costs, and next experiment on one page. This is educational material rather than financial or legal advice; review decisions specific to your business with an appropriate professional.'),
        },
      ],
      exam: {
        id: 'business-exam-economics', title: t('اختبار أرقام المشروع', 'Business numbers check'), passPercent: 70,
        questionCount: 3,
      },
    },
  ],
  'course-phone-photography': [
    {
      id: 'photo-section-light', title: t('الضوء والتكوين', 'Light and composition'),
      lessons: [
        {
          id: 'photo-lesson-camera', title: t('ابدأ بكاميرا هاتفك', 'Start with your phone camera'), minutes: 12, preview: true,
          body: t('نظف العدسة وأوقف المرشحات التلقائية قبل التصوير. جرب ضبط التركيز والتعريض يدويًا إن كان هاتفك يدعم ذلك، وقارن النتيجة بالإعداد التلقائي.', 'Clean the lens and turn off automatic filters before shooting. Try adjusting focus and exposure manually if your phone supports it, and compare the result with automatic settings.'),
        },
        {
          id: 'photo-lesson-light', title: t('استغلال ضوء النافذة', 'Using window light'), minutes: 18, preview: false,
          body: t('ضع المنتج قرب نافذة مع ضوء غير مباشر وراقب الظلال. استخدم ورقة بيضاء لعكس الضوء على الجانب المظلل بدل تشغيل عدة مصادر مختلفة.', 'Place the product near a window with indirect light and observe the shadows. Use white paper to bounce light onto the darker side instead of switching on several different light sources.'),
        },
        {
          id: 'photo-lesson-composition', title: t('التكوين والخلفيات البسيطة', 'Composition and simple backgrounds'), minutes: 20, preview: false,
          body: t('اختر نقطة اهتمام واضحة وخلفية لا تنافسها. جرّب قاعدة الأثلاث ثم التكوين المركزي، واترك مساحة للنص إذا كانت الصورة ستستخدم في إعلان.', 'Choose a clear point of interest and a background that does not compete with it. Try the rule of thirds and then a centered composition, leaving space for text if the image will be used in an advertisement.'),
        },
        {
          id: 'photo-lesson-angles', title: t('زوايا التصوير وتثبيت الهاتف', 'Camera angles and phone stability'), minutes: 17, preview: false,
          body: t('التقط المنتج من الأمام ومن زاوية 45 درجة ومن الأعلى. ثبت الهاتف بحامل أو سطح آمن وقارن الأشكال قبل اختيار زاوية تخدم القصة.', 'Photograph the product from the front, at 45 degrees, and from above. Stabilize the phone with a stand or safe surface, and compare shapes before choosing an angle that serves the story.'),
        },
      ],
      exam: {
        id: 'photo-exam-light', title: t('اختبار الضوء والتكوين', 'Light and composition check'), passPercent: 70,
        questionCount: 3,
      },
    },
    {
      id: 'photo-section-story', title: t('تصوير المنتج وإعداد الصور للنشر', 'Product photography and preparing images'),
      lessons: [
        {
          id: 'photo-lesson-shot-list', title: t('قائمة لقطات تروي القصة', 'A shot list that tells the story'), minutes: 16, preview: false,
          body: t('خطط لصورة رئيسية وصورة تفاصيل وصورة توضح استخدام المنتج. تحقق من موافقة الأشخاص الظاهرين في الصور ومن حقوق أي عناصر أو صور خارجية تستخدمها.', 'Plan a hero image, a detail shot, and an image showing the product in use. Check consent for people shown in photos and the rights to any outside assets or images you use.'),
        },
        {
          id: 'photo-lesson-edit', title: t('تعديل الإضاءة والألوان باعتدال', 'Adjusting light and color with restraint'), minutes: 22, preview: false,
          body: t('ابدأ بتصحيح التعريض وتوازن اللون الأبيض ثم اضبط التباين قليلًا. قارن الصورة بالمنتج الحقيقي كي لا تغير لونه أو توحي بخصائص غير موجودة.', 'Start by correcting exposure and white balance, then adjust contrast slightly. Compare the photo with the real product so its color and properties are not misrepresented.'),
        },
        {
          id: 'photo-lesson-export', title: t('القص والتصدير للويب', 'Cropping and exporting for the web'), minutes: 18, preview: false,
          body: t('احفظ نسخة أصلية ثم قص نسخة تناسب مساحة النشر. اختر حجمًا وجودة يحققان وضوحًا جيدًا دون ملف ضخم، وافحص الصورة بعد رفعها.', 'Keep an original copy, then crop a version for the publishing space. Choose a size and quality that preserve clarity without creating a huge file, and inspect the image after uploading.'),
        },
        {
          id: 'photo-lesson-project', title: t('مشروع: مجموعة صور لمنتج واحد', 'Project: a photo set for one product'), minutes: 30, preview: false,
          body: t('صور منتجًا تملكه في ثلاث لقطات متسقة من حيث الضوء والخلفية. اكتب وصفًا بديلًا موجزًا لكل صورة واشرح كيف يخدم كل إطار قصة المنتج.', 'Photograph a product you own in three shots with consistent light and backgrounds. Write concise alternative text for each image and explain how each frame supports the product’s story.'),
        },
      ],
      exam: {
        id: 'photo-exam-story', title: t('اختبار إعداد الصور للنشر', 'Image publishing check'), passPercent: 70,
        questionCount: 3,
      },
    },
  ],
};

export const sampleCourses: Course[] = [
  {
    id: 'course-design-foundations',
    slug: t('أساسيات-التصميم-البصري', 'visual-design-foundations'),
    title: t('أساسيات التصميم البصري', 'Visual design foundations'),
    description: t('تعلّم التكوين والألوان والخطوط، ثم صمّم بطاقة دورة بالعربية والإنجليزية. مسار عملي يبدأ بالمبادئ وينتهي بمشروع صغير يمكنك تطويره.', 'Learn composition, color, and typography, then design a course card in Arabic and English. A practical path from core principles to a small project you can build on.'),
    categorySlug: 'design', instructorId: 'instructor-noura', level: 'BEGINNER', priceHalalas: 34900,
    minutes: 155, lessonCount: 8, cover: 'design', featured: true,
  },
  {
    id: 'course-web-foundations',
    slug: t('بناء-واجهات-الويب', 'building-web-interfaces'),
    title: t('ابنِ أول واجهة ويب', 'Build your first web interface'),
    description: t('ابدأ بـ HTML وCSS وJavaScript، وابنِ معرض دورات متجاوبًا يدعم العربية. تمارين قصيرة في كل خطوة مع تركيز على سهولة الاستخدام وإمكانية الوصول.', 'Start with HTML, CSS, and JavaScript, and build a responsive course catalog with Arabic support. Short exercises at every step emphasize usability and accessibility.'),
    categorySlug: 'technology', instructorId: 'instructor-faisal', level: 'BEGINNER', priceHalalas: 49900,
    minutes: 205, lessonCount: 8, cover: 'code', featured: true,
  },
  {
    id: 'course-business-launch',
    slug: t('من-الفكرة-إلى-المشروع', 'from-idea-to-business'),
    title: t('من الفكرة إلى مشروعك الأول', 'From idea to your first business'),
    description: t('افهم عميلك، اختبر عرضك، واحسب تكاليفك بالريال السعودي. أنشئ خطة مشروع من صفحة واحدة وتجربة أولية تساعدك على اتخاذ القرار التالي.', 'Understand your customer, test your offer, and calculate costs in Saudi riyals. Create a one-page business plan and a first experiment to guide your next decision.'),
    categorySlug: 'business', instructorId: 'instructor-sara', level: 'ALL_LEVELS', priceHalalas: 39900,
    minutes: 187, lessonCount: 8, cover: 'business', featured: true,
  },
  {
    id: 'course-phone-photography',
    slug: t('تصوير-المنتجات-بالهاتف', 'product-photography-with-your-phone'),
    title: t('تصوير المنتجات بهاتفك', 'Product photography with your phone'),
    description: t('اصنع صورًا أوضح باستخدام هاتفك وضوء النافذة. تعلم التكوين وتعديل الصور باعتدال، وأنجز مجموعة صور متسقة لمنتج تختاره.', 'Create clearer images with your phone and window light. Learn composition and restrained editing, and produce a consistent photo set for a product of your choice.'),
    categorySlug: 'photography', instructorId: 'instructor-abdullah', level: 'ALL_LEVELS', priceHalalas: 24900,
    minutes: 153, lessonCount: 8, cover: 'photo', featured: false,
  },
];
