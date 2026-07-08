import { describe, expect, it } from 'vitest'
import { buildFactInstruction, buildMemoryBlock, buildMilestoneReminder, buildMoveRequestReminder, buildOutputFormatInstructions, buildSpecialDayLine } from './prompt.js'
import type { MemorySnapshot } from './memory.js'

const BASE_MEMORY: MemorySnapshot = {
  user: { id: 'u1', name: 'Sam', nicknames: [], birthday: null, notes: null, location: null, pronouns: null, is_test: true, created_at: '2026-01-01T00:00:00.000Z' },
  facts: [],
  messages: [],
  dates: [],
  state: {
    mood: 'bored',
    energy: 42,
    relationship_level: 2,
    interaction_count: 10,
    last_seen_at: '2026-07-01T00:00:00.000Z',
    streak_days: 3,
    personality_notes: null,
    last_cold_at: null,
    milestones: [],
  },
}

describe('buildMemoryBlock', () => {
  it('includes the current mood and energy', () => {
    const block = buildMemoryBlock(BASE_MEMORY, { coldAvailable: true, newMilestone: null })
    expect(block).toContain('mood bored, energy 42')
  })

  it('explains the energy-banded health arc and the annoyed trigger', () => {
    const block = buildMemoryBlock(BASE_MEMORY, { coldAvailable: true, newMilestone: null })
    expect(block).toContain('sick')
    expect(block).toContain('unwell')
    expect(block).toContain('recovering')
    expect(block).toContain('annoyed')
  })
})

describe('buildMemoryBlock signals', () => {
  it('tells the model a cold is off the table when coldAvailable is false', () => {
    const block = buildMemoryBlock(BASE_MEMORY, { coldAvailable: false, newMilestone: null })
    expect(block).toContain('not time for another one yet')
  })

  it('announces a fresh milestone when one is passed', () => {
    const block = buildMemoryBlock(BASE_MEMORY, { coldAvailable: true, newMilestone: 'interactions_100' })
    expect(block).toContain('ONE HUNDRED conversations')
  })
})

describe('buildOutputFormatInstructions', () => {
  it('lists every mood group and the JSON shape', () => {
    const text = buildOutputFormatInstructions()
    expect(text).toContain('"personality_notes"')
    expect(text).toContain('"new_facts"')
    expect(text).toContain('annoyed')
  })
})

describe('buildSpecialDayLine', () => {
  it('returns an empty string on an ordinary day with no birthday', () => {
    expect(buildSpecialDayLine('Sam', null, new Date('2026-07-07T12:00:00.000Z'))).toBe('')
  })

  it('mentions the holiday mood when there is one', () => {
    expect(buildSpecialDayLine('Sam', null, new Date('2026-12-25T12:00:00.000Z'))).toContain('christmas')
  })

  it("prioritizes the user's birthday over a coincidental holiday", () => {
    const line = buildSpecialDayLine('Sam', '1998-12-25', new Date('2026-12-25T12:00:00.000Z'))
    expect(line).toContain('birthday')
    expect(line).toContain('Sam')
  })
})

describe('buildMilestoneReminder', () => {
  it('returns an empty string when there is no new milestone', () => {
    expect(buildMilestoneReminder(null)).toBe('')
  })

  it('echoes the milestone copy with an OVERRIDE prefix when one is passed', () => {
    const line = buildMilestoneReminder('interactions_100')
    expect(line).toContain('OVERRIDE')
    expect(line).toContain('ONE HUNDRED conversations')
  })
})

describe('buildFactInstruction', () => {
  it('asks for a single spontaneous fact, not a reply', () => {
    const text = buildFactInstruction()
    expect(text).toContain('fun fact')
    expect(text).toContain('not a reply')
  })
})

describe('buildMoveRequestReminder', () => {
  it('returns an empty string when no move was requested', () => {
    expect(buildMoveRequestReminder(false)).toBe('')
  })

  it('tells the model to actually do the move, not downplay it, when one was requested', () => {
    const line = buildMoveRequestReminder(true)
    expect(line).toContain('OVERRIDE')
    expect(line).toContain('Do not say you can')
  })
})
