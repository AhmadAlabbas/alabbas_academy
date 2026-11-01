import type {Locale} from './api';

export const translations = {
  ar: {
    home: 'الرئيسية', courses: 'الدورات', saved: 'المحفوظات', account: 'حسابي',
    appName: 'أكاديمية العباس', strap: 'تعلم بذكاء، وتقدم بثقة',
    hero: 'معرفة تفتح لك آفاقًا جديدة', heroText: 'استكشف الدورات التعليمية وتعرّف على محتواها من جوالك.',
    explore: 'استكشف الدورات', featured: 'دورات مميزة', all: 'جميع الدورات',
    search: 'ابحث عن دورة...', lessons: 'دروس', noCourses: 'لا توجد دورات متاحة حاليًا.',
    noSaved: 'لم تحفظ أي دورة بعد.', saveHint: 'اضغط على رمز الحفظ في أي دورة للرجوع إليها بسهولة.',
    view: 'التفاصيل', syllabus: 'محتوى الدورة', noLessons: 'لم يُنشر محتوى الدورة بعد.',
    offline: 'تعذر الاتصال. يتم عرض البيانات المحفوظة.', retry: 'إعادة المحاولة',
    unavailable: 'تعذر تحميل البيانات. حاول مجددًا عند توفر الاتصال.',
    language: 'اللغة', welcome: 'التعلم عبر جميع أجهزتك',
    accountInfo: 'يمكنك تسجيل الدخول إلى حساب الأكاديمية الحالي ومتابعة التعلم عبر الموقع. يتم تطوير تسجيل الدخول الأصلي للتطبيق.',
    signIn: 'تسجيل الدخول عبر الموقع', myLearning: 'دوراتي عبر الموقع',
    privacy: 'سياسة الخصوصية', empty: 'لا توجد نتائج مطابقة', clear: 'إزالة الفلتر',
    courseDetail: 'تفاصيل الدورة', unavailableCourse: 'تعذر جلب تفاصيل هذه الدورة.',
    categories: 'التصنيفات', back: 'رجوع', contentOnly: 'المحتوى هنا للعرض فقط؛ عمليات الدفع غير مفعّلة في التطبيق.',
  },
  en: {
    home: 'Home', courses: 'Courses', saved: 'Saved', account: 'Account',
    appName: 'ALABBAS Academy', strap: 'Learn with purpose. Grow with confidence.',
    hero: 'Learning that opens new possibilities', heroText: 'Discover Academy courses and preview the curriculum on your phone.',
    explore: 'Browse courses', featured: 'Featured courses', all: 'All courses',
    search: 'Search courses...', lessons: 'lessons', noCourses: 'No courses are available yet.',
    noSaved: 'No saved courses yet.', saveHint: 'Bookmark a course to find it easily next time.',
    view: 'Details', syllabus: 'Course curriculum', noLessons: 'No published lessons yet.',
    offline: 'Connection unavailable. Showing saved public data.', retry: 'Try again',
    unavailable: 'Unable to load courses. Check your connection.',
    language: 'Language', welcome: 'Continue learning anywhere',
    accountInfo: 'Use your existing Academy website account to sign in and access your learning. Native sign-in is being developed.',
    signIn: 'Sign in on website', myLearning: 'My courses on website',
    privacy: 'Privacy policy', empty: 'No matching courses', clear: 'Clear filter',
    courseDetail: 'Course details', unavailableCourse: 'Unable to load course details.',
    categories: 'Categories', back: 'Back', contentOnly: 'Course previews only. In-app payments are not enabled.',
  },
} as const;

export function copy(locale: Locale) {return translations[locale];}
