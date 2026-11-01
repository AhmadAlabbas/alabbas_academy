'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight,
  CircleHelp, CirclePlay, Code2, Copy, ExternalLink, FileCode2, Globe2, Lightbulb,
  ListChecks, LockKeyhole, Menu, PanelRight, Play, RotateCcw, Search, Sparkles,
  Terminal, Trophy, X,
} from 'lucide-react';
import {checkLesson, previewDocument, type CheckResult} from './grader';
import {lessons, lessonsFor, lessonMap, tracks, type CodeLocale, type Files, type Lesson, type Track} from './lessons';

type Tab = keyof Files;
type ConsoleLine = {kind: 'log' | 'warn' | 'error'; value: string};
const STORAGE_PROGRESS = 'alabbas-code-guest-progress-v1';
const STORAGE_DRAFT_PREFIX = 'alabbas-code-draft-v1:';

const copy = {
  en: {
    academy: 'Back to Academy', learn: 'Learn', tracks: 'Learning paths', workspace: 'Workspace',
    badge: 'A better way to learn to code', heroLine1: 'The future is', heroLine2: 'something you build.',
    intro: 'From your very first HTML tag to real JavaScript logic. Read a little, write a lot, and learn by making things work.',
    start: 'Start learning for free', explore: 'Explore paths', active: 'Your coding journey',
    featured: 'CHOOSE YOUR PATH', tracksTitle: 'Learn a skill. Build something real.',
    tracksIntro: 'Short lessons, real code, instant practice checks. No downloads or setup required.',
    lessons: 'lessons', hours: 'hours', open: 'Start path', continue: 'Continue learning',
    progress: 'Your progress', finished: 'Completed', all: 'All lessons',
    level: 'Beginner friendly', access: 'Free interactive practice',
    lesson: 'LESSON', instructions: 'Your mission', editor: 'Your code', output: 'Live preview',
    console: 'Console', tests: 'Practice checks', run: 'Run code', check: 'Check answer',
    reset: 'Reset code', hint: 'Need a hint?', hideHint: 'Hide hint', next: 'Next lesson',
    back: 'Back to paths', good: 'Nice work — all checks passed!',
    keepGoing: 'Not quite yet. Review the checklist and try again.',
    consoleEmpty: 'Console output appears here when you run JavaScript.',
    previewInfo: 'Preview updates when you press Run code.',
    noLesson: 'Choose a lesson to start learning.',
    guest: 'Guest mode', signed: 'Academy account connected',
    guestInfo: 'Your practice progress is saved on this device. Sign in to sync completed lessons with your Academy account.',
    signedInfo: 'Completed practice lessons sync with your Academy account.',
    signIn: 'Sign in to Academy', empty: 'No matching lessons',
    tagline: 'Practice makes progress.', save: 'Changes saved locally',
    local: 'Your code drafts stay on this device. This is formative practice, not a certified exam.',
    help: 'HOW IT WORKS', how: 'Learn a concept, edit the code, run the preview, then pass the practice checks.',
    achievements: 'Small steps. Real momentum.', search: 'Find a lesson',
    editorGuide: 'Tip: Ctrl/⌘ + Enter runs your code. Ctrl/⌘ + Shift + Enter checks your work.',
    invalid: 'Please check your code and try again.',
    syncError: 'Saved on this device; online progress sync is unavailable.',
  },
  ar: {
    academy: 'العودة للأكاديمية', learn: 'تعلّم', tracks: 'مسارات التعلم', workspace: 'مساحة البرمجة',
    badge: 'طريقة مختلفة لتعلّم البرمجة', heroLine1: 'المستقبل يبدأ', heroLine2: 'بما تصنعه أنت.',
    intro: 'من أول وسم HTML إلى منطق JavaScript. اقرأ قليلًا، واكتب كودًا كثيرًا، وتعلّم بالممارسة.',
    start: 'ابدأ التعلم مجانًا', explore: 'استكشف المسارات', active: 'رحلتك البرمجية',
    featured: 'اختر مسارك', tracksTitle: 'تعلّم مهارة. وابنِ شيئًا حقيقيًا.',
    tracksIntro: 'دروس قصيرة وتطبيق مباشر واختبارات فورية. دون تحميل أدوات أو إعدادات معقدة.',
    lessons: 'دروس', hours: 'ساعات', open: 'ابدأ المسار', continue: 'تابع التعلم',
    progress: 'إنجازاتك', finished: 'مكتملة', all: 'جميع الدروس',
    level: 'مناسب للمبتدئين', access: 'تدريب تفاعلي مجاني',
    lesson: 'الدرس', instructions: 'مهمتك', editor: 'المحرر البرمجي', output: 'المعاينة الحية',
    console: 'وحدة الإخراج', tests: 'فحوصات التدريب', run: 'شغّل الكود', check: 'افحص الحل',
    reset: 'إعادة التعيين', hint: 'تحتاج مساعدة؟', hideHint: 'إخفاء التلميح', next: 'الدرس التالي',
    back: 'العودة للمسارات', good: 'أحسنت! اجتزت كل الفحوصات.',
    keepGoing: 'لم يكتمل الحل بعد. راجع الفحوصات وأعد المحاولة.',
    consoleEmpty: 'ستظهر رسائل JavaScript هنا بعد التشغيل.',
    previewInfo: 'تتحدث المعاينة عند الضغط على تشغيل الكود.',
    noLesson: 'اختر درسًا للبدء.',
    guest: 'وضع الزائر', signed: 'متصل بحساب الأكاديمية',
    guestInfo: 'يُحفظ تقدمك على هذا الجهاز. سجّل الدخول لمزامنة الدروس المكتملة مع حساب الأكاديمية.',
    signedInfo: 'تُزامن الدروس المكتملة مع حسابك في الأكاديمية.',
    signIn: 'تسجيل الدخول للأكاديمية', empty: 'لا توجد دروس مطابقة',
    tagline: 'الممارسة تصنع التقدم.', save: 'تُحفظ التغييرات محليًا',
    local: 'تُحفظ مسودات الكود على هذا الجهاز. هذه تمارين تدريبية وليست اختبارات معتمدة.',
    help: 'كيف تتعلم؟', how: 'اقرأ الفكرة، عدّل الكود، شغّل المعاينة، ثم اجتز فحوصات التدريب.',
    achievements: 'خطوات صغيرة. نتائج كبيرة.', search: 'ابحث عن درس',
    editorGuide: 'اختصار: Ctrl/⌘ + Enter للتشغيل، و Ctrl/⌘ + Shift + Enter لفحص الحل.',
    invalid: 'راجع الكود وحاول مجددًا.',
    syncError: 'تم الحفظ محليًا، لكن المزامنة غير متاحة حاليًا.',
  },
} as const;

