import { describe, expect, it } from 'vitest'
import { canCatchCold, computeEnergy, newMilestones } from './relationship.js'

describe('computeEnergy', () => {
  it('returns full energy when there is no prior visit', () => {
    expect(computeEnergy(null, 0)).toBe(100)
  })

  it('does not decay within the first 6 hours, but still adds the interaction bump', () => {
    const lastSeenAt = new Date('2026-07-07T12:00:00.000Z').toISOString()
    const now = new Date('2026-07-07T13:00:00.000Z') // 1 hour later
    expect(computeEnergy(lastSeenAt, 40, now)).toBe(48)
  })

  it('decays toward the floor partway through the decay window', () => {
    const lastSeenAt = new Date('2026-07-07T00:00:00.000Z').toISOString()
    const now = new Date('2026-07-08T15:00:00.000Z') // 39 hours later -- halfway between 6h and 72h
    expect(computeEnergy(lastSeenAt, 90, now)).toBe(68)
  })

  it('floors at 30 (plus the bump) once fully decayed', () => {
    const lastSeenAt = new Date('2026-07-01T00:00:00.000Z').toISOString()
    const now = new Date('2026-07-07T00:00:00.000Z') // 144 hours later, well past the 72h floor
    expect(computeEnergy(lastSeenAt, 90, now)).toBe(38)
  })

  it('caps at 100 even when the bump would push it over', () => {
    const lastSeenAt = new Date('2026-07-07T12:00:00.000Z').toISOString()
    const now = new Date('2026-07-07T13:00:00.000Z') // 1 hour later, no decay
    expect(computeEnergy(lastSeenAt, 98, now)).toBe(100)
  })
})

describe('canCatchCold', () => {
  it('allows a cold when there is no prior one', () => {
    expect(canCatchCold(null)).toBe(true)
  })

  it('blocks a cold within the cooldown window', () => {
    const lastColdAt = new Date('2026-07-01T00:00:00.000Z').toISOString()
    const now = new Date('2026-07-05T00:00:00.000Z') // 4 days later
    expect(canCatchCold(lastColdAt, now)).toBe(false)
  })

  it('allows a cold once the cooldown has elapsed', () => {
    const lastColdAt = new Date('2026-06-01T00:00:00.000Z').toISOString()
    const now = new Date('2026-07-01T00:00:00.000Z') // 30 days later
    expect(canCatchCold(lastColdAt, now)).toBe(true)
  })
})

describe('newMilestones', () => {
  it('detects crossing an interaction-count milestone', () => {
    const prior = { interactionCount: 9, streakDays: 1, relationshipLevel: 1 }
    const next = { interactionCount: 10, streakDays: 1, relationshipLevel: 1 }
    expect(newMilestones(prior, next, [])).toEqual(['interactions_10'])
  })

  it('detects a streak milestone and a level-up in the same turn', () => {
    const prior = { interactionCount: 4, streakDays: 6, relationshipLevel: 1 }
    const next = { interactionCount: 5, streakDays: 7, relationshipLevel: 2 }
    expect(newMilestones(prior, next, [])).toEqual(['streak_7', 'level_2'])
  })

  it('never repeats an already-celebrated milestone', () => {
    const prior = { interactionCount: 99, streakDays: 1, relationshipLevel: 4 }
    const next = { interactionCount: 100, streakDays: 1, relationshipLevel: 4 }
    expect(newMilestones(prior, next, ['interactions_100'])).toEqual([])
  })

  it('returns nothing when no threshold was crossed', () => {
    const prior = { interactionCount: 11, streakDays: 1, relationshipLevel: 2 }
    const next = { interactionCount: 12, streakDays: 1, relationshipLevel: 2 }
    expect(newMilestones(prior, next, [])).toEqual([])
  })
})
