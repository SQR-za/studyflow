import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChoiceQuestion, MatchQuestion, Subject } from '../../types'
import { MockScreen } from './MockScreen'

const choiceQuestions: ChoiceQuestion[] = Array.from({ length: 45 }, (_, index) => ({
  id: `choice-${index + 1}`,
  q: `Question ${index + 1}?`,
  choices: ['A', 'B', 'C', 'D'],
  answer: 0,
}))
const matchQuestion: MatchQuestion = {
  id: 'match-46',
  type: 'match',
  q: 'Match the concepts.',
  pairs: [['A', '1'], ['B', '2']],
}
const questions = [...choiceQuestions, matchQuestion]
const subject: Subject = {
  name: 'CCCS-422 Final',
  code: 'CCCS422-FINAL',
  color: '#f43f5e',
  chapters: [{
    id: 'topic-6',
    label: 'Topic 6',
    questions,
    lessons: [{ id: 'mpi-full', label: 'MPI full section', questions }],
  }],
}

describe('MockScreen comprehensive selection', () => {
  it('starts every question in the selected section without the 40-question cap', () => {
    const onStartComprehensive = vi.fn()
    const onRecord = vi.fn()
    render(<MockScreen
      data={{ [subject.code]: subject }}
      order={[subject.code]}
      hidden={[]}
      drills={{ version: 2, subject: subject.code, chapters: {}, presets: [] }}
      onBack={vi.fn()}
      onRecord={onRecord}
      onReviewWrong={vi.fn()}
      onStartComprehensive={onStartComprehensive}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'MPI full section' }))
    fireEvent.change(screen.getByLabelText('عدد الأسئلة'), { target: { value: 'all' } })
    expect(screen.getByRole('option', { name: 'كل الأسئلة (46)' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ابدأ الاختبار' }))
    expect(onStartComprehensive).toHaveBeenCalledWith(questions, subject.code, 'قسم كامل · MPI full section', ['mpi-full'])
    expect(onRecord).not.toHaveBeenCalled()
  })
})
