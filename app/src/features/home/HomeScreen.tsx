import { useId, useMemo, useState } from 'react'
import { ProgressRing } from '../../components/Ui'
import { APP_BUILD, MASTERY_BOX } from '../../lib/constants'
import { daysBetween, subjectShortName, todayString } from '../../lib/utils'
import type { AppSettings, Chapter, DailyStore, Lesson, NotesBlock, ProgressStore, StudySchedule, Subject } from '../../types'

export interface StartRequest {
  code: string
  scope: string
  mode: 'all' | 'review' | 'practice' | 'learn'
  lessonIds?: Set<string>
}

interface HomeScreenProps {
  data: Record<string, Subject>
  order: string[]
  schedule: StudySchedule
  store: ProgressStore
  settings: AppSettings
  daily: DailyStore
  onOpenScreen: (screen: 'search' | 'mock' | 'plan' | 'settings' | 'weak') => void
  onStart: (request: StartRequest) => void
  onStartStarred: () => void
  onStartDue: () => void
  onStartLessonTest: (code: string, lesson: Lesson) => void
  onOpenNotes: (notes: NotesBlock | undefined | null, title: string) => void
  onToggleExtra: () => void
  onChangeDuration: (minutes: number) => void
}

function questionsOf(chapter: Chapter, includeExtra: boolean) {
  const questions = includeExtra ? chapter.questions : chapter.questions.filter(question => question.src !== 'extra')
  return [...questions, ...(chapter.practice ?? [])]
}

function statsFor(items: Array<{ id: string }>, store: ProgressStore) {
  let mastered = 0
  let seen = 0
  let weak = 0
  for (const item of items) {
    const progress = store.q[item.id]
    if (!progress) continue
    if (progress.seen > 0) seen += 1
    if (progress.box >= MASTERY_BOX) mastered += 1
    if (progress.wrong > 0 && progress.box < MASTERY_BOX) weak += 1
  }
  return { mastered, seen, weak, total: items.length }
}

