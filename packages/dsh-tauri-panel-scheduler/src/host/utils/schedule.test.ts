import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { nextOccurrence, parseTimeToMinutes, validateSchedule } from './schedule'

// cron-schedule 无 timezone 形参：`timeZone` 字段只被校验、不被使用，计算走进程本地时区。
// 因此每个用例前都把进程钉回 UTC（用例级改 TZ 的 DST 组必须能被下一个用例复位），
// 期望值一律用 `Date.UTC` 基准，宿主时区不影响结果。
const HOST_TZ = process.env.TZ

beforeEach(() => {
  process.env.TZ = 'UTC'
})

afterAll(() => {
  if (HOST_TZ === undefined)
    delete process.env.TZ
  else
    process.env.TZ = HOST_TZ
})

describe('parseTimeToMinutes', () => {
  it('parses "HH:mm" into minutes since midnight', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0)
    expect(parseTimeToMinutes('08:30')).toBe(510)
    expect(parseTimeToMinutes('23:59')).toBe(1439)
  })

  it('rejects invalid formats and out-of-range values', () => {
    expect(parseTimeToMinutes('')).toBeUndefined()
    expect(parseTimeToMinutes('8')).toBeUndefined()
    expect(parseTimeToMinutes('24:00')).toBeUndefined()
    expect(parseTimeToMinutes('08:60')).toBeUndefined()
    expect(parseTimeToMinutes('ab:cd')).toBeUndefined()
  })
})

