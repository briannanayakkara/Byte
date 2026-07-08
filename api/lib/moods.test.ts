import { describe, expect, it } from 'vitest'
import { MOOD_GROUPS, SELECTABLE_MOODS } from './moods.js'

describe('SELECTABLE_MOODS', () => {
  it('excludes listening and talking (no voice feature yet)', () => {
    expect(SELECTABLE_MOODS).not.toContain('listening')
    expect(SELECTABLE_MOODS).not.toContain('talking')
  })

  it('has no duplicates across groups', () => {
    expect(new Set(SELECTABLE_MOODS).size).toBe(SELECTABLE_MOODS.length)
  })

  it('flattens every group', () => {
    const expectedCount = MOOD_GROUPS.reduce((sum, g) => sum + g.moods.length, 0)
    expect(SELECTABLE_MOODS.length).toBe(expectedCount)
  })

  it('includes the Play group moods', () => {
    expect(SELECTABLE_MOODS).toContain('skate')
    expect(SELECTABLE_MOODS).toContain('playball')
    expect(SELECTABLE_MOODS).toContain('jam')
  })
})
