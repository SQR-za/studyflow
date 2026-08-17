import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StudyText } from '../../components/StudyText'
import { Button, ScreenHeader } from '../../components/Ui'
import { QUESTION_KIND_LABELS } from '../../lib/constants'
import { readiness, shuffle, subjectShortName } from '../../lib/utils'
import type { ChoiceQuestion, DrillPreset, DrillsCatalog, StudyQuestion, Subject } from '../../types'
import './mock.css'

interface MockItem {
  question: ChoiceQuestion
  choices: string[]
  correct: number
  pick: number
}

function MockTimer({ endAt, onElapsed }: { endAt: number; onElapsed: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((endAt - Date.now()) / 1_000)))
  const onElapsedRef = useRef(onElapsed)
  const elapsedRef = useRef(false)

  useEffect(() => { onElapsedRef.current = onElapsed }, [onElapsed])
  useEffect(() => {
    const update = () => {
      const next = Math.max(0, Math.ceil((endAt - Date.now()) / 1_000))
      setSecondsLeft(next)
      if (next === 0 && !elapsedRef.current) {
        elapsedRef.current = true
        onElapsedRef.current()
      }
    }
    update()
    const timer = window.setInterval(update, 1_000)
    return () => window.clearInterval(timer)
  }, [endAt])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  return <span className={`timer-chip ${secondsLeft <= 60 ? 'bad' : ''}`} dir="ltr">⏱ {minutes}:{String(seconds).padStart(2, '0')}</span>
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

