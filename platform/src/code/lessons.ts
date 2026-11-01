/**
 * ALABBAS Code — authored, beginner-friendly lessons.
 * The checks are formative feedback, NOT a secure exam/certificate assessment.
 * Each track can grow independently without changing the editor API.
 */
export type CodeLocale = 'ar' | 'en';
export type TrackId = 'html' | 'css' | 'javascript';
export type Localized = {ar: string; en: string};
export type Files = {html: string; css: string; js: string};
export type Check =
  | {type: 'html'; label: Localized; selector: string; attribute?: string; contains?: string}
  | {type: 'css'; label: Localized; selector: string; property: string; contains?: string}
  | {type: 'js'; label: Localized; pattern: string};

export type Lesson = {
  id: string;
  track: TrackId;
  title: Localized;
  description: Localized;
  task: Localized;
  hint: Localized;
  starter: Files;
  checks: Check[];
};
export type Track = {
  id: TrackId;
  title: Localized;
  eyebrow: Localized;
  description: Localized;
  accent: string;
  symbol: string;
  estimatedHours: number;
};
const t = (en: string, ar: string): Localized => ({en, ar});
const html = (markup: string): Files => ({html: markup, css: '', js: ''});
const css = (markup: string, styles: string): Files => ({html: markup, css: styles, js: ''});
const js = (markup: string, script: string): Files => ({html: markup, css: '', js: script});
const h = (label: Localized, selector: string, attribute?: string, contains?: string): Check =>
  ({type: 'html', label, selector, ...(attribute ? {attribute} : {}), ...(contains ? {contains} : {})});
const c = (label: Localized, selector: string, property: string, contains?: string): Check =>
  ({type: 'css', label, selector, property, ...(contains ? {contains} : {})});
const j = (label: Localized, pattern: string): Check => ({type: 'js', label, pattern});

export const tracks: Track[] = [
  {id: 'html', title:t('Build with HTML','ابدأ مع HTML'),
   eyebrow:t('01 / THE STRUCTURE','٠١ / أساس الويب'),
   description:t('Create meaningful web pages, one element at a time.','أنشئ صفحات ويب صحيحة ومنظمة، عنصرًا بعد عنصر.'),
   accent:'#d9f4e8', symbol:'<>', estimatedHours:2},
  {id: 'css', title:t('Style with CSS','صمّم باستخدام CSS'),
   eyebrow:t('02 / THE DESIGN','٠٢ / التصميم'),
   description:t('Turn simple markup into polished, responsive interfaces.','حوّل الصفحات البسيطة إلى واجهات جذابة ومتجاوبة.'),
   accent:'#e7e6ff', symbol:'{ }', estimatedHours:2},
  {id: 'javascript', title:t('Think in JavaScript','فكّر بلغة JavaScript'),
   eyebrow:t('03 / THE LOGIC','٠٣ / المنطق البرمجي'),
   description:t('Work through variables, functions, and everyday logic.','تدرّب على المتغيرات والدوال والمنطق البرمجي.'),
   accent:'#fdf0cc', symbol:'JS', estimatedHours:3},
];

