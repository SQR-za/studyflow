import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import webDrillsAsset from '../../../public/web-321-drills-v1.json'
import { validateWebDrills } from '../../lib/content'
import type { Lesson, LessonContent } from '../../types'
import { LessonScreen } from './LessonScreen'

const content: LessonContent = {
  summary: 'The cascade selects the declaration that wins for each property.',
  objectives: ['Explain specificity.', 'Predict the winning declaration.'],
  blocks: [
    { type: 'text', heading: 'Start with the cascade', paragraphs: ['CSS evaluates origin, importance, specificity, then source order.'] },
    { type: 'list', heading: 'Decision order', items: ['Compare importance.', 'Compare specificity.'] },
    {
      type: 'code',
      heading: 'Try it',
      language: 'html',
      code: '<article class="card">Hello</article>',
      explanation: 'This is real, selectable HTML text.',
      result: {
        src: '/lesson-assets/result.png',
        alt: 'Rendered card result',
        caption: 'Result · النتيجة',
        source: 'CSS slide 6',
        width: 1200,
        height: 675,
      },
    },
    {
      type: 'figure',
      heading: 'Visual model',
      figure: {
        src: 'lesson-assets/model.png',
        alt: 'Specificity visual model',
        caption: 'Specificity model',
        source: 'CSS slide 9',
        width: 800,
        height: 450,
      },
    },
    { type: 'callout', tone: 'exam', text: 'Equal specificity means the later declaration wins.' },
  ],
  recap: ['Specificity is compared only after origin and importance.'],
}

const lesson: Lesson = { id: 'cascade', label: 'CSS Cascade', questions: [], content }
const previousLesson: Lesson = { id: 'selectors', label: 'Previous lesson', questions: [], content }
const nextLesson: Lesson = { id: 'box-model', label: 'Next lesson', questions: [], content }

describe('LessonScreen', () => {
  it('starts each opened lesson at the top of the page', () => {
    document.documentElement.scrollTop = 640
    document.body.scrollTop = 640

    render(
      <LessonScreen
        subject="Web Development"
        chapter="CSS"
        color="#38bdf8"
        lesson={lesson}
        onBack={vi.fn()}
        onOpenLesson={vi.fn()}
        onStartLearn={vi.fn()}
        onStartFullTest={vi.fn()}
      />,
    )

    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.body.scrollTop).toBe(0)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'CSS Cascade' }))
  })

  it('renders all lesson media and copyable code, then launches actions and navigation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const onOpenLesson = vi.fn()
    const onStartLearn = vi.fn()
    const onStartQuickTest = vi.fn()
    const onStartFullTest = vi.fn()
    const { container } = render(
      <LessonScreen
        subject="Web Development"
        chapter="CSS"
        color="#38bdf8"
        lesson={lesson}
        previousLesson={previousLesson}
        nextLesson={nextLesson}
        lessonPosition={2}
        lessonCount={4}
        onBack={vi.fn()}
        onOpenLesson={onOpenLesson}
        onStartLearn={onStartLearn}
        onStartQuickTest={onStartQuickTest}
        onStartFullTest={onStartFullTest}
      />,
    )

    expect(screen.getByText(content.summary)).toBeInTheDocument()
    expect(screen.getByText('Predict the winning declaration.')).toBeInTheDocument()
    expect(screen.getByText('Compare specificity.')).toBeInTheDocument()
    expect(screen.getByText('Equal specificity means the later declaration wins.')).toBeInTheDocument()
    expect(screen.getByText(content.recap[0])).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'تقدمك في أقسام الفصل' })).toHaveAttribute('aria-valuenow', '50')

    const resultImage = screen.getByRole('img', { name: 'Rendered card result' })
    expect(resultImage).toHaveAttribute('src', '/studyflow/next/lesson-assets/result.png')
    expect(resultImage).toHaveAttribute('loading', 'lazy')
    expect(resultImage).toHaveAttribute('decoding', 'async')
    expect(resultImage).toHaveAttribute('width', '1200')
    expect(resultImage).toHaveAttribute('height', '675')
    expect(screen.getByText('CSS slide 6')).toBeInTheDocument()

    const code = container.querySelector('code')
    expect(code).toHaveTextContent('<article class="card">Hello</article>')
    expect(code?.querySelector('article')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'نسخ الكود' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'تم النسخ' })).toBeInTheDocument())
    expect(writeText).toHaveBeenCalledWith('<article class="card">Hello</article>')

    fireEvent.click(screen.getByRole('button', { name: /Previous lesson/ }))
    fireEvent.click(screen.getByRole('button', { name: /Next lesson/ }))
    expect(onOpenLesson.mock.calls).toEqual([['selectors'], ['box-model']])

    fireEvent.click(screen.getByRole('button', { name: /تدريب وحفظ/ }))
    fireEvent.click(screen.getByRole('button', { name: /فحص سريع/ }))
    fireEvent.click(screen.getByRole('button', { name: /اختبار شامل/ }))
    expect(onStartLearn).toHaveBeenCalledOnce()
    expect(onStartQuickTest).toHaveBeenCalledOnce()
    expect(onStartFullTest).toHaveBeenCalledOnce()
  })

  it('renders every checked-in Web lesson payload with deployment-safe media URLs', () => {
    const validated = validateWebDrills(webDrillsAsset)
    const sections = Object.values(validated.chapters).flatMap(chapter => chapter.sections)

    sections.forEach((section, index) => {
      if (!section.content) throw new Error(`Missing content for ${section.id}`)
      const shippedLesson: Lesson = { id: section.id, label: section.label, questions: [], content: section.content }
      const expectedCodeBlocks = section.content.blocks.filter(block => block.type === 'code').length
      const expectedFigures = section.content.blocks.filter(block => block.type === 'figure' || (block.type === 'code' && Boolean(block.result))).length
      const view = render(
        <LessonScreen
          subject="CCSW-321"
          chapter="Web Development"
          color="#38bdf8"
          lesson={shippedLesson}
          lessonPosition={index + 1}
          lessonCount={sections.length}
          onBack={vi.fn()}
          onOpenLesson={vi.fn()}
          onStartLearn={vi.fn()}
          onStartFullTest={vi.fn()}
        />,
      )

      expect(view.container.querySelectorAll('.study-code-block--lesson')).toHaveLength(expectedCodeBlocks)
      const images = [...view.container.querySelectorAll('img')]
      expect(images).toHaveLength(expectedFigures)
      for (const image of images) {
        expect(image.getAttribute('src')).toMatch(/^\/studyflow\/next\/lesson-assets\//)
        expect(image).toHaveAttribute('loading', 'lazy')
        expect(image).toHaveAttribute('decoding', 'async')
      }
      view.unmount()
    })
  }, 15_000)
})
