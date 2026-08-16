import { describe, expect, it } from 'vitest'
import webDrillsAsset from '../../public/web-321-drills-v1.json'
import { createEmptyDrills, loadCachedPreparedContent, prepareContent, validatePdcDrills, validateWebDrills } from './content'
import { publicAssetUrl } from './assets'
import type { ContentBundle, DrillsBundle, LessonContent } from '../types'

const lessonContent: LessonContent = {
  summary: 'Understand how a browser applies CSS.',
  objectives: ['Explain the cascade.'],
  blocks: [
    { type: 'text', heading: 'Core idea', paragraphs: ['Rules compete by origin, specificity, and order.'] },
    { type: 'code', language: 'css', code: '.card { display: block; }', explanation: 'This creates a block box.' },
  ],
  recap: ['Later declarations win when specificity is equal.'],
}

const builtin: ContentBundle = {
  version: 1,
  subjects: {
    TEST: { name: 'Test', code: 'TEST', color: '#fff', chapters: [{ id: 'c1', label: 'Chapter', questions: [{ id: 'q1', q: 'Base?', choices: ['A', 'B'], answer: 0 }], practice: [] }] },
  },
  schedule: { plan: [{ d: '2026-08-12', tasks: [{ c: 'TEST', ch: 'c1' }] }], exams: [] },
}

const drills: DrillsBundle = {
  version: 2,
  subject: 'TEST',
  chapters: {
    c1: {
      questions: [{ id: 'q2', q: 'Drill?', choices: ['A', 'B'], answer: 1 }],
      sections: [{ id: 's1', label: 'Section', questionIds: ['q1', 'q2'], content: lessonContent }],
    },
  },
  presets: [],
}

describe('publicAssetUrl', () => {
  it('joins deployment-relative assets and rejects unsafe paths', () => {
    expect(publicAssetUrl('/lesson-assets/example.webp', '/studyflow/next/')).toBe('/studyflow/next/lesson-assets/example.webp')
    expect(() => publicAssetUrl('   ', '/studyflow/next/')).toThrow(/فارغ/)
    expect(() => publicAssetUrl('lesson-assets/../private.webp', '/studyflow/next/')).toThrow(/مجلد أعلى/)
  })
})

describe('checked-in Web lesson content', () => {
  it('passes the runtime schema with content for all 18 sections', () => {
    const validated = validateWebDrills(webDrillsAsset)
    const sections = Object.values(validated.chapters).flatMap(chapter => chapter.sections)

    expect(sections).toHaveLength(18)
    expect(sections.every(section => Boolean(section.content))).toBe(true)
  })
})

