import { describe, expect, it } from 'vitest'
import { detectRequestedMood } from './detectRequestedMood.js'

describe('detectRequestedMood', () => {
  it('detects a flip request', () => {
    expect(detectRequestedMood('do a flip')).toBe('flip')
  })

  it('detects a backflip request without matching the substring "flip" first', () => {
    expect(detectRequestedMood('do a backflip')).toBe('backflip')
  })

  it('detects a spin request in various forms', () => {
    expect(detectRequestedMood('spin around')).toBe('spin')
    expect(detectRequestedMood('can you do some spinning')).toBe('spin')
  })

  it('detects a moonwalk request', () => {
    expect(detectRequestedMood('moonwalk for me')).toBe('moonwalk')
  })

  it('detects a wiggle request', () => {
    expect(detectRequestedMood('wiggle for me')).toBe('wiggle')
  })

  it('detects a dance request in various forms', () => {
    expect(detectRequestedMood('dance for me')).toBe('dancing')
    expect(detectRequestedMood('can you dance')).toBe('dancing')
    expect(detectRequestedMood('I love dancing')).toBe('dancing')
  })

  it('returns null when no move word is present', () => {
    expect(detectRequestedMood('how is your day going?')).toBeNull()
    expect(detectRequestedMood('')).toBeNull()
  })

  it('does not match common everyday verbs excluded by design', () => {
    expect(detectRequestedMood('I need to run an errand')).toBeNull()
    expect(detectRequestedMood("let's walk to the store")).toBeNull()
    expect(detectRequestedMood('please sit down')).toBeNull()
  })
})
