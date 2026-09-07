export type ProviderId = 'codex' | 'claude'
export type ProviderSource = 'app-server' | 'oauth'
export type ProviderStatus = 'loading' | 'ready' | 'stale' | 'unavailable'
export type LimitKind = 'five-hour' | 'weekly' | 'other'

export interface LimitWindow {
  id: string
  kind: LimitKind
  label: string
  durationMinutes: number | null
  remainingPercent: number
  resetsAt: string | null
  modelName: string | null
}

export interface ProviderSnapshot {
  provider: ProviderId
  displayName: string
  source: ProviderSource
  status: ProviderStatus
  plan: string | null
  windows: LimitWindow[]
  updatedAt: string | null
  error: string | null
  retryAfter: string | null
}

export interface AppSettings {
  showFiveHour: boolean
  showWeekly: boolean
  showFiveHourReset: boolean
  showWeeklyReset: boolean
  launchAtLogin: boolean
}

export interface AppState {
  providers: Record<ProviderId, ProviderSnapshot>
  settings: AppSettings
  refreshing: boolean
  nextRefreshAt: string | null
}

export interface SettingsPatch {
  showFiveHour?: boolean
  showWeekly?: boolean
  showFiveHourReset?: boolean
  showWeeklyReset?: boolean
  launchAtLogin?: boolean
}

export interface LimitBarApi {
  getState(): Promise<AppState>
  refresh(): Promise<AppState>
  updateSettings(patch: SettingsPatch): Promise<AppState>
  subscribe(listener: (state: AppState) => void): () => void
  setSettingsOpen(open: boolean): void
  quit(): void
}

declare global {
  interface Window {
    limitBar: LimitBarApi
  }
}
