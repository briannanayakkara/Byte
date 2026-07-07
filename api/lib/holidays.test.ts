import { describe, expect, it } from 'vitest'
import { getHolidayToday, isBirthdayToday } from './holidays.js'

describe('getHolidayToday', () => {
  it('returns null on an ordinary day', () => {
    expect(getHolidayToday(new Date('2026-07-07T12:00:00.000Z'))).toBeNull()
  })

  it('recognizes Halloween', () => {
    expect(getHolidayToday(new Date('2026-10-31T12:00:00.000Z'))).toBe('halloween')
  })

  it('recognizes Christmas', () => {
    expect(getHolidayToday(new Date('2026-12-25T12:00:00.000Z'))).toBe('christmas')
  })

  it("recognizes New Year's Day", () => {
    expect(getHolidayToday(new Date('2027-01-01T12:00:00.000Z'))).toBe('newyear')
  })

  it("recognizes Valentine's Day", () => {
    expect(getHolidayToday(new Date('2027-02-14T12:00:00.000Z'))).toBe('valentine')
  })

  it('matches on month/day regardless of year', () => {
    expect(getHolidayToday(new Date('1999-12-25T00:00:00.000Z'))).toBe('christmas')
  })
})

describe('isBirthdayToday', () => {
  it('returns false when there is no birthday on file', () => {
    expect(isBirthdayToday(null, new Date('2026-07-07T00:00:00.000Z'))).toBe(false)
  })

  it('returns false on a non-matching day', () => {
    expect(isBirthdayToday('1998-05-14', new Date('2026-07-07T00:00:00.000Z'))).toBe(false)
  })

  it('returns true when month/day match, regardless of birth year', () => {
    expect(isBirthdayToday('1998-07-07', new Date('2026-07-07T12:00:00.000Z'))).toBe(true)
  })
})
