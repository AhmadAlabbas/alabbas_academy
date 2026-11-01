import {describe, expect, it} from 'vitest';
import {checkLesson, previewDocument} from '@/code/grader';
import {lessonMap, lessons, lessonsFor, tracks, type Files} from '@/code/lessons';

describe('ALABBAS Code curriculum', () => {
  it('has unique, bounded lesson identifiers and bilingual content', () => {
    expect(tracks).toHaveLength(3);
    expect(lessons.length).toBeGreaterThanOrEqual(12);
    expect(lessonMap.size).toBe(lessons.length);
    for (const track of tracks) expect(lessonsFor(track.id).length).toBeGreaterThanOrEqual(4);
    for (const lesson of lessons) {
      expect(lesson.id).toMatch(/^[a-z0-9-]{1,100}$/);
      expect(tracks.some(track => track.id === lesson.track)).toBe(true);
      for (const field of ['title', 'description', 'task', 'hint'] as const) {
        expect(lesson[field].en.trim().length).toBeGreaterThan(6);
        expect(lesson[field].ar.trim().length).toBeGreaterThan(6);
      }
      expect(lesson.checks.length).toBeGreaterThanOrEqual(2);
      expect(new Set(lesson.checks.map(check => check.label.en)).size).toBe(lesson.checks.length);
      expect(Object.values(lesson.starter).every(value => value.length <= 40000)).toBe(true);
      for (const check of lesson.checks) {
        expect(check.label.en.trim()).not.toBe('');
        expect(check.label.ar.trim()).not.toBe('');
        if (check.type === 'js') expect(() => new RegExp(check.pattern)).not.toThrow();
      }
    }
  });
  it('recognizes meaningful JavaScript answers and rejects missing structures', () => {
    const lesson = lessonMap.get('js-variables')!;
    const starter: Files = {...lesson.starter, js: 'const name = "Ada"; console.log(name);'};
    expect(checkLesson(lesson, starter).every(result => result.passed)).toBe(true);
    expect(checkLesson(lesson, {...starter, js: 'const age = 12;'}).every(result => result.passed)).toBe(false);
    expect(checkLesson(lesson, {...starter, js: '// const name = "Fake";\nlet x = 1;'}).every(result => result.passed)).toBe(false);
  });
  it('constrains preview networking and isolates arbitrary learner scripts', () => {
    const source = previewDocument({
      html: '<p>Hello</p>',
      css: 'body{color:red} </style><script>evil()</script>',
      js: 'console.log("</script><script>evil()</script>")',
    }, 27);
    expect(source).toContain("default-src 'none'");
    expect(source).toContain("connect-src 'none'");
    expect(source).toContain("form-action 'none'");
    expect(source).toContain('runId:id');
    expect(source).toContain('\\u003c/script');
    expect(source).not.toContain('color:red} </style><script>evil()');
    expect(source).not.toContain('console.log("</script><script>evil()</script>")');
  });
});
