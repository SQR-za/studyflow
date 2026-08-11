import type { StudyQuestion } from '../types'

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function todayString(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000)
}

export function subjectShortName(name: string): string {
  return name.split(' · ')[0]
}

export function isChoice(question: StudyQuestion): question is Extract<StudyQuestion, { choices: string[] }> {
  return 'choices' in question && Array.isArray(question.choices)
}

export function isMatch(question: StudyQuestion): question is Extract<StudyQuestion, { type: 'match' }> {
  return question.type === 'match'
}

export function isPractice(question: StudyQuestion): question is Extract<StudyQuestion, { solution: string }> {
  return 'solution' in question && typeof question.solution === 'string'
}

export function readiness(percent: number): { className: string; label: string } {
  if (percent >= 90) return { className: 'ready', label: 'متقن — جاهز' }
  if (percent >= 80) return { className: 'near', label: 'قريب جدًا' }
  if (percent >= 70) return { className: 'near', label: 'جيد، راجع الأخطاء' }
  return { className: 'review', label: 'غير جاهز بعد' }
}