describe('nextOccurrence', () => {
  it('interval returns from + everyMinutes', () => {
    const from = Date.UTC(2026, 0, 1, 0, 0, 0)
    const next = nextOccurrence({ kind: 'interval', everyMinutes: 30, timeZone: 'UTC' }, from)
    expect(next).toBe(from + 30 * 60 * 1000)
  })

  it('interval rejects oversized everyMinutes (would overflow Date)', () => {
    expect(nextOccurrence({ kind: 'interval', everyMinutes: Number.MAX_SAFE_INTEGER, timeZone: 'UTC' }, Date.now())).toBeUndefined()
    expect(nextOccurrence({ kind: 'interval', everyMinutes: 1e9, timeZone: 'UTC' }, Date.now())).toBeUndefined()
    expect(validateSchedule({ kind: 'interval', everyMinutes: 1e9, timeZone: 'UTC' })).toBe(false)
  })

  it('once returns the anchored instant only while it is still in the future', () => {
    const at = '2026-03-01T12:30:00.000Z'
    expect(nextOccurrence({ kind: 'once', at, timeZone: 'UTC' }, Date.UTC(2026, 2, 1, 12, 29, 59)))
      .toBe(Date.UTC(2026, 2, 1, 12, 30, 0))
    expect(nextOccurrence({ kind: 'once', at, timeZone: 'UTC' }, Date.UTC(2026, 2, 1, 12, 30, 0))).toBeUndefined()
    expect(nextOccurrence({ kind: 'once', at, timeZone: 'UTC' }, Date.UTC(2027, 0, 1))).toBeUndefined()
    expect(nextOccurrence({ kind: 'once', at: 'not-a-date', timeZone: 'UTC' }, Date.UTC(2026, 0, 1))).toBeUndefined()
  })

  it('hourly lands on the next occurrence of that minute', () => {
    expect(nextOccurrence({ kind: 'hourly', minute: 30, timeZone: 'UTC' }, Date.UTC(2026, 0, 1, 8, 10, 0)))
      .toBe(Date.UTC(2026, 0, 1, 8, 30, 0))
    expect(nextOccurrence({ kind: 'hourly', minute: 30, timeZone: 'UTC' }, Date.UTC(2026, 0, 1, 8, 45, 0)))
      .toBe(Date.UTC(2026, 0, 1, 9, 30, 0))
    expect(nextOccurrence({ kind: 'hourly', minute: 0, timeZone: 'UTC' }, Date.UTC(2026, 0, 1, 8, 0, 0)))
      .toBe(Date.UTC(2026, 0, 1, 9, 0, 0))
  })

  it('hourly rejects an out-of-range minute instead of returning a bogus instant', () => {
    expect(nextOccurrence({ kind: 'hourly', minute: 60, timeZone: 'UTC' }, Date.UTC(2026, 0, 1, 8, 0, 0))).toBeUndefined()
    expect(nextOccurrence({ kind: 'hourly', minute: -1, timeZone: 'UTC' }, Date.UTC(2026, 0, 1, 8, 0, 0))).toBeUndefined()
  })

  it('custom steps whole days from the anchor, strictly after `from`', () => {
    const anchor = '2026-01-01T00:00:00.000Z'
    expect(nextOccurrence({ kind: 'custom', everyDays: 2, anchor, time: '08:00', timeZone: 'UTC' }, Date.UTC(2026, 0, 1, 9, 0, 0)))
      .toBe(Date.UTC(2026, 0, 3, 0, 0, 0))
    expect(nextOccurrence({ kind: 'custom', everyDays: 2, anchor, time: '08:00', timeZone: 'UTC' }, Date.UTC(2026, 0, 3, 0, 0, 0)))
      .toBe(Date.UTC(2026, 0, 5, 0, 0, 0))
    expect(nextOccurrence({ kind: 'custom', everyDays: 2, anchor, time: '08:00', timeZone: 'UTC' }, Date.UTC(2025, 11, 20, 0, 0, 0)))
      .toBe(Date.UTC(2026, 0, 1, 0, 0, 0))
  })

  it('custom rejects invalid everyDays / anchor / time', () => {
    const anchor = '2026-01-01T00:00:00.000Z'
    expect(nextOccurrence({ kind: 'custom', everyDays: 0, anchor, time: '08:00', timeZone: 'UTC' }, Date.UTC(2026, 0, 1))).toBeUndefined()
    expect(nextOccurrence({ kind: 'custom', everyDays: 2, anchor: 'nope', time: '08:00', timeZone: 'UTC' }, Date.UTC(2026, 0, 1))).toBeUndefined()
    expect(nextOccurrence({ kind: 'custom', everyDays: 2, anchor, time: 'bad', timeZone: 'UTC' }, Date.UTC(2026, 0, 1))).toBeUndefined()
  })

  it('daily returns today at time when still in the future', () => {
    const from = Date.UTC(2026, 0, 1, 7, 0, 0)
    const next = nextOccurrence({ kind: 'daily', time: '08:00', timeZone: 'UTC' }, from)
    expect(next).toBe(Date.UTC(2026, 0, 1, 8, 0, 0))
  })

  it('daily rolls to tomorrow when the time already passed', () => {
    const from = Date.UTC(2026, 0, 1, 9, 0, 0)
    const next = nextOccurrence({ kind: 'daily', time: '08:00', timeZone: 'UTC' }, from)
    expect(next).toBe(Date.UTC(2026, 0, 2, 8, 0, 0))
  })

  it('workdays skips weekends', () => {
    // 2026-01-03 是周六
    const saturday = Date.UTC(2026, 0, 3, 9, 0, 0)
    const next = nextOccurrence({ kind: 'workdays', time: '08:00', timeZone: 'UTC' }, saturday)
    // 下一个工作日是周一 2026-01-05
    expect(next).toBe(Date.UTC(2026, 0, 5, 8, 0, 0))
  })

  it('weekly picks the next selected weekday', () => {
    // 2026-01-01 是周四；选 MO/WE → 下一个选中的是周一 2026-01-05
    const thursday = Date.UTC(2026, 0, 1, 9, 0, 0)
    const next = nextOccurrence({ kind: 'weekly', weekdays: ['MO', 'WE'], time: '08:00', timeZone: 'UTC' }, thursday)
    expect(next).toBe(Date.UTC(2026, 0, 5, 8, 0, 0))
  })

  it('monthly lands on the requested day and skips short months', () => {
    expect(nextOccurrence({ kind: 'monthly', day: 15, time: '08:00', timeZone: 'UTC' }, Date.UTC(2026, 0, 10, 0, 0, 0)))
      .toBe(Date.UTC(2026, 0, 15, 8, 0, 0))
    expect(nextOccurrence({ kind: 'monthly', day: 15, time: '08:00', timeZone: 'UTC' }, Date.UTC(2026, 0, 20, 0, 0, 0)))
      .toBe(Date.UTC(2026, 1, 15, 8, 0, 0))
    // 2026-02 没有 31 日 → 下一次是 03-31
    expect(nextOccurrence({ kind: 'monthly', day: 31, time: '08:00', timeZone: 'UTC' }, Date.UTC(2026, 1, 1, 0, 0, 0)))
      .toBe(Date.UTC(2026, 2, 31, 8, 0, 0))
  })

  it('returns undefined for invalid schedules', () => {
    expect(nextOccurrence({ kind: 'interval', everyMinutes: 0, timeZone: 'UTC' }, Date.now())).toBeUndefined()
    expect(nextOccurrence({ kind: 'daily', time: 'bad', timeZone: 'UTC' }, Date.now())).toBeUndefined()
    expect(nextOccurrence({ kind: 'weekly', weekdays: [], time: '08:00', timeZone: 'UTC' }, Date.now())).toBeUndefined()
    expect(nextOccurrence({ kind: 'workdays', time: '24:00', timeZone: 'UTC' }, Date.now())).toBeUndefined()
  })

  // monthly day 超出 cron 的 1-31 时会从 parseCronExpression 抛出，而不是按契约返回 undefined；
  // store 侧经 validateSchedule 挡掉了该输入，故此处不断言该不可达行为。
})

