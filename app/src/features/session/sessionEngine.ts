import { DAY_MS, GAPS, MASTERY_BOX, SESSION_CAP } from '../../lib/constants'
import { isChoice, isMatch } from '../../lib/utils'
import type { QuestionProgress, SessionMeta, StudyQuestion } from '../../types'

export interface SessionCardRuntime {
  question: StudyQuestion
  box: number
  dueStep: number
  sessionAttempts: number
  learnStreak: number
  done: boolean
  testAnswer?: {
    selectedChoice: number | null
    matchAssignments: Record<number, number>
    practiceCorrect: boolean | null
  }
}

export interface ActiveCardRuntime {
  cardId: string
  answered: boolean
  correct: boolean | null
  revealed: boolean
  choiceOrder: number[]
  selectedChoice: number | null
  matchAnswerOrder: number[]
  matchAssignments: Record<number, number>
  selectedMatchAnswer: number | null
  openHints: Record<number, boolean>
  assistanceOpen: boolean
}

export interface SessionStats {
  good: number
  bad: number
  streak: number
}

export interface SessionEngineState {
  cards: SessionCardRuntime[]
  progress: Record<string, QuestionProgress>
  meta: SessionMeta
  step: number
  previousId: string | null
  cycleSeenIds: string[]
  active: ActiveCardRuntime | null
  stats: SessionStats
  startedAt: number
  status: 'active' | 'complete' | 'empty'
}

export interface SessionGradeResult {
  state: SessionEngineState
  questionId: string
  progress: QuestionProgress
  correct: boolean
}

export interface SessionSummary {
  totalUnique: number
  attempts: number
  good: number
  bad: number
  accuracy: number
  mastered: number
  remaining: number
  elapsedSeconds: number
  completed: boolean
}

export function defaultQuestionProgress(): QuestionProgress {
  return { box: 1, seen: 0, correct: 0, wrong: 0, due: 0, last: 0 }
}

export function shuffleWith<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export function createSessionEngine(
  questions: readonly StudyQuestion[],
  meta: SessionMeta,
  progress: Readonly<Record<string, QuestionProgress>>,
  startedAt: number,
  random: () => number,
): SessionEngineState {
  const cards = shuffleWith(questions, random).map((question, dueStep) => ({
    question,
    box: progress[question.id]?.box || 1,
    dueStep,
    sessionAttempts: 0,
    learnStreak: 0,
    done: false,
  }))

  return {
    cards,
    progress: { ...progress },
    meta,
    step: 0,
    previousId: null,
    cycleSeenIds: [],
    active: null,
    stats: { good: 0, bad: 0, streak: 0 },
    startedAt,
    status: cards.length ? 'active' : 'empty',
  }
}

interface NextCardPick {
  card: SessionCardRuntime
  cycleSeenIds: string[]
}

function pickNextCard(state: SessionEngineState, random: () => number): NextCardPick | null {
  const pool = state.cards.filter((card) => !card.done)
  if (!pool.length) return null

  const seenThisCycle = new Set(state.cycleSeenIds)
  let cycleSeenIds = state.cycleSeenIds
  let candidates = pool.filter((card) => !seenThisCycle.has(card.question.id))

  // Start a new sweep only after every still-active card has appeared once.
  // This keeps spaced-repetition due steps inside a fair, no-repeat cycle.
  if (!candidates.length) {
    candidates = pool
    cycleSeenIds = []
  }

  // At a sweep boundary, do not show the just-answered card again when any
  // alternative remains, even when several cards share the same due step.
  const schedulable = candidates.length > 1
    ? candidates.filter((card) => card.question.id !== state.previousId)
    : candidates
  const minimumDueStep = Math.min(...schedulable.map((card) => card.dueStep))
  const dueCards = schedulable.filter((card) => card.dueStep === minimumDueStep)

  const card = dueCards[Math.floor(random() * dueCards.length)]
  return {
    card,
    cycleSeenIds: [...cycleSeenIds, card.question.id],
  }
}

