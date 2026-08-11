import { ScreenHeader } from '../../components/Ui'
import type { NotesBlock } from '../../types'

const SECTIONS: Array<[keyof NotesBlock, string]> = [
  ['draw', '🎨 ارسمها بيدك'],
  ['formulas', '🧠 احفظها غيبًا'],
  ['practice', '✍️ اختبر نفسك'],
  ['watch', '⚠️ أخطاء شائعة — انتبه'],
]

export function NotesScreen({ title, notes, onBack }: { title: string; notes?: NotesBlock | null; onBack: () => void }) {
  const available = SECTIONS.filter(([key]) => notes?.[key]?.length)
  return (
    <main className="screen">
      <ScreenHeader title="📝 المذاكرة اليدوية" subtitle={title} onBack={onBack} />
      <p className="screen-intro">النقاط التي تحتاج فهمًا ورسمًا واسترجاعًا، وليست مجرد اختيار من متعدد.</p>
      {available.length ? available.map(([key, heading]) => (
        <section className="content-section" key={key}>
          <h2>{heading}</h2>
          <ul>{notes?.[key]?.map((item, index) => <li key={`${key}-${index}`} dir="auto">{item}</li>)}</ul>
        </section>
      )) : <section className="empty-state"><span className="empty-state__icon">🗒️</span><h2>لا توجد ملاحظات يدوية هنا</h2></section>}
    </main>
  )
}

