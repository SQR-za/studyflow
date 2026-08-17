import { useEffect, useRef } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import { Button, ScreenHeader } from '../../components/Ui'
import type { CramGuide, CramPhase, CramSection } from './webFinalCram'
import './cram.css'

type CramCallout = Extract<CramSection, { type: 'callout' }>
type CramCodeSection = Extract<CramSection, { type: 'code' }>

const CALLOUT_META: Record<CramCallout['tone'], { icon: string; label: string }> = {
  key: { icon: '✓', label: 'قاعدة أساسية' },
  exam: { icon: '◎', label: 'تركيز اختباري' },
  warning: { icon: '!', label: 'انتبه' },
}

const PRIORITY_LABELS: Record<CramPhase['priority'], string> = {
  'very-high': 'أولوية قصوى',
  high: 'أولوية عالية',
  final: 'تثبيت أخير',
}

function phaseAnchor(id: string) {
  return `cram-phase-${id}`
}

function CramCodeExample({ section, headingId }: { section: CramCodeSection; headingId: string }) {
  return (
    <section className="cram-content cram-code" aria-labelledby={headingId}>
      <header className="cram-content__header">
        <div>
          <span className="cram-content__type">تطبيق سريع</span>
          <h3 id={headingId} dir="auto">{section.heading}</h3>
        </div>
        {section.source ? <span className="cram-source" dir="auto">{section.source}</span> : null}
      </header>

      <p className="cram-code__prompt" dir="auto">{section.prompt}</p>
      <CodeBlock text={section.code} language={section.language} variant="lesson" copyable />

      <details className="cram-answer">
        <summary>
          <span>اكشف الإجابة</span>
          <span className="cram-answer__chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="cram-answer__body">
          <span className="cram-answer__label">الإجابة النموذجية</span>
          <CodeBlock text={section.answer} language={section.language} variant="lesson" copyable />
          <p className="cram-code__explanation" dir="auto">{section.explanation}</p>
          {section.trap ? (
            <aside className="cram-code__trap" aria-label="فخ شائع">
              <strong>فخ شائع</strong>
              <p dir="auto">{section.trap}</p>
            </aside>
          ) : null}
        </div>
      </details>
    </section>
  )
}

