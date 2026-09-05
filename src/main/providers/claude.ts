import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ProviderSnapshot } from '../../shared/contracts'
import { makeLimitWindow, WEEKLY_MINUTES, FIVE_HOUR_MINUTES } from '../../shared/usage'
import { findExecutable, runProcess } from '../process'

const usageEndpoint = 'https://api.anthropic.com/api/oauth/usage'
const keychainService = 'Claude Code-credentials'

interface ClaudeAuth {
  loggedIn?: boolean
  authMethod?: string
  subscriptionType?: string
}

interface ClaudeUsageWindow {
  utilization?: number
  resets_at?: string
}

interface ClaudeUsagePayload {
  five_hour?: ClaudeUsageWindow
  seven_day?: ClaudeUsageWindow
  limits?: Array<{
    kind?: string
    percent?: number
    resets_at?: string | number
    scope?: { model?: { display_name?: string } }
  }>
}

export function parseClaudeCredentials(payload: string): string {
  const parsed = JSON.parse(payload) as {
    claudeAiOauth?: { accessToken?: string }
  }
  const token = parsed.claudeAiOauth?.accessToken
  if (!token) throw new Error("Claude's saved credentials contain no OAuth token.")
  return token
}

export function parseClaudeUsage(payload: unknown, now = new Date()): ProviderSnapshot {
  const data = payload as ClaudeUsagePayload
  const windows = [
    data.five_hour?.utilization == null
      ? null
      : makeLimitWindow({
          id: 'five_hour',
          durationMinutes: FIVE_HOUR_MINUTES,
          usedPercent: data.five_hour.utilization,
          resetsAt: data.five_hour.resets_at,
        }),
    data.seven_day?.utilization == null
      ? null
      : makeLimitWindow({
          id: 'seven_day',
          durationMinutes: WEEKLY_MINUTES,
          usedPercent: data.seven_day.utilization,
          resetsAt: data.seven_day.resets_at,
        }),
    ...(data.limits ?? []).flatMap((limit) => {
      const modelName = limit.scope?.model?.display_name
      if (limit.kind !== 'weekly_scoped' || limit.percent == null || !modelName) return []
      return [
        makeLimitWindow({
          id: `weekly_scoped_${modelName.toLowerCase()}`,
          durationMinutes: WEEKLY_MINUTES,
          usedPercent: limit.percent,
          resetsAt: limit.resets_at,
          modelName,
        }),
      ]
    }),
  ].filter((window): window is NonNullable<typeof window> => window !== null)

  if (windows.length === 0) throw new Error('Claude reported no subscription limits.')

  return {
    provider: 'claude',
    displayName: 'Claude',
    source: 'oauth',
    status: 'ready',
    plan: null,
    windows,
    updatedAt: now.toISOString(),
    error: null,
    retryAfter: null,
  }
}

export async function probeClaudeOAuth(): Promise<ProviderSnapshot> {
  const executable = await findExecutable('claude')
  if (!executable) return unavailable('Claude Code was not found. Install it and run `claude`.')

  try {
    const authResult = await runProcess(executable, ['auth', 'status', '--json'], {
      timeoutMs: 20_000,
    })
    const auth = JSON.parse(authResult.stdout) as ClaudeAuth
    if (authResult.exitCode !== 0 || !auth.loggedIn) {
      return unavailable('Claude Code is not signed in. Run `claude` to log in.')
    }
    if (auth.authMethod !== 'claude.ai') {
      return unavailable('Claude is using an API key, which has no subscription limit windows.')
    }

    const token = await readAccessToken()
    const response = await fetch(usageEndpoint, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: AbortSignal.timeout(20_000),
    })

    if (response.status === 401 || response.status === 403) {
      return unavailable("Claude's saved token was rejected. Run `claude` once to refresh it.")
    }
    if (response.status === 429) {
      const retryAfter = retryAfterDate(response.headers.get('retry-after'))
      return unavailable("Claude's usage endpoint is rate limiting.", retryAfter)
    }
    if (!response.ok) return unavailable(`Claude usage request failed (HTTP ${response.status}).`)

    const snapshot = parseClaudeUsage(await response.json())
    return { ...snapshot, plan: auth.subscriptionType ?? null }
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : 'Claude usage is unavailable.')
  }
}

async function readAccessToken(): Promise<string> {
  const result = await runProcess(
    '/usr/bin/security',
    ['find-generic-password', '-s', keychainService, '-w'],
    { timeoutMs: 20_000 },
  )
  if (result.exitCode === 0) {
    try {
      return parseClaudeCredentials(result.stdout)
    } catch {
      // Fall back to Claude Code's legacy credentials file.
    }
  }

  try {
    const legacy = await readFile(path.join(os.homedir(), '.claude/.credentials.json'), 'utf8')
    return parseClaudeCredentials(legacy)
  } catch {
    throw new Error(
      "Could not read Claude's credentials. Approve Keychain access or run `claude` again.",
    )
  }
}

function retryAfterDate(value: string | null): string | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds > 0) {
    return new Date(Date.now() + seconds * 1000).toISOString()
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function unavailable(message: string, retryAfter: string | null = null): ProviderSnapshot {
  return {
    provider: 'claude',
    displayName: 'Claude',
    source: 'oauth',
    status: 'unavailable',
    plan: null,
    windows: [],
    updatedAt: null,
    error: message,
    retryAfter,
  }
}