describe('prepareContent', () => {
  it('merges drills once and builds lessons without mutating source', () => {
    const empty: ContentBundle = { version: 1, subjects: {}, schedule: { plan: [], exams: [] } }
    const first = prepareContent(builtin, empty, drills)
    const second = prepareContent(builtin, empty, drills)
    expect(first.data.TEST.chapters[0].questions.map(question => question.id)).toEqual(['q1', 'q2'])
    expect(first.data.TEST.chapters[0].lessons?.[0].questions.map(question => question.id)).toEqual(['q1', 'q2'])
    expect(first.data.TEST.chapters[0].lessons?.[0].content).toEqual(lessonContent)
    expect(second.data.TEST.chapters[0].questions).toHaveLength(2)
    expect(builtin.subjects.TEST.chapters[0].questions).toHaveLength(1)
  })

  it('accepts legacy sections without content and rejects malformed lesson content', () => {
    const legacy = JSON.parse(JSON.stringify({ ...drills, subject: 'WEB-EXAM2' }))
    delete legacy.chapters.c1.sections[0].content
    expect(validateWebDrills(legacy).chapters.c1.sections[0].content).toBeUndefined()

    const malformed = JSON.parse(JSON.stringify({ ...drills, subject: 'WEB-EXAM2' }))
    malformed.chapters.c1.sections[0].content.blocks[0].paragraphs = 'not-an-array'
    expect(() => validateWebDrills(malformed)).toThrow(/النص غير صالح/)

    const unsafeFigure = JSON.parse(JSON.stringify({ ...drills, subject: 'WEB-EXAM2' }))
    unsafeFigure.chapters.c1.sections[0].content.blocks.push({
      type: 'figure',
      figure: { src: '../private.png', alt: 'Unsafe', caption: 'Unsafe path', source: 'Test', width: 100, height: 100 },
    })
    expect(() => validateWebDrills(unsafeFigure)).toThrow(/مسار الصورة غير صالح/)
  })

  it('composes cached/custom content synchronously before network refresh', () => {
    const cached = loadCachedPreparedContent({ customContent: builtin, storage: null })
    expect(cached.order).toEqual(['TEST'])
    expect(cached.data.TEST.chapters[0].questions[0].id).toBe('q1')
  })

  it('validates self-contained rapid section presets without merging them into mastery questions', () => {
    const rapid: DrillsBundle = {
      ...drills,
      presets: [{
        id: 'rapid-s1-4',
        label: 'Rapid S1',
        count: 2,
        quick: true,
        timed: true,
        lessonIds: ['s1'],
        questions: [
          { id: 'rapid-q1', q: 'First?', choices: ['A', 'B'], answer: 0 },
          { id: 'rapid-q2', q: 'Second?', choices: ['A', 'B'], answer: 1 },
        ],
      }],
    }
    expect(validatePdcDrills({ ...rapid, subject: 'CCCS422-FINAL' }).presets[0].questions).toHaveLength(2)
    expect(prepareContent(builtin, { version: 1, subjects: {}, schedule: { plan: [], exams: [] } }, rapid).data.TEST.chapters[0].questions.map(question => question.id)).toEqual(['q1', 'q2'])
  })

  it('merges independent drill bundles into their matching subjects', () => {
    const twoSubjects: ContentBundle = {
      version: 1,
      subjects: {
        PDC: { name: 'PDC', code: 'PDC', color: '#fff', chapters: [{ id: 'pdc-c1', label: 'PDC Chapter', questions: [{ id: 'pdc-q1', q: 'Base PDC?', choices: ['A', 'B'], answer: 0 }] }] },
        WEB: { name: 'Web', code: 'WEB', color: '#fff', chapters: [{ id: 'web-c1', label: 'Web Chapter', questions: [{ id: 'web-q1', q: 'Base Web?', choices: ['A', 'B'], answer: 0 }] }] },
      },
      schedule: { plan: [], exams: [] },
    }
    const pdc: DrillsBundle = { version: 2, subject: 'PDC', chapters: { 'pdc-c1': { questions: [{ id: 'pdc-q2', q: 'PDC drill?', choices: ['A', 'B'], answer: 1 }], sections: [{ id: 'pdc-s1', label: 'PDC section', questionIds: ['pdc-q1', 'pdc-q2'] }] } }, presets: [] }
    const web: DrillsBundle = { version: 2, subject: 'WEB', chapters: { 'web-c1': { questions: [{ id: 'web-q2', q: 'Web drill?', choices: ['A', 'B'], answer: 1 }], sections: [{ id: 'web-s1', label: 'Web section', questionIds: ['web-q1', 'web-q2'] }] } }, presets: [] }
    const prepared = prepareContent(twoSubjects, { version: 1, subjects: {}, schedule: { plan: [], exams: [] } }, pdc, web)

    expect(prepared.data.PDC.chapters[0].questions.map(question => question.id)).toEqual(['pdc-q1', 'pdc-q2'])
    expect(prepared.data.WEB.chapters[0].questions.map(question => question.id)).toEqual(['web-q1', 'web-q2'])
    expect(Object.keys(prepared.drillBundles)).toEqual(['PDC', 'WEB'])
    expect(validateWebDrills({ ...web, subject: 'WEB-EXAM2' }).subject).toBe('WEB-EXAM2')
  })

  it('supports metadata-only quick presets that sample from a lesson at launch', () => {
    const web: DrillsBundle = {
      version: 2,
      subject: 'WEB-EXAM2',
      chapters: {},
      presets: [{ id: 'web-quick', label: 'Web quick', count: 4, quick: true, timed: true, lessonIds: ['web-css-boxes'] }],
    }
    expect(validateWebDrills(web).presets[0].questions).toBeUndefined()
  })

  it('keeps a same-code custom subject as a complete override without built-in drills or presets', () => {
    const builtinWeb: ContentBundle = {
      version: 1,
      subjects: {
        WEB: { name: 'Built-in Web', code: 'WEB', color: '#fff', chapters: [{ id: 'web-c1', label: 'Built-in chapter', questions: [{ id: 'builtin-q', q: 'Built in?', choices: ['A', 'B'], answer: 0 }] }] },
      },
      schedule: { plan: [], exams: [] },
    }
    const customWeb: ContentBundle = {
      version: 1,
      subjects: {
        WEB: { name: 'My Web', code: 'WEB', color: '#123456', chapters: [{ id: 'web-c1', label: 'My chapter', questions: [{ id: 'custom-q', q: 'Custom?', choices: ['A', 'B'], answer: 1 }] }] },
      },
      schedule: { plan: [], exams: [] },
    }
    const webDrills: DrillsBundle = {
      version: 2,
      subject: 'WEB',
      chapters: {
        'web-c1': {
          questions: [{ id: 'drill-q', q: 'Drill?', choices: ['A', 'B'], answer: 0 }],
          sections: [{ id: 'web-section', label: 'Built-in section', questionIds: ['custom-q', 'drill-q'] }],
        },
      },
      presets: [{ id: 'web-preset', label: 'Built-in preset', count: 2, lessonIds: ['web-section'] }],
    }

    const prepared = prepareContent(builtinWeb, customWeb, createEmptyDrills('PDC'), webDrills)

    expect(prepared.data.WEB.name).toBe('My Web')
    expect(prepared.data.WEB.chapters[0].questions.map(question => question.id)).toEqual(['custom-q'])
    expect(prepared.data.WEB.chapters[0].sections).toBeUndefined()
    expect(prepared.data.WEB.chapters[0].lessons).toBeUndefined()
    expect(prepared.drillBundles.WEB).toBeUndefined()
  })
})
