import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { mathTextToSafeHtml } from '../../components/MathText'
import type { ChoiceQuestion, MatchQuestion, PracticeQuestion, SessionMeta } from '../../types'
import { SessionScreen } from './SessionScreen'
import { createSessionEngine, gradeActiveCard, moveToNextCard } from './sessionEngine'

const meta: SessionMeta = {
  code: 'TEST-101',
  scope: 'ch-1',
  mode: 'all',
  color: '#2dd4bf',
  subject: 'Test subject',
  label: 'Chapter 1',
}

const baseProps = {
  meta,
  progress: {},
  starred: {},
  random: () => 0,
  onProgressChange: vi.fn(),
  onStarChange: vi.fn(),
  onExit: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('keeps the original MCQ id, supports keys, RTL, and moves focus to the next action', async () => {
  const question: ChoiceQuestion = {
    id: 'stable-q-001',
    q: 'Which call gets `MPI_Comm_rank`?',
    choices: ['MPI_Init', 'MPI_Comm_rank', 'MPI_Finalize', 'MPI_Send'],
    answer: 1,
  }
  const onProgressChange = vi.fn()

  render(
    <SessionScreen
      {...baseProps}
      questions={[question]}
      onProgressChange={onProgressChange}
    />,
  )

  expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl')
  const card = screen.getByRole('article')
  await waitFor(() => expect(card).toHaveFocus())

  const correctButton = screen.getByRole('button', { name: /MPI_Comm_rank/ })
  const displayedKey = correctButton.getAttribute('aria-label')?.charAt(0)
  expect(displayedKey).toBeTruthy()
  fireEvent.keyDown(document, { key: displayedKey?.toLowerCase() })

  expect(onProgressChange).toHaveBeenCalledWith(
    'stable-q-001',
    expect.objectContaining({ box: 2, seen: 1, correct: 1, wrong: 0 }),
  )
  await waitFor(() => expect(screen.getByRole('button', { name: /التالي/ })).toHaveFocus())
})

it('keeps the Arabic translation and hint hidden until each one is requested', () => {
  const question: ChoiceQuestion = {
    id: 'assist-001',
    q: 'What does `MPI_Comm_rank` return?',
    q_ar: 'ما الذي تعيده الدالة MPI_Comm_rank؟',
    hint_ar: 'فكّر في هوية العملية داخل communicator.',
    choices: ['The rank', 'The size'],
    answer: 0,
  }

  render(<SessionScreen {...baseProps} questions={[question]} />)

  expect(screen.queryByText(question.q_ar!)).not.toBeInTheDocument()
  expect(screen.queryByText(question.hint_ar!)).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /إظهار الترجمة/ }))
  expect(screen.getByText('الترجمة العربية').closest('section')).toHaveTextContent(question.q_ar!)
  expect(screen.queryByText(question.hint_ar!)).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /إظهار التلميح/ }))
  expect(screen.getByText('تلميح بدون كشف الإجابة').closest('section')).toHaveTextContent(question.hint_ar!)
})

it('closes assistance when a failed card is requeued for a new attempt', () => {
  const question: ChoiceQuestion = {
    id: 'assist-requeue-001',
    q: 'Choose the correct answer.',
    q_ar: 'اختر الإجابة الصحيحة.',
    hint_ar: 'هذه محاولة جديدة.',
    choices: ['Wrong', 'Correct'],
    answer: 1,
  }

  const { container } = render(<SessionScreen {...baseProps} questions={[question]} />)
  const view = within(container)

  fireEvent.click(view.getByRole('button', { name: /إظهار الترجمة/ }))
  expect(view.getByText(question.q_ar!)).toBeVisible()
  fireEvent.click(view.getByRole('button', { name: /Wrong/ }))
  fireEvent.click(view.getByRole('button', { name: /التالي/ }))

  expect(view.queryByText(question.q_ar!)).not.toBeInTheDocument()
  expect(view.getByRole('button', { name: /إظهار الترجمة/ })).toHaveAttribute('aria-expanded', 'false')
})

