type Lesson = {id: string};
type Progress = {lessonId: string; completedAt: Date | string | null; updatedAt?: Date | string};
export function learningProgress(lessons: Lesson[], progress: Progress[]) {
  const visible = new Set(lessons.map(lesson => lesson.id));
  const complete = new Set(progress.filter(item => item.completedAt && visible.has(item.lessonId)).map(item => item.lessonId));
  const latest = progress.filter(item => !item.completedAt && visible.has(item.lessonId)).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0];
  const next = lessons.find(lesson => lesson.id === latest?.lessonId) || lessons.find(lesson => !complete.has(lesson.id)) || lessons[0];
  return {completed: complete.size, total: lessons.length, percentage: lessons.length ? Math.round(complete.size / lessons.length * 100) : 0, next};
}
