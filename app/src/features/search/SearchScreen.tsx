import { useMemo, useState } from 'react'
import { ScreenHeader } from '../../components/Ui'
import { isChoice, isPractice, subjectShortName } from '../../lib/utils'
import type { Subject } from '../../types'

export function SearchScreen({ data, order, onBack }: { data: Record<string, Subject>; order: string[]; onBack: () => void }) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (term.length < 2) return []
    const found: Array<{ code: string; chapter: string; question: any }> = []
    for (const code of order) for (const chapter of data[code].chapters) {
      for (const question of [...chapter.questions, ...(chapter.practice ?? [])]) {
        const text = `${question.q} ${isChoice(question) ? question.choices.join(' ') : isPractice(question) ? question.solution : question.pairs?.flat().join(' ') ?? ''}`.toLowerCase()
        if (text.includes(term)) found.push({ code, chapter: chapter.label, question })
        if (found.length >= 60) return found
      }
    }
    return found
  }, [data, order, query])

  return (
    <main className="screen">
      <ScreenHeader title="🔎 البحث في الأسئلة" onBack={onBack} />
      <label className="search-field"><span className="sr-only">عبارة البحث</span><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="اكتب كلمة من السؤال أو الإجابة…" /></label>
      {query.trim().length < 2 ? <p className="screen-intro">اكتب حرفين على الأقل.</p> : !results.length ? <p className="screen-intro">لا توجد نتائج.</p> : (
        <div className="search-results">{results.map(({ code, chapter, question }) => {
          const open = openId === question.id
          const answer = isChoice(question) ? question.choices[question.answer] : isPractice(question) ? question.solution : question.pairs?.map((pair: [string, string]) => `${pair[0]} → ${pair[1]}`).join(' · ')
          return <button type="button" className={open ? 'is-open' : ''} key={question.id} onClick={() => setOpenId(open ? null : question.id)}>
            <strong dir="auto">{question.q}</strong>
            {open && <span className="search-answer" dir="auto">✓ {answer}{question.explanation ? ` — ${question.explanation}` : ''}</span>}
            <small>{subjectShortName(data[code].name)} · {chapter}</small>
          </button>
        })}</div>
      )}
    </main>
  )
}
