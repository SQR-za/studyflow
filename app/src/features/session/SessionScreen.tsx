import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { MathText } from '../../components/MathText'
import { StudyText } from '../../components/StudyText'
import { MASTERY_BOX } from '../../lib/constants'
import { isChoice, isMatch, isPractice } from '../../lib/utils'
import type { QuestionProgress, SessionMeta, StudyQuestion } from '../../types'
import {
  createSessionEngine,
  getActiveCard,
  getSessionSummary,
  gradeActiveCard,
  moveToNextCard,
  replaceActiveCard,
} from './sessionEngine'
import type { SessionEngineState, SessionGradeResult, SessionSummary } from './sessionEngine'
import './session.css'

const MATCH_DRAG_MIME = 'application/x-studyflow-match-answer'

export interface SessionScreenProps {
  /** Change this value to restart an otherwise identical question pool. */
  sessionId?: string | number
  questions: readonly StudyQuestion[]
  meta: SessionMeta
  progress: Readonly<Record<string, QuestionProgress>>
  starred: Readonly<Record<string, boolean>>
  sessionMinutes?: number
  sound?: boolean
  fullscreen?: boolean
  onProgressChange: (questionId: string, progress: QuestionProgress) => void
  onStarChange: (questionId: string, starred: boolean) => void
  onDailyAnswer?: () => void
  onComplete?: (summary: SessionSummary) => void
  onExit: (summary: SessionSummary) => void
  onOpenNotes?: () => void
  /** Deterministic tests can inject a seeded random source. */
  random?: () => number
}

const MODE_LABELS: Record<SessionMeta['mode'], string> = {
  all: '',
  review: '⚠️ مراجعة الغلطات',
  practice: '🧮 مسائل',
  star: '⭐ المميّزة',
  due: '🔁 مراجعة مستحقّة',
  learn: '🧠 حفظ · مرتان صحيحتان',
  test: '⚡ اختبار حقيقي · التصحيح في النهاية',
}

const SOURCE_LABELS: Record<string, string> = {
  official: '📘 مصدر رسمي',
  lecture: '🎓 محاضرة',
  extra: '✨ إضافي',
  source: '📄 من المصدر',
  exam: '🎯 نطاق الاختبار',
  slides: '📽️ شرائح',
}

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function SessionTimer({ endAt, onElapsed }: { endAt: number; onElapsed: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.round((endAt - Date.now()) / 1_000)))
  const elapsedAnnouncedRef = useRef(false)

  useEffect(() => {
    const update = () => {
      const next = Math.max(0, Math.round((endAt - Date.now()) / 1_000))
      setSecondsLeft(next)
      if (next === 0 && !elapsedAnnouncedRef.current) {
        elapsedAnnouncedRef.current = true
        onElapsed()
      }
    }
    update()
    const interval = window.setInterval(update, 1_000)
    return () => window.clearInterval(interval)
  }, [endAt, onElapsed])

  return <b dir="ltr">{formatTimer(secondsLeft)}</b>
}

function choiceKey(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}

function pairHint(question: Extract<StudyQuestion, { type: 'match' }>, row: number): string {
  const hints = question.pairHints_ar
  if (Array.isArray(hints)) return hints[row] ?? ''
  if (!hints) return ''

  const hasZeroBasedKeys = Object.prototype.hasOwnProperty.call(hints, '0')
  const numberedHint = hasZeroBasedKeys ? hints[String(row)] : hints[String(row + 1)]
  return numberedHint ?? hints[question.pairs[row]?.[0]] ?? ''
}

function sourceLabel(question: StudyQuestion): string {
  if (question.source) return `📄 ${question.source}`
  return question.src ? (SOURCE_LABELS[question.src] ?? String(question.src)) : ''
}

function feedback(correct: boolean, sound: boolean): void {
  try {
    navigator.vibrate?.(correct ? 15 : [20, 40, 20])
  } catch {
    // Vibration is optional.
  }

  if (!sound) return
  try {
    const AudioContextConstructor = window.AudioContext
    const context = new AudioContextConstructor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.frequency.value = correct ? 660 : 200
    gain.gain.value = 0.05
    oscillator.start()
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18)
    oscillator.stop(context.currentTime + 0.19)
    oscillator.addEventListener('ended', () => void context.close(), { once: true })
  } catch {
    // Audio feedback must never block studying.
  }
}

function Explanation({ question, show }: { question: StudyQuestion; show: boolean }) {
  if (!show || (!question.explanation && !question.explanation_ar)) return null
  return (
    <aside className="sf-session__explanation" aria-label="شرح الإجابة">
      {question.explanation ? <MathText text={question.explanation} as="div" /> : null}
      {question.explanation_ar ? (
        <div className="sf-session__explanation-ar" dir="rtl" lang="ar">
          <strong>شرح عربي</strong>
          <MathText text={question.explanation_ar} as="div" />
        </div>
      ) : null}
    </aside>
  )
}