function SubjectCard({ subject, store, settings, onStart, onStartLessonTest, onOpenNotes }: {
  subject: Subject
  store: ProgressStore
  settings: AppSettings
  onStart: HomeScreenProps['onStart']
  onStartLessonTest: HomeScreenProps['onStartLessonTest']
  onOpenNotes: HomeScreenProps['onOpenNotes']
}) {
  const [open, setOpen] = useState(subject.code === 'CCCS422-FINAL')
  const bodyId = `subject-${useId().replaceAll(':', '')}`
  const subjectItems = subject.chapters.flatMap(chapter => questionsOf(chapter, settings.includeExtra))
  const subjectStats = statsFor(subjectItems, store)
  const mastery = subjectStats.total ? subjectStats.mastered / subjectStats.total * 100 : 0

  return (
    <section className={`subject-card ${open ? 'is-open' : ''}`} style={{ '--subject-color': subject.color } as React.CSSProperties}>
      <button className="subject-card__header" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls={bodyId}>
        <span className="subject-card__dot" />
        <span className="subject-card__identity">
          <strong>{subject.name}</strong>
          <small dir="ltr">{subject.code} · {subject.chapters.length} chapters · {subjectStats.total} items</small>
        </span>
        <span className="subject-card__mastery"><small>الإتقان</small><b>{Math.round(mastery)}%</b></span>
        <span className="subject-card__chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="subject-card__body" id={bodyId}>
          {subject.chapters.map(chapter => {
            const items = questionsOf(chapter, settings.includeExtra)
            const chapterStats = statsFor(items, store)
            const percent = chapterStats.total ? chapterStats.mastered / chapterStats.total * 100 : 0
            return (
              <div className="chapter-block" key={chapter.id}>
                <div className="chapter-row">
                  <ProgressRing value={percent} color={subject.color} />
                  <button className="chapter-row__main" type="button" onClick={() => onStart({ code: subject.code, scope: chapter.id, mode: 'all' })}>
                    <strong dir="auto">{chapter.label}</strong>
                    <small>{chapter.questions.length} سؤال{chapter.lessons?.length ? ` · ${chapter.lessons.length} أقسام` : ''}{chapter.practice?.length ? ` · ${chapter.practice.length} مسائل` : ''} · أتقنت {chapterStats.mastered}{chapterStats.weak ? ` · ⚠ ${chapterStats.weak}` : ''}</small>
                  </button>
                  <div className="chapter-row__actions">
                    <button type="button" onClick={() => onStart({ code: subject.code, scope: chapter.id, mode: 'review' })} title="راجع الأخطاء">⚠</button>
                    {!!chapter.practice?.length && <button type="button" onClick={() => onStart({ code: subject.code, scope: chapter.id, mode: 'practice' })} title="المسائل">🧮</button>}
                    <button type="button" onClick={() => onOpenNotes(chapter.notes, `${subjectShortName(subject.name)} · ${chapter.label}`)} title="الملاحظات">📝</button>
                  </div>
                </div>

                {!!chapter.lessons?.length && (
                  <div className="lesson-list">
                    {chapter.lessons.map(lesson => {
                      const lessonQuestions = settings.includeExtra ? lesson.questions : lesson.questions.filter(question => question.src !== 'extra')
                      const lessonStats = statsFor(lessonQuestions, store)
                      const lastTest = store.tests[lesson.id]
                      return (
                        <div className="lesson-row" key={lesson.id}>
                          <span className="lesson-row__dot" />
                          <button className="lesson-row__main" type="button" onClick={() => onStart({ code: subject.code, scope: '__LESSONS__', mode: 'learn', lessonIds: new Set([lesson.id]) })}>
                            <strong dir="auto">{lesson.label}</strong>
                            <small>{lessonQuestions.length} سؤال · أتقنت {lessonStats.mastered}{lessonStats.weak ? ` · ⚠ ${lessonStats.weak}` : ''}</small>
                            {lastTest && <span className={`score-chip ${lastTest.pct >= 90 ? 'good' : lastTest.pct >= 70 ? 'warn' : 'bad'}`}>آخر اختبار {lastTest.pct}%</span>}
                          </button>
                          <div className="lesson-row__actions">
                            <button type="button" onClick={() => onStart({ code: subject.code, scope: '__LESSONS__', mode: 'learn', lessonIds: new Set([lesson.id]) })}>🧠 <span>حفظ</span></button>
                            <button type="button" onClick={() => onStartLessonTest(subject.code, lesson)}>⚡ <span>اختبار</span></button>
                            {lesson.notes && <button type="button" onClick={() => onOpenNotes(lesson.notes, `${subjectShortName(subject.name)} · ${lesson.label}`)}>📝</button>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          <div className="subject-card__footer">
            <button type="button" onClick={() => onStart({ code: subject.code, scope: '__ALL__', mode: 'all' })}>🔀 كل الفصول مخلوطة</button>
            <button type="button" onClick={() => onStart({ code: subject.code, scope: '__ALL__', mode: 'review' })}>⚠ أخطاء المادة ({subjectStats.weak})</button>
          </div>
        </div>
      )}
    </section>
  )
}

export function HomeScreen(props: HomeScreenProps) {
  const visibleOrder = props.order.filter(code => !props.settings.hidden.includes(code))
  const effectiveOrder = visibleOrder.length ? visibleOrder : props.order
  const allItems = effectiveOrder.flatMap(code => props.data[code]?.chapters.flatMap(chapter => questionsOf(chapter, props.settings.includeExtra)) ?? [])
  const totalStats = statsFor(allItems, props.store)
  const today = todayString()
  const todayCount = props.daily.dates[today] ?? 0
  const upcoming = props.schedule.exams
    .filter(exam => props.data[exam.c])
    .map(exam => ({ ...exam, left: daysBetween(today, exam.d) }))
    .filter(exam => exam.left >= 0)
    .sort((a, b) => a.left - b.left)
  const starredCount = Object.values(props.store.star).filter(Boolean).length
  const dueCount = useMemo(() => {
    const now = Date.now()
    return allItems.filter(item => {
      const state = props.store.q[item.id]
      return state && state.seen > 0 && state.due > 0 && state.due <= now
    }).length
  }, [allItems, props.store])

  return (
    <main className="screen home-screen">
      <header className="app-header">
        <div className="brand-mark">SF</div>
        <div className="brand-copy"><h1>StudyFlow</h1><p>مذاكرة ذكية من محتواك</p></div>
        <span className="app-header__spacer" />
        <span className="preview-badge">React Preview</span>
        <button className="sync-indicator" type="button" onClick={() => props.onOpenScreen('settings')} aria-label="إعدادات المزامنة"><i /></button>
      </header>

      <nav className="quick-nav" aria-label="التنقل الرئيسي">
        <button type="button" onClick={() => props.onOpenScreen('search')}>🔎 <span>بحث</span></button>
        <button type="button" onClick={() => props.onOpenScreen('mock')}>🎯 <span>اختبار</span></button>
        <button type="button" onClick={() => props.onOpenScreen('plan')}>📅 <span>الخطة</span></button>
        <button type="button" onClick={() => props.onOpenScreen('settings')}>⚙️ <span>إعدادات</span></button>
      </nav>

      <section className="today-card">
        <div className="today-card__top"><strong>📅 اليوم</strong><span dir="ltr">{today}</span></div>
        <div className="daily-goal"><span>هدفك</span><div role="progressbar" aria-label="تقدم الهدف اليومي" aria-valuemin={0} aria-valuemax={props.settings.goal} aria-valuenow={Math.min(todayCount, props.settings.goal)}><i style={{ '--goal-progress': props.settings.goal > 0 ? Math.min(1, todayCount / props.settings.goal) : 0 } as React.CSSProperties} /></div><b>{todayCount}/{props.settings.goal}</b></div>
        <div className="exam-countdown">
          {upcoming.length ? upcoming.map(exam => (
            <article key={exam.c} style={{ '--subject-color': props.data[exam.c].color } as React.CSSProperties}>
              <b>{exam.left === 0 ? 'اليوم' : exam.left}</b>
              <span>{exam.left === 0 ? '🎯 ' : ''}{subjectShortName(props.data[exam.c].name)}</span>
              <small dir="ltr">{exam.d.slice(5)} · {exam.t}</small>
            </article>
          )) : <p className="muted">انتهت الاختبارات المجدولة 🎉</p>}
        </div>
      </section>

      <section className="overview-card">
        <div><b>{totalStats.total}</b><span>سؤال ومسألة</span></div>
        <div><b className="good-text">{totalStats.total ? Math.round(totalStats.mastered / totalStats.total * 100) : 0}%</b><span>الإتقان</span></div>
        <div><b className="info-text">{totalStats.total ? Math.round(totalStats.seen / totalStats.total * 100) : 0}%</b><span>المراجعة</span></div>
        <div><b>{totalStats.mastered}</b><span>أتقنتها</span></div>
      </section>

      <section className="study-controls">
        <button type="button" className={props.settings.includeExtra ? 'is-on' : ''} aria-pressed={props.settings.includeExtra} onClick={props.onToggleExtra}><i />{props.settings.includeExtra ? 'يشمل الأسئلة الإضافية' : 'الأسئلة الأساسية فقط'}</button>
        <div className="duration-control"><span>⏱ {props.settings.sessionMins} دقيقة</span><button type="button" aria-label="تقليل مدة الجلسة 5 دقائق" onClick={() => props.onChangeDuration(Math.max(5, props.settings.sessionMins - 5))}>−</button><button type="button" aria-label="زيادة مدة الجلسة 5 دقائق" onClick={() => props.onChangeDuration(Math.min(120, props.settings.sessionMins + 5))}>+</button></div>
        <button type="button" onClick={props.onStartDue}>🔁 مراجعة اليوم {dueCount ? `(${dueCount})` : ''}</button>
        <button type="button" onClick={() => props.onOpenScreen('weak')}>📉 أضعف الفصول</button>
        <button type="button" onClick={props.onStartStarred}>⭐ المميزة ({starredCount})</button>
      </section>

      <div className="subject-stack">
        {effectiveOrder.map(code => props.data[code] && (
          <SubjectCard key={code} subject={props.data[code]} store={props.store} settings={props.settings} onStart={props.onStart} onStartLessonTest={props.onStartLessonTest} onOpenNotes={props.onOpenNotes} />
        ))}
      </div>

      <footer className="app-footer">StudyFlow {APP_BUILD} · تقدمك يبقى في متصفحك · MIT</footer>
    </main>
  )
}
