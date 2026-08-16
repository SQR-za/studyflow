import { useEffect, useRef } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import { StudyText } from '../../components/StudyText'
import { Button, ScreenHeader } from '../../components/Ui'
import { publicAssetUrl } from '../../lib/assets'
import type { Lesson, LessonBlock, LessonFigure } from '../../types'
import './lesson.css'

const CALLOUT_LABELS: Record<Extract<LessonBlock, { type: 'callout' }>['tone'], string> = {
  key: 'الفكرة الأساسية',
  exam: 'ركّز للاختبار',
  warning: 'انتبه',
}

export interface LessonScreenProps {
  subject: string
  chapter: string
  color: string
  lesson: Lesson
  previousLesson?: Lesson | null
  nextLesson?: Lesson | null
  lessonPosition?: number
  lessonCount?: number
  onBack: () => void
  onOpenLesson: (lessonId: string) => void
  onStartLearn: () => void
  onStartQuickTest?: () => void
  onStartFullTest: () => void
}

function LessonFigureView({ figure }: { figure: LessonFigure }) {
  return (
    <figure className="lesson-figure">
      <img
        src={publicAssetUrl(figure.src)}
        alt={figure.alt}
        width={figure.width}
        height={figure.height}
        loading="lazy"
        decoding="async"
      />
      <figcaption>
        <span dir="auto">{figure.caption}</span>
        <cite dir="auto">{figure.source}</cite>
      </figcaption>
    </figure>
  )
}

function LessonContentBlock({ block }: { block: LessonBlock }) {
  if (block.type === 'callout') {
    return (
      <aside className={`lesson-callout lesson-callout--${block.tone}`} aria-label={block.heading ?? CALLOUT_LABELS[block.tone]}>
        <strong dir="auto">{block.heading ?? CALLOUT_LABELS[block.tone]}</strong>
        <p dir="auto"><StudyText text={block.text} /></p>
      </aside>
    )
  }

  return (
    <section className={`lesson-block lesson-block--${block.type}`}>
      {block.heading ? <h2 dir="auto">{block.heading}</h2> : null}
      {block.type === 'text' ? block.paragraphs.map((paragraph, index) => (
        <p dir="auto" key={`${index}-${paragraph.slice(0, 24)}`}><StudyText text={paragraph} /></p>
      )) : null}
      {block.type === 'list' ? (
        <ul>
          {block.items.map((item, index) => <li dir="auto" key={`${index}-${item.slice(0, 24)}`}><StudyText text={item} /></li>)}
        </ul>
      ) : null}
      {block.type === 'code' ? (
        <>
          <CodeBlock text={block.code} variant="lesson" language={block.language} copyable />
          {block.explanation ? <p className="lesson-code-explanation" dir="auto"><StudyText text={block.explanation} /></p> : null}
          {block.result ? <LessonFigureView figure={block.result} /> : null}
        </>
      ) : null}
      {block.type === 'figure' ? <LessonFigureView figure={block.figure} /> : null}
    </section>
  )
}

export function LessonScreen({
  subject,
  chapter,
  color,
  lesson,
  previousLesson = null,
  nextLesson = null,
  lessonPosition = 1,
  lessonCount = 1,
  onBack,
  onOpenLesson,
  onStartLearn,
  onStartQuickTest,
  onStartFullTest,
}: LessonScreenProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const content = lesson.content
  const safeCount = Math.max(1, lessonCount)
  const safePosition = Math.min(safeCount, Math.max(1, lessonPosition))
  const progress = Math.round(safePosition / safeCount * 100)

  useEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    titleRef.current?.focus({ preventScroll: true })
  }, [lesson.id])

  return (
    <main className="screen lesson-screen" dir="rtl" style={{ '--lesson-color': color } as React.CSSProperties}>
      <ScreenHeader title={lesson.label} subtitle={`${subject} · ${chapter}`} onBack={onBack} titleRef={titleRef} />

      <article className="lesson-reader" aria-labelledby="lesson-summary-heading">
        <header className="lesson-reader__hero">
          <div className="lesson-reader__position">
            <span>القسم {safePosition} من {safeCount}</span>
            <span>{progress}%</span>
          </div>
          <div
            className="lesson-reader__progress"
            role="progressbar"
            aria-label="تقدمك في أقسام الفصل"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <i style={{ '--lesson-progress': progress / 100 } as React.CSSProperties} />
          </div>
          <p className="lesson-reader__eyebrow">📖 شرح القسم</p>
          <h2 id="lesson-summary-heading">الخلاصة</h2>
          {content ? <p className="lesson-reader__summary" dir="auto"><StudyText text={content.summary} /></p> : <p className="muted">لا يتوفر شرح مكتوب لهذا القسم بعد.</p>}
        </header>

        {content ? (
          <>
            <section className="lesson-objectives" aria-labelledby="lesson-objectives-heading">
              <h2 id="lesson-objectives-heading">بعد هذا الدرس ستستطيع</h2>
              <ul>
                {content.objectives.map((objective, index) => (
                  <li dir="auto" key={`${index}-${objective.slice(0, 24)}`}><span aria-hidden="true">✓</span><StudyText text={objective} /></li>
                ))}
              </ul>
            </section>

            <div className="lesson-blocks">
              {content.blocks.map((block, index) => <LessonContentBlock block={block} key={`${lesson.id}-${block.type}-${index}`} />)}
            </div>

            <section className="lesson-recap" aria-labelledby="lesson-recap-heading">
              <h2 id="lesson-recap-heading">ثبّت الفكرة</h2>
              <ul>
                {content.recap.map((item, index) => <li dir="auto" key={`${index}-${item.slice(0, 24)}`}><StudyText text={item} /></li>)}
              </ul>
            </section>
          </>
        ) : null}
      </article>

      <nav className="lesson-navigation" aria-label="التنقل بين أقسام الفصل">
        <button type="button" disabled={!previousLesson} onClick={() => previousLesson && onOpenLesson(previousLesson.id)}>
          <span>→ السابق</span>
          <strong dir="auto">{previousLesson?.label ?? 'لا يوجد قسم سابق'}</strong>
        </button>
        <button type="button" disabled={!nextLesson} onClick={() => nextLesson && onOpenLesson(nextLesson.id)}>
          <span>التالي ←</span>
          <strong dir="auto">{nextLesson?.label ?? 'لا يوجد قسم تالٍ'}</strong>
        </button>
      </nav>

      <section className="lesson-actions" aria-label="تدرّب على هذا القسم">
        <div>
          <h2>جاهز تثبّت معلوماتك؟</h2>
          <p>ابدأ تدريب الحفظ، أو اختبر نفسك مباشرة.</p>
        </div>
        <Button onClick={onStartLearn}>🧠 تدريب وحفظ</Button>
        <Button variant="secondary" onClick={onStartQuickTest} disabled={!onStartQuickTest}>⚡ فحص سريع</Button>
        <Button variant="secondary" onClick={onStartFullTest}>📋 اختبار شامل</Button>
      </section>
    </main>
  )
}
