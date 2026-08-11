import { describe, expect, it } from 'vitest'
import { createProgressStore, recordAnswer, setStarred } from './progress'
import { DAY_MS } from './constants'

describe('legacy progress compatibility', () => {
  it('advances and resets boxes using the existing due schedule', () => {
    const now = 1_700_000_000_000
    const first = recordAnswer(createProgressStore(), 'q1', true, now)
    expect(first.progress).toMatchObject({ box: 2, seen: 1, correct: 1, wrong: 0, last: now })
    expect(first.progress.due).toBe(now + 4 * DAY_MS)
    const second = recordAnswer(first.store, 'q1', false, now + 10)
    expect(second.progress).toMatchObject({ box: 1, seen: 2, correct: 1, wrong: 1 })
    expect(second.progress.due).toBe(now + 10 + DAY_MS)
  })

  it('removes false stars instead of persisting tombstones', () => {
    const starred = setStarred(createProgressStore(), 'q1', true)
    expect(starred.star.q1).toBe(true)
    expect(setStarred(starred, 'q1', false).star).not.toHaveProperty('q1')
  })
})

