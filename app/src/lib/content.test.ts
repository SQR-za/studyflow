import { describe, expect, it } from 'vitest'
import { loadCachedPreparedContent, prepareContent } from './content'
import type { ContentBundle, DrillsBundle } from '../types'

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
      sections: [{ id: 's1', label: 'Section', questionIds: ['q1', 'q2'] }],
    },
  },
  presets: [],
}

describe('prepareContent', () => {
  it('merges drills once and builds lessons without mutating source', () => {
    const empty: ContentBundle = { version: 1, subjects: {}, schedule: { plan: [], exams: [] } }
    const first = prepareContent(builtin, empty, drills)
    const second = prepareContent(builtin, empty, drills)
    expect(first.data.TEST.chapters[0].questions.map(question => question.id)).toEqual(['q1', 'q2'])
    expect(first.data.TEST.chapters[0].lessons?.[0].questions.map(question => question.id)).toEqual(['q1', 'q2'])
    expect(second.data.TEST.chapters[0].questions).toHaveLength(2)
    expect(builtin.subjects.TEST.chapters[0].questions).toHaveLength(1)
  })

  it('composes cached/custom content synchronously before network refresh', () => {
    localStorage.clear()
    const cached = loadCachedPreparedContent({ customContent: builtin, storage: localStorage })
    expect(cached.order).toEqual(['TEST'])
    expect(cached.data.TEST.chapters[0].questions[0].id).toBe('q1')
  })
})
