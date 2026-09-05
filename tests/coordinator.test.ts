import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextRefreshTime } from '../src/main/coordinator'
import { emptyProvider } from '../src/shared/usage'

afterEach(() => vi.useRealTimers())

describe('refresh scheduling', () => {
  it('honors a provider retry-after later than the normal five-minute poll', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-05T10:00:00Z'))
    const codex = emptyProvider('codex')
    const claude = emptyProvider('claude')
    claude.retryAfter = '2026-09-05T10:12:00Z'

    expect(nextRefreshTime({ codex, claude }).toISOString()).toBe('2026-09-05T10:12:00.000Z')
  })
})
