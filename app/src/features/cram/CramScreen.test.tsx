import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CramGuide } from './webFinalCram'
import { CramScreen } from './CramScreen'

const guide: CramGuide = {
  id: 'web-final-cram',
  title: 'ملخص نهائي تطوير الويب',
  eyebrow: 'مراجعة مركّزة قبل النهائي',
  summary: 'أربع مراحل تربط الأساسيات بالتطبيق والاسترجاع النشط.',
  totalMinutes: 240,
  phases: [
    {
      id: 'html',
      order: 1,
      minutes: 45,
      title: 'HTML الدلالي',
      subtitle: 'راجع بنية الصفحة والعناصر المناسبة.',
      priority: 'high',
      source: 'HTML slides',
      sections: [{
        type: 'table',
        heading: 'اختيار العنصر الصحيح',
        columns: ['العنصر', 'الاستخدام'],
        rows: [['button', 'تنفيذ فعل'], ['a', 'الانتقال إلى رابط']],
        note: 'اختر العنصر حسب المعنى، لا حسب الشكل.',
      }],
    },
    {
      id: 'css',
      order: 2,
      minutes: 60,
      title: 'CSS والتخطيط',
      subtitle: 'طبّق الـ cascade والتخطيط المرن.',
      priority: 'very-high',
      source: 'CSS slides',
      sections: [{
        type: 'code',
        heading: 'أكمل المحدد',
        language: 'css',
        code: '.card {\n  display: ?;\n}',
        prompt: 'اجعل البطاقة حاوية Flexbox.',
        answer: '.card {\n  display: flex;\n}',
        explanation: 'القيمة flex تنشئ سياق تنسيق مرنًا.',
        trap: 'لا تضع flex على العناصر الأبناء بدل الحاوية.',
        source: 'CSS slide 18',
      }],
    },
    {
      id: 'javascript',
      order: 3,
      minutes: 75,
      title: 'JavaScript وDOM',
      subtitle: 'ثبّت الأحداث وتحديث الواجهة.',
      priority: 'high',
      source: 'JavaScript slides',
      sections: [{
        type: 'list',
        heading: 'تسلسل حل سؤال DOM',
        items: ['حدّد العنصر.', 'اربط الحدث.', 'حدّث الحالة أو الواجهة.'],
      }],
    },
    {
      id: 'recall',
      order: 4,
      minutes: 60,
      title: 'استرجاع نهائي',
      subtitle: 'اختبر الفهم وحدّد الثغرات الأخيرة.',
      priority: 'final',
      source: 'Course review',
      sections: [{
        type: 'callout',
        tone: 'exam',
        heading: 'لا تكتفِ بالقراءة',
        text: 'أغلق الملخص واشرح الإجابة بصوتك قبل كشفها.',
      }],
    },
  ],
  finalChecklist: ['أستطيع شرح الفرق بين button وa.', 'حللت مثال CSS دون النظر للإجابة.'],
}

describe('CramScreen', () => {
  it('renders the RTL cram guide, four-stage timeline, responsive table, and checklist', () => {
    const { container } = render(
      <CramScreen guide={guide} onBack={vi.fn()} onOpenTests={vi.fn()} />,
    )

    expect(container.querySelector('main')).toHaveAttribute('dir', 'rtl')
    expect(screen.getByRole('heading', { level: 1, name: guide.title })).toBeInTheDocument()
    expect(screen.getByLabelText('240 دقيقة إجمالًا')).toBeInTheDocument()
    expect(screen.getByText(/لا يضمن ورود أسئلة بعينها/)).toBeInTheDocument()

    const phaseLinks = screen.getAllByRole('link', { name: /المرحلة \d/ })
    expect(phaseLinks).toHaveLength(4)
    expect(phaseLinks[0]).toHaveAttribute('href', '#cram-phase-html')
    expect(screen.getByRole('region', { name: 'جدول اختيار العنصر الصحيح' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('columnheader', { name: 'العنصر' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'تنفيذ فعل' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: guide.finalChecklist[0] })).toBeInTheDocument()
  })

  it('keeps the code answer collapsed until the learner reveals it', () => {
    render(<CramScreen guide={guide} onBack={vi.fn()} onOpenTests={vi.fn()} />)

    const reveal = screen.getByText('اكشف الإجابة')
    const details = reveal.closest('details')
    expect(details).not.toHaveAttribute('open')

    fireEvent.click(reveal)

    expect(details).toHaveAttribute('open')
    expect(details?.querySelector('code')).toHaveTextContent(/\.card\s*\{\s*display:\s*flex;\s*\}/)
  })

  it('calls the platform tests and back callbacks', () => {
    const onBack = vi.fn()
    const onOpenTests = vi.fn()
    render(<CramScreen guide={guide} onBack={onBack} onOpenTests={onOpenTests} />)

    fireEvent.click(screen.getByRole('button', { name: 'اختبارات المنصة' }))
    fireEvent.click(screen.getByRole('button', { name: 'العودة' }))

    expect(onOpenTests).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
  })
})
