import { describe, expect, it } from 'vitest'
import securityPlusAsset from '../../public/security-plus-sy0-701.json'
import { createEmptyDrills, loadCachedPreparedContent, prepareContent, validateBuiltinContent, validateDrills } from './content'
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

describe('checked-in Security+ content', () => {
  it('ships only SY0-701 with every domain, objective, and question', () => {
    const validated = validateBuiltinContent(securityPlusAsset)
    const subject = validated.subjects['SEC-PLUS']
    const questions = subject.chapters.flatMap(chapter => chapter.questions)
    const objectives = subject.chapters.flatMap(chapter => chapter.objectives ?? [])

    expect(Object.keys(validated.subjects)).toEqual(['SEC-PLUS'])
    expect(subject.chapters).toHaveLength(5)
    expect(objectives).toHaveLength(28)
    expect(questions).toHaveLength(987)
    expect(questions.filter(question => question.type === 'match')).toHaveLength(111)
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
    const legacy = JSON.parse(JSON.stringify(drills))
    delete legacy.chapters.c1.sections[0].content
    expect(validateDrills(legacy, 'TEST').chapters.c1.sections[0].content).toBeUndefined()

    const malformed = JSON.parse(JSON.stringify(drills))
    malformed.chapters.c1.sections[0].content.blocks[0].paragraphs = 'not-an-array'
    expect(() => validateDrills(malformed, 'TEST')).toThrow(/النص غير صالح/)

    const unsafeFigure = JSON.parse(JSON.stringify(drills))
    unsafeFigure.chapters.c1.sections[0].content.blocks.push({
      type: 'figure',
      figure: { src: '../private.png', alt: 'Unsafe', caption: 'Unsafe path', source: 'Test', width: 100, height: 100 },
    })
    expect(() => validateDrills(unsafeFigure, 'TEST')).toThrow(/مسار الصورة غير صالح/)
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
    expect(validateDrills(rapid, 'TEST').presets[0].questions).toHaveLength(2)
    expect(prepareContent(builtin, { version: 1, subjects: {}, schedule: { plan: [], exams: [] } }, rapid).data.TEST.chapters[0].questions.map(question => question.id)).toEqual(['q1', 'q2'])
  })

  it('merges independent drill bundles into their matching subjects', () => {
    const twoSubjects: ContentBundle = {
      version: 1,
      subjects: {
        ALPHA: { name: 'Alpha', code: 'ALPHA', color: '#fff', chapters: [{ id: 'alpha-c1', label: 'Alpha Chapter', questions: [{ id: 'alpha-q1', q: 'Base Alpha?', choices: ['A', 'B'], answer: 0 }] }] },
        BETA: { name: 'Beta', code: 'BETA', color: '#fff', chapters: [{ id: 'beta-c1', label: 'Beta Chapter', questions: [{ id: 'beta-q1', q: 'Base Beta?', choices: ['A', 'B'], answer: 0 }] }] },
      },
      schedule: { plan: [], exams: [] },
    }
    const alpha: DrillsBundle = { version: 2, subject: 'ALPHA', chapters: { 'alpha-c1': { questions: [{ id: 'alpha-q2', q: 'Alpha drill?', choices: ['A', 'B'], answer: 1 }], sections: [{ id: 'alpha-s1', label: 'Alpha section', questionIds: ['alpha-q1', 'alpha-q2'] }] } }, presets: [] }
    const beta: DrillsBundle = { version: 2, subject: 'BETA', chapters: { 'beta-c1': { questions: [{ id: 'beta-q2', q: 'Beta drill?', choices: ['A', 'B'], answer: 1 }], sections: [{ id: 'beta-s1', label: 'Beta section', questionIds: ['beta-q1', 'beta-q2'] }] } }, presets: [] }
    const prepared = prepareContent(twoSubjects, { version: 1, subjects: {}, schedule: { plan: [], exams: [] } }, alpha, beta)

    expect(prepared.data.ALPHA.chapters[0].questions.map(question => question.id)).toEqual(['alpha-q1', 'alpha-q2'])
    expect(prepared.data.BETA.chapters[0].questions.map(question => question.id)).toEqual(['beta-q1', 'beta-q2'])
    expect(Object.keys(prepared.drillBundles)).toEqual(['ALPHA', 'BETA'])
    expect(validateDrills(beta, 'BETA').subject).toBe('BETA')
  })

  it('supports metadata-only quick presets that sample from a lesson at launch', () => {
    const quick: DrillsBundle = {
      version: 2,
      subject: 'TEST',
      chapters: {},
      presets: [{ id: 'section-quick', label: 'Section quick', count: 4, quick: true, timed: true, lessonIds: ['section-one'] }],
    }
    expect(validateDrills(quick, 'TEST').presets[0].questions).toBeUndefined()
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

    const prepared = prepareContent(builtinWeb, customWeb, createEmptyDrills('UNRELATED'), webDrills)

    expect(prepared.data.WEB.name).toBe('My Web')
    expect(prepared.data.WEB.chapters[0].questions.map(question => question.id)).toEqual(['custom-q'])
    expect(prepared.data.WEB.chapters[0].sections).toBeUndefined()
    expect(prepared.data.WEB.chapters[0].lessons).toBeUndefined()
    expect(prepared.drillBundles.WEB).toBeUndefined()
  })
})
