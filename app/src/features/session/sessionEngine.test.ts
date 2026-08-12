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
  const wrong = gradeActiveCard(start('test'), false, 2_000, noRandom)

  expect(wrong).not.toBeNull()
  expect(wrong!.state.cards[0]).toMatchObject({ done: true, sessionAttempts: 1 })
  expect(wrong!.state.stats).toEqual({ good: 0, bad: 1, streak: 0 })
  expect(moveToNextCard(wrong!.state, noRandom).status).toBe('complete')
})
