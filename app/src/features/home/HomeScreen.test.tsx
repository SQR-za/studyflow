import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomeScreen } from './HomeScreen'
import type { DrillPreset, Lesson, LessonContent, Subject } from '../../types'

const question = { id: 'q1', q: 'Question?', choices: ['A', 'B'], answer: 0 }
const lesson: Lesson = { id: 'mpi-foundations', label: '1 · MPI Foundations', questions: [question] }
const subject: Subject = {
  name: 'CCCS-422 Final',
  code: 'CCCS422-FINAL',
  color: '#f43f5e',
  chapters: [{ id: 't6', label: 'Topic 6', questions: [question], lessons: [lesson] }],
}
const quickPreset: DrillPreset = {
  id: 'rapid-mpi-foundations-4',
  label: '⚡ MPI 1 · Foundations',
  count: 4,
  timed: true,
  quick: true,
  lessonIds: [lesson.id],
  questions: [question, { ...question, id: 'q2' }, { ...question, id: 'q3' }, { ...question, id: 'q4' }],
}

const content: LessonContent = {
  summary: 'CSS boxes have content, padding, border, and margin.',
  objectives: ['Identify every box-model layer.'],
  blocks: [{ type: 'text', paragraphs: ['Padding sits inside the border.'] }],
  recap: ['Margin is outside the border.'],
}

function renderHome(nextSubject: Subject, overrides: Partial<React.ComponentProps<typeof HomeScreen>> = {}) {
  const props: React.ComponentProps<typeof HomeScreen> = {
    data: { [nextSubject.code]: nextSubject },
    order: [nextSubject.code],
    schedule: { plan: [], exams: [] },
    store: { q: {}, star: {}, tests: {}, attempts: [] },
    settings: { includeExtra: true, goal: 50, sound: false, sessionMins: 20, fullscreen: false, hidden: [] },
    daily: { dates: {} },
    quickPresets: [quickPreset],
    onOpenScreen: vi.fn(),
    onStart: vi.fn(),
    onStartStarred: vi.fn(),
    onStartDue: vi.fn(),
    onStartLessonTest: vi.fn(),
    onStartLessonQuickTest: vi.fn(),
    onOpenLesson: vi.fn(),
    onOpenNotes: vi.fn(),
    onToggleExtra: vi.fn(),
    onChangeDuration: vi.fn(),
    ...overrides,
  }
  return render(<HomeScreen {...props} />)
}

describe('HomeScreen rapid section tests', () => {
  it('offers separate rapid and comprehensive test actions', () => {
    const onQuick = vi.fn()
    const onComprehensive = vi.fn()
    renderHome(subject, { onStartLessonTest: onComprehensive, onStartLessonQuickTest: onQuick })

    fireEvent.click(screen.getByRole('button', { name: /سريع/ }))
    expect(onQuick).toHaveBeenCalledWith(subject.code, lesson, quickPreset)
    expect(onComprehensive).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /شامل/ }))
    expect(onComprehensive).toHaveBeenCalledWith(subject.code, lesson)
  })
})

describe('HomeScreen lesson reading', () => {
  it('opens content-backed lessons from the row and the explicit lesson action', () => {
    const readableLesson: Lesson = { ...lesson, id: 'css-boxes', label: 'CSS Box Model', content }
    const readableSubject: Subject = {
      ...subject,
      chapters: [{ ...subject.chapters[0], id: 'css', lessons: [readableLesson] }],
    }
    const onOpenLesson = vi.fn()
    const onStart = vi.fn()
    renderHome(readableSubject, { quickPresets: [], onOpenLesson, onStart })

    fireEvent.click(screen.getByRole('button', { name: /CSS Box Model/ }))
    expect(onOpenLesson).toHaveBeenCalledWith(readableSubject.code, 'css', readableLesson.id)
    expect(onStart).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /درس/ }))
    expect(onOpenLesson).toHaveBeenCalledTimes(2)
  })

  it('keeps the existing learn action when a lesson has no reading content', () => {
    const onOpenLesson = vi.fn()
    const onStart = vi.fn()
    renderHome(subject, { onOpenLesson, onStart })

    fireEvent.click(screen.getByRole('button', { name: /MPI Foundations/ }))

    expect(onOpenLesson).not.toHaveBeenCalled()
    expect(onStart).toHaveBeenCalledWith({
      code: subject.code,
      scope: '__LESSONS__',
      mode: 'learn',
      lessonIds: new Set([lesson.id]),
    })
    expect(screen.queryByRole('button', { name: /درس/ })).not.toBeInTheDocument()
  })
})
