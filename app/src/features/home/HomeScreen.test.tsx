import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomeScreen } from './HomeScreen'
import type { DrillPreset, Lesson, Subject } from '../../types'

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

describe('HomeScreen rapid section tests', () => {
  it('offers separate rapid and comprehensive test actions', () => {
    const onQuick = vi.fn()
    const onComprehensive = vi.fn()
    render(<HomeScreen
      data={{ [subject.code]: subject }}
      order={[subject.code]}
      schedule={{ plan: [], exams: [] }}
      store={{ q: {}, star: {}, tests: {}, attempts: [] }}
      settings={{ includeExtra: true, goal: 50, sound: false, sessionMins: 20, fullscreen: false, hidden: [] }}
      daily={{ dates: {} }}
      quickPresets={[quickPreset]}
      onOpenScreen={vi.fn()}
      onStart={vi.fn()}
      onStartStarred={vi.fn()}
      onStartDue={vi.fn()}
      onStartLessonTest={onComprehensive}
      onStartLessonQuickTest={onQuick}
      onOpenNotes={vi.fn()}
      onToggleExtra={vi.fn()}
      onChangeDuration={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('button', { name: /سريع/ }))
    expect(onQuick).toHaveBeenCalledWith(subject.code, lesson, quickPreset)
    expect(onComprehensive).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /شامل/ }))
    expect(onComprehensive).toHaveBeenCalledWith(subject.code, lesson)
  })
})
