import { describe, expect, it } from 'vitest'
import { computeEnergy } from './relationship.js'

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