describe('validateSchedule', () => {
  it('accepts all four valid kinds', () => {
    expect(validateSchedule({ kind: 'daily', time: '08:00', timeZone: 'UTC' })).toBe(true)
    expect(validateSchedule({ kind: 'interval', everyMinutes: 30, timeZone: 'UTC' })).toBe(true)
    expect(validateSchedule({ kind: 'workdays', time: '09:30', timeZone: 'UTC' })).toBe(true)
    expect(validateSchedule({ kind: 'weekly', weekdays: ['MO', 'FR'], time: '10:00', timeZone: 'UTC' })).toBe(true)
  })

  it('accepts the once / hourly / monthly / custom kinds', () => {
    expect(validateSchedule({ kind: 'once', at: '2026-01-01T08:00:00.000Z', timeZone: 'UTC' })).toBe(true)
    expect(validateSchedule({ kind: 'hourly', minute: 0, timeZone: 'UTC' })).toBe(true)
    expect(validateSchedule({ kind: 'hourly', minute: 59, timeZone: 'UTC' })).toBe(true)
    expect(validateSchedule({ kind: 'monthly', day: 31, time: '08:00', timeZone: 'UTC' })).toBe(true)
    expect(validateSchedule({ kind: 'custom', everyDays: 7, anchor: '2026-01-01T00:00:00.000Z', time: '08:00', timeZone: 'UTC' })).toBe(true)
  })

  it('rejects invalid shapes', () => {
    expect(validateSchedule({ kind: 'daily', time: '25:00' })).toBe(false)
    expect(validateSchedule({ kind: 'interval', everyMinutes: -1 })).toBe(false)
    expect(validateSchedule({ kind: 'weekly', weekdays: ['XX'], time: '08:00' })).toBe(false)
    expect(validateSchedule(null)).toBe(false)
    expect(validateSchedule('nope')).toBe(false)
  })

  it('rejects out-of-range fields per kind', () => {
    expect(validateSchedule({ kind: 'once', at: 'not-a-date' })).toBe(false)
    expect(validateSchedule({ kind: 'once', at: 1735689600000 })).toBe(false)
    expect(validateSchedule({ kind: 'hourly', minute: 60 })).toBe(false)
    expect(validateSchedule({ kind: 'hourly', minute: 1.5 })).toBe(false)
    expect(validateSchedule({ kind: 'monthly', day: 32, time: '08:00' })).toBe(false)
    expect(validateSchedule({ kind: 'monthly', day: 0, time: '08:00' })).toBe(false)
    expect(validateSchedule({ kind: 'custom', everyDays: 0, anchor: '2026-01-01T00:00:00.000Z', time: '08:00' })).toBe(false)
    expect(validateSchedule({ kind: 'custom', everyDays: 7, anchor: 'nope', time: '08:00' })).toBe(false)
    expect(validateSchedule({ kind: 'custom', everyDays: 7, anchor: '2026-01-01T00:00:00.000Z', time: 'bad' })).toBe(false)
    expect(validateSchedule({ kind: 'unknown' })).toBe(false)
    expect(validateSchedule([])).toBe(false)
  })
})

describe('nextOccurrence across DST (America/New_York)', () => {
  // 本组需要非 UTC 的进程时区：顶层 `beforeEach` 先把 TZ 钉到 UTC，描述块级 hook 在其后执行，
  // 这里再覆盖一次即可；用例结束后由下一个用例的顶层 `beforeEach` 复位，故无需自行还原。
  beforeEach(() => {
    process.env.TZ = 'America/New_York'
  })

  it('daily keeps the same wall-clock time across spring-forward', () => {
    // 2026-03-08 02:00 EST → 03:00 EDT（春季前拨，当天只有 23 小时）。
    // 从 03-07 09:00 之后找 08:00 → 应为 03-08 08:00 EDT。
    const from = new Date(2026, 2, 7, 9, 0, 0).getTime()
    const next = nextOccurrence({ kind: 'daily', time: '08:00', timeZone: 'America/New_York' }, from)
    const expected = new Date(2026, 2, 8, 8, 0, 0).getTime()
    expect(next).toBe(expected)
    // 与「日历日 +1」一致：加 24h 毫秒会得到 23 小时的钟面错位。
    expect(new Date(next as number).getHours()).toBe(8)
  })

  it('daily keeps the same wall-clock time across fall-back', () => {
    // 2026-11-01 02:00 EDT → 01:00 EST（秋季回拨，当天 25 小时）。
    const from = new Date(2026, 9, 31, 9, 0, 0).getTime()
    const next = nextOccurrence({ kind: 'daily', time: '08:00', timeZone: 'America/New_York' }, from)
    const expected = new Date(2026, 10, 1, 8, 0, 0).getTime()
    expect(next).toBe(expected)
    expect(new Date(next as number).getHours()).toBe(8)
  })

  it('workdays keeps wall-clock time across a DST boundary', () => {
    // 2026-03-06（周五）之后的工作日 08:00：跨 03-08 春季前拨 → 03-09（周一）08:00。
    const friday = new Date(2026, 2, 6, 12, 0, 0).getTime()
    const next = nextOccurrence({ kind: 'workdays', time: '08:00', timeZone: 'America/New_York' }, friday)
    expect(next).toBe(new Date(2026, 2, 9, 8, 0, 0).getTime())
  })
})
