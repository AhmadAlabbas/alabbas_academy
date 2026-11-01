import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator, Image, Linking, Pressable, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {
  cachedCatalog, fetchCatalog, fetchSyllabus, LOCALE_KEY, readableMinutes,
  SAVED_KEY, SITE_ORIGIN,
  type Catalog, type Course, type Locale, type Syllabus,
} from './src/api';
import {copy} from './src/copy';

type Tab = 'home' | 'courses' | 'saved' | 'account';
const NAVY = '#10213c', BLUE = '#296a91', GOLD = '#f0dca7', BG = '#f6f8fa';
const initialCatalog: Catalog = {version: 1, courses: [], categories: [], instructors: []};

function localized(value: {ar: string; en: string}, locale: Locale) {
  return value[locale] || value.ar || value.en;
}
function simpleExcerpt(text: string) {
  return text.replace(/^#{1,6}\s+/gm, '').replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ').trim();
}
function openAcademy(path: string) {
  // Never open external checkout or payment routes from this application.
  return Linking.openURL(SITE_ORIGIN + path).catch(() => undefined);
}
function AppRoot() {
  const [locale, setLocale] = useState<Locale>('ar');
  const [tab, setTab] = useState<Tab>('home');
  const [catalog, setCatalog] = useState<Catalog>(initialCatalog);
  const [saved, setSaved] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Course | null>(null);
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [offline, setOffline] = useState(false);
  const t = copy(locale);
  const rtl = locale === 'ar';
  const rowDirection = rtl ? 'row-reverse' as const : 'row' as const;
  const alignment = rtl ? 'right' as const : 'left' as const;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchCatalog();
      setCatalog(next);
      setOffline(false);
    } catch {
      setOffline(true);
      const cached = await cachedCatalog();
      if (cached) setCatalog(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      AsyncStorage.getItem(SAVED_KEY),
      AsyncStorage.getItem(LOCALE_KEY),
      cachedCatalog(),
    ]).then(([ids, language, cache]) => {
      if (!alive) return;
      if (ids) {
        try {
          const parsed: unknown = JSON.parse(ids);
          if (Array.isArray(parsed)) setSaved(parsed.filter((id): id is string => typeof id === 'string'));
        } catch { /* Corrupt local preferences must not crash the app. */ }
      }
      if (language === 'en' || language === 'ar') setLocale(language);
      if (cache) setCatalog(cache);
    }).catch(() => undefined).finally(() => {if (alive) void refresh();});
    return () => {alive = false;};
  }, [refresh]);

  useEffect(() => {
    if (!selected) {setSyllabus(null);setDetailError(false);return;}
    let active = true;
    setSyllabus(null);setDetailError(false);setLoadingDetail(true);
    fetchSyllabus(selected.id).then(data => {if(active) setSyllabus(data);})
      .catch(() => {if(active) setDetailError(true);})
      .finally(() => {if(active) setLoadingDetail(false);});
    return () => {active = false;};
  }, [selected]);

  async function toggleSaved(id: string) {
    const next = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id];
    setSaved(next);
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next)).catch(() => undefined);
  }
  function toggleLocale() {
    const next: Locale = locale === 'ar' ? 'en' : 'ar';
    setLocale(next);
    void AsyncStorage.setItem(LOCALE_KEY, next).catch(() => undefined);
  }

  const courses = useMemo(() => catalog.courses.filter(course => {
    const text = (course.title.ar + ' ' + course.title.en + ' ' +
      course.description.ar + ' ' + course.description.en).toLocaleLowerCase();
    return (!query.trim() || text.includes(query.trim().toLocaleLowerCase())) &&
      (!category || course.categorySlug === category);
  }), [catalog.courses, query, category]);

  function Heading({children}: {children: React.ReactNode}) {
    return <Text style={[styles.heading, {textAlign: alignment}]}>{children}</Text>;
  }
  function Action({children, onPress, secondary = false}: {
    children: React.ReactNode; onPress: () => void; secondary?: boolean;
  }) {
    return <Pressable accessibilityRole="button" onPress={onPress}
      style={({pressed}) => [styles.action, secondary && styles.secondaryAction, pressed && styles.pressed]}>
      <Text style={[styles.actionText, secondary && styles.secondaryText]}>{children}</Text>
    </Pressable>;
  }
  function CourseCard({course}: {course: Course}) {
    const marked = saved.includes(course.id);
    const instructor = catalog.instructors.find(i => i.id === course.instructorId);
    return <View style={styles.courseCard}>
      <Pressable accessibilityRole="button" onPress={() => setSelected(course)} style={({pressed}) => pressed && styles.pressed}>
        {course.thumbnailUrl?.startsWith('https://') ?
          <Image source={{uri: course.thumbnailUrl}} style={styles.courseImage} resizeMode="cover"/> :
          <View style={styles.imageFallback}><Text style={styles.imageFallbackText}>ALABBAS  /  ACADEMY</Text></View>}
        <View style={styles.cardBody}>
          <Text style={[styles.courseTitle, {textAlign: alignment}]}>{localized(course.title, locale)}</Text>
          <Text style={[styles.description, {textAlign: alignment}]} numberOfLines={3}>
            {simpleExcerpt(localized(course.description, locale))}
          </Text>
          <Text style={[styles.meta, {textAlign: alignment}]}>
            {course.lessonCount} {t.lessons}  ·  {readableMinutes(course.minutes, locale)}
          </Text>
          {instructor && <Text style={[styles.meta, {textAlign: alignment}]}>
            {localized(instructor.name, locale)}
          </Text>}
        </View>
      </Pressable>
      <View style={[styles.cardActions, {flexDirection: rowDirection}]}>
        <Pressable accessibilityRole="button" onPress={() => setSelected(course)} style={styles.detailButton}>
          <Text style={styles.detailButtonText}>{t.view}</Text>
        </Pressable>
        <Pressable accessibilityRole="button"
          accessibilityLabel={marked ? 'Remove bookmark' : 'Save course'}
          onPress={() => void toggleSaved(course.id)} style={[styles.saveButton, marked && styles.savedButton]}>
          <Text style={styles.saveText}>{marked ? '★' : '☆'}</Text>
        </Pressable>
      </View>
    </View>;
  }
  function CourseList({list}: {list: Course[]}) {
    return list.length ?
      <View style={styles.courseList}>{list.map(course => <CourseCard key={course.id} course={course}/>)}</View> :
      <Text style={[styles.emptyText, {textAlign: alignment}]}>{t.empty}</Text>;
  }
  function CourseDetail() {
    if (!selected) return null;
    return <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={styles.backButton}>
        <Text style={styles.backText}>{rtl ? '→' : '←'}  {t.back}</Text>
      </Pressable>
      <Text style={[styles.eyebrow, {textAlign: alignment}]}>{t.courseDetail}</Text>
      <Heading>{localized(selected.title, locale)}</Heading>
      <Text style={[styles.description, styles.longText, {textAlign: alignment}]}>
        {simpleExcerpt(localized(selected.description, locale))}
      </Text>
      <Text style={[styles.meta, {textAlign: alignment}]}>
        {selected.lessonCount} {t.lessons}  ·  {readableMinutes(selected.minutes, locale)}
      </Text>
      <View style={styles.sectionHeader}>
        <Action secondary onPress={() => void toggleSaved(selected.id)}>
          {saved.includes(selected.id) ? '★' : '☆'}  {t.saved}
        </Action>
      </View>
      <Heading>{t.syllabus}</Heading>
      {loadingDetail && <ActivityIndicator color={BLUE} size="large"/>}
      {detailError && <Text style={styles.alert}>{t.unavailableCourse}</Text>}
      {!loadingDetail && syllabus && (!syllabus.sections.length ||
        syllabus.sections.every(section => !section.lessons.length)) &&
        <Text style={styles.emptyText}>{t.noLessons}</Text>}
      {syllabus?.sections.map((section, index) => (
        <View key={section.id} style={styles.syllabusSection}>
          <Text style={[styles.sectionTitle, {textAlign: alignment}]}>
            {index + 1}. {localized(section.title, locale)}
          </Text>
          {section.lessons.map(lesson => (
            <View key={lesson.id} style={[styles.lesson, {flexDirection: rowDirection}]}>
              <Text style={[styles.lessonName, {textAlign: alignment}]}>
                {localized(lesson.title, locale)}
              </Text>
              <Text style={styles.lessonMinutes}>{readableMinutes(lesson.minutes, locale)}</Text>
            </View>
          ))}
        </View>
      ))}
      <Text style={[styles.footnote, {textAlign: alignment}]}>{t.contentOnly}</Text>
    </ScrollView>;
  }

  function Home() {
    const featured = catalog.courses.filter(c => c.featured).slice(0, 4);
    return <>
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, {textAlign: alignment}]}>{t.strap}</Text>
        <Text style={[styles.heroTitle, {textAlign: alignment}]}>{t.hero}</Text>
        <Text style={[styles.heroText, {textAlign: alignment}]}>{t.heroText}</Text>
        <Action onPress={() => {setTab('courses');setCategory('');}}>{t.explore}</Action>
      </View>
      <Heading>{t.featured}</Heading>
      {loading && !catalog.courses.length && <ActivityIndicator size="large" color={BLUE}/>}
      {featured.length ? <CourseList list={featured}/> :
        !loading && <Text style={[styles.emptyText, {textAlign: alignment}]}>{t.noCourses}</Text>}
    </>;
  }
  function Browse() {
    return <>
      <Heading>{t.explore}</Heading>
      <TextInput accessibilityLabel={t.search} placeholder={t.search}
        placeholderTextColor="#7c8694" value={query} onChangeText={setQuery}
        autoCorrect={false} style={[styles.search, {textAlign: alignment}]}/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chips, rtl && {flexDirection: 'row-reverse'}]}>
        <Pressable accessibilityRole="button" onPress={() => setCategory('')}
          style={[styles.chip, !category && styles.activeChip]}>
          <Text style={[styles.chipText, !category && styles.activeChipText]}>{t.all}</Text>
        </Pressable>
        {catalog.categories.map(item => <Pressable key={item.id}
          accessibilityRole="button" onPress={() => setCategory(item.id)}
          style={[styles.chip, category === item.id && styles.activeChip]}>
          <Text style={[styles.chipText, category === item.id && styles.activeChipText]}>
            {localized(item.title, locale)}
          </Text>
        </Pressable>)}
      </ScrollView>
      <CourseList list={courses}/>
    </>;
  }
  function Saved() {
    const list = catalog.courses.filter(course => saved.includes(course.id));
    return <>
      <Heading>{t.saved}</Heading>
      {!list.length && <Text style={[styles.emptyText, {textAlign: alignment}]}>
        {t.noSaved} {t.saveHint}
      </Text>}
      <CourseList list={list}/>
    </>;
  }
  function Account() {
    return <>
      <Heading>{t.welcome}</Heading>
      <Text style={[styles.description, styles.longText, {textAlign: alignment}]}>{t.accountInfo}</Text>
      <View style={styles.accountActions}>
        <Action onPress={() => void openAcademy(`/${locale}/login`)}>{t.signIn}</Action>
        <Action secondary onPress={() => void openAcademy(`/${locale}/my-courses`)}>{t.myLearning}</Action>
        <Action secondary onPress={() => void openAcademy(`/${locale}/privacy`)}>{t.privacy}</Action>
      </View>
      <Text style={[styles.footnote, {textAlign: alignment}]}>{t.contentOnly}</Text>
    </>;
  }

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <StatusBar barStyle="dark-content" backgroundColor="#ffffff"/>
    <View style={[styles.topbar, {flexDirection: rowDirection}]}>
      <Pressable accessibilityRole="button" onPress={() => {setTab('home');setSelected(null);}}>
        <Text style={styles.brand}>ALABBAS <Text style={styles.brandAccent}>ACADEMY</Text></Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.languageButton}>
        <Text style={styles.languageText}>{rtl ? 'EN' : 'عربي'}</Text>
      </Pressable>
    </View>
    {offline && <Pressable onPress={() => void refresh()} style={styles.offlineBar}>
      <Text style={styles.offlineText}>{catalog.courses.length ? t.offline : t.unavailable}  ↻</Text>
    </Pressable>}
    {selected ? <CourseDetail/> :
      <ScrollView key={tab} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={BLUE}/>}
        contentContainerStyle={styles.content}>
        {tab === 'home' ? <Home/> : tab === 'courses' ? <Browse/> :
          tab === 'saved' ? <Saved/> : <Account/>}
      </ScrollView>}
    {!selected && <View style={styles.tabbar}>
      {(['home', 'courses', 'saved', 'account'] as Tab[]).map((item, index) => (
        <Pressable key={item} accessibilityRole="tab" accessibilityState={{selected: tab === item}}
          onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.selectedTab]}>
          <Text style={[styles.tabIcon, tab === item && styles.selectedText]}>
            {['⌂', '▤', '☆', '◎'][index]}
          </Text>
          <Text style={[styles.tabLabel, tab === item && styles.selectedText]}>{t[item]}</Text>
        </Pressable>
      ))}
    </View>}
  </SafeAreaView>;
}

