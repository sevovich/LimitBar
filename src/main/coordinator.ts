import type {
  AppState,
  ProviderSnapshot,
  SettingsPatch,
} from '../shared/contracts'
import { validateSettings } from '../shared/usage'
import { probeClaudeOAuth } from './providers/claude'
import { probeCodex } from './providers/codex'
import { StateStore } from './store'

const refreshIntervalMs = 5 * 60 * 1000

export class UsageCoordinator {
  private state!: AppState
  private timer: NodeJS.Timeout | null = null
  private listeners = new Set<(state: AppState) => void>()

  constructor(
    private readonly store: StateStore,
    private readonly onLaunchAtLogin: (enabled: boolean) => void,
  ) {}

  async start(): Promise<void> {
    const persisted = await this.store.load()
    this.state = {
      providers: StateStore.hydrateProviders(persisted.providers),
      settings: persisted.settings,
      refreshing: false,
      nextRefreshAt: null,
    }
    this.onLaunchAtLogin(this.state.settings.launchAtLogin)
    this.emit()
    await this.refresh()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  getState(): AppState {
    return structuredClone(this.state)
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener)
    if (this.state) listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  async refresh(): Promise<AppState> {
    if (this.state.refreshing) return this.getState()
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.state = { ...this.state, refreshing: true }
    this.emit()

    const [codex, claude] = await Promise.all([
      probeCodex(),
      probeClaudeOAuth(),
    ])
    const providers = {
      codex: mergeWithCache(codex, this.state.providers.codex),
      claude: mergeWithCache(claude, this.state.providers.claude),
    }
    const nextRefreshAt = nextRefreshTime(providers)
    this.state = {
      ...this.state,
      providers,
      refreshing: false,
      nextRefreshAt: nextRefreshAt.toISOString(),
    }
    await this.store.save(this.state.settings, providers)
    this.emit()
    this.timer = setTimeout(() => void this.refresh(), nextRefreshAt.getTime() - Date.now())
    return this.getState()
  }

  async updateSettings(patch: SettingsPatch): Promise<AppState> {
    const previous = this.state.settings
    const settings = validateSettings({ ...previous, ...patch })
    if (settings.launchAtLogin !== previous.launchAtLogin) {
      this.onLaunchAtLogin(settings.launchAtLogin)
    }
    this.state = { ...this.state, settings }
    await this.store.save(settings, this.state.providers)
    this.emit()
    return this.refresh()
  }

  private emit(): void {
    const snapshot = this.getState()
    for (const listener of this.listeners) listener(snapshot)
  }
}

export function nextRefreshTime(providers: AppState['providers']): Date {
  const regular = Date.now() + refreshIntervalMs
  const retryTimes = Object.values(providers)
    .map((provider) => provider.retryAfter ? new Date(provider.retryAfter).getTime() : 0)
    .filter((value) => Number.isFinite(value) && value > Date.now())
  return new Date(Math.max(regular, ...retryTimes))
}

function mergeWithCache(
  fresh: ProviderSnapshot,
  cached: ProviderSnapshot,
): ProviderSnapshot {
  if (fresh.status !== 'unavailable' || cached.windows.length === 0) return fresh
  return {
    ...cached,
    source: fresh.source,
    status: 'stale',
    error: fresh.error,
    retryAfter: fresh.retryAfter,
  }
}

export function assertSettingsPatch(value: unknown): SettingsPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid settings update.')
  }
  const input = value as Record<string, unknown>
  const allowed = new Set(['showFiveHour', 'showWeekly', 'showFiveHourReset', 'showWeeklyReset', 'launchAtLogin'])
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error('Unknown setting.')
  if (
    ['showFiveHour', 'showWeekly', 'showFiveHourReset', 'showWeeklyReset', 'launchAtLogin'].some(
      (key) => key in input && typeof input[key] !== 'boolean',
    )
  ) {
    throw new Error('Invalid boolean setting.')
  }
  return input as SettingsPatch
}
