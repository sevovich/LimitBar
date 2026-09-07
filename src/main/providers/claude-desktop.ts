import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ProviderSnapshot } from '../../shared/contracts'
import { FIVE_HOUR_MINUTES, makeLimitWindow, WEEKLY_MINUTES } from '../../shared/usage'

const historyPath = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Claude',
  'plan-usage-history.json',
)

interface DesktopSample {
  t?: number | string
  u?: {
    fh?: number
    sd?: number
  }
}

interface DesktopHistory {
  samples?: DesktopSample[]
}

export function parseClaudeDesktopUsage(
  payload: unknown,
  now = new Date(),
  staleAfterMs = 15 * 60 * 1000,
): ProviderSnapshot {
  const history = payload as DesktopHistory
  const sample = history.samples?.at(-1)
  if (!sample?.u || sample.t == null) throw new Error('Claude Desktop reported no usage history.')

  const observedAt = parseTimestamp(sample.t)
  if (!observedAt) throw new Error('Claude Desktop usage history has an invalid timestamp.')

  const windows = [
    sample.u.fh == null
      ? null
      : makeLimitWindow({
          id: 'five_hour',
          durationMinutes: FIVE_HOUR_MINUTES,
          usedPercent: sample.u.fh,
        }),
    sample.u.sd == null
      ? null
      : makeLimitWindow({
          id: 'seven_day',
          durationMinutes: WEEKLY_MINUTES,
          usedPercent: sample.u.sd,
        }),
  ].filter((window): window is NonNullable<typeof window> => window !== null)

  if (windows.length === 0) throw new Error('Claude Desktop reported no subscription limits.')

  const stale = now.getTime() - observedAt.getTime() > staleAfterMs
  return {
    provider: 'claude',
    displayName: 'Claude',
    source: 'desktop',
    status: stale ? 'stale' : 'ready',
    plan: null,
    windows,
    updatedAt: observedAt.toISOString(),
    error: stale
      ? 'Claude Desktop has not refreshed usage for more than 15 minutes. Open it to update the reading.'
      : null,
    retryAfter: null,
  }
}

export async function probeClaudeDesktop(): Promise<ProviderSnapshot> {
  try {
    return parseClaudeDesktopUsage(JSON.parse(await readFile(historyPath, 'utf8')))
  } catch (error) {
    return {
      provider: 'claude',
      displayName: 'Claude',
      source: 'desktop',
      status: 'unavailable',
      plan: null,
      windows: [],
      updatedAt: null,
      error:
        error instanceof SyntaxError
          ? "Claude Desktop's usage history could not be read."
          : 'No Claude Desktop usage yet. Open Claude Desktop and sign in once.',
      retryAfter: null,
    }
  }
}

function parseTimestamp(value: number | string): Date | null {
  const timestamp = typeof value === 'number' ? value : Number(value)
  const date = Number.isFinite(timestamp)
    ? new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp)
    : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
