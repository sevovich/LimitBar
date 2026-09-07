import { describe, expect, it } from 'vitest'
import { emptyProvider, formatProviderTrayTitle, formatResetRemaining, formatTrayTitle, makeLimitWindow, remainingFromUsed, validateSettings } from '../src/shared/usage'

describe('usage helpers', () => {
  it('converts provider utilization into remaining percentages', () => {
    expect(remainingFromUsed(0)).toBe(100)
    expect(remainingFromUsed(43.6)).toBe(56)
    expect(remainingFromUsed(120)).toBe(0)
  })

  it('keeps at least one global window visible', () => {
    expect(validateSettings({
      showFiveHour: false,
      showWeekly: false,
      showFiveHourReset: false,
      showWeeklyReset: false,
      launchAtLogin: false,
    }).showWeekly).toBe(true)
  })

  it('formats both providers as remaining values for the tray', () => {
    const codex = emptyProvider('codex')
    codex.windows = [
      makeLimitWindow({ id: 'primary', durationMinutes: 300, usedPercent: 32 }),
      makeLimitWindow({ id: 'secondary', durationMinutes: 10_080, usedPercent: 61 }),
    ]
    const claude = emptyProvider('claude')
    claude.windows = [
      makeLimitWindow({ id: 'five_hour', durationMinutes: 300, usedPercent: 47 }),
      makeLimitWindow({ id: 'seven_day', durationMinutes: 10_080, usedPercent: 73 }),
    ]

    expect(formatTrayTitle({ codex, claude }, { showFiveHour: true, showWeekly: true, showFiveHourReset: false, showWeeklyReset: false }))
      .toBe('68/39 · 53/27')
    expect(formatTrayTitle({ codex, claude }, { showFiveHour: false, showWeekly: true, showFiveHourReset: false, showWeeklyReset: false }))
      .toBe('39 · 27')
    expect(formatProviderTrayTitle(codex, { showFiveHour: true, showWeekly: false, showFiveHourReset: false, showWeeklyReset: false })).toBe('68')
  })

  it('adds compact reset countdowns only when enabled', () => {
    const reset = new Date('2026-09-05T12:34:00Z').getTime()
    expect(formatResetRemaining(new Date(reset).toISOString(), new Date('2026-09-05T10:20:00Z').getTime())).toBe('2h14m')
    expect(formatResetRemaining(new Date(reset + 2 * 86_400_000 + 3 * 3_600_000 + 14 * 60_000).toISOString(), reset)).toBe('2d3h14m')
    const codex = emptyProvider('codex')
    codex.windows = [
      makeLimitWindow({ id: 'primary', durationMinutes: 300, usedPercent: 32, resetsAt: new Date(reset).toISOString() }),
      makeLimitWindow({ id: 'secondary', durationMinutes: 10_080, usedPercent: 61, resetsAt: new Date(reset + 2 * 86_400_000 + 3 * 3_600_000 + 14 * 60_000).toISOString() }),
    ]
    expect(formatProviderTrayTitle(codex, { showFiveHour: true, showWeekly: true, showFiveHourReset: true, showWeeklyReset: true })).toMatch(/^68 \d+[hm]/)
  })
})
