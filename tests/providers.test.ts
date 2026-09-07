import { describe, expect, it } from 'vitest'
import { parseClaudeCredentials, parseClaudeUsage } from '../src/main/providers/claude'
import { parseClaudeDesktopUsage } from '../src/main/providers/claude-desktop'
import { parseClaudeAccessibilityUsage } from '../src/main/providers/claude-accessibility'
import { parseCodexResponse } from '../src/main/providers/codex'

describe('Codex response parsing', () => {
  it('reads the named Codex bucket and returns remaining percentages', () => {
    const snapshot = parseCodexResponse({
      result: {
        rateLimitsByLimitId: {
          codex: {
            planType: 'plus',
            primary: { usedPercent: 14, windowDurationMins: 300, resetsAt: 1_800_000_000 },
            secondary: { usedPercent: 74, windowDurationMins: 10_080, resetsAt: 1_800_100_000 },
          },
        },
      },
    }, new Date('2026-09-05T10:00:00Z'))

    expect(snapshot.plan).toBe('plus')
    expect(snapshot.windows.map((window) => window.remainingPercent)).toEqual([86, 26])
    expect(snapshot.windows.map((window) => window.kind)).toEqual(['five-hour', 'weekly'])
  })
})

describe('Claude response parsing', () => {
  it('reads OAuth subscription windows and model-scoped weekly limits', () => {
    const snapshot = parseClaudeUsage({
      five_hour: { utilization: 22, resets_at: '2026-09-05T12:00:00Z' },
      seven_day: { utilization: 40, resets_at: '2026-09-08T12:00:00Z' },
      limits: [{
        kind: 'weekly_scoped',
        percent: 70,
        resets_at: '2026-09-09T12:00:00Z',
        scope: { model: { display_name: 'Sonnet' } },
      }],
    })

    expect(snapshot.windows.map((window) => window.remainingPercent)).toEqual([78, 60, 30])
    expect(snapshot.windows[2]?.label).toBe('Sonnet weekly')
  })

  it('extracts only the OAuth access token', () => {
    expect(parseClaudeCredentials(JSON.stringify({
      claudeAiOauth: { accessToken: 'secret-token', refreshToken: 'not-used' },
    }))).toBe('secret-token')
  })

  it('reads Claude Desktop history as remaining percentages', () => {
    const snapshot = parseClaudeDesktopUsage({
      version: 2,
      samples: [{
        t: '2026-09-05T10:00:00Z',
        u: { fh: 22, sd: 40 },
      }],
    }, new Date('2026-09-05T10:10:00Z'))

    expect(snapshot.source).toBe('desktop')
    expect(snapshot.status).toBe('ready')
    expect(snapshot.windows.map((window) => window.remainingPercent)).toEqual([78, 60])
  })

  it('does not present old Claude Desktop history as current data', () => {
    const snapshot = parseClaudeDesktopUsage({
      samples: [{ t: '2026-09-05T08:00:00Z', u: { fh: 22, sd: 40 } }],
    }, new Date('2026-09-05T10:00:00Z'))

    expect(snapshot.status).toBe('unavailable')
    expect(snapshot.windows).toHaveLength(0)
    expect(snapshot.updatedAt).toBe('2026-09-05T08:00:00.000Z')
  })

  it('reads current Claude Desktop usage text through Accessibility', () => {
    const snapshot = parseClaudeAccessibilityUsage(`
      Usage Context window 233.3k / 1M (23%)
      Plan usage limits · Max (5x)
      5-hour limit Resets in 39 min 100%
      Weekly · all models Resets Mon 12:00 AM 14%
      Weekly · Fable Resets Mon 12:00 AM 18%
    `, new Date('2026-09-07T10:00:00Z'))

    expect(snapshot.status).toBe('ready')
    expect(snapshot.plan).toBe('Max (5x)')
    expect(snapshot.windows.map((window) => window.remainingPercent)).toEqual([0, 86, 82])
    expect(snapshot.windows[0]?.resetsAt).toBe('2026-09-07T10:39:00.000Z')
  })
})
