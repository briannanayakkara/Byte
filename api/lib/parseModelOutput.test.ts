import { describe, expect, it } from 'vitest'
import { parseModelOutput, stripTrailingQuestion } from './parseModelOutput.js'

describe('parseModelOutput', () => {
  it('passes through a well-formed response unchanged', () => {
    const raw = JSON.stringify({
      reply: 'hey there!',
      mood: 'happy',
      new_facts: [{ content: 'likes ramen', category: 'likes' }],
      personality_notes: 'inside joke about ramen',
    })
    const result = parseModelOutput(raw, null)
    expect(result).toEqual({
      reply: 'hey there!',
      mood: 'happy',
      newFacts: [{ content: 'likes ramen', category: 'likes' }],
      personalityNotes: 'inside joke about ramen',
    })
  })

  it('falls back to neutral for an invalid mood', () => {
    const raw = JSON.stringify({ reply: 'hi', mood: 'not-a-real-mood', new_facts: [] })
    const result = parseModelOutput(raw, null)
    expect(result.mood).toBe('neutral')
  })

  it('falls back to other for an invalid fact category', () => {
    const raw = JSON.stringify({
      reply: 'hi',
      mood: 'happy',
      new_facts: [{ content: 'something', category: 'not-a-real-category' }],
    })
    const result = parseModelOutput(raw, null)
    expect(result.newFacts).toEqual([{ content: 'something', category: 'other' }])
  })

  it('drops a fact with empty-string content', () => {
    const raw = JSON.stringify({
      reply: 'hi',
      mood: 'happy',
      new_facts: [
        { content: '', category: 'likes' },
        { content: '   ', category: 'likes' },
        { content: 'a real fact', category: 'likes' },
      ],
    })
    const result = parseModelOutput(raw, null)
    expect(result.newFacts).toEqual([{ content: 'a real fact', category: 'likes' }])
  })

  it('drops a fact with non-string content', () => {
    const raw = JSON.stringify({
      reply: 'hi',
      mood: 'happy',
      new_facts: [{ content: 42, category: 'likes' }],
    })
    const result = parseModelOutput(raw, null)
    expect(result.newFacts).toEqual([])
  })

  it('falls back to the prior personality_notes when the field is missing', () => {
    const raw = JSON.stringify({ reply: 'hi', mood: 'happy', new_facts: [] })
    const result = parseModelOutput(raw, 'existing shared context')
    expect(result.personalityNotes).toBe('existing shared context')
  })

  it('falls back to null personality_notes when there is no prior value', () => {
    const raw = JSON.stringify({ reply: 'hi', mood: 'happy', new_facts: [] })
    const result = parseModelOutput(raw, null)
    expect(result.personalityNotes).toBeNull()
  })

  it('falls back to a neutral reply on unparseable JSON', () => {
    const raw = 'not json at all'
    const result = parseModelOutput(raw, 'existing shared context')
    expect(result).toEqual({
      reply: raw,
      mood: 'neutral',
      newFacts: [],
      personalityNotes: 'existing shared context',
    })
  })
})

describe('stripTrailingQuestion', () => {
  it('flattens a trailing rhetorical question into a statement', () => {
    expect(stripTrailingQuestion('Isn\'t that cool?')).toBe('Isn\'t that cool.')
  })

  it('flattens a trailing tag question with a comma', () => {
    expect(stripTrailingQuestion('Amazing, right?')).toBe('Amazing, right.')
  })

  it('collapses repeated trailing question marks to a single period', () => {
    expect(stripTrailingQuestion('No way, right??')).toBe('No way, right.')
  })

  it('leaves a statement with no trailing question mark unchanged', () => {
    expect(stripTrailingQuestion('Beetles are wild little guys.')).toBe('Beetles are wild little guys.')
  })

  it('does not touch a question mark in the middle of the text', () => {
    expect(stripTrailingQuestion('Did you know? Octopuses have three hearts.')).toBe(
      'Did you know? Octopuses have three hearts.'
    )
  })
})