export const lessons: Lesson[] = [
  {
    id:'html-first-heading', track:'html',
    title:t('Your first heading','عنوانك الأول'),
    description:t('Give your web page a clear title.','اكتب أول عنوان في صفحة الويب.'),
    task:t('Inside the main element, add an h1 heading that says Hello, World!','داخل العنصر main أضف عنوان h1 يحتوي على Hello, World!'),
    hint:t('Use an opening <h1> and closing </h1> around the text.','اكتب <h1> قبل النص و </h1> بعده.'),
    starter:html('<main>\n  <!-- Write your heading below -->\n\n</main>'),
    checks:[h(t('You used an h1 heading','أضفت عنوان h1'),'h1'),
            h(t('Your heading says Hello, World!','كتبت النص المطلوب'),'h1',undefined,'Hello, World!')],
  },
  {
    id:'html-paragraphs', track:'html',
    title:t('Tell your story','احكِ قصتك'),
    description:t('Organize a profile with paragraphs.','نظّم نبذة شخصية باستخدام الفقرات.'),
    task:t('Add an h2 named About me and two paragraphs inside the main element.','أضف عنوان h2 باسم About me وفقرتين داخل main.'),
    hint:t('A paragraph uses the <p> element. You need two of them.','الفقرة تُكتب باستخدام <p>. أضف فقرتين.'),
    starter:html('<main>\n  <!-- Introduce yourself -->\n\n</main>'),
    checks:[h(t('Add an h2 heading','أضف عنوان h2'),'h2',undefined,'About me'),
            h(t('Write your first paragraph','اكتب الفقرة الأولى'),'main p:nth-of-type(1)'),
            h(t('Write a second paragraph','اكتب الفقرة الثانية'),'main p:nth-of-type(2)')],
  },
  {
    id:'html-links', track:'html',
    title:t('Connect the web','اربط الصفحات'),
    description:t('Create a meaningful link.','أنشئ رابطًا يمكن للزائر فتحه.'),
    task:t('Add a link to https://developer.mozilla.org with the visible text Read the docs.','أضف رابطًا إلى https://developer.mozilla.org يحمل النص Read the docs.'),
    hint:t('An anchor uses <a href="https://...">text</a>.','استخدم الوسم <a> مع خاصية href.'),
    starter:html('<main>\n  <h1>Useful resources</h1>\n  <!-- Add your link -->\n</main>'),
    checks:[h(t('Your page contains a link','تحتوي الصفحة على رابط'),'a[href]'),
            h(t('The link points to MDN','يؤدي الرابط إلى MDN'),'a[href="https://developer.mozilla.org"]'),
            h(t('The link has the requested label','يتضمن الرابط النص المطلوب'),'a',undefined,'Read the docs')],
  },
  {
    id:'html-images', track:'html',
    title:t('Images with purpose','صور ذات معنى'),
    description:t('Make your images accessible.','اجعل الصور مفهومة ومتاحة للجميع.'),
    task:t('Add an image with a valid src attribute and useful alt text describing the image.','أضف صورة لها src ونص alt واضح يصف محتواها.'),
    hint:t('Start with <img src="..." alt="...">. For this exercise, you may use a public HTTPS image URL.','استخدم <img src="..." alt="..."> مع رابط صورة HTTPS عام.'),
    starter:html('<main>\n  <h1>My gallery</h1>\n  <!-- Add an accessible image -->\n</main>'),
    checks:[h(t('You added an image','أضفت صورة'),'img[src]'),
            h(t('You included alternative text','أضفت وصفًا بديلًا'),'img[alt]:not([alt=""])')],
  },
  {
    id:'html-semantic', track:'html',
    title:t('Build a proper page','صفحة منظمة'),
    description:t('Use semantic HTML landmarks.','استخدم عناصر HTML الدلالية.'),
    task:t('Create a header, a main section containing an article, and a footer.','أنشئ header و main يتضمن article، ثم footer.'),
    hint:t('Use <header>, <main>, <article>, and <footer>.','تحتاج إلى وسوم header و main و article و footer.'),
    starter:html('<!-- Give your page a clear structure -->\n\n'),
    checks:[h(t('Your page has a header','أضفت ترويسة'),'header'),
            h(t('Your page has main content','أضفت المحتوى الرئيسي'),'main'),
            h(t('Main contains an article','يوجد مقال داخل المحتوى'),'main article'),
            h(t('Your page has a footer','أضفت تذييل الصفحة'),'footer')],
  },
  {
    id:'css-colors', track:'css',
    title:t('Make colour count','قوة الألوان'),
    description:t('Learn declarations and colour.','افهم خصائص الألوان في CSS.'),
    task:t('Style the h1 with the color property and give body a background-color.','غيّر لون h1 باستخدام color وأضف لون خلفية للعنصر body.'),
    hint:t('Try h1 { color: #2563eb; } and body { background-color: #f8fafc; }.','استخدم قاعدة CSS مستقلة لكل عنصر.'),
    starter:css('<h1>Hello, designer!</h1>\n<p>This page needs colour.</p>',
      '/* Add your styles below */\n\n'),
    checks:[c(t('Give the heading a colour','أضف لونًا للعنوان'),'h1','color'),
            c(t('Give the body a background colour','أضف لون خلفية للصفحة'),'body','background-color')],
  },
  {
    id:'css-spacing', track:'css',
    title:t('Space to breathe','المساحات والهوامش'),
    description:t('Use spacing to guide the reader.','تحكم في الفراغات لتحسين القراءة.'),
    task:t('Give .card at least one padding value and a border-radius.','أضف padding و border-radius إلى الصنف .card.'),
    hint:t('Add a .card { ... } rule containing padding: 24px; and border-radius: 16px;.','اكتب قاعدة .card وأضف خاصيتي padding و border-radius.'),
    starter:css('<div class="card">\n  <h2>My first card</h2>\n  <p>Good spacing makes ideas clearer.</p>\n</div>',
      'body { background: #e9eff8; }\n.card { background: white; }\n'),
    checks:[c(t('Add padding to the card','أضف حشوة للبطاقة'),'.card','padding'),
            c(t('Round the card corners','اجعل زوايا البطاقة مستديرة'),'.card','border-radius')],
  },
  {
    id:'css-typography', track:'css',
    title:t('Typography that speaks','الخطوط الواضحة'),
    description:t('Design readable type.','صمّم نصًا واضحًا وسهل القراءة.'),
    task:t('Add a font-size and line-height to the .intro paragraph.','أضف font-size و line-height إلى الفقرة .intro.'),
    hint:t('Target .intro { font-size: 18px; line-height: 1.7; }.','استهدف الصنف .intro داخل ملف CSS.'),
    starter:css('<h1>Design is communication.</h1>\n<p class="intro">Typography is more than choosing a font. The space between lines matters too.</p>',
      'body { padding: 24px; font-family: system-ui; }\n'),
    checks:[c(t('Set the font size','حدّد حجم الخط'),'.intro','font-size'),
            c(t('Improve the line height','اضبط تباعد الأسطر'),'.intro','line-height')],
  },
  {
    id:'css-flexbox', track:'css',
    title:t('Arrange with Flexbox','التوزيع باستخدام Flexbox'),
    description:t('Build flexible layouts.','رتّب العناصر بشكل مرن.'),
    task:t('Set display: flex and gap on .cards so that the cards sit beside each other.','اجعل .cards تستخدم display: flex وأضف مسافة باستخدام gap.'),
    hint:t('Use .cards { display: flex; gap: 16px; }.','أضف display: flex ثم gap داخل .cards.'),
    starter:css('<section class="cards">\n  <div class="item">HTML</div>\n  <div class="item">CSS</div>\n  <div class="item">JS</div>\n</section>',
      '.item { background: #bce2e7; border-radius: 10px; padding: 24px; }\n'),
    checks:[c(t('Enable Flexbox','فعّل Flexbox'),'.cards','display','flex'),
            c(t('Add a gap between cards','أضف مسافة بين البطاقات'),'.cards','gap')],
  },
  {
    id:'js-variables', track:'javascript',
    title:t('Store a value','احفظ قيمة'),
    description:t('Understand variables and output.','تعرّف على المتغيرات وإظهار النتائج.'),
    task:t('Declare const name and assign your name. Then use console.log(name).','أنشئ متغيرًا ثابتًا باسم name يحمل اسمك، ثم اطبعه باستخدام console.log(name).'),
    hint:t('Try const name = "Ada"; followed by console.log(name);','استخدم const name = "Ada"; ثم console.log(name);'),
    starter:js('<h1>JavaScript Console</h1>\n<p>Open the Console tab after running your code.</p>',
      '// Create a variable and print it\n'),
    checks:[j(t('Declare a const named name','أنشئ ثابتًا باسم name'),'\\bconst\\s+name\\s*='),j(t('Print the value of name','اطبع قيمة name'),'console\\s*\\.\\s*log\\s*\\(\\s*name\\s*\\)')],
  },
  {
    id:'js-functions', track:'javascript',
    title:t('Write a function','أنشئ دالة'),
    description:t('Create reusable instructions.','اكتب تعليمات يمكن إعادة استخدامها.'),
    task:t('Write a function named greet that takes a name and returns a greeting. Call it and log the result.','اكتب دالة باسم greet تستقبل name وتعيد رسالة ترحيب، ثم اطبع النتيجة.'),
    hint:t('function greet(name) { return "Hi " + name; }','استخدم function greet(name) مع return.'),
    starter:js('<h1>Functions</h1>\n<p>Check the console to see your greeting.</p>',
      '// Build a greeting function\n'),
    checks:[j(t('Declare the greet function','عرّف الدالة greet'),'function\\s+greet\\s*\\('),
            j(t('Return a result','أعد نتيجة باستخدام return'),'\\breturn\\b'),
            j(t('Call greet','استدعِ الدالة greet'),'greet\\s*\\(')],
  },
  {
    id:'js-conditions', track:'javascript',
    title:t('Make a decision','اتخذ قرارًا'),
    description:t('Let your program choose what happens.','اجعل برنامجك يتخذ قرارات.'),
    task:t('Create a score variable and an if/else statement that prints a different message for passing and failing.','أنشئ متغير score وشرط if/else يطبع رسالتين مختلفتين حسب النجاح.'),
    hint:t('Start with const score = 80; and if (score >= 60) { ... } else { ... }.','ابدأ بمتغير score ثم استخدم if و else.'),
    starter:js('<h1>Decision maker</h1>\n<p>Test different score values.</p>',
      '// Is this a passing score?\n'),
    checks:[j(t('Create a score variable','أنشئ المتغير score'),'\\b(?:const|let)\\s+score\\s*='),
            j(t('Use an if statement','استخدم if'),'\\bif\\s*\\('),
            j(t('Handle the alternative with else','أضف else'),'\\belse\\b')],
  },
  {
    id:'js-loops', track:'javascript',
    title:t('Repeat with a loop','التكرار باستخدام الحلقات'),
    description:t('Automate repeated tasks.','كرّر الأوامر بطريقة ذكية.'),
    task:t('Write a for loop that prints the numbers 1 to 5 using console.log.','اكتب حلقة for تطبع الأرقام من 1 إلى 5 باستخدام console.log.'),
    hint:t('Use for (let i = 1; i <= 5; i++) { console.log(i); }.','ابدأ بحلقة for مع متغير i يبدأ من 1.'),
    starter:js('<h1>Loop lab</h1>\n<p>Run and inspect the output.</p>',
      '// Print numbers 1 to 5\n'),
    checks:[j(t('Write a for loop','اكتب حلقة for'),'\\bfor\\s*\\('),
            j(t('Log each number','اطبع الأرقام'),'console\\s*\\.\\s*log\\s*\\(')],
  },
];
export const lessonMap = new Map(lessons.map(lesson => [lesson.id, lesson]));
export const lessonsFor = (track: TrackId) => lessons.filter(lesson => lesson.track === track);