export default function App() {
  return <SafeAreaProvider><AppRoot/></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: BG},
  topbar: {paddingHorizontal: 20, minHeight: 65, alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e6ebef'},
  brand: {color: NAVY, fontWeight: '900', fontSize: 17, letterSpacing: 0.5},
  brandAccent: {color: BLUE, fontSize: 11, fontWeight: '700'},
  languageButton: {backgroundColor: BG, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9},
  languageText: {fontSize: 13, fontWeight: '800', color: NAVY},
  content: {padding: 20, paddingBottom: 38, gap: 16},
  eyebrow: {fontWeight: '700', color: BLUE, fontSize: 12},
  hero: {padding: 24, borderRadius: 24, backgroundColor: '#e8f1f6', gap: 16, marginBottom: 12},
  heroTitle: {fontSize: 32, lineHeight: 43, fontWeight: '800', color: NAVY},
  heroText: {fontSize: 15, lineHeight: 26, color: '#41526a'},
  heading: {fontSize: 23, fontWeight: '800', color: NAVY, lineHeight: 35, marginTop: 8},
  action: {alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 14,
    paddingHorizontal: 20, backgroundColor: NAVY, alignSelf: 'stretch'},
  actionText: {fontSize: 14, color: 'white', fontWeight: '800'},
  secondaryAction: {backgroundColor: 'white', borderWidth: 1, borderColor: '#d5dfe7'},
  secondaryText: {color: NAVY},
  pressed: {opacity: 0.78},
  courseList: {gap: 16},
  courseCard: {backgroundColor: 'white', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e5ebee'},
  courseImage: {width: '100%', height: 150},
  imageFallback: {height: 144, justifyContent: 'center', alignItems: 'center', backgroundColor: '#dae8f2'},
  imageFallbackText: {color: NAVY, fontWeight: '900', letterSpacing: 2, fontSize: 13},
  cardBody: {padding: 18, gap: 8},
  courseTitle: {color: NAVY, fontSize: 18, lineHeight: 27, fontWeight: '800'},
  description: {fontSize: 14, lineHeight: 24, color: '#4f5d6e'},
  longText: {fontSize: 15, lineHeight: 28},
  meta: {fontSize: 12, color: '#6d7c8b'},
  cardActions: {paddingHorizontal: 18, paddingBottom: 16, alignItems: 'center', gap: 10},
  detailButton: {flex: 1, paddingVertical: 12, backgroundColor: NAVY, borderRadius: 12, alignItems: 'center'},
  detailButtonText: {color: 'white', fontSize: 13, fontWeight: '700'},
  saveButton: {height: 42, width: 47, backgroundColor: '#f5f7f9', borderRadius: 12, alignItems: 'center',
    justifyContent: 'center'},
  savedButton: {backgroundColor: GOLD},
  saveText: {fontSize: 25, fontWeight: '600', color: NAVY},
  search: {minHeight: 48, backgroundColor: 'white', borderColor: '#dce4ea', borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 16, fontSize: 15, color: NAVY},
  chips: {gap: 8, paddingBottom: 6, alignItems: 'center'},
  chip: {borderRadius: 50, backgroundColor: 'white', borderColor: '#dbe3e9',
    borderWidth: 1, paddingVertical: 9, paddingHorizontal: 14},
  activeChip: {backgroundColor: NAVY, borderColor: NAVY},
  chipText: {color: NAVY, fontSize: 12, fontWeight: '600'},
  activeChipText: {color: 'white'},
  emptyText: {color: '#657488', fontSize: 14, lineHeight: 26, paddingVertical: 14},
  backButton: {paddingVertical: 10},
  backText: {color: BLUE, fontWeight: '800', fontSize: 15},
  sectionHeader: {marginVertical: 8},
  sectionTitle: {fontSize: 16, fontWeight: '800', color: NAVY, marginBottom: 14},
  syllabusSection: {backgroundColor: 'white', padding: 20, borderRadius: 17, gap: 8},
  lesson: {paddingVertical: 11, borderTopWidth: 1, borderColor: '#edf0f2', alignItems: 'center', gap: 14},
  lessonName: {color: NAVY, fontSize: 13, flex: 1, lineHeight: 22},
  lessonMinutes: {color: '#738093', fontSize: 11},
  footnote: {color: '#718094', fontSize: 12, lineHeight: 21},
  alert: {color: '#9a3c38', fontSize: 14},
  accountActions: {gap: 12, paddingVertical: 14},
  tabbar: {flexDirection: 'row', backgroundColor: 'white', borderTopColor: '#e3e9ed', borderTopWidth: 1,
    minHeight: 70, paddingTop: 5},
  tab: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 2},
  selectedTab: {borderTopWidth: 2, borderTopColor: BLUE},
  tabIcon: {fontSize: 23, color: '#778399'},
  tabLabel: {fontSize: 11, color: '#778399', fontWeight: '600'},
  selectedText: {color: NAVY, fontWeight: '900'},
  offlineBar: {backgroundColor: '#fff3cf', paddingVertical: 9, paddingHorizontal: 16},
  offlineText: {fontSize: 12, color: '#6c520b', textAlign: 'center'},
});
