import { describe, expect, it } from 'vitest'
import { WEB_FINAL_CRAM_GUIDE } from './webFinalCram'

describe('WEB_FINAL_CRAM_GUIDE', () => {
  it('defines a complete four-hour sequence', () => {
    expect(WEB_FINAL_CRAM_GUIDE.phases).toHaveLength(4)
    expect(WEB_FINAL_CRAM_GUIDE.phases.reduce((sum, phase) => sum + phase.minutes, 0)).toBe(240)
    expect(WEB_FINAL_CRAM_GUIDE.totalMinutes).toBe(240)
    expect(new Set(WEB_FINAL_CRAM_GUIDE.phases.map(phase => phase.id)).size).toBe(4)
  })

  it('contains rectangular tables and answer-backed code examples', () => {
    const sections = WEB_FINAL_CRAM_GUIDE.phases.flatMap(phase => phase.sections)
    const tables = sections.filter(section => section.type === 'table')
    const examples = sections.filter(section => section.type === 'code')

    expect(tables.length).toBeGreaterThanOrEqual(10)
    expect(examples.length).toBeGreaterThanOrEqual(15)
    for (const table of tables) {
      expect(table.columns.length).toBeGreaterThanOrEqual(3)
      expect(table.rows.length).toBeGreaterThanOrEqual(3)
      expect(table.rows.every(row => row.length === table.columns.length)).toBe(true)
    }
    for (const example of examples) {
      expect(example.code.trim()).not.toBe('')
      expect(example.prompt.trim()).not.toBe('')
      expect(example.answer.trim()).not.toBe('')
      expect(example.explanation).toMatch(/[\u0600-\u06FF]/)
      expect(example.source).toMatch(/Slide|StudyFlow/)
    }
  })

  it('ends with a practical closed-book checklist', () => {
    expect(WEB_FINAL_CRAM_GUIDE.finalChecklist).toHaveLength(12)
    expect(WEB_FINAL_CRAM_GUIDE.finalChecklist.every(item => /[\u0600-\u06FF]/.test(item))).toBe(true)
  })
})