function CramSectionView({ section, phaseId, index }: {
  section: CramSection
  phaseId: string
  index: number
}) {
  const headingId = `cram-${phaseId}-${section.type}-${index}`

  if (section.type === 'table') {
    return (
      <section className="cram-content cram-table" aria-labelledby={headingId}>
        <header className="cram-content__header">
          <div>
            <span className="cram-content__type">مقارنة</span>
            <h3 id={headingId} dir="auto">{section.heading}</h3>
          </div>
          {section.source ? <span className="cram-source" dir="auto">{section.source}</span> : null}
        </header>
        <div
          className="cram-table__scroll"
          role="region"
          aria-label={`جدول ${section.heading}`}
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                {section.columns.map((column, columnIndex) => (
                  <th scope="col" dir="auto" key={`${columnIndex}-${column}`}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${row[0] ?? ''}`}>
                  {row.map((cell, cellIndex) => (
                    <td dir="auto" key={`${cellIndex}-${cell}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {section.note ? <p className="cram-table__note" dir="auto">{section.note}</p> : null}
      </section>
    )
  }

  if (section.type === 'code') {
    return <CramCodeExample section={section} headingId={headingId} />
  }

  if (section.type === 'list') {
    return (
      <section className="cram-content cram-list" aria-labelledby={headingId}>
        <header className="cram-content__header">
          <div>
            <span className="cram-content__type">ثبّت المعلومة</span>
            <h3 id={headingId} dir="auto">{section.heading}</h3>
          </div>
          {section.source ? <span className="cram-source" dir="auto">{section.source}</span> : null}
        </header>
        <ul>
          {section.items.map((item, itemIndex) => (
            <li key={`${itemIndex}-${item.slice(0, 32)}`}>
              <span aria-hidden="true">{String(itemIndex + 1).padStart(2, '0')}</span>
              <span dir="auto">{item}</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  const meta = CALLOUT_META[section.tone]
  return (
    <aside
      className={`cram-callout cram-callout--${section.tone}`}
      aria-labelledby={headingId}
    >
      <span className="cram-callout__icon" aria-hidden="true">{meta.icon}</span>
      <div>
        <span className="cram-callout__label">{meta.label}</span>
        <h3 id={headingId} dir="auto">{section.heading}</h3>
        <p dir="auto">{section.text}</p>
        {section.source ? <span className="cram-callout__source" dir="auto">{section.source}</span> : null}
      </div>
    </aside>
  )
}

export interface CramScreenProps {
  guide: CramGuide
  onBack: () => void
  onOpenTests: () => void
}

export function CramScreen({ guide, onBack, onOpenTests }: CramScreenProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    titleRef.current?.focus({ preventScroll: true })
  }, [guide.id])

  return (
    <main className="screen cram-screen" dir="rtl">
      <ScreenHeader
        title={guide.title}
        subtitle={guide.eyebrow}
        onBack={onBack}
        titleRef={titleRef}
      />

      <section className="cram-hero" aria-labelledby="cram-hero-heading">
        <div className="cram-hero__copy">
          <p className="cram-hero__eyebrow">{guide.eyebrow}</p>
          <h2 id="cram-hero-heading">خطة مركّزة للّحظات الأخيرة</h2>
          <p className="cram-hero__summary" dir="auto">{guide.summary}</p>
        </div>
        <div className="cram-hero__duration" aria-label={`${guide.totalMinutes} دقيقة إجمالًا`}>
          <span dir="ltr">{guide.totalMinutes}</span>
          <strong>دقيقة</strong>
          <small>إجمالي الخطة</small>
        </div>
        <p className="cram-hero__notice">
          <span aria-hidden="true">!</span>
          <span><strong>تنبيه:</strong> هذا الملخص يرفع جاهزيتك، لكنه لا يضمن ورود أسئلة بعينها في الاختبار.</span>
        </p>
      </section>

      <nav className="cram-timeline" aria-labelledby="cram-timeline-heading">
        <div className="cram-section-heading">
          <div>
            <span>مسارك الآن</span>
            <h2 id="cram-timeline-heading">قسّم الـ {guide.totalMinutes} دقيقة</h2>
          </div>
          <p>ابدأ بالأعلى أولوية، ثم تحرّك بالترتيب.</p>
        </div>
        <ol className="cram-timeline__list">
          {guide.phases.map(phase => (
            <li key={phase.id}>
              <a
                href={`#${phaseAnchor(phase.id)}`}
                aria-label={`المرحلة ${phase.order}: ${phase.title}، ${phase.minutes} دقيقة`}
              >
                <span className="cram-timeline__number" aria-hidden="true">{phase.order}</span>
                <span className="cram-timeline__copy">
                  <strong dir="auto">{phase.title}</strong>
                  <small>{phase.minutes} دقيقة</small>
                </span>
                <span className="cram-timeline__arrow" aria-hidden="true">↓</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="cram-phases">
        {guide.phases.map(phase => (
          <article className="cram-phase" id={phaseAnchor(phase.id)} key={phase.id}>
            <header className="cram-phase__header">
              <span className="cram-phase__order" aria-hidden="true">{String(phase.order).padStart(2, '0')}</span>
              <div className="cram-phase__identity">
                <div className="cram-phase__meta">
                  <span>{phase.minutes} دقيقة</span>
                  <span className="cram-phase__priority">{PRIORITY_LABELS[phase.priority]}</span>
                </div>
                <h2 dir="auto">{phase.title}</h2>
                <p dir="auto">{phase.subtitle}</p>
              </div>
              <span className="cram-phase__source" dir="auto">المصدر · {phase.source}</span>
            </header>

            <div className="cram-phase__sections">
              {phase.sections.map((section, index) => (
                <CramSectionView
                  section={section}
                  phaseId={phase.id}
                  index={index}
                  key={`${phase.id}-${section.type}-${index}`}
                />
              ))}
            </div>
          </article>
        ))}
      </div>

      <section className="cram-checklist" aria-labelledby="cram-checklist-heading">
        <header>
          <span aria-hidden="true">✓</span>
          <div>
            <p>قبل أن تغلق الصفحة</p>
            <h2 id="cram-checklist-heading">قائمة التحقق النهائية</h2>
          </div>
        </header>
        <div className="cram-checklist__items">
          {guide.finalChecklist.map((item, index) => {
            const inputId = `cram-check-${guide.id}-${index}`
            return (
              <label htmlFor={inputId} key={`${index}-${item.slice(0, 32)}`}>
                <input id={inputId} type="checkbox" />
                <span dir="auto">{item}</span>
              </label>
            )
          })}
        </div>
      </section>

      <footer className="cram-actions" aria-label="إجراءات الملخص">
        <div>
          <strong>حوّل المراجعة إلى استرجاع نشط.</strong>
          <span>اختبر نفسك الآن، ثم ارجع فقط للنقاط التي أخطأت فيها.</span>
        </div>
        <Button onClick={onOpenTests}>اختبارات المنصة</Button>
        <Button variant="secondary" onClick={onBack}>العودة</Button>
      </footer>
    </main>
  )
}
