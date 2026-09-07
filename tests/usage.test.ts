import { describe, expect, it } from 'vitest'
import { emptyProvider, formatProviderTrayTitle, formatTrayTitle, makeLimitWindow, remainingFromUsed, validateSettings } from '../src/shared/usage'

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
      claudeSource: 'oauth',
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

    expect(formatTrayTitle({ codex, claude }, { showFiveHour: true, showWeekly: true }))
      .toBe('68/39 · 53/27')
    expect(formatTrayTitle({ codex, claude }, { showFiveHour: false, showWeekly: true }))
      .toBe('39 · 27')
    expect(formatProviderTrayTitle(codex, { showFiveHour: true, showWeekly: false })).toBe('68')
  })
})