it('reveals a practice solution before self-grading', () => {
  const question: PracticeQuestion = {
    id: 'practice-001',
    type: 'practice',
    q: 'Compute the result.',
    solution: '42',
  }
  const onProgressChange = vi.fn()

  render(
    <SessionScreen
      {...baseProps}
      questions={[question]}
      onProgressChange={onProgressChange}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'أظهر الحل' }))
  expect(screen.getByRole('region', { name: 'الحل' })).toHaveTextContent('42')
  expect(onProgressChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '✓ نعم' }))
  expect(onProgressChange).toHaveBeenCalledWith(
    'practice-001',
    expect.objectContaining({ correct: 1, seen: 1 }),
  )
})

it('supports matching by tap plus number keys and exposes per-row Arabic hints', () => {
  const question: MatchQuestion = {
    id: 'match-001',
    type: 'match',
    q: 'Match each item.',
    pairs: [
      ['Left one', 'Answer one'],
      ['Left two', 'Answer two'],
    ],
    pairHints_ar: { 1: 'تلميح الصف الأول', 2: 'تلميح الصف الثاني' },
  }
  const onProgressChange = vi.fn()

  render(
    <SessionScreen
      {...baseProps}
      questions={[question]}
      onProgressChange={onProgressChange}
    />,
  )

  expect(screen.getByText('تم 0 من 2')).toBeVisible()
  expect(screen.queryByText('تلميح الصف الأول')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /تلميح للصف 1/ }))
  expect(screen.getByText('تلميح الصف الأول')).toBeVisible()

  fireEvent.click(screen.getByRole('button', { name: /Answer one/ }))
  fireEvent.keyDown(document, { key: '1' })
  fireEvent.click(screen.getByRole('button', { name: /Answer two/ }))
  fireEvent.keyDown(document, { key: '2' })
  fireEvent.click(screen.getByRole('button', { name: /تحقّق من التوصيل/ }))

  expect(onProgressChange).toHaveBeenCalledWith(
    'match-001',
    expect.objectContaining({ correct: 1, seen: 1 }),
  )
})

it('uses the full answer card as the native drag preview', () => {
  const question: MatchQuestion = {
    id: 'match-drag-001',
    type: 'match',
    q: 'Match each item.',
    pairs: [
      ['MPI_Init', 'Starts MPI'],
      ['MPI_Finalize', 'Ends MPI'],
    ],
  }
  const setData = vi.fn()
  const setDragImage = vi.fn()

  render(<SessionScreen {...baseProps} questions={[question]} />)

  fireEvent.dragStart(screen.getByRole('button', { name: /Starts MPI/ }), {
    dataTransfer: { setData, setDragImage, effectAllowed: 'none' },
  })

  expect(setData).toHaveBeenCalledWith('application/x-studyflow-match-answer', '0')
  expect(setDragImage).toHaveBeenCalledWith(expect.any(HTMLElement), expect.any(Number), expect.any(Number))
})

it('escapes caller HTML inside the MathText boundary while protecting technical identifiers', () => {
  const html = mathTextToSafeHtml('<img src=x onerror=alert(1)> `my_rank` MPI_Comm_rank')
  expect(html).not.toContain('<img')
  expect(html).toContain('&lt;img')
  expect(html).toContain('class="inline-code">my_rank</code>')
  expect(html).toContain('class="technical-identifier">MPI_Comm_rank</span>')
})

it('preserves the legacy learn streak and normal session caps', () => {
  const question: ChoiceQuestion = {
    id: 'caps-001',
    q: 'Q',
    choices: ['yes', 'no'],
    answer: 0,
  }
  const noRandom = () => 0

  let learn = moveToNextCard(
    createSessionEngine([question], { ...meta, mode: 'learn' }, {}, 1_000, noRandom),
    noRandom,
  )
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = gradeActiveCard(learn, true, 2_000 + attempt, noRandom)
    expect(result).not.toBeNull()
    learn = moveToNextCard(result!.state, noRandom)
  }
  expect(learn.status).toBe('complete')
  expect(learn.progress['caps-001']).toMatchObject({ seen: 2, correct: 2, box: 3 })

  let normal = moveToNextCard(
    createSessionEngine([question], { ...meta, mode: 'all' }, {}, 1_000, noRandom),
    noRandom,
  )
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = gradeActiveCard(normal, false, 3_000 + attempt, noRandom)
    expect(result).not.toBeNull()
    normal = moveToNextCard(result!.state, noRandom)
  }
  expect(normal.status).toBe('complete')
  expect(normal.progress['caps-001']).toMatchObject({ seen: 5, wrong: 5, box: 1 })
})
