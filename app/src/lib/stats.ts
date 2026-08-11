import type {
  Chapter,
  ChapterStats,
  Lesson,
  LessonStats,
  OverallStats,
  ProgressStore,
  StudyQuestion,
  Subject,
  SubjectStats,
} from '../types'
import { MASTERY_BOX } from './constants'

export function visibleQuestions(chapter: Chapter, includeExtra = true): StudyQuestion[] {
  const questions = Array.isArray(chapter.questions) ? chapter.questions : []
  return includeExtra ? questions : questions.filter((question) => question.src !== 'extra')
}

export function visibleLessonQuestions(lesson: Lesson, includeExtra = true): StudyQuestion[] {
  const questions = Array.isArray(lesson.questions) ? lesson.questions : []
  return includeExtra ? questions : questions.filter((question) => question.src !== 'extra')
}

export function isWeak(store: ProgressStore, id: string): boolean {
  const state = store.q[id]
  return Boolean(state && state.wrong > 0 && state.box < MASTERY_BOX)
}

export function chapterStats(chapter: Chapter, store: ProgressStore, includeExtra = true): ChapterStats {
  let mastered = 0
  let seen = 0
  let weak = 0
  const items = [...visibleQuestions(chapter, includeExtra), ...(chapter.practice ?? [])]

  for (const question of items) {
    const state = store.q[question.id]
    if (!state) continue
    if (state.seen > 0) seen += 1
    if (state.box >= MASTERY_BOX) mastered += 1
    if (isWeak(store, question.id)) weak += 1
  }
  return { mastered, seen, weak, total: items.length }
}

export function lessonStats(lesson: Lesson, store: ProgressStore, includeExtra = true): LessonStats {
  let mastered = 0
  let weak = 0
  const items = visibleLessonQuestions(lesson, includeExtra)
  for (const question of items) {
    const state = store.q[question.id]
    if (!state) continue
    if (state.box >= MASTERY_BOX) mastered += 1
    if (isWeak(store, question.id)) weak += 1
  }
  return { mastered, weak, total: items.length }
}

export function subjectStats(subject: Subject, store: ProgressStore, includeExtra = true): SubjectStats {
  const stats = subject.chapters.reduce<ChapterStats>(
    (total, chapter) => {
      const chapterResult = chapterStats(chapter, store, includeExtra)
      total.mastered += chapterResult.mastered
      total.seen += chapterResult.seen
      total.weak += chapterResult.weak
      total.total += chapterResult.total
      return total
    },
    { mastered: 0, seen: 0, weak: 0, total: 0 },
  )
  return { ...stats, percent: stats.total ? Math.round((stats.mastered / stats.total) * 100) : 0 }
}

export function visibleOrder(order: readonly string[], hidden: readonly string[] = []): string[] {
  const visible = order.filter((code) => !hidden.includes(code))
  return visible.length ? visible : [...order]
}

export function overallStats(
  data: Record<string, Subject>,
  order: readonly string[],
  store: ProgressStore,
  includeExtra = true,
  hidden: readonly string[] = [],
): OverallStats {
  const totals: ChapterStats = { mastered: 0, seen: 0, weak: 0, total: 0 }
  for (const code of visibleOrder(order, hidden)) {
    const subject = data[code]
    if (!subject) continue
    const result = subjectStats(subject, store, includeExtra)
    totals.mastered += result.mastered
    totals.seen += result.seen
    totals.weak += result.weak
    totals.total += result.total
  }
  return {
    ...totals,
    masteryPercent: totals.total ? Math.round((totals.mastered / totals.total) * 100) : 0,
    seenPercent: totals.total ? Math.round((totals.seen / totals.total) * 100) : 0,
  }
}

export function dueQuestions(
  data: Record<string, Subject>,
  order: readonly string[],
  store: ProgressStore,
  includeExtra = true,
  now = Date.now(),
): StudyQuestion[] {
  const due: StudyQuestion[] = []
  for (const code of order) {
    const subject = data[code]
    if (!subject) continue
    for (const chapter of subject.chapters) {
      for (const question of [...visibleQuestions(chapter, includeExtra), ...(chapter.practice ?? [])]) {
        const state = store.q[question.id]
        if (state && state.seen > 0 && state.due > 0 && state.due <= now) due.push(question)
      }
    }
  }
  return due
}

export function starredQuestions(
  data: Record<string, Subject>,
  order: readonly string[],
  store: ProgressStore,
  includeExtra = true,
): StudyQuestion[] {
  const starred: StudyQuestion[] = []
  for (const code of order) {
    const subject = data[code]
    if (!subject) continue
    for (const chapter of subject.chapters) {
      for (const question of [...visibleQuestions(chapter, includeExtra), ...(chapter.practice ?? [])]) {
        if (store.star[question.id]) starred.push(question)
      }
    }
  }
  return starred
}

export function chapterById(data: Record<string, Subject>, code: string, id: string): Chapter | null {
  return data[code]?.chapters.find((chapter) => chapter.id === id) ?? null
}

export function codeOfChapter(data: Record<string, Subject>, order: readonly string[], chapterId: string): string | null {
  for (const code of order) {
    if (data[code]?.chapters.some((chapter) => chapter.id === chapterId)) return code
  }
  return null
}

export function lessonById(data: Record<string, Subject>, code: string, id: string): Lesson | null {
  for (const chapter of data[code]?.chapters ?? []) {
    const lesson = chapter.lessons?.find((candidate) => candidate.id === id)
    if (lesson) return lesson
  }
  return null
}

export function lessonForQuestion(data: Record<string, Subject>, code: string, questionId: string): Lesson | null {
  for (const chapter of data[code]?.chapters ?? []) {
    const lesson = chapter.lessons?.find((candidate) => candidate.questions.some((question) => question.id === questionId))
    if (lesson) return lesson
  }
  return null
}
