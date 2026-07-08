import { describe, expect, it } from 'vitest'
import { pickNextActivity } from './usePlayMode.js'

describe('pickNextActivity', () => {
  it('returns a valid activity when there is no previous one', () => {
    const activity = pickNextActivity(null, () => 0)
    expect(activity.mood).toBeTruthy()
    expect(activity.durationMs).toBeGreaterThan(0)
  })

  it('never repeats the immediately-previous activity', () => {
    for (let i = 0; i < 20; i++) {
      const random = () => i / 20
      const activity = pickNextActivity('skate', random)
      expect(activity.mood).not.toBe('skate')
    }
  })

  it('picks the first candidate when random() returns 0', () => {
    const activity = pickNextActivity(null, () => 0)
    expect(activity.mood).toBe('skate')
  })

  it('picks the last candidate when random() returns just under 1', () => {
    const activity = pickNextActivity(null, () => 0.9999)
    expect(activity.mood).toBe('moonwalk')
  })
})
