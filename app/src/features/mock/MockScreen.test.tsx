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
  code: 'SEC-PLUS',
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
      drillBundles={{ [subject.code]: { version: 2, subject: subject.code, chapters: {}, presets: [] } }}
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

  it('launches a full lesson preset through the comprehensive runner, including matching questions', () => {
    const onStartComprehensive = vi.fn()
    const comprehensivePreset = {
      id: 'web-css-comprehensive',
      label: 'CSS Comprehensive',
      count: questions.length,
      timed: true,
      lessonIds: ['mpi-full'],
    }
    render(<MockScreen
      data={{ [subject.code]: subject }}
      order={[subject.code]}
      hidden={[]}
      drillBundles={{ [subject.code]: { version: 2, subject: subject.code, chapters: {}, presets: [comprehensivePreset] } }}
      onBack={vi.fn()}
      onRecord={vi.fn()}
      onReviewWrong={vi.fn()}
      onStartComprehensive={onStartComprehensive}
    />)

    fireEvent.click(screen.getByRole('button', { name: /CSS Comprehensive/ }))

    expect(onStartComprehensive).toHaveBeenCalledWith(questions, subject.code, 'CSS Comprehensive', ['mpi-full'])
    expect(onStartComprehensive.mock.calls[0][0]).toContain(matchQuestion)
  })

  it('keeps the legacy weighted mock runner choice-only', () => {
    const onStartComprehensive = vi.fn()
    const weightedPreset = {
      id: 'weighted-mock',
      label: 'Weighted Mock',
      timed: true,
      parts: [{ chapterId: 'topic-6', count: questions.length }],
    }
    render(<MockScreen
      data={{ [subject.code]: subject }}
      order={[subject.code]}
      hidden={[]}
      drillBundles={{ [subject.code]: { version: 2, subject: subject.code, chapters: {}, presets: [weightedPreset] } }}
      onBack={vi.fn()}
      onRecord={vi.fn()}
      onReviewWrong={vi.fn()}
      onStartComprehensive={onStartComprehensive}
    />)

    fireEvent.click(screen.getByRole('button', { name: /Weighted Mock/ }))

    expect(onStartComprehensive).not.toHaveBeenCalled()
    expect(screen.getByText(`1/${choiceQuestions.length}`)).toBeInTheDocument()
    expect(screen.queryByText(matchQuestion.q)).not.toBeInTheDocument()
  })

  it('shows rapid-question kind, formatted code, and fast detection guidance in review', () => {
    const rapidQuestion: ChoiceQuestion = {
      id: 'rapid-css-001',
      kind: 'find_fix',
      q: 'Find the error:\n```css\n.card { display: flex; }\n```',
      hint_ar: 'طريقة الكشف السريعة: افحصي الخاصية داخل القاعدة.',
      choices: ['No error', 'Remove display'],
      answer: 0,
      explanation_ar: 'السبب: display: flex صحيحة.',
    }
    const rapidPreset = {
      id: 'rapid-css',
      label: 'CSS rapid',
      quick: true,
      count: 1,
      lessonIds: ['mpi-full'],
      questions: [rapidQuestion],
    }

    render(<MockScreen
      data={{ [subject.code]: subject }}
      order={[subject.code]}
      hidden={[]}
      drillBundles={{ [subject.code]: { version: 2, subject: subject.code, chapters: {}, presets: [rapidPreset] } }}
      onBack={vi.fn()}
      onRecord={vi.fn()}
      onReviewWrong={vi.fn()}
      onStartComprehensive={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('button', { name: /CSS rapid/ }))
    expect(screen.getByText('🛠 اكتشف الخطأ')).toBeVisible()
    expect(screen.getByText('.card { display: flex; }')).toHaveAttribute('data-language', 'css')

    fireEvent.click(screen.getByRole('button', { name: /إنهاء/ }))

    expect(screen.getAllByText('🛠 اكتشف الخطأ')).toHaveLength(1)
    expect(screen.queryByText(/```css/)).not.toBeInTheDocument()
    expect(screen.getByText(rapidQuestion.hint_ar!)).toBeVisible()
  })
})
