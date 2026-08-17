import { describe, expect, it } from 'vitest'
import { SESSION_CAP } from '../../lib/constants'
import type { ChoiceQuestion, SessionMeta } from '../../types'
import { createSessionEngine, gradeActiveCard, moveToNextCard } from './sessionEngine'

const question: ChoiceQuestion = {
  id: 'pacing-001',
  q: 'Question',
  choices: ['correct', 'wrong'],
  answer: 0,
}

const cycleQuestions: ChoiceQuestion[] = Array.from({ length: 4 }, (_value, index) => ({
  id: `cycle-${index + 1}`,
  q: `Cycle question ${index + 1}`,
  choices: ['correct', 'wrong'],
  answer: 0,
}))

const baseMeta: SessionMeta = {
  code: 'TEST-101',
  scope: 'ch-1',
  mode: 'all',
  color: '#2dd4bf',
  subject: 'Test subject',
  label: 'Chapter 1',
}

const noRandom = () => 0
const nonLearnModes = ['all', 'review', 'practice', 'star', 'due'] as const

function start(mode: SessionMeta['mode']) {
  return moveToNextCard(
    createSessionEngine([question], { ...baseMeta, mode }, {}, 1_000, noRandom),
    noRandom,
  )
}

describe.each(nonLearnModes)('%s session pacing', (mode) => {
  it('finishes a card on its first correct answer', () => {
    const result = gradeActiveCard(start(mode), true, 2_000, noRandom)

    expect(result).not.toBeNull()
    expect(result!.state.cards[0]).toMatchObject({ done: true, sessionAttempts: 1 })
    expect(moveToNextCard(result!.state, noRandom).status).toBe('complete')
    expect(result!.state.stats).toEqual({ good: 1, bad: 0, streak: 1 })
    expect(result!.progress).toMatchObject({ seen: 1, correct: 1, wrong: 0, box: 2 })
  })

  it('requeues a wrong answer and finishes it on the first later correct answer', () => {
    const wrong = gradeActiveCard(start(mode), false, 2_000, noRandom)

    expect(wrong).not.toBeNull()
    expect(wrong!.state.cards[0]).toMatchObject({ done: false, sessionAttempts: 1 })

    const requeued = moveToNextCard(wrong!.state, noRandom)
    expect(requeued.active).toMatchObject({ cardId: question.id, answered: false })

    const correct = gradeActiveCard(requeued, true, 3_000, noRandom)
    expect(correct).not.toBeNull()
    expect(correct!.state.cards[0]).toMatchObject({ done: true, sessionAttempts: 2 })
    expect(moveToNextCard(correct!.state, noRandom).status).toBe('complete')
    expect(correct!.state.stats).toEqual({ good: 1, bad: 1, streak: 1 })
    expect(correct!.progress).toMatchObject({ seen: 2, correct: 1, wrong: 1, box: 2 })
  })
})

it('uses SESSION_CAP only as a wrong-answer safety cap outside learn mode', () => {
  let state = start('all')

  for (let attempt = 1; attempt <= SESSION_CAP; attempt += 1) {
    const result = gradeActiveCard(state, false, 2_000 + attempt, noRandom)
    expect(result).not.toBeNull()
    expect(result!.state.cards[0].done).toBe(attempt === SESSION_CAP)
    state = moveToNextCard(result!.state, noRandom)
  }

  expect(state.status).toBe('complete')
  expect(state.progress[question.id]).toMatchObject({
    seen: SESSION_CAP,
    correct: 0,
    wrong: SESSION_CAP,
    box: 1,
  })
})

it('runs test mode as one attempt per question, including wrong answers', () => {
  const initialProgress = { box: 4, seen: 9, correct: 7, wrong: 2, due: 9_999, last: 1_500 }
  const state = moveToNextCard(
    createSessionEngine([question], { ...baseMeta, mode: 'test' }, { [question.id]: initialProgress }, 1_000, noRandom),
    noRandom,
  )
  const wrong = gradeActiveCard(state, false, 2_000, noRandom)

  expect(wrong).not.toBeNull()
  expect(wrong!.state.cards[0]).toMatchObject({ done: true, sessionAttempts: 1, box: 4 })
  expect(wrong!.state.stats).toEqual({ good: 0, bad: 1, streak: 0 })
  expect(wrong!.state.progress[question.id]).toEqual(initialProgress)
  expect(wrong!.progress).toEqual(initialProgress)
  expect(moveToNextCard(wrong!.state, noRandom).status).toBe('complete')
})

it('does not repeat a wrong card until every other active card appears', () => {
  let state = moveToNextCard(
    createSessionEngine(cycleQuestions, { ...baseMeta, mode: 'all' }, {}, 1_000, noRandom),
    noRandom,
  )

  for (let cycle = 0; cycle < 2; cycle += 1) {
    const seen = new Set<string>()
    for (let index = 0; index < cycleQuestions.length; index += 1) {
      expect(state.active).not.toBeNull()
      seen.add(state.active!.cardId)
      const result = gradeActiveCard(state, false, 2_000 + cycle * 10 + index, noRandom)
      expect(result).not.toBeNull()
      state = moveToNextCard(result!.state, noRandom)
    }
    expect(seen.size).toBe(cycleQuestions.length)
  }
})

it('shows every learn card once before the second-correct review cycle', () => {
  let state = moveToNextCard(
    createSessionEngine(cycleQuestions, { ...baseMeta, mode: 'learn' }, {}, 1_000, noRandom),
    noRandom,
  )

  for (let cycle = 0; cycle < 2; cycle += 1) {
    const seen = new Set<string>()
    for (let index = 0; index < cycleQuestions.length; index += 1) {
      expect(state.active).not.toBeNull()
      seen.add(state.active!.cardId)
      const result = gradeActiveCard(state, true, 3_000 + cycle * 10 + index, noRandom)
      expect(result).not.toBeNull()
      state = moveToNextCard(result!.state, noRandom)
    }
    expect(seen.size).toBe(cycleQuestions.length)
  }

  expect(state.status).toBe('complete')
})

it('does not immediately repeat the last card when due steps tie at a cycle boundary', () => {
  const twoQuestions = cycleQuestions.slice(0, 2)
  let state = moveToNextCard(
    createSessionEngine(twoQuestions, { ...baseMeta, mode: 'all' }, {}, 1_000, noRandom),
    noRandom,
  )

  expect(state.active?.cardId).toBe(twoQuestions[1].id)
  const firstWrong = gradeActiveCard(state, false, 2_000, () => 0.999)
  expect(firstWrong).not.toBeNull()
  state = moveToNextCard(firstWrong!.state, noRandom)
  expect(state.active?.cardId).toBe(twoQuestions[0].id)

  const secondWrong = gradeActiveCard(state, false, 3_000, noRandom)
  expect(secondWrong).not.toBeNull()
  expect(secondWrong!.state.cards.map((card) => card.dueStep)).toEqual([4, 4])

  state = moveToNextCard(secondWrong!.state, () => 0.999)
  expect(state.active?.cardId).toBe(twoQuestions[1].id)
})
