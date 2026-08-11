import { ScreenHeader } from '../../components/Ui'
import { daysBetween, subjectShortName, todayString } from '../../lib/utils'
import type { StudySchedule, Subject } from '../../types'

const STEPS = [['lec', '📖 المحاضرة'], ['sum', '📝 الملخص'], ['con', '💡 المفاهيم']] as const

export function PlanScreen({ data, schedule, planDone, onToggle, onStart, onBack }: {
  data: Record<string, Subject>
  schedule: StudySchedule
  planDone: Record<string, boolean>
  onToggle: (key: string) => void
  onStart: (code: string, chapterId: string, review?: boolean) => void
  onBack: () => void
}) {
  const today = todayString()
  const upcoming = schedule.exams.filter(exam => data[exam.c]).map(exam => ({ ...exam, left: daysBetween(today, exam.d) })).sort((a, b) => a.left - b.left)
  return (
    <main className="screen">
      <ScreenHeader title="📅 خطة المذاكرة" onBack={onBack} />
      <div className="countdown-grid">
        {upcoming.map(exam => <article key={exam.c}><b style={{ color: data[exam.c].color }}>{exam.left < 0 ? '✓' : exam.left === 0 ? 'اليوم' : exam.left}</b><span>{subjectShortName(data[exam.c].name)}</span><small dir="ltr">{exam.d.slice(5)} · {exam.t}</small></article>)}
      </div>
      <p className="screen-intro">اقرأ وافهم، راجع الملخص والمفاهيم، ثم اختبر نفسك بالبطاقات.</p>
      <div className="plan-days">
        {schedule.plan.map(day => {
          const isToday = day.d === today
          const isPast = daysBetween(today, day.d) < 0
          return (
            <section className={`plan-day ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}`} key={day.d}>
              <header><b dir="ltr">{day.d.slice(5)}</b><span>{day.day}</span>{isToday && <em>اليوم</em>}{day.exam && data[day.exam] && <em className="exam">🎯 اختبار {subjectShortName(data[day.exam].name)}</em>}</header>
              {day.tasks?.length ? day.tasks.filter(task => data[task.c]).map((task, taskIndex) => {
                const chapter = data[task.c].chapters.find(item => item.id === task.ch)
                const label = task.review ? `${subjectShortName(data[task.c].name)} · مراجعة شاملة` : `${subjectShortName(data[task.c].name)} · ${chapter?.label ?? task.ch}`
                return (
                  <article className="plan-task" key={`${day.d}-${task.ch}-${taskIndex}`}>
                    <h3 dir="auto">{label}</h3>
                    {!task.review && <div className="step-list">{STEPS.map(([key, text]) => {
                      const id = `${day.d}|${task.ch}|${key}`
                      return <button className={planDone[id] ? 'done' : ''} type="button" key={key} onClick={() => onToggle(id)}><i>{planDone[id] ? '✓' : ''}</i>{text}</button>
                    })}</div>}
                    <div className="task-actions">
                      <button type="button" onClick={() => onStart(task.c, task.review ? '__ALL__' : task.ch, task.review)}>🃏 ابدأ البطاقات</button>
                      {(() => { const id = `${day.d}|${task.ch}|cards`; return <button className={planDone[id] ? 'done' : ''} type="button" onClick={() => onToggle(id)}><i>{planDone[id] ? '✓' : ''}</i>خلصت</button> })()}
                    </div>
                  </article>
                )
              }) : !day.exam && <p className="muted">مراجعة حرة</p>}
            </section>
          )
        })}
      </div>
    </main>
  )
}