function TestReview({ state }: { state: SessionEngineState }) {
  return (
    <section className="sf-session__test-review" aria-label="مراجعة إجابات الاختبار">
      <h2>مراجعة الإجابات</h2>
      {state.cards.map((card, index) => {
        const question = card.question
        const answer = card.testAnswer
        const correct = card.learnStreak > 0
        return (
          <article key={question.id} className={correct ? 'is-correct' : 'is-wrong'}>
            <header>
              <b>{index + 1}</b>
              <span>{correct ? '✓ صحيح' : '✗ خطأ'}</span>
            </header>
            <h3><StudyText text={question.q} variant="question" /></h3>
            {isChoice(question) ? (
              <div className="sf-session__test-answers">
                <p>
                  <strong>إجابتك</strong>
                  <StudyText
                    text={answer?.selectedChoice === null || answer?.selectedChoice === undefined
                      ? '—'
                      : question.choices[answer.selectedChoice]}
                    variant="choice"
                  />
                </p>
                <p>
                  <strong>الإجابة الصحيحة</strong>
                  <StudyText text={question.choices[question.answer]} variant="choice" />
                </p>
              </div>
            ) : null}
            {isMatch(question) ? (
              <div className="sf-session__test-pairs">
                {question.pairs.map((pair, row) => {
                  const selected = answer?.matchAssignments[row]
                  const rowCorrect = selected === row
                  return (
                    <p key={`${question.id}-${row}`} className={rowCorrect ? 'is-correct' : 'is-wrong'}>
                      <MathText text={pair[0]} />
                      <span aria-hidden="true">←</span>
                      <MathText text={pair[1]} />
                      {!rowCorrect && selected !== undefined ? (
                        <small>إجابتك: <MathText text={question.pairs[selected][1]} /></small>
                      ) : null}
                    </p>
                  )
                })}
              </div>
            ) : null}
            {isPractice(question) ? (
              <div className="sf-session__solution">
                <strong>الحل</strong>
                <MathText text={question.solution} as="div" />
              </div>
            ) : null}
            <Explanation question={question} show />
          </article>
        )
      })}
    </section>
  )
}

export function SessionScreen(props: SessionScreenProps) {
  const generatedKey = `${props.meta.code ?? ''}:${props.meta.scope}:${props.meta.mode}:${props.questions
    .map((question) => question.id)
    .join('|')}`
  return <SessionRun key={props.sessionId ?? generatedKey} {...props} />
}

