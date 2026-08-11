import { ScreenHeader, ProgressRing } from '../../components/Ui'
import { MASTERY_BOX } from '../../lib/constants'
import { subjectShortName } from '../../lib/utils'
import type { AppSettings, ProgressStore, Subject } from '../../types'

export function WeakScreen({ data, order, settings, store, onStart, onBack }: {
  data: Record<string, Subject>
  order: string[]
  settings: AppSettings
  store: ProgressStore
  onStart: (code: string, chapterId: string) => void
  onBack: () => void
}) {
  const rows = order.filter(code => !settings.hidden.includes(code)).flatMap(code => data[code].chapters.map(chapter => {
    const items = [...(settings.includeExtra ? chapter.questions : chapter.questions.filter(question => question.src !== 'extra')), ...(chapter.practice ?? [])]
    let mastered = 0; let weak = 0
    for (const item of items) { const state = store.q[item.id]; if (state?.box >= MASTERY_BOX) mastered += 1; if (state?.wrong && state.box < MASTERY_BOX) weak += 1 }
    return { code, chapter, total: items.length, mastered, weak, percent: items.length ? mastered / items.length * 100 : 0 }
  })).sort((a, b) => a.percent - b.percent || b.weak - a.weak)

  return (
    <main className="screen">
      <ScreenHeader title="📉 أضعف الفصول" onBack={onBack} />
      <p className="screen-intro">مرتبة من الأقل إتقانًا. ابدأ من الأعلى ثم اختبر نفسك من جديد.</p>
      <div className="weak-list">
        {rows.map(row => <button type="button" key={`${row.code}-${row.chapter.id}`} onClick={() => onStart(row.code, row.chapter.id)}>
          <ProgressRing value={row.percent} color={data[row.code].color} />
          <span><strong dir="auto">{subjectShortName(data[row.code].name)} · {row.chapter.label}</strong><small>{row.mastered}/{row.total} متقن{row.weak ? ` · ⚠ ${row.weak} أخطاء` : ''}</small></span>
          <i>◀</i>
        </button>)}
      </div>
    </main>
  )
}