export function moveToNextCard(
  state: SessionEngineState,
  random: () => number,
): SessionEngineState {
  if (state.status === 'empty') return state
  if (state.active && !state.active.answered) return state

  const pick = pickNextCard(state, random)
  if (!pick) return { ...state, active: null, status: 'complete' }

  const card = pick.card
  const question = card.question
  return {
    ...state,
    status: 'active',
    cycleSeenIds: pick.cycleSeenIds,
    active: {
      cardId: question.id,
      answered: false,
      correct: null,
      revealed: false,
      choiceOrder: isChoice(question)
        ? shuffleWith(question.choices.map((_choice, index) => index), random)
        : [],
      selectedChoice: null,
      matchAnswerOrder: isMatch(question)
        ? shuffleWith(question.pairs.map((_pair, index) => index), random)
        : [],
      matchAssignments: {},
      selectedMatchAnswer: null,
      openHints: {},
      assistanceOpen: false,
    },
  }
}

export function replaceActiveCard(
  state: SessionEngineState,
  update: (active: ActiveCardRuntime) => ActiveCardRuntime,
): SessionEngineState {
  return state.active ? { ...state, active: update(state.active) } : state
}

export function gradeActiveCard(
  state: SessionEngineState,
  correct: boolean,
  now: number,
  random: () => number,
): SessionGradeResult | null {
  const active = state.active
  if (!active || active.answered) return null

  const cardIndex = state.cards.findIndex((card) => card.question.id === active.cardId)
  if (cardIndex < 0) return null

  const card = state.cards[cardIndex]
  const previousProgress = state.progress[card.question.id] ?? defaultQuestionProgress()
  const step = state.step + 1
  const sessionAttempts = card.sessionAttempts + 1
  const isTest = state.meta.mode === 'test'

  const box = isTest ? card.box : correct ? Math.min(5, card.box + 1) : 1
  const dueStep = correct
    ? step + GAPS[box] + Math.floor(random() * 3)
    : step + 2 + Math.floor(random() * 2)
  const learnStreak = correct ? card.learnStreak + 1 : 0
  const done = isTest
    ? true
    : state.meta.mode === 'learn'
      ? learnStreak >= 2 || sessionAttempts >= 7
      : correct || sessionAttempts >= SESSION_CAP

  const nextProgress: QuestionProgress = isTest
    ? previousProgress
    : {
        box,
        seen: previousProgress.seen + 1,
        correct: previousProgress.correct + (correct ? 1 : 0),
        wrong: previousProgress.wrong + (correct ? 0 : 1),
        due: now + (correct ? GAPS[box] : 1) * DAY_MS,
        last: now,
      }

  const cards = [...state.cards]
  cards[cardIndex] = {
    ...card,
    box,
    dueStep,
    sessionAttempts,
    learnStreak,
    done,
    testAnswer: isTest
      ? {
          selectedChoice: active.selectedChoice,
          matchAssignments: { ...active.matchAssignments },
          practiceCorrect: isChoice(card.question) || isMatch(card.question) ? null : correct,
        }
      : card.testAnswer,
  }

  const nextState: SessionEngineState = {
    ...state,
    cards,
    progress: isTest ? state.progress : { ...state.progress, [card.question.id]: nextProgress },
    step,
    previousId: card.question.id,
    active: {
      ...active,
      answered: true,
      correct,
    },
    stats: {
      good: state.stats.good + (correct ? 1 : 0),
      bad: state.stats.bad + (correct ? 0 : 1),
      streak: correct ? state.stats.streak + 1 : 0,
    },
  }

  return {
    state: nextState,
    questionId: card.question.id,
    progress: nextProgress,
    correct,
  }
}

export function getActiveCard(state: SessionEngineState): SessionCardRuntime | null {
  if (!state.active) return null
  return state.cards.find((card) => card.question.id === state.active?.cardId) ?? null
}

export function getSessionSummary(state: SessionEngineState, now: number): SessionSummary {
  const attempts = state.stats.good + state.stats.bad
  return {
    totalUnique: state.cards.length,
    attempts,
    good: state.stats.good,
    bad: state.stats.bad,
    accuracy: attempts ? Math.round((state.stats.good / attempts) * 100) : 0,
    mastered: state.cards.filter(
      (card) => (state.progress[card.question.id]?.box ?? card.box) >= MASTERY_BOX,
    ).length,
    remaining: state.cards.filter((card) => !card.done).length,
    elapsedSeconds: Math.max(0, Math.floor((now - state.startedAt) / 1_000)),
    completed: state.status === 'complete',
  }
}
