import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
