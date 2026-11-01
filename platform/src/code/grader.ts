import type {Check, Files, Lesson} from './lessons';

export type CheckResult = {label: Check['label']; passed: boolean};

function stripComments(source: string): string {
  // A lightweight structural checker, not a JavaScript parser or a secure exam.
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function cssRuleMatches(rules: CSSRuleList, selector: string, property: string, contains?: string): boolean {
  for (const rule of Array.from(rules)) {
    if ('cssRules' in rule && cssRuleMatches((rule as CSSGroupingRule).cssRules, selector, property, contains)) return true;
    if (!('selectorText' in rule) || !('style' in rule)) continue;
    const styleRule = rule as CSSStyleRule;
    const matches = styleRule.selectorText.split(',').map(value => value.trim().toLowerCase()).includes(selector.toLowerCase());
    const value = styleRule.style.getPropertyValue(property).trim();
    if (matches && value && (!contains || value.toLowerCase().includes(contains.toLowerCase()))) return true;
  }
  return false;
}

/** In-browser guidance only. Achievements are not an examination or trusted certification. */
export function checkLesson(lesson: Lesson, files: Files): CheckResult[] {
  const document = typeof DOMParser === 'undefined' ? null :
    new DOMParser().parseFromString(files.html, 'text/html');
  let stylesheet: CSSStyleSheet | null = null;
  if (typeof CSSStyleSheet !== 'undefined') {
    try {
      stylesheet = new CSSStyleSheet();
      stylesheet.replaceSync(files.css);
    } catch { stylesheet = null; }
  }
  const script = stripComments(files.js);
  return lesson.checks.map(check => {
    let passed = false;
    try {
      if (check.type === 'html') {
        const matched = document?.querySelector(check.selector);
        const attr = check.attribute ? matched?.getAttribute(check.attribute) : undefined;
        passed = Boolean(matched) && (!check.attribute || Boolean(attr)) &&
          (!check.contains || (matched?.textContent || '').trim().includes(check.contains));
      } else if (check.type === 'css') {
        passed = Boolean(stylesheet && cssRuleMatches(stylesheet.cssRules, check.selector, check.property, check.contains));
      } else {
        passed = new RegExp(check.pattern).test(script);
      }
    } catch { passed = false; }
    return {label: check.label, passed};
  });
}

/**
 * The learner's JavaScript executes ONLY in an opaque-origin iframe.
 * Never evaluate it in the Academy origin, Node.js, or a same-origin worker.
 * Resource and network access are constrained by the iframe's CSP.
 */
export function previewDocument(files: Files, runId: number): string {
  const bounded = {
    html: files.html.slice(0, 40000),
    css: files.css.slice(0, 40000),
    js: files.js.slice(0, 40000),
  };
  // Do not allow student CSS to break out of the <style> element.
  const css = bounded.css.replace(/<\/style/gi, '<\\/style');
  // Encode student code as a JS string; insert it as a sandboxed script element without eval().
  const script = JSON.stringify(bounded.js).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; img-src data: https:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>*,*::before,*::after{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:24px;color:#152238}img{max-width:100%} ${css}</style>
</head><body>${bounded.html}
<script>
(function(){
var id=${runId};
function report(kind,value){try{parent.postMessage({academyCodePreview:true,runId:id,kind:kind,value:String(value).slice(0,700)},'*')}catch(e){}}
function format(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return '[object]'}}
['log','warn','error'].forEach(function(kind){
  console[kind]=function(){report(kind,Array.from(arguments).map(format).join(' '))}
});
window.addEventListener('error',function(e){report('error',e.message||'JavaScript error')});
window.addEventListener('unhandledrejection',function(e){report('error',e.reason&&e.reason.message?e.reason.message:e.reason||'Promise rejected')});
try{
  var student=document.createElement('script');
  student.textContent=${script};
  document.body.appendChild(student);
  report('ready','');
}catch(e){report('error',e&&e.message?e.message:e)}
})();
</script>
</body></html>`;
}