function SessionRun({
  questions,
  meta,
  progress,
  starred,
  sessionMinutes = 20,
  sound = false,
  fullscreen = false,
  onProgressChange,
  onStarChange,
  onDailyAnswer,
  onComplete,
  onExit,
  onOpenNotes,
  random = Math.random,
}: SessionScreenProps) {
  const isTest = meta.mode === 'test'
  const randomRef = useRef(random)
  const startedAtRef = useRef(Date.now())
  const initialState = useRef<SessionEngineState | null>(null)
  if (!initialState.current) {
    initialState.current = moveToNextCard(
      createSessionEngine(questions, meta, progress, startedAtRef.current, randomRef.current),
      randomRef.current,
    )
  }

  const [viewState, setViewState] = useState(initialState.current)
  const stateRef = useRef(viewState)
  const [localStars, setLocalStars] = useState<Record<string, boolean>>({ ...starred })
  const [assistance, setAssistance] = useState({
    questionId: '',
    translationOpen: false,
    hintOpen: false,
  })
  const [dragOverRow, setDragOverRow] = useState<number | null>(null)
  const [draggingAnswer, setDraggingAnswer] = useState<number | null>(null)
  const [cardMotionKey, setCardMotionKey] = useState(0)
  const [guardOpen, setGuardOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const durationMinutes = Math.max(1, Math.min(120, sessionMinutes || 20))
  const timerEndRef = useRef(startedAtRef.current + durationMinutes * 60_000)
  const cardRef = useRef<HTMLElement>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const gradeYesRef = useRef<HTMLButtonElement>(null)
  const stayButtonRef = useRef<HTMLButtonElement>(null)
  const leaveButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const dragPreviewRef = useRef<HTMLElement | null>(null)
  const domId = useId().replaceAll(':', '')
  const announceTimerEnd = useCallback(() => {
    setAnnouncement('انتهى وقت الجلسة. أكمل البطاقات المتبقية')
  }, [])

  function commit(nextState: SessionEngineState): void {
    stateRef.current = nextState
    setViewState(nextState)
  }

  function summary(state = stateRef.current): SessionSummary {
    return getSessionSummary(state, Date.now())
  }

  function persistGrade(result: SessionGradeResult): void {
    commit(result.state)
    onProgressChange(result.questionId, result.progress)
    onDailyAnswer?.()
    feedback(result.correct, sound)
    setAnnouncement(result.correct ? 'إجابة صحيحة' : 'إجابة غير صحيحة')
    window.requestAnimationFrame(() => nextButtonRef.current?.focus())
  }

  function gradeFrom(state: SessionEngineState, correct: boolean): void {
    const result = gradeActiveCard(state, correct, Date.now(), randomRef.current)
    if (result) persistGrade(result)
  }

  function answerChoice(originalChoiceIndex: number): void {
    const current = stateRef.current
    const card = getActiveCard(current)
    if (!card || !current.active || current.active.answered || !isChoice(card.question)) return
    const selected = replaceActiveCard(current, (active) => ({
      ...active,
      selectedChoice: originalChoiceIndex,
    }))
    if (isTest) {
      commit(selected)
      setAnnouncement('تم اختيار الإجابة. يمكنك تغييرها قبل الانتقال')
      return
    }
    gradeFrom(selected, originalChoiceIndex === card.question.answer)
  }

  function revealPractice(): void {
    const current = stateRef.current
    const card = getActiveCard(current)
    if (!card || !current.active || current.active.answered || !isPractice(card.question)) return
    commit(replaceActiveCard(current, (active) => ({ ...active, revealed: true })))
    setAnnouncement('ظهر الحل. قيّم إجابتك بنفسك')
    window.requestAnimationFrame(() => gradeYesRef.current?.focus())
  }

  function gradePractice(correct: boolean): void {
    gradeFrom(stateRef.current, correct)
  }

  function advance(): void {
    const current = stateRef.current
    if (current.active && !current.active.answered) return
    const next = moveToNextCard(current, randomRef.current)
    setAssistance({ questionId: '', translationOpen: false, hintOpen: false })
    setCardMotionKey((value) => value + 1)
    commit(next)
    if (next.status === 'complete' && current.status !== 'complete') {
      const completedSummary = getSessionSummary(next, Date.now())
      setAnnouncement('اكتملت الجلسة')
      onComplete?.(completedSummary)
    }
  }

  function submitTestAnswer(): void {
    const current = stateRef.current
    const card = getActiveCard(current)
    const active = current.active
    if (!isTest || !card || !active || active.answered) return

    let correct: boolean
    if (isChoice(card.question)) {
      if (active.selectedChoice === null) return
      correct = active.selectedChoice === card.question.answer
    } else if (isMatch(card.question)) {
      if (Object.keys(active.matchAssignments).length !== card.question.pairs.length) return
      correct = card.question.pairs.every((_pair, row) => active.matchAssignments[row] === row)
    } else {
      return
    }

    const result = gradeActiveCard(current, correct, Date.now(), randomRef.current)
    if (!result) return
    onDailyAnswer?.()

    const next = moveToNextCard(result.state, randomRef.current)
    setAssistance({ questionId: '', translationOpen: false, hintOpen: false })
    setCardMotionKey((value) => value + 1)
    setAnnouncement('تم تسجيل الإجابة')
    commit(next)
    if (next.status === 'complete') onComplete?.(getSessionSummary(next, Date.now()))
  }

  function requestExit(): void {
    const current = stateRef.current
    if (current.status !== 'active' || getSessionSummary(current, Date.now()).remaining === 0) {
      onExit(getSessionSummary(current, Date.now()))
      return
    }
    setGuardOpen(true)
  }

  function toggleStar(): void {
    const id = stateRef.current.active?.cardId
    if (!id) return
    const nextValue = !localStars[id]
    setLocalStars((current) => ({ ...current, [id]: nextValue }))
    onStarChange(id, nextValue)
    setAnnouncement(nextValue ? 'أضيف السؤال إلى المميّزة' : 'أزيل السؤال من المميّزة')
  }

  function toggleTranslation(): void {
    const questionId = stateRef.current.active?.cardId
    if (!questionId) return
    setAssistance((current) => ({
      questionId,
      translationOpen: current.questionId === questionId ? !current.translationOpen : true,
      hintOpen: current.questionId === questionId ? current.hintOpen : false,
    }))
  }

  function toggleHint(): void {
    const questionId = stateRef.current.active?.cardId
    if (!questionId) return
    setAssistance((current) => ({
      questionId,
      translationOpen: current.questionId === questionId ? current.translationOpen : false,
      hintOpen: current.questionId === questionId ? !current.hintOpen : true,
    }))
  }

  function selectMatchAnswer(answer: number): void {
    const current = stateRef.current
    const card = getActiveCard(current)
    if (!card || !current.active || current.active.answered || !isMatch(card.question)) return
    commit(
      replaceActiveCard(current, (active) => ({
        ...active,
        selectedMatchAnswer: active.selectedMatchAnswer === answer ? null : answer,
      })),
    )
  }

  function assignMatch(row: number, answer: number): void {
    const current = stateRef.current
    const card = getActiveCard(current)
    if (!card || !current.active || current.active.answered || !isMatch(card.question)) return
    if (!Number.isInteger(row) || !Number.isInteger(answer)) return
    if (row < 0 || answer < 0 || row >= card.question.pairs.length || answer >= card.question.pairs.length) {
      return
    }

    const assignments = { ...current.active.matchAssignments }
    for (const [assignedRow, assignedAnswer] of Object.entries(assignments)) {
      if (assignedAnswer === answer) delete assignments[Number(assignedRow)]
    }
    assignments[row] = answer
    commit(
      replaceActiveCard(current, (active) => ({
        ...active,
        matchAssignments: assignments,
        selectedMatchAnswer: null,
      })),
    )
    setAnnouncement(`وُضعت الإجابة في الصف ${row + 1}`)
    window.requestAnimationFrame(() => document.getElementById(`sf-slot-${domId}-${row}`)?.focus())
  }

  function chooseMatchSlot(row: number): void {
    const current = stateRef.current
    const active = current.active
    if (!active || active.answered) return
    if (active.selectedMatchAnswer !== null) {
      assignMatch(row, active.selectedMatchAnswer)
      return
    }
    if (active.matchAssignments[row] === undefined) return
    const assignments = { ...active.matchAssignments }
    delete assignments[row]
    commit(replaceActiveCard(current, (item) => ({ ...item, matchAssignments: assignments })))
  }

  function togglePairHint(row: number): void {
    commit(
      replaceActiveCard(stateRef.current, (active) => ({
        ...active,
        openHints: { ...active.openHints, [row]: !active.openHints[row] },
      })),
    )
  }

  function clearMatchDrag(): void {
    dragPreviewRef.current?.remove()
    dragPreviewRef.current = null
    setDragOverRow(null)
    setDraggingAnswer(null)
  }

  function beginMatchDrag(event: DragEvent<HTMLButtonElement>, answer: number): void {
    const current = stateRef.current
    if (!current.active || current.active.answered) {
      event.preventDefault()
      return
    }

    clearMatchDrag()
    setDraggingAnswer(answer)
    event.dataTransfer.setData(MATCH_DRAG_MIME, String(answer))
    event.dataTransfer.effectAllowed = 'move'

    const source = event.currentTarget
    const bounds = source.getBoundingClientRect()
    const preview = source.cloneNode(true) as HTMLElement
    preview.classList.remove('is-selected')
    preview.classList.add('sf-session__drag-preview')
    preview.setAttribute('aria-hidden', 'true')
    preview.style.width = `${bounds.width}px`
    document.body.append(preview)
    dragPreviewRef.current = preview

    event.dataTransfer.setDragImage(
      preview,
      Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    )
  }

  function dropMatch(event: DragEvent<HTMLElement>, row: number): void {
    event.preventDefault()
    const rawAnswer = event.dataTransfer.getData(MATCH_DRAG_MIME)
    if (/^\d+$/.test(rawAnswer)) assignMatch(row, Number(rawAnswer))
    clearMatchDrag()
  }

  function gradeMatch(): void {
    const current = stateRef.current
    const card = getActiveCard(current)
    if (!card || !current.active || current.active.answered || !isMatch(card.question)) return
    if (Object.keys(current.active.matchAssignments).length !== card.question.pairs.length) return
    gradeFrom(
      current,
      card.question.pairs.every((_pair, row) => current.active?.matchAssignments[row] === row),
    )
  }

  useEffect(() => {
    if (viewState.status !== 'active' || !fullscreen) return undefined
    let enteredFullscreen = false
    void document.documentElement
      .requestFullscreen?.()
      .then(() => {
        enteredFullscreen = true
      })
      .catch(() => undefined)
    return () => {
      if (enteredFullscreen && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    }
  }, [fullscreen, viewState.status])

  useEffect(() => {
    if (!viewState.active?.cardId) return
    window.requestAnimationFrame(() => cardRef.current?.focus())
  }, [cardMotionKey, viewState.active?.cardId])

  useEffect(() => () => dragPreviewRef.current?.remove(), [])

  useEffect(() => {
    if (!guardOpen) return undefined
    previousFocusRef.current = document.activeElement as HTMLElement | null
    window.requestAnimationFrame(() => stayButtonRef.current?.focus())
    return () => previousFocusRef.current?.focus()
  }, [guardOpen])

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      const current = stateRef.current
      if (current.status !== 'active' || getSessionSummary(current, Date.now()).remaining === 0) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [])

  useEffect(() => {
    const handleKeyboard = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTextInput =
        target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      if (isTextInput || event.altKey || event.ctrlKey || event.metaKey) return

      if (event.key === 'Escape') {
        event.preventDefault()
        if (guardOpen) setGuardOpen(false)
        else requestExit()
        return
      }
      if (guardOpen) return

      const current = stateRef.current
      const card = getActiveCard(current)
      const active = current.active
      if (!card || !active) return

      if (isTest && !active.answered && (event.key === 'Enter' || event.key === ' ')) {
        if (target?.tagName === 'BUTTON') return
        event.preventDefault()
        submitTestAnswer()
        return
      }

      if (active.answered && (event.key === 'Enter' || event.key === ' ')) {
        if (target?.tagName === 'BUTTON') return
        event.preventDefault()
        advance()
        return
      }

      if (isMatch(card.question) && active.selectedMatchAnswer !== null && /^[1-9]$/.test(event.key)) {
        const row = Number(event.key) - 1
        if (row < card.question.pairs.length) {
          event.preventDefault()
          assignMatch(row, active.selectedMatchAnswer)
        }
        return
      }

      if (isPractice(card.question) && !active.revealed && (event.key === 'Enter' || event.key === ' ')) {
        if (target?.tagName === 'BUTTON') return
        event.preventDefault()
        revealPractice()
        return
      }

      if (!isChoice(card.question) || active.answered) return
      let displayedIndex = -1
      if (/^[1-9]$/.test(event.key)) displayedIndex = Number(event.key) - 1
      else if (/^[a-z]$/i.test(event.key)) displayedIndex = event.key.toLowerCase().charCodeAt(0) - 97
      const originalIndex = active.choiceOrder[displayedIndex]
      if (originalIndex === undefined) return
      event.preventDefault()
      answerChoice(originalIndex)
    }

    document.addEventListener('keydown', handleKeyboard)
    return () => document.removeEventListener('keydown', handleKeyboard)
  })

  const activeCard = getActiveCard(viewState)
  const active = viewState.active
  const currentQuestion = activeCard?.question
  const attempts = viewState.stats.good + viewState.stats.bad
  const mastered = viewState.cards.filter(
    (card) => (viewState.progress[card.question.id]?.box ?? card.box) >= MASTERY_BOX,
  ).length
  const completedCount = viewState.cards.filter((card) => card.done).length
  const modeLabel = MODE_LABELS[meta.mode]

  if (viewState.status === 'empty') {
    return (
      <main className="screen sf-session sf-session--empty" dir="rtl">
        <div className="sf-session__empty-card">
          <span aria-hidden="true">🎉</span>
          <h1>لا توجد عناصر في هذه الجلسة</h1>
          <p>قد تكون أنهيت المراجعة المستحقّة أو لا توجد أخطاء في هذا النطاق.</p>
          <button type="button" className="sf-session__primary" onClick={() => onExit(summary())}>
            العودة
          </button>
        </div>
      </main>
    )
  }

  if (viewState.status === 'complete') {
    const finalSummary = summary(viewState)
    if (isTest) {
      return (
        <main className="screen sf-session sf-session--complete sf-session--test-result" dir="rtl" style={{ '--session-accent': meta.color } as React.CSSProperties}>
          <section className="sf-session__test-summary">
            <span className="sf-session__celebration" aria-hidden="true">🎯</span>
            <h1>نتيجة اختبار القسم</h1>
            <strong>{finalSummary.accuracy}%</strong>
            <p>{finalSummary.good} صح من {finalSummary.totalUnique} · {finalSummary.bad} خطأ · {formatTimer(finalSummary.elapsedSeconds)}</p>
          </section>
          <TestReview state={viewState} />
          <button type="button" className="sf-session__primary sf-session__test-return" onClick={() => onExit(finalSummary)}>
            العودة للرئيسية
          </button>
        </main>
      )
    }
    return (
      <main className="screen sf-session sf-session--complete" dir="rtl">
        <div className="sf-session__empty-card">
          <span className="sf-session__celebration" aria-hidden="true">🎉</span>
          <h1>خلّصت الجلسة كاملة!</h1>
          <p>
            {finalSummary.good} صح من {finalSummary.attempts} محاولة · دقّة {finalSummary.accuracy}%
          </p>
          <button type="button" className="sf-session__primary" onClick={() => onExit(finalSummary)}>
            العودة للرئيسية
          </button>
        </div>
      </main>
    )
  }

  if (!activeCard || !active || !currentQuestion) return null

  const isMatching = isMatch(currentQuestion)
  const isPracticing = isPractice(currentQuestion)
  const hasAssistance = !isTest && Boolean(currentQuestion.q_ar || currentQuestion.hint_ar)
  const translationOpen = assistance.questionId === currentQuestion.id && assistance.translationOpen
  const hintOpen = assistance.questionId === currentQuestion.id && assistance.hintOpen
  const questionSource = !isMatching && !isPracticing ? sourceLabel(currentQuestion) : ''
  const usedAnswers = new Set(Object.values(active.matchAssignments))
  const remainingAnswers = active.matchAnswerOrder.filter((answer) => !usedAnswers.has(answer))
  const allMatched = isMatching && Object.keys(active.matchAssignments).length === currentQuestion.pairs.length
  const guardSecondsLeft = Math.max(0, Math.round((timerEndRef.current - Date.now()) / 1_000))

  return (
    <main className="screen sf-session" dir="rtl" style={{ '--session-accent': meta.color } as React.CSSProperties}>
      <header className="sf-session__topbar">
        <button type="button" className="sf-session__icon" onClick={requestExit} aria-label="الخروج من الجلسة">
          →
        </button>
        <div className="sf-session__title">
          <strong>{meta.subject}</strong>
          {meta.label ? <span> · {meta.label}</span> : null}
        </div>
        {modeLabel ? <span className={`sf-session__mode sf-session__mode--${meta.mode}`}>{modeLabel}</span> : null}
        {onOpenNotes && !isTest ? (
          <button type="button" className="sf-session__notes" onClick={onOpenNotes}>
            📝 الناقص
          </button>
        ) : null}
      </header>

      <section className="sf-session__stats" aria-label="إحصاءات الجلسة">
        <span>⏱ <SessionTimer endAt={timerEndRef.current} onElapsed={announceTimerEnd} /></span>
        {isTest ? (
          <>
            <span>السؤال <b>{completedCount + 1}/{viewState.cards.length}</b></span>
            <span>متبقي <b>{Math.max(0, viewState.cards.length - completedCount - 1)}</b></span>
          </>
        ) : (
          <>
            <span className="sf-session__stat-good">صح <b>{viewState.stats.good}</b></span>
            <span className="sf-session__stat-bad">غلط <b>{viewState.stats.bad}</b></span>
            <span>الدقّة <b>{attempts ? `${Math.round((viewState.stats.good / attempts) * 100)}%` : '—'}</b></span>
            <span>🔥 <b>{viewState.stats.streak}</b></span>
            <span>الإتقان <b>{mastered}/{viewState.cards.length}</b></span>
          </>
        )}
      </section>
      <div className="sf-session__mastery" role="progressbar" aria-label={isTest ? `أجبت عن ${completedCount} من ${viewState.cards.length}` : `أتقنت ${mastered} من ${viewState.cards.length}`} aria-valuemin={0} aria-valuemax={viewState.cards.length} aria-valuenow={isTest ? completedCount : mastered}>
        <i style={{ '--mastery-ratio': viewState.cards.length ? (isTest ? completedCount : mastered) / viewState.cards.length : 0 } as React.CSSProperties} />
      </div>

      <article key={`${currentQuestion.id}-${cardMotionKey}`} className={`sf-session__card ${!isTest && active.answered ? (active.correct ? 'has-correct-result' : 'has-wrong-result') : ''}`} ref={cardRef} tabIndex={-1} aria-labelledby={`sf-question-${domId}`}>
        <div className="sf-session__accent" />
        <div className="sf-session__meta">
          <span className="sf-session__source" title={currentQuestion.source ?? ''}>{questionSource}</span>
          {!isTest ? (
            <div className="sf-session__question-actions">
              <span className="sf-session__boxes" aria-label={`الصندوق ${activeCard.box} من 5`}>
                {Array.from({ length: 5 }, (_item, index) => (
                  <i key={index} className={index < activeCard.box ? 'is-on' : ''} aria-hidden="true" />
                ))}
              </span>
              <button
                type="button"
                className={`sf-session__star ${localStars[currentQuestion.id] ? 'is-on' : ''}`}
                onClick={toggleStar}
                aria-pressed={Boolean(localStars[currentQuestion.id])}
                aria-label={localStars[currentQuestion.id] ? 'إزالة النجمة' : 'تمييز السؤال بنجمة'}
              >
                {localStars[currentQuestion.id] ? '★' : '☆'}
              </button>
            </div>
          ) : null}
        </div>

        <h1 className="sf-session__question" id={`sf-question-${domId}`}>
          <StudyText text={currentQuestion.q} variant="question" />
        </h1>

        {hasAssistance ? (
          <div className="sf-session__assist">
            <div className="sf-session__assist-actions" role="group" aria-label="مساعدة السؤال">
              {currentQuestion.q_ar ? (
                <button
                  type="button"
                  onClick={toggleTranslation}
                  aria-expanded={translationOpen}
                  aria-controls={`sf-translation-${domId}`}
                >
                  <span aria-hidden="true">{translationOpen ? '−' : '+'}</span>
                  {translationOpen ? 'إخفاء الترجمة' : 'إظهار الترجمة'}
                </button>
              ) : null}
              {currentQuestion.hint_ar ? (
                <button
                  type="button"
                  onClick={toggleHint}
                  aria-expanded={hintOpen}
                  aria-controls={`sf-hint-${domId}`}
                >
                  <span aria-hidden="true">{hintOpen ? '−' : '+'}</span>
                  {hintOpen ? 'إخفاء التلميح' : 'إظهار التلميح'}
                </button>
              ) : null}
            </div>
            {translationOpen && currentQuestion.q_ar ? (
              <section id={`sf-translation-${domId}`} className="sf-session__assist-panel" dir="rtl" lang="ar">
                <strong>الترجمة العربية</strong>
                <MathText text={currentQuestion.q_ar} as="div" />
              </section>
            ) : null}
            {hintOpen && currentQuestion.hint_ar ? (
              <section id={`sf-hint-${domId}`} className="sf-session__assist-panel sf-session__assist-panel--hint" dir="rtl" lang="ar">
                <strong>تلميح بدون كشف الإجابة</strong>
                <MathText text={currentQuestion.hint_ar} as="div" />
              </section>
            ) : null}
          </div>
        ) : null}

        {isChoice(currentQuestion) ? (
          <div className="sf-session__choices" aria-label="الخيارات">
            {active.choiceOrder.map((originalIndex, displayedIndex) => {
              const wasSelected = active.selectedChoice === originalIndex
              const isCorrectAnswer = currentQuestion.answer === originalIndex
              const resultClass = isTest
                ? wasSelected ? 'is-selected' : ''
                : active.answered
                ? isCorrectAnswer
                  ? 'is-correct'
                  : wasSelected
                    ? 'is-wrong'
                    : 'is-dim'
                : ''
              return (
                <button
                  type="button"
                  key={originalIndex}
                  className={`sf-session__choice ${resultClass}`}
                  onClick={() => answerChoice(originalIndex)}
                  disabled={!isTest && active.answered}
                  aria-pressed={isTest ? wasSelected : undefined}
                  aria-label={`${choiceKey(displayedIndex)}. ${currentQuestion.choices[originalIndex]}`}
                >
                  <span aria-hidden="true">{choiceKey(displayedIndex)}</span>
                  <StudyText text={currentQuestion.choices[originalIndex]} variant="choice" />
                </button>
              )
            })}
          </div>
        ) : null}

        {isPracticing ? (
          <div className="sf-session__practice">
            {!active.revealed ? (
              <button type="button" className="sf-session__primary" onClick={revealPractice}>
                أظهر الحل
              </button>
            ) : (
              <>
                <section className="sf-session__solution" aria-label="الحل">
                  <strong>الحل</strong>
                  <MathText text={currentQuestion.solution} as="div" />
                </section>
                <Explanation question={currentQuestion} show />
                {!active.answered ? (
                  <div className="sf-session__self-grade" role="group" aria-label="قيّم إجابتك">
                    <span>هل عرفت تحلّها؟</span>
                    <button ref={gradeYesRef} type="button" onClick={() => gradePractice(true)}>
                      ✓ نعم
                    </button>
                    <button type="button" onClick={() => gradePractice(false)}>
                      ✗ لا
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {isMatching ? (
          <div className="sf-session__matching">
            {!active.answered ? (
              <>
                <p className="sf-session__match-help">
                  اضغط الإجابة ثم رقم الصف، أو اسحب البطاقة كاملة إلى مكانها.
                </p>
                <section className="sf-session__bank" aria-label="بنك الإجابات">
                  <header>
                    <strong>بنك الإجابات · Answer bank</strong>
                    <span aria-live="polite">تم {usedAnswers.size} من {currentQuestion.pairs.length}</span>
                  </header>
                  {remainingAnswers.length ? (
                    <div>
                      {remainingAnswers.map((answer) => (
                        <button
                          type="button"
                          key={answer}
                          className={[
                            active.selectedMatchAnswer === answer ? 'is-selected' : '',
                            draggingAnswer === answer ? 'is-dragging' : '',
                          ].filter(Boolean).join(' ')}
                          draggable
                          aria-pressed={active.selectedMatchAnswer === answer}
                          aria-label={`الإجابة: ${currentQuestion.pairs[answer][1]}. اضغط لاختيارها أو اسحبها إلى صف`}
                          onClick={() => selectMatchAnswer(answer)}
                          onDragStart={(event) => beginMatchDrag(event, answer)}
                          onDragEnd={clearMatchDrag}
                        >
                          <span className="sf-session__drag-handle" aria-hidden="true">
                            {active.selectedMatchAnswer === answer ? '✓' : '⠿'}
                          </span>
                          <MathText text={currentQuestion.pairs[answer][1]} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p>✓ وُزّعت كل الإجابات — عدّل أي خانة أو تحقّق</p>
                  )}
                </section>
              </>
            ) : null}

            <div className="sf-session__match-rows">
              {currentQuestion.pairs.map((pair, row) => {
                const answer = active.matchAssignments[row]
                const hint = pairHint(currentQuestion, row)
                const rowCorrect = answer === row
                return (
                  <section
                    key={`${currentQuestion.id}-${row}`}
                    data-match-row={row}
                    aria-label={`الصف ${row + 1}: ${pair[0]}`}
                    className={[
                      active.answered ? (rowCorrect ? 'is-correct' : 'is-wrong') : '',
                      dragOverRow === row ? 'is-drag-over' : '',
                    ].filter(Boolean).join(' ')}
                    onDragEnter={() => setDragOverRow(row)}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverRow(null)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      if (dragOverRow !== row) setDragOverRow(row)
                    }}
                    onDrop={(event) => dropMatch(event, row)}
                  >
                    <span className="sf-session__match-number">{row + 1}</span>
                    <MathText text={pair[0]} className="sf-session__match-left" />
                    {active.answered ? (
                      <div className="sf-session__match-result">
                        <MathText text={answer === undefined ? '—' : currentQuestion.pairs[answer][1]} />
                        <b aria-label={rowCorrect ? 'صحيح' : 'خطأ'}>{rowCorrect ? '✓' : '✗'}</b>
                        {!rowCorrect ? (
                          <small>
                            Correct answer: <MathText text={pair[1]} />
                          </small>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        key={answer ?? 'empty'}
                        type="button"
                        id={`sf-slot-${domId}-${row}`}
                        className={`sf-session__match-slot ${answer !== undefined ? 'is-filled' : ''}`}
                        onClick={() => chooseMatchSlot(row)}
                        aria-label={
                          answer !== undefined
                            ? `تغيير إجابة الصف ${row + 1}: ${currentQuestion.pairs[answer][1]}`
                            : `ضع إجابة في الصف ${row + 1}`
                        }
                      >
                        {answer !== undefined ? (
                          <>
                            <MathText text={currentQuestion.pairs[answer][1]} />
                            <span aria-hidden="true">×</span>
                          </>
                        ) : active.selectedMatchAnswer !== null ? (
                          'اضغط لوضع الإجابة'
                        ) : (
                          'اختر من البنك'
                        )}
                      </button>
                    )}
                    {hint && !active.answered && !isTest ? (
                      <>
                        <button
                          type="button"
                          className="sf-session__pair-hint-button"
                          onClick={() => togglePairHint(row)}
                          aria-label={`تلميح للصف ${row + 1}`}
                          aria-expanded={Boolean(active.openHints[row])}
                          aria-controls={`sf-pair-hint-${domId}-${row}`}
                        >
                          {active.openHints[row] ? '−' : '؟'}
                        </button>
                        {active.openHints[row] ? (
                          <div
                            id={`sf-pair-hint-${domId}-${row}`}
                            className="sf-session__pair-hint"
                            dir="rtl"
                            lang="ar"
                          >
                            <MathText text={hint} />
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </section>
                )
              })}
            </div>
            {!active.answered ? (
              <button type="button" className="sf-session__primary" onClick={isTest ? submitTestAnswer : gradeMatch} disabled={!allMatched}>
                {isTest ? 'التالي ←' : 'تحقّق من التوصيل ✓'}
              </button>
            ) : null}
          </div>
        ) : null}

        {!isTest && !isPracticing ? <Explanation question={currentQuestion} show={active.answered} /> : null}

        {isTest && isChoice(currentQuestion) ? (
          <footer className="sf-session__next sf-session__next--test">
            <span>{active.selectedChoice === null ? 'اختر إجابة للمتابعة' : 'يمكنك تغيير اختيارك قبل الانتقال'}</span>
            <button ref={nextButtonRef} type="button" className="sf-session__primary" onClick={submitTestAnswer} disabled={active.selectedChoice === null}>
              التالي <span aria-hidden="true">←</span>
            </button>
          </footer>
        ) : active.answered ? (
          <footer className="sf-session__next">
            <strong className={active.correct ? 'is-correct' : 'is-wrong'}>
              {active.correct ? '✓ صحيح' : '✗ راجعها'}
            </strong>
            <button ref={nextButtonRef} type="button" className="sf-session__primary" onClick={advance}>
              التالي <span aria-hidden="true">←</span>
            </button>
          </footer>
        ) : null}
      </article>

      <p className="sf-session__keys">
        الاختيارات: <kbd>1–9</kbd> أو <kbd>A–Z</kbd> · التالي: <kbd>Enter</kbd> · خروج: <kbd>Esc</kbd>
      </p>
      <div className="sf-session__live" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {guardOpen ? (
        <div className="sf-session__guard" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`sf-guard-title-${domId}`}
            aria-describedby={`sf-guard-message-${domId}`}
            onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setGuardOpen(false)
              }
              if (event.key !== 'Tab') return
              const first = stayButtonRef.current
              const last = leaveButtonRef.current
              if (!first || !last) return
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
              }
            }}
          >
            <span className="sf-session__guard-emoji" aria-hidden="true">
              {guardSecondsLeft > 0 ? '⏳' : summary().remaining > 8 ? '⏰' : '🔥'}
            </span>
            <h2 id={`sf-guard-title-${domId}`}>{isTest ? 'إلغاء الاختبار؟' : 'هل تريد الخروج؟'}</h2>
            <p id={`sf-guard-message-${domId}`}>
              {isTest
                ? 'لن تُحفظ نتيجة نهائية لهذا الاختبار إذا خرجت الآن.'
                : guardSecondsLeft > 0
                ? `باقي ${formatTimer(guardSecondsLeft)} من وقتك. كمّل الجلسة ولا تقطع تركيزك.`
                : `باقي ${summary().remaining} بطاقة. تقدّمك محفوظ، لكن إنهاء الجولة أفضل.`}
            </p>
            <div>
              <button ref={stayButtonRef} type="button" className="sf-session__primary" onClick={() => setGuardOpen(false)}>
                {isTest ? 'متابعة الاختبار' : 'أكمل الجلسة'}
              </button>
              <button ref={leaveButtonRef} type="button" onClick={() => onExit(summary())}>
                {isTest ? 'إلغاء الاختبار' : 'خروج وحفظ التقدّم'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default SessionScreen