export function MockScreen({ data, order, hidden, drillBundles, onBack, onRecord, onReviewWrong, onStartComprehensive }: {
  data: Record<string, Subject>
  order: string[]
  hidden: string[]
  drillBundles: DrillsCatalog
  onBack: () => void
  onRecord: (result: MockResultPayload) => void
  onReviewWrong: (questions: ChoiceQuestion[], code: string, label: string) => void
  onStartComprehensive: (questions: StudyQuestion[], code: string, label: string, lessonIds: string[]) => void
}) {
  const visible = order.filter(code => !hidden.includes(code))
  const [stage, setStage] = useState<'setup' | 'run' | 'result'>('setup')
  const [code, setCode] = useState(visible[0] ?? order[0] ?? '')
  const [lessonIds, setLessonIds] = useState<Set<string>>(() => new Set())
  const [count, setCount] = useState<number | 'all'>(20)
  const [timed, setTimed] = useState(true)
  const [items, setItems] = useState<MockItem[]>([])
  const [index, setIndex] = useState(0)
  const [timerEndAt, setTimerEndAt] = useState(0)
  const [translationOpen, setTranslationOpen] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [label, setLabel] = useState('اختبار مخصص')
  const [presetId, setPresetId] = useState<string | undefined>()

  const subject = data[code]
  const lessons = useMemo(() => subject?.chapters.flatMap(chapter => chapter.lessons ?? []) ?? [], [subject])
  const presets = drillBundles[code]?.presets ?? []
  const comprehensivePool = useMemo(() => {
    if (!subject) return []
    if (lessonIds.size) return lessons.filter(lesson => lessonIds.has(lesson.id)).flatMap(lesson => lesson.questions)
    if (lessons.length) return lessons.flatMap(lesson => lesson.questions)
    return subject.chapters.flatMap(chapter => chapter.questions)
  }, [lessonIds, lessons, subject])

  const finish = useCallback(() => {
    if (!items.length || stage === 'result') return
    const correct = items.filter(item => item.pick === item.correct).length
    const percent = Math.round(correct / items.length * 100)
    onRecord({ code, label, items, lessonIds: [...lessonIds], presetId, percent, correct })
    setStage('result')
  }, [code, items, label, lessonIds, onRecord, presetId, stage])

  function makeItems(pool: ChoiceQuestion[]): MockItem[] {
    return shuffle(pool).map(question => {
      const indexed = question.choices.map((text, answer) => ({ text, answer }))
      const shuffled = shuffle(indexed)
      return { question, choices: shuffled.map(choice => choice.text), correct: shuffled.findIndex(choice => choice.answer === question.answer), pick: -1 }
    })
  }

  function startWithPool(pool: ChoiceQuestion[], nextLabel: string, nextLessons: string[], nextPreset?: string, forceTimed = timed, exactMinutes?: number) {
    if (!pool.length) return
    const next = makeItems(pool)
    setItems(next)
    setIndex(0)
    setLabel(nextLabel)
    setPresetId(nextPreset)
    setLessonIds(new Set(nextLessons))
    setTimed(forceTimed)
    setTimerEndAt(Date.now() + (exactMinutes ?? Math.max(5, next.length)) * 60_000)
    setTranslationOpen(false)
    setHintOpen(false)
    setStage('run')
  }

  function startCustom() {
    if (!subject) return
    if (count === 'all') {
      const selectedLessons = lessons.filter(lesson => lessonIds.has(lesson.id))
      const nextLabel = selectedLessons.length === 1
        ? `قسم كامل · ${selectedLessons[0].label}`
        : selectedLessons.length > 1
          ? `${selectedLessons.length} أقسام كاملة`
          : `كل أقسام ${subjectShortName(subject.name)}`
      onStartComprehensive(comprehensivePool, code, nextLabel, [...lessonIds])
      return
    }
    const pool = lessonIds.size
      ? lessons.filter(lesson => lessonIds.has(lesson.id)).flatMap(lesson => lesson.questions).filter(isChoiceQuestion)
      : subject.chapters.flatMap(chapter => chapter.questions).filter(isChoiceQuestion)
    startWithPool(shuffle(pool).slice(0, Math.min(count, pool.length)), lessonIds.size ? `${lessonIds.size} أقسام مختارة` : `اختبار ${subjectShortName(subject.name)}`, [...lessonIds])
  }

  function startPreset(preset: DrillPreset) {
    const presetLessons = preset.lessonIds?.length
      ? lessons.filter(lesson => preset.lessonIds?.includes(lesson.id))
      : []
    const presetStudyPool = presetLessons.flatMap(lesson => lesson.questions)
    const isFullLessonPreset = !preset.quick
      && !preset.parts?.length
      && presetStudyPool.length > 0
      && preset.count === presetStudyPool.length

    if (isFullLessonPreset) {
      onStartComprehensive(presetStudyPool, code, preset.label, preset.lessonIds ?? [])
      return
    }

    let pool: ChoiceQuestion[] = []
    if (preset.questions?.length) pool = preset.questions.filter(isChoiceQuestion)
    if (!preset.questions?.length && preset.parts) for (const part of preset.parts) {
      const chapter = subject?.chapters.find(item => item.id === part.chapterId)
      if (chapter) pool.push(...shuffle(chapter.questions.filter(isChoiceQuestion)).slice(0, part.count))
    }
    if (!preset.questions?.length && preset.lessonIds) pool = shuffle(presetStudyPool.filter(isChoiceQuestion)).slice(0, preset.count ?? 20)
    startWithPool(shuffle(pool), preset.label, preset.quick ? [preset.id] : (preset.lessonIds ?? []), preset.id, preset.timed !== false, preset.quick ? 5 : undefined)
  }

  if (stage === 'setup') return (
    <main className="screen mock-screen">
      <ScreenHeader title="🎯 اختبار تجريبي" onBack={onBack} />
      <section className="mock-panel">
        <h2>اختر المادة</h2>
        <div className="subject-toggles" role="group" aria-label="اختيار المادة">{visible.map(item => <button type="button" className={item === code ? 'selected' : ''} aria-pressed={item === code} key={item} onClick={() => { setCode(item); setLessonIds(new Set()) }}>{data[item].name}</button>)}</div>
      </section>
      {!!presets.filter(preset => !preset.quick).length && <section className="mock-panel"><h2>اختبارات جاهزة</h2><div className="preset-grid">{presets.filter(preset => !preset.quick).map(preset => <button type="button" key={preset.id} onClick={() => startPreset(preset)}><strong>{preset.label}</strong><span>{preset.count ?? preset.parts?.reduce((sum, part) => sum + part.count, 0) ?? '—'} سؤال {preset.timed === false ? '· بلا وقت' : '· بوقت'}</span></button>)}</div></section>}
      {!!presets.filter(preset => preset.quick).length && <section className="mock-panel"><h2>⚡ فحص سريع لكل قسم</h2><p>أربع أسئلة مركّزة تقيس أهم قاعدة أو حساب أو فخ في القسم.</p><div className="preset-grid">{presets.filter(preset => preset.quick).map(preset => <button type="button" key={preset.id} onClick={() => startPreset(preset)}><strong>{preset.label}</strong><span>{preset.count ?? preset.questions?.length ?? '—'} أسئلة · نحو 4 دقائق</span></button>)}</div></section>}
      {!!lessons.length && <section className="mock-panel"><h2>الأقسام</h2><div className="lesson-picker">{subject.chapters.filter(chapter => chapter.lessons?.length).map(chapter => <div key={chapter.id}><h3>{chapter.label}</h3><div role="group" aria-label={chapter.label}>{chapter.lessons?.map(lesson => <button type="button" className={lessonIds.has(lesson.id) ? 'selected' : ''} aria-pressed={lessonIds.has(lesson.id)} key={lesson.id} onClick={() => setLessonIds(current => { const next = new Set(current); next.has(lesson.id) ? next.delete(lesson.id) : next.add(lesson.id); return next })}>{lesson.label}</button>)}</div></div>)}</div></section>}
      <section className="mock-panel mock-options"><div><label htmlFor="mock-count">عدد الأسئلة</label><select id="mock-count" value={count} onChange={event => setCount(event.target.value === 'all' ? 'all' : Number(event.target.value))}>{[10, 20, 30, 40].map(value => <option key={value} value={value}>{value}</option>)}<option value="all">كل الأسئلة ({comprehensivePool.length})</option></select></div><label className="check-label"><input type="checkbox" checked={timed} onChange={event => setTimed(event.target.checked)} /> مؤقت</label><Button onClick={startCustom}>ابدأ الاختبار</Button></section>
    </main>
  )

  if (stage === 'run') {
    const item = items[index]
    if (!item) return null
    return (
      <main className="screen mock-screen">
        <ScreenHeader title="🎯 اختبار تجريبي" subtitle={label} onBack={() => window.confirm('الخروج من الاختبار الحالي؟') && onBack()} actions={timed ? <MockTimer key={timerEndAt} endAt={timerEndAt} onElapsed={finish} /> : undefined} />
        <div className="mock-progress"><span>{index + 1}/{items.length}</span><i role="progressbar" aria-label="تقدم الاختبار" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={index}><b style={{ '--mock-progress': items.length ? index / items.length : 0 } as React.CSSProperties} /></i><span>متبقي {items.length - index - 1}</span></div>
        <section key={item.question.id} className="question-card" style={{ '--subject-color': subject?.color ?? '#2dd4bf' } as React.CSSProperties}>
          {item.question.kind ? <span className="mock-question-kind">{QUESTION_KIND_LABELS[item.question.kind]}</span> : null}
          <h2 dir="auto"><StudyText text={item.question.q} variant="question" /></h2>
          {(item.question.q_ar || item.question.hint_ar) && (
            <div className="assist-block">
              <div className="assist-block__actions" role="group" aria-label="مساعدة السؤال">
                {item.question.q_ar ? <button type="button" onClick={() => setTranslationOpen(value => !value)} aria-expanded={translationOpen}>{translationOpen ? '− إخفاء الترجمة' : '+ إظهار الترجمة'}</button> : null}
                {item.question.hint_ar ? <button type="button" onClick={() => setHintOpen(value => !value)} aria-expanded={hintOpen}>{hintOpen ? '− إخفاء التلميح' : '+ إظهار التلميح'}</button> : null}
              </div>
              {translationOpen && item.question.q_ar ? <article><small>الترجمة العربية</small><p dir="rtl">{item.question.q_ar}</p></article> : null}
              {hintOpen && item.question.hint_ar ? <article><small>تلميح بدون كشف الإجابة</small><p dir="rtl">{item.question.hint_ar}</p></article> : null}
            </div>
          )}
          <div className="choice-list" role="radiogroup" aria-label="خيارات الإجابة">{item.choices.map((choice, choiceIndex) => <button type="button" role="radio" aria-checked={item.pick === choiceIndex} className={item.pick === choiceIndex ? 'selected' : ''} key={`${choice}-${choiceIndex}`} onClick={() => setItems(current => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, pick: choiceIndex } : entry))}><kbd>{String.fromCharCode(65 + choiceIndex)}</kbd><StudyText text={choice} variant="choice" /></button>)}</div>
          <div className="question-actions"><Button variant="secondary" onClick={() => { setTranslationOpen(false); setHintOpen(false); if (index < items.length - 1) setIndex(value => value + 1); else finish() }}>تخطٍّ</Button><Button onClick={() => { setTranslationOpen(false); setHintOpen(false); if (index < items.length - 1) setIndex(value => value + 1); else finish() }}>{index === items.length - 1 ? 'إنهاء ✓' : 'التالي'}</Button></div>
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
      <div className="result-review">{items.map((item, itemIndex) => {
        const ok = item.pick === item.correct
        return (
          <article className={ok ? 'correct' : 'wrong'} key={item.question.id}>
            {item.question.kind ? <span className="mock-question-kind">{QUESTION_KIND_LABELS[item.question.kind]}</span> : null}
            <h3 dir="auto"><span>{itemIndex + 1}. </span><StudyText text={item.question.q} variant="question" /></h3>
            <p>
              {ok ? '✓ صحيح' : '✗ خطأ'} · إجابتك:{' '}
              <StudyText text={item.pick >= 0 ? item.choices[item.pick] : '— متروك'} variant="choice" />
            </p>
            {!ok ? (
              <div dir="auto">
                <strong>✓ الصحيح: </strong><StudyText text={item.choices[item.correct]} variant="choice" />
                {item.question.explanation ? <StudyText text={` — ${item.question.explanation}`} /> : null}
              </div>
            ) : null}
            {item.question.hint_ar ? <aside className="result-review__fast-tip" dir="rtl"><b>طريقة الكشف السريعة</b><StudyText text={item.question.hint_ar} /></aside> : null}
            {item.question.explanation_ar ? <aside dir="rtl"><b>شرح عربي</b><StudyText text={item.question.explanation_ar} /></aside> : null}
          </article>
        )
      })}</div>
    </main>
  )
}

function isChoiceQuestion(value: unknown): value is ChoiceQuestion {
  if (!value || typeof value !== 'object') return false
  const question = value as Partial<ChoiceQuestion>
  return Array.isArray(question.choices) && Number.isInteger(question.answer)
}