function progressCount(track: Track, completed: string[]) {
  return lessonsFor(track.id).filter(lesson => completed.includes(lesson.id)).length;
}

function getDraft(lesson: Lesson): Files {
  try {
    const raw = localStorage.getItem(STORAGE_DRAFT_PREFIX + lesson.id);
    if (!raw) return {...lesson.starter};
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === 'object' && ['html','css','js'].every(key =>
      typeof (data as Record<string, unknown>)[key] === 'string' &&
      ((data as Record<string, string>)[key]).length <= 40000)) return data as Files;
  } catch { /* Private browsing or unavailable storage */ }
  return {...lesson.starter};
}

function ProgressRing({percent}: {percent: number}) {
  return <div className="code-progress-ring" style={{background: `conic-gradient(#91f0c2 ${percent}%, #293346 ${percent}% 100%)`}}>
    <div>{percent}%</div>
  </div>;
}

function TrackCard({track, locale, count, onOpen}: {
  track: Track; locale: CodeLocale; count: number; onOpen: () => void;
}) {
  const t = copy[locale], total = lessonsFor(track.id).length;
  return <button className="code-track-card" onClick={onOpen} type="button">
    <span className="code-track-symbol" style={{background: track.accent}}>{track.symbol}</span>
    <span className="code-track-meta">{track.eyebrow[locale]}</span>
    <strong>{track.title[locale]}</strong>
    <span className="code-track-desc">{track.description[locale]}</span>
    <span className="code-track-foot">
      <span><BookOpen size={14}/>{total} {t.lessons}</span>
      <span>{count ? `${count}/${total} ${t.finished}` : t.open} <ArrowRight size={16}/></span>
    </span>
    <span className="code-track-line"><i style={{width: `${count / total * 100}%`}}/></span>
  </button>;
}

