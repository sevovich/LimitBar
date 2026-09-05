import type { ProviderSnapshot } from '../../shared/contracts'
import { makeLimitWindow } from '../../shared/usage'
import { findExecutable, runJsonLineProtocol } from '../process'

interface CodexWindow {
  usedPercent?: number
  windowDurationMins?: number | null
  resetsAt?: number | null
}

interface CodexSnapshot {
  planType?: string | null
  primary?: CodexWindow | null
  secondary?: CodexWindow | null
}

interface CodexResponse {
  result?: {
    rateLimits?: CodexSnapshot | null
    rateLimitsByLimitId?: Record<string, CodexSnapshot> | null
  }
  error?: { message?: string }
}

const requestId = 2

export function parseCodexResponse(payload: unknown, now = new Date()): ProviderSnapshot {
  const response = payload as CodexResponse
  if (response?.error) {
    throw new Error(response.error.message || 'Codex refused the usage request.')
  }

  const snapshots = response?.result?.rateLimitsByLimitId
  const snapshot = snapshots?.codex ?? response?.result?.rateLimits ?? Object.values(snapshots ?? {})[0]
  if (!snapshot) throw new Error('Codex returned no usage data. Run `codex` once.')

  const windows = [
    ['primary', snapshot.primary] as const,
    ['secondary', snapshot.secondary] as const,
  ].flatMap(([id, window]) => {
    if (!window || typeof window.usedPercent !== 'number') return []
    return [
      makeLimitWindow({
        id,
        durationMinutes: window.windowDurationMins ?? null,
        usedPercent: window.usedPercent,
        resetsAt: window.resetsAt,
      }),
    ]
  })

  if (windows.length === 0) throw new Error('Codex reported no active limit windows.')

  return {
    provider: 'codex',
    displayName: 'Codex',
    source: 'app-server',
    status: 'ready',
    plan: snapshot.planType ?? null,
    windows,
    updatedAt: now.toISOString(),
    error: null,
    retryAfter: null,
  }
}

export async function probeCodex(): Promise<ProviderSnapshot> {
  const executable = await findExecutable('codex')
  if (!executable) return unavailable('Codex CLI was not found. Install it and run `codex login`.')

  try {
    const response = await runJsonLineProtocol(
      executable,
      ['app-server'],
      [
        JSON.stringify({
          id: 1,
          method: 'initialize',
          params: { clientInfo: { name: 'limitbar', version: '0.1.0' } },
        }),
        JSON.stringify({ method: 'initialized', params: {} }),
        JSON.stringify({ id: requestId, method: 'account/rateLimits/read', params: {} }),
      ],
      requestId,
    )
    return parseCodexResponse(response)
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : 'Codex usage is unavailable.')
  }
}

function unavailable(message: string): ProviderSnapshot {
  return {
    provider: 'codex',
    displayName: 'Codex',
    source: 'app-server',
    status: 'unavailable',
    plan: null,
    windows: [],
    updatedAt: null,
    error: message,
    retryAfter: null,
  }
}
