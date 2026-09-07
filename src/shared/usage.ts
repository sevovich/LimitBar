import type {
  AppSettings,
  LimitKind,
  LimitWindow,
  ProviderId,
  ProviderSnapshot,
} from './contracts'

export const FIVE_HOUR_MINUTES = 5 * 60
export const WEEKLY_MINUTES = 7 * 24 * 60

export const DEFAULT_SETTINGS: AppSettings = {
  showFiveHour: true,
  showWeekly: true,
  claudeSource: 'oauth',
  launchAtLogin: false,
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function remainingFromUsed(usedPercent: number): number {
  return clampPercent(100 - usedPercent)
}

export function limitKind(durationMinutes: number | null, id = ''): LimitKind {
  if (durationMinutes === FIVE_HOUR_MINUTES || /five.?hour/i.test(id)) return 'five-hour'
  if (durationMinutes === WEEKLY_MINUTES || /seven.?day|week/i.test(id)) return 'weekly'
  return 'other'
}

export function makeLimitWindow(input: {
  id: string
  durationMinutes: number | null
  usedPercent: number
  resetsAt?: string | number | null
  modelName?: string | null
}): LimitWindow {
  const kind = limitKind(input.durationMinutes, input.id)
  return {
    id: input.id,
    kind,
    label:
      kind === 'five-hour'
        ? '5-hour'
        : kind === 'weekly'
          ? input.modelName
            ? `${input.modelName} weekly`
            : 'Weekly'
          : 'Limit',
    durationMinutes: input.durationMinutes,
    remainingPercent: remainingFromUsed(input.usedPercent),
    resetsAt: normalizeTimestamp(input.resetsAt),
    modelName: input.modelName ?? null,
  }
}

function normalizeTimestamp(value: string | number | null | undefined): string | null {
  if (value == null) return null
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function emptyProvider(provider: ProviderId): ProviderSnapshot {
  return {
    provider,
    displayName: provider === 'codex' ? 'Codex' : 'Claude',
    source: provider === 'codex' ? 'app-server' : 'oauth',
    status: 'loading',
    plan: null,
    windows: [],
    updatedAt: null,
    error: null,
    retryAfter: null,
  }
}

export function validateSettings(settings: AppSettings): AppSettings {
  if (!settings.showFiveHour && !settings.showWeekly) {
    return { ...settings, showWeekly: true }
  }
  return settings
}

export function getWindow(
  snapshot: ProviderSnapshot,
  kind: 'five-hour' | 'weekly',
): LimitWindow | undefined {
  const exact = snapshot.windows.find((window) => window.kind === kind && !window.modelName)
  return exact ?? snapshot.windows.find((window) => window.kind === kind)
}

export function formatTrayTitle(
  providers: Record<ProviderId, ProviderSnapshot>,
  settings: Pick<AppSettings, 'showFiveHour' | 'showWeekly'>,
): string {
  return (['codex', 'claude'] as const)
    .map((provider) => {
      const snapshot = providers[provider]
      const values: string[] = []
      if (settings.showFiveHour) {
        values.push(getWindow(snapshot, 'five-hour')?.remainingPercent.toString() ?? '—')
      }
      if (settings.showWeekly) {
        values.push(getWindow(snapshot, 'weekly')?.remainingPercent.toString() ?? '—')
      }
      return values.join('/')
    })
    .join(' · ')
}

export function remainingTone(remaining: number): 'safe' | 'watch' | 'critical' {
  if (remaining <= 10) return 'critical'
  if (remaining <= 25) return 'watch'
  return 'safe'
}