export function CodeExperience({locale, initialLesson}: {locale: CodeLocale; initialLesson: string|null}) {
  const t=copy[locale], rtl=locale==='ar';
  const [activeId,setActiveId]=useState<string|null>(null);
  const active=activeId?lessonMap.get(activeId)||null:null;
  const [files,setFiles]=useState<Files>({html:'',css:'',js:''});
  const [selectedTab,setSelectedTab]=useState<Tab>('html');
  const [isHintOpen,setHintOpen]=useState(false);
  const [results,setResults]=useState<CheckResult[]|null>(null);
  const [checked,setChecked]=useState(false);
  const [completed,setCompleted]=useState<string[]>([]);
  const [authenticated,setAuthenticated]=useState(false);
  const [progressReady,setProgressReady]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [runId,setRunId]=useState(0);
  const [previewHtml,setPreviewHtml]=useState('');
  const [logs,setLogs]=useState<ConsoleLine[]>([]);
  const [previewTab,setPreviewTab]=useState<'preview'|'console'>('preview');
  const [search,setSearch]=useState('');
  const [mobileMenu,setMobileMenu]=useState(false);
  const [resetConfirm,setResetConfirm]=useState(false);
  const frameRef=useRef<HTMLIFrameElement|null>(null);
  const runRef=useRef(0);

  const openLesson=useCallback((id: string, updateUrl=true)=>{
    const lesson=lessonMap.get(id);
    if(!lesson)return;
    const draft=getDraft(lesson);
    setActiveId(id);setFiles(draft);
    setSelectedTab(lesson.track==='javascript'?'js':lesson.track);
    setResults(null);setChecked(false);setHintOpen(false);setLogs([]);setPreviewTab('preview');
    setResetConfirm(false);setMobileMenu(false);setFeedback('');
    const nextRun=runRef.current+1;
    runRef.current=nextRun;setRunId(nextRun);setPreviewHtml(previewDocument(draft,nextRun));
    if(updateUrl)history.pushState({lesson:id},'',`/code/${locale}?lesson=${encodeURIComponent(id)}`);
    window.scrollTo({top:0,behavior:'instant'});
  },[locale]);

  const closeLesson=useCallback((updateUrl=true)=>{
    setActiveId(null);setMobileMenu(false);setFeedback('');
    if(updateUrl)history.pushState({},'',`/code/${locale}`);
  },[locale]);

  useEffect(()=>{
    const requested=new URLSearchParams(location.search).get('lesson')||initialLesson;
    if(requested && lessonMap.has(requested))openLesson(requested,false);
    function onBack(){
      const id=new URLSearchParams(location.search).get('lesson');
      if(id && lessonMap.has(id))openLesson(id,false);else closeLesson(false);
    }
    window.addEventListener('popstate',onBack);
    return ()=>window.removeEventListener('popstate',onBack);
  },[openLesson,closeLesson,initialLesson]);

  useEffect(()=>{
    let cancelled=false;
    let guest: string[]=[];
    try {
      const raw=localStorage.getItem(STORAGE_PROGRESS);
      const decoded:unknown=raw && JSON.parse(raw);
      if(Array.isArray(decoded))guest=decoded.filter((id):id is string=>typeof id==='string'&&lessonMap.has(id));
    }catch{/* unavailability must not break learning */}
    setCompleted(guest);setProgressReady(true);
    fetch('/api/code/progress',{cache:'no-store'})
      .then(async response=>response.ok?await response.json():null)
      .then(async data=>{
        if(cancelled || !data || data.authenticated!==true || !Array.isArray(data.completed))return;
        setAuthenticated(true);
        const serverIds=data.completed.filter((id:unknown):id is string=>typeof id==='string'&&lessonMap.has(id));
        setCompleted(Array.from(new Set([...serverIds,...guest])));
        for(const id of guest.filter(item=>!serverIds.includes(item))){
          await fetch('/api/code/progress',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({lessonId:id})}).catch(()=>undefined);
        }
        // Guest practice remains available locally, but no credential is persisted.
      }).catch(()=>undefined);
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    if(!active)return;
    try{localStorage.setItem(STORAGE_DRAFT_PREFIX+active.id,JSON.stringify(files));}catch{}
  },[active,files]);

  useEffect(()=>{
    if(!progressReady)return;
    try{localStorage.setItem(STORAGE_PROGRESS,JSON.stringify(completed));}catch{}
  },[progressReady,completed]);

  useEffect(()=>{
    const listener=(event:MessageEvent)=>{
      if(event.source!==frameRef.current?.contentWindow)return;
      const data=event.data;
      if(!data || typeof data!=='object'||data.academyCodePreview!==true||data.runId!==runRef.current)return;
      if(!['log','warn','error'].includes(data.kind)||typeof data.value!=='string')return;
      if(data.kind==='log'||data.kind==='warn'||data.kind==='error'){
        setLogs(previous=>[...previous.slice(-39),{kind:data.kind,value:data.value.slice(0,700)}]);
      }
    };
    window.addEventListener('message',listener);
    return()=>window.removeEventListener('message',listener);
  },[]);

  const totalCompleted=completed.filter(id=>lessonMap.has(id)).length;
  const currentTrack=active?tracks.find(track=>track.id===active.track)!:null;
  const trackLessons=currentTrack?lessonsFor(currentTrack.id):[];
  const index=active?trackLessons.findIndex(x=>x.id===active.id):-1;
  const nextLesson=trackLessons[index+1]||null;
  const percent=Math.round(totalCompleted/lessons.length*100);
  const matches=useMemo(()=>{
    const needle=search.trim().toLocaleLowerCase();
    return needle?lessons.filter(lesson=>
      lesson.title.en.toLocaleLowerCase().includes(needle)||
      lesson.title.ar.toLocaleLowerCase().includes(needle)||
      lesson.description.en.toLocaleLowerCase().includes(needle)||
      lesson.description.ar.toLocaleLowerCase().includes(needle)):lessons;
  },[search]);

  function run(){
    const id=runRef.current+1;runRef.current=id;setRunId(id);
    setLogs([]);setPreviewHtml(previewDocument(files,id));setFeedback('');
  }
  async function check(){
    if(!active)return;
    run();
    const next=checkLesson(active,files);
    setResults(next);setChecked(true);
    const passed=next.length>0&&next.every(item=>item.passed);
    setFeedback(passed?t.good:t.keepGoing);
    if(passed){
      setCompleted(previous=>previous.includes(active.id)?previous:[...previous,active.id]);
      if(authenticated){
        try{
          const response=await fetch('/api/code/progress',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({lessonId:active.id})});
          if(!response.ok)setFeedback(t.good+' '+t.syncError);
        }catch{setFeedback(t.good+' '+t.syncError);}
      }
    }
  }
  function changeFile(value:string){
    if(value.length>40000)return;
    setFiles(previous=>({...previous,[selectedTab]:value}));
    setChecked(false);setResults(null);setFeedback('');
  }
  function reset(){
    if(!active)return;
    if(!resetConfirm){setResetConfirm(true);return;}
    const draft={...active.starter};setFiles(draft);
    setResults(null);setChecked(false);setFeedback('');setResetConfirm(false);
    runRef.current+=1;setRunId(runRef.current);
    setPreviewHtml(previewDocument(draft,runRef.current));setLogs([]);
  }
  function editKeyDown(event:React.KeyboardEvent<HTMLTextAreaElement>){
    if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){
      event.preventDefault();
      if(event.shiftKey)void check();else run();
    }
    if(event.key==='Tab'){
      event.preventDefault();
      const target=event.currentTarget, start=target.selectionStart, end=target.selectionEnd;
      const next=files[selectedTab].slice(0,start)+'  '+files[selectedTab].slice(end);
      changeFile(next);
      requestAnimationFrame(()=>{target.selectionStart=target.selectionEnd=start+2;});
    }
  }
  const signInHref=`/${locale}/login`;

  return <div className="code-app" dir={rtl?'rtl':'ltr'}>
    <header className="code-topbar">
      <div className="code-topbar-inner">
        <a className="code-wordmark" href={`/code/${locale}`} onClick={event=>{event.preventDefault();closeLesson();}}>
          <span className="code-mark"><Code2 size={20} strokeWidth={2.5}/></span>
          <span>ALABBAS <strong>CODE</strong></span>
          <span className="code-brand-dot"/>
        </a>
        <nav className={`code-topnav ${mobileMenu?'is-open':''}`} aria-label={t.tracks}>
          <button type="button" onClick={()=>{closeLesson();setMobileMenu(false);}}>{t.tracks}</button>
          <a href={`/${locale}`}>{t.academy}<ExternalLink size={13}/></a>
        </nav>
        <div className="code-top-actions">
          <span className="code-top-count"><Trophy size={15}/>{totalCompleted}/{lessons.length}</span>
          <a className="code-lang" href={`/code/${locale==='en'?'ar':'en'}${active?`?lesson=${encodeURIComponent(active.id)}`:''}`}
            aria-label={locale==='en'?'Switch to Arabic':'التغيير إلى الإنجليزية'}><Globe2 size={15}/>{locale==='en'?'العربية':'EN'}</a>
          <button className="code-menu-toggle" type="button" onClick={()=>setMobileMenu(!mobileMenu)} aria-label={mobileMenu?'Close navigation':'Open navigation'}>
            {mobileMenu?<X size={20}/>:<Menu size={20}/>}
          </button>
        </div>
      </div>
    </header>

    {!active ? <main className="code-home">
      <section className="code-hero">
        <div className="code-hero-copy">
          <p className="code-pill"><span className="code-pulse"/><Sparkles size={14}/>{t.badge}</p>
          <h1>{t.heroLine1}<br/><em>{t.heroLine2}</em></h1>
          <p className="code-hero-description">{t.intro}</p>
          <div className="code-hero-actions">
            <button className="code-primary-btn" type="button" onClick={()=>openLesson(lessons.find(lesson=>!completed.includes(lesson.id))?.id||lessons[0].id)}>
              {t.start}<ArrowRight size={18}/>
            </button>
            <a href="#paths" className="code-outline-btn">{t.explore}<ChevronDown size={17}/></a>
          </div>
          <div className="code-hero-proof"><span><Check size={15}/>{t.access}</span><span><Check size={15}/>{t.level}</span></div>
        </div>
        <div className="code-hero-visual" aria-hidden="true">
          <div className="code-visual-glow"/>
          <div className="code-sample-window">
            <div className="code-sample-top"><span className="code-dot red"/><span className="code-dot yellow"/><span className="code-dot green"/><span>hello-world.html</span><Code2 size={15}/></div>
            <div className="code-sample-body"><div className="code-sample-num">01<br/>02<br/>03<br/>04<br/>05<br/>06</div>
              <pre><span className="code-purple">&lt;main&gt;</span>{'\n  '}<span className="code-purple">&lt;h1&gt;</span>Hello, World!<span className="code-purple">&lt;/h1&gt;</span>{'\n  '}<span className="code-purple">&lt;p&gt;</span>{'\n    '}The best way to learn{'\n    '}is to <span className="code-yellow-text">build.</span>{'\n  '}<span className="code-purple">&lt;/p&gt;</span>{'\n'}<span className="code-purple">&lt;/main&gt;</span></pre></div>
            <div className="code-sample-success"><CheckCheck size={18}/><span>{t.good}</span><span>100%</span></div>
          </div>
          <div className="code-visual-float"><div>JS</div><span>HTML / CSS / JS</span></div>
        </div>
      </section>

      <section className="code-main-section" id="paths">
        <div className="code-section-head">
          <div><p className="code-kicker"><span/>{t.featured}</p><h2>{t.tracksTitle}</h2><p>{t.tracksIntro}</p></div>
          <div className="code-head-decor"><Code2 size={22}/></div>
        </div>
        <div className="code-tracks-grid">
          {tracks.map(track=><TrackCard key={track.id} track={track} locale={locale}
            count={progressCount(track,completed)}
            onOpen={()=>openLesson(lessonsFor(track.id).find(lesson=>!completed.includes(lesson.id))?.id||lessonsFor(track.id)[0].id)}/>)}
        </div>
      </section>

      <section className="code-main-section code-dashboard">
        <div className="code-section-head"><div><p className="code-kicker"><span/>{t.active}</p><h2>{t.achievements}</h2></div></div>
        <div className="code-dashboard-grid">
          <div className="code-progress-panel">
            <ProgressRing percent={percent}/>
            <div><strong>{totalCompleted} <span>/ {lessons.length}</span></strong><p>{t.finished} · {t.progress}</p></div>
            <button type="button" className="code-small-action"
              onClick={()=>openLesson(lessons.find(item=>!completed.includes(item.id))?.id||lessons[0].id)}>
              {t.continue}<ArrowRight size={16}/></button>
          </div>
          <div className="code-guide-panel"><div className="code-guide-icon"><Lightbulb size={24}/></div><div><small>{t.help}</small><p>{t.how}</p></div></div>
        </div>
      </section>
      <section className="code-main-section code-lesson-list">
        <div className="code-section-head"><div><p className="code-kicker"><span/>{t.all}</p><h2>{t.all}</h2></div></div>
        <label className="code-search"><Search size={18}/><span className="code-sr-only">{t.search}</span>
          <input placeholder={t.search} value={search} onChange={event=>setSearch(event.target.value)}/></label>
        <div className="code-lesson-directory">
          {matches.map((lesson,i)=><button type="button" key={lesson.id} onClick={()=>openLesson(lesson.id)}>
            <span className={`code-list-badge ${completed.includes(lesson.id)?'done':''}`}>{completed.includes(lesson.id)?<Check size={18}/>:String(i+1).padStart(2,'0')}</span>
            <span className="code-directory-main"><strong>{lesson.title[locale]}</strong><small>{lesson.description[locale]}</small></span>
            <span className="code-directory-track">{tracks.find(track=>track.id===lesson.track)?.title[locale]}</span>
            <ChevronRight size={18} className="code-chevron"/></button>)}
          {!matches.length&&<div className="code-empty">{t.empty}</div>}
        </div>
      </section>
    </main> : <main className="code-studio">
      <div className="code-studio-banner">
        <button type="button" onClick={()=>closeLesson()}><ArrowLeft size={17}/>{t.back}</button>
        <div className="code-studio-progress"><span>{currentTrack?.title[locale]}</span><div><i style={{width:`${trackLessons.filter(item=>completed.includes(item.id)).length/trackLessons.length*100}%`}}/></div><span>{trackLessons.filter(item=>completed.includes(item.id)).length}/{trackLessons.length}</span></div>
      </div>
      <div className="code-studio-grid">
        <aside className="code-studio-sidebar">
          <div className="code-sidebar-head"><span>{currentTrack?.eyebrow[locale]}</span><strong>{currentTrack?.title[locale]}</strong></div>
          <div className="code-sidebar-label"><ListChecks size={15}/>{t.all}</div>
          <div className="code-sidebar-items">
            {trackLessons.map((lesson,i)=><button type="button" key={lesson.id} onClick={()=>openLesson(lesson.id)}
              className={`${lesson.id===active.id?'active':''}`}>
              <span className={`code-sidebar-number ${completed.includes(lesson.id)?'done':''}`}>{completed.includes(lesson.id)?<Check size={14}/>:String(i+1).padStart(2,'0')}</span>
              <span>{lesson.title[locale]}</span>{lesson.id===active.id&&<ChevronRight size={15}/>}</button>)}
          </div>
          <div className="code-sidebar-bottom"><LockKeyhole size={15}/>{authenticated?t.signed:t.guest}</div>
        </aside>

        <section className="code-instructions">
          <p className="code-small-overline">{t.lesson} {String(index+1).padStart(2,'0')} / {String(trackLessons.length).padStart(2,'0')}</p>
          <h1>{active.title[locale]}</h1>
          <p className="code-instruction-description">{active.description[locale]}</p>
          <div className="code-instruction-divider"/>
          <div className="code-mission-head"><span><ListChecks size={19}/></span><strong>{t.instructions}</strong></div>
          <p className="code-task-text">{active.task[locale]}</p>
          <button type="button" className="code-hint-trigger" onClick={()=>setHintOpen(!isHintOpen)}>
            <Lightbulb size={17}/>{isHintOpen?t.hideHint:t.hint}{isHintOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
          </button>
          {isHintOpen&&<div className="code-hint-box">{active.hint[locale]}</div>}
          <div className="code-tests-area">
            <h2><ListChecks size={18}/>{t.tests}<span>{results?.filter(item=>item.passed).length||0}/{active.checks.length}</span></h2>
            <div className="code-checks-list">
              {(results||active.checks.map(item=>({label:item.label,passed:false}))).map((result,i)=>
                <div className={`code-check-item ${results?(result.passed?'passed':'failed'):''}`} key={i}>
                  <span>{result.passed?<Check size={13}/>:i+1}</span>{result.label[locale]}</div>)}
            </div>
            {checked&&<p className={`code-feedback ${results?.every(result=>result.passed)?'positive':'negative'}`} role="status">{feedback}</p>}
            {checked&&results?.every(result=>result.passed)&&nextLesson&&
              <button type="button" className="code-next-button" onClick={()=>openLesson(nextLesson.id)}>{t.next}<ArrowRight size={16}/></button>}
          </div>
        </section>

        <section className="code-workspace">
          <div className="code-workspace-head"><span><Terminal size={17}/>{t.workspace}</span><span className="code-file-status"><span/>{t.save}</span></div>
          <div className="code-workspace-panels">
            <div className="code-editor-section">
              <div className="code-editor-tabs">
                {(['html','css','js'] as const).map(tab=><button key={tab} type="button" onClick={()=>setSelectedTab(tab)}
                  className={selectedTab===tab?'selected':''}>
                  <span className={`code-file-dot ${tab}`}/>{tab==='js'?'script.js':tab==='css'?'style.css':'index.html'}</button>)}
              </div>
              <div className="code-editor-body">
                <div className="code-gutter" aria-hidden="true">{Array.from({length:Math.max(18,files[selectedTab].split('\n').length)},(_,i)=><span key={i}>{i+1}</span>)}</div>
                <textarea value={files[selectedTab]} onChange={e=>changeFile(e.target.value)} onKeyDown={editKeyDown}
                  aria-label={`${selectedTab} ${t.editor}`} spellCheck={false}
                  autoComplete="off" autoCapitalize="off" autoCorrect="off"
                  dir="ltr" maxLength={40000}/></div>
              <div className="code-editor-actions">
                <span className="code-editor-guide" title={t.editorGuide}><CircleHelp size={16}/><span>{t.editorGuide}</span></span>
                <div className="code-action-buttons">
                  <button type="button" className="code-reset-button" onClick={reset}><RotateCcw size={15}/>{resetConfirm?(rtl?'تأكيد الإعادة':'Confirm reset'):t.reset}</button>
                  <button type="button" className="code-run-button" onClick={run}><Play size={15} fill="currentColor"/>{t.run}</button>
                  <button type="button" className="code-check-button" onClick={()=>void check()}><CheckCheck size={17}/>{t.check}</button>
                </div>
              </div>
            </div>
            <div className="code-output-section">
              <div className="code-output-header">
                <div><button type="button" className={previewTab==='preview'?'active':''} onClick={()=>setPreviewTab('preview')}><PanelRight size={15}/>{t.output}</button>
                  <button type="button" className={previewTab==='console'?'active':''} onClick={()=>setPreviewTab('console')}><Terminal size={15}/>{t.console}</button></div>
                <span className="code-output-live"><i/>LIVE</span>
              </div>
              <div className="code-preview-frame" hidden={previewTab!=='preview'}>
                <iframe key={runId} ref={frameRef} sandbox="allow-scripts" srcDoc={previewHtml}
                  title={t.output} referrerPolicy="no-referrer"/>
              </div>
              {previewTab==='console'&&<div className="code-console-log" role="log" aria-live="polite">
                {logs.length?logs.map((line,i)=><pre key={i} className={`code-console-${line.kind}`}>{line.value}</pre>):
                  <span>{t.consoleEmpty}</span>}</div>}
            </div>
          </div>
          <div className="code-workspace-footer"><span><LockKeyhole size={13}/>{t.local}</span><span>{t.previewInfo}</span></div>
        </section>
      </div>
    </main>}
    <footer className="code-footer"><div><span>ALABBAS <strong>CODE</strong></span><span>{t.tagline}</span></div><a href={`/${locale}`}>{t.academy}<ArrowRight size={15}/></a></footer>
  </div>;
}
