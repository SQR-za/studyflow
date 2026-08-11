import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ScreenHeader } from '../../components/Ui'
import { readiness, shuffle, subjectShortName } from '../../lib/utils'
import type { ChoiceQuestion, DrillPreset, DrillsBundle, Lesson, Subject } from '../../types'
import './mock.css'

interface MockItem {
  question: ChoiceQuestion
  choices: string[]
  correct: number
  pick: number
}

export interface MockResultPayload {
  code: string
  label: string
  items: MockItem[]
  lessonIds: string[]
  presetId?: string
  percent: number
  correct: number
}

export function MockScreen({ data, order, hidden, drills, initialLesson, onBack, onRecord, onReviewWrong }: {
  data: Record<string, Subject>
  order: string[]
  hidden: string[]
  drills: DrillsBundle
  initialLesson?: { code: string; lessonId: string } | null
  onBack: () => void
  onRecord: (result: MockResultPayload) => void
  onReviewWrong: (questions: ChoiceQuestion[], code: string, label: string) => void
}) {
  const visible = order.filter(code => !hidden.includes(code))
  const [stage, setStage] = useState<'setup' | 'run' | 'result'>('setup')
  const [code, setCode] = useState(initialLesson?.code ?? visible[0] ?? order[0] ?? '')
  const [lessonIds, setLessonIds] = useState<Set<string>>(() => initialLesson ? new Set([initialLesson.lessonId]) : new Set())
  const [count, setCount] = useState(20)
  const [timed, setTimed] = useState(true)
  const [items, setItems] = useState<MockItem[]>([])
  const [index, setIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [assistOpen, setAssistOpen] = useState(false)
  const [label, setLabel] = useState('اختبار مخصص')
  const [presetId, setPresetId] = useState<string | undefined>()

  const subject = data[code]
  const lessons = useMemo(() => subject?.chapters.flatMap(chapter => chapter.lessons ?? []) ?? [], [subject])
  const presets = code === drills.subject ? drills.presets : []

  useEffect(() => {
    if (!initialLesson) return
    const lesson = data[initialLesson.code]?.chapters.flatMap(chapter => chapter.lessons ?? []).find(item => item.id === initialLesson.lessonId)
    if (lesson) startWithPool(lesson.questions.filter(isChoiceQuestion), `اختبار القسم · ${lesson.label}`, [lesson.id], undefined, true)
    // Initial lesson is an explicit one-shot launch request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = useCallback(() => {
    if (!items.length || stage === 'result') return
    const correct = items.filter(item => item.pick === item.correct).length
    const percent = Math.round(correct / items.length * 100)
    onRecord({ code, label, items, lessonIds: [...lessonIds], presetId, percent, correct })
    setStage('result')
  }, [code, items, label, lessonIds, onRecord, presetId, stage])

  useEffect(() => {
    if (stage !== 'run' || !timed) return
    if (secondsLeft <= 0) { finish(); return }
    const timer = window.setTimeout(() => setSecondsLeft(value => value - 1), 1_000)
    return () => window.clearTimeout(timer)
  }, [finish, secondsLeft, stage, timed])

  function makeItems(pool: ChoiceQuestion[]): MockItem[] {
    return shuffle(pool).map(question => {
      const indexed = question.choices.map((text, answer) => ({ text, answer }))
      const shuffled = shuffle(indexed)
      return { question, choices: shuffled.map(choice => choice.text), correct: shuffled.findIndex(choice => choice.answer === question.answer), pick: -1 }
    })
  }

  function startWithPool(pool: ChoiceQuestion[], nextLabel: string, nextLessons: string[], nextPreset?: string, forceTimed = timed) {
    if (!pool.length) return
    const next = makeItems(pool)
    setItems(next)
    setIndex(0)
    setLabel(nextLabel)
    setPresetId(nextPreset)
    setLessonIds(new Set(nextLessons))
    setTimed(forceTimed)
    setSecondsLeft(Math.max(5, next.length) * 60)
    setAssistOpen(false)
    setStage('run')
  }

  function startCustom() {
    if (!subject) return
    const pool = lessonIds.size
      ? lessons.filter(lesson => lessonIds.has(lesson.id)).flatMap(lesson => lesson.questions).filter(isChoiceQuestion)
      : subject.chapters.flatMap(chapter => chapter.questions).filter(isChoiceQuestion)
    startWithPool(shuffle(pool).slice(0, Math.min(count, pool.length)), lessonIds.size ? `${lessonIds.size} أقسام مختارة` : `اختبار ${subjectShortName(subject.name)}`, [...lessonIds])
  }

  function startPreset(preset: DrillPreset) {
    let pool: ChoiceQuestion[] = []
    if (preset.parts) for (const part of preset.parts) {
      const chapter = subject?.chapters.find(item => item.id === part.chapterId)
      if (chapter) pool.push(...shuffle(chapter.questions.filter(isChoiceQuestion)).slice(0, part.count))
    }
    if (preset.lessonIds) pool = shuffle(lessons.filter(lesson => preset.lessonIds?.includes(lesson.id)).flatMap(lesson => lesson.questions).filter(isChoiceQuestion)).slice(0, preset.count ?? 20)
    startWithPool(shuffle(pool), preset.label, preset.lessonIds ?? [], preset.id, preset.timed !== false)
  }

  if (stage === 'setup') return (
    <main className="screen mock-screen">
      <ScreenHeader title="🎯 اختبار تجريبي" onBack={onBack} />
      <section className="mock-panel">
        <h2>اختر المادة</h2>
        <div className="subject-toggles">{visible.map(item => <button type="button" className={item === code ? 'selected' : ''} key={item} onClick={() => { setCode(item); setLessonIds(new Set()) }}>{data[item].name}</button>)}</div>
      </section>
      {!!presets.length && <section className="mock-panel"><h2>اختبارات جاهزة</h2><div className="preset-grid">{presets.map(preset => <button type="button" key={preset.id} onClick={() => startPreset(preset)}><strong>{preset.label}</strong><span>{preset.count ?? preset.parts?.reduce((sum, part) => sum + part.count, 0) ?? '—'} سؤال {preset.timed === false ? '· بلا وقت' : '· بوقت'}</span></button>)}</div></section>}
      {!!lessons.length && <section className="mock-panel"><h2>الأقسام</h2><div className="lesson-picker">{subject.chapters.filter(chapter => chapter.lessons?.length).map(chapter => <div key={chapter.id}><h3>{chapter.label}</h3><div>{chapter.lessons?.map(lesson => <button type="button" className={lessonIds.has(lesson.id) ? 'selected' : ''} key={lesson.id} onClick={() => setLessonIds(current => { const next = new Set(current); next.has(lesson.id) ? next.delete(lesson.id) : next.add(lesson.id); return next })}>{lesson.label}</button>)}</div></div>)}</div></section>}
      <section className="mock-panel mock-options"><div><label htmlFor="mock-count">عدد الأسئلة</label><select id="mock-count" value={count} onChange={event => setCount(Number(event.target.value))}>{[10, 20, 30, 40].map(value => <option key={value} value={value}>{value}</option>)}</select></div><label className="check-label"><input type="checkbox" checked={timed} onChange={event => setTimed(event.target.checked)} /> مؤقت</label><Button onClick={startCustom}>ابدأ الاختبار</Button></section>
    </main>
  )

  if (stage === 'run') {
    const item = items[index]
    if (!item) return null
    const minutes = Math.floor(secondsLeft / 60); const seconds = secondsLeft % 60
    return (
      <main className="screen mock-screen">
        <ScreenHeader title="🎯 اختبار تجريبي" subtitle={label} onBack={() => window.confirm('الخروج من الاختبار الحالي؟') && onBack()} actions={timed ? <span className={`timer-chip ${secondsLeft <= 60 ? 'bad' : ''}`} dir="ltr">⏱ {minutes}:{String(seconds).padStart(2, '0')}</span> : undefined} />
        <div className="mock-progress"><span>{index + 1}/{items.length}</span><i><b style={{ width: `${index / items.length * 100}%` }} /></i><span>متبقي {items.length - index - 1}</span></div>
        <section className="question-card" style={{ '--subject-color': subject?.color ?? '#2dd4bf' } as React.CSSProperties}>
          <h2 dir="auto">{item.question.q}</h2>
          {(item.question.q_ar || item.question.hint_ar) && <div className="assist-block"><button type="button" onClick={() => setAssistOpen(value => !value)} aria-expanded={assistOpen}>{assistOpen ? '− إخفاء المساعدة' : '+ ترجمة وتلميح'}</button>{assistOpen && <div><article><small>الترجمة العربية</small><p dir="rtl">{item.question.q_ar}</p></article><article><small>تلميح بدون كشف الإجابة</small><p dir="rtl">{item.question.hint_ar}</p></article></div>}</div>}
          <div className="choice-list">{item.choices.map((choice, choiceIndex) => <button type="button" className={item.pick === choiceIndex ? 'selected' : ''} key={`${choice}-${choiceIndex}`} onClick={() => setItems(current => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, pick: choiceIndex } : entry))}><kbd>{String.fromCharCode(65 + choiceIndex)}</kbd><span dir="auto">{choice}</span></button>)}</div>
          <div className="question-actions"><Button variant="secondary" onClick={() => { setAssistOpen(false); if (index < items.length - 1) setIndex(value => value + 1); else finish() }}>تخطٍّ</Button><Button onClick={() => { setAssistOpen(false); if (index < items.length - 1) setIndex(value => value + 1); else finish() }}>{index === items.length - 1 ? 'إنهاء ✓' : 'التالي'}</Button></div>
        </section>
      </main>
    )
  }

  const correct = items.filter(item => item.pick === item.correct).length
  const percent = items.length ? Math.round(correct / items.length * 100) : 0
  const status = readiness(percent)
  const wrong = items.filter(item => item.pick !== item.correct).map(item => item.question)
  return (
    <main className="screen mock-screen">
      <ScreenHeader title="نتيجة الاختبار" subtitle={label} onBack={onBack} />
      <section className="result-summary"><strong className={percent >= 90 ? 'good' : percent >= 70 ? 'warn' : 'bad'}>{percent}%</strong><p>{correct} من {items.length} صحيحة</p><span className={status.className}>{status.label}</span><div><Button variant="secondary" onClick={() => setStage('setup')}>🔁 اختبار آخر</Button><Button disabled={!wrong.length} onClick={() => onReviewWrong(wrong, code, 'أخطاء الاختبار')}>⚠ راجع الأخطاء</Button></div></section>
      <div className="result-review">{items.map((item, itemIndex) => { const ok = item.pick === item.correct; return <article className={ok ? 'correct' : 'wrong'} key={item.question.id}><h3 dir="auto">{itemIndex + 1}. {item.question.q}</h3><p>{ok ? '✓ صحيح' : '✗ خطأ'} · إجابتك: <span dir="auto">{item.pick >= 0 ? item.choices[item.pick] : '— متروك'}</span></p>{!ok && <div dir="auto">✓ الصحيح: {item.choices[item.correct]}{item.question.explanation ? ` — ${item.question.explanation}` : ''}</div>}{item.question.explanation_ar && <aside dir="rtl"><b>شرح عربي</b>{item.question.explanation_ar}</aside>}</article> })}</div>
    </main>
  )
}

function isChoiceQuestion(value: unknown): value is ChoiceQuestion {
  if (!value || typeof value !== 'object') return false
  const question = value as Partial<ChoiceQuestion>
  return Array.isArray(question.choices) && Number.isInteger(question.answer)
}
