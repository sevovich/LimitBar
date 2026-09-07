import type {
  AppState,
  ProviderSnapshot,
  SettingsPatch,
} from '../shared/contracts'
import { validateSettings } from '../shared/usage'
import { configureClaudeLocalSnapshots, probeClaudeLocal } from './providers/claude-local'
import { probeClaudeDesktop } from './providers/claude-desktop'
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
      probeClaudeWithFallback(this.state.settings.claudeSource),
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
    if (settings.claudeSource !== previous.claudeSource) {
      await configureClaudeLocalSnapshots(settings.claudeSource === 'local')
      this.state.providers.claude = {
        ...this.state.providers.claude,
        source: settings.claudeSource,
      }
    }
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

async function probeClaudeWithFallback(source: AppState['settings']['claudeSource']): Promise<ProviderSnapshot> {
  const primary = source === 'local'
    ? await probeClaudeLocal()
    : source === 'desktop'
      ? await probeClaudeDesktop()
      : await probeClaudeOAuth()

  if (primary.status !== 'unavailable' || source === 'desktop') return primary
  const desktop = await probeClaudeDesktop()
  return desktop.status === 'unavailable' ? primary : desktop
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
  const allowed = new Set(['showFiveHour', 'showWeekly', 'claudeSource', 'launchAtLogin'])
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error('Unknown setting.')
  if (
    ['showFiveHour', 'showWeekly', 'launchAtLogin'].some(
      (key) => key in input && typeof input[key] !== 'boolean',
    )
  ) {
    throw new Error('Invalid boolean setting.')
  }
  if (
    'claudeSource' in input &&
    input.claudeSource !== 'oauth' &&
    input.claudeSource !== 'desktop' &&
    input.claudeSource !== 'local'
  ) {
    throw new Error('Invalid Claude source.')
  }
  return input as SettingsPatch
}
