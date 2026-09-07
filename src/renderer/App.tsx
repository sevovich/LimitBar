import { useEffect, useState } from 'react'
import type { AppState, SettingsPatch } from '../shared/contracts'
import { demoState } from './demo-state'
import { ProviderCard } from './ProviderCard'

const isPreview = typeof window.limitBar === 'undefined'

function lastUpdated(state: AppState): string {
  const timestamps = Object.values(state.providers)
    .map((provider) => provider.updatedAt)
    .filter((value): value is string => Boolean(value))
  if (timestamps.length === 0) return 'Not updated yet'
  const latest = Math.max(...timestamps.map((value) => new Date(value).getTime()))
  const seconds = Math.max(0, Math.round((Date.now() - latest) / 1000))
  if (seconds < 10) return 'Updated just now'
  if (seconds < 60) return `Updated ${seconds}s ago`
  return `Updated ${Math.round(seconds / 60)}m ago`
}

export function App() {
  const [state, setState] = useState<AppState | null>(isPreview ? demoState : null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (isPreview) return
    let active = true
    void window.limitBar.getState().then((next) => active && setState(next))
    const unsubscribe = window.limitBar.subscribe((next) => active && setState(next))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  async function updateSettings(patch: SettingsPatch) {
    if (isPreview) {
      setState((current) => current && ({
        ...current,
        settings: { ...current.settings, ...patch },
      }))
      return
    }
    setState(await window.limitBar.updateSettings(patch))
  }

  async function refresh() {
    if (isPreview) return
    setState(await window.limitBar.refresh())
  }

  function toggleSettings() {
    const open = !settingsOpen
    setSettingsOpen(open)
    if (!isPreview) window.limitBar.setSettingsOpen(open)
  }

  if (!state) {
    return <main className="shell loading-shell" aria-label="Loading LimitBar"><div className="loader" /></main>
  }

  return (
    <main className="shell">
      <header className="app-header">
        <div>
          <h1>LimitBar</h1>
          <p>{lastUpdated(state)}</p>
        </div>
        <button
          className={`icon-button refresh-button${state.refreshing ? ' is-spinning' : ''}`}
          aria-label="Refresh usage"
          title="Refresh usage"
          disabled={state.refreshing}
          onClick={() => void refresh()}
        >
          ↻
        </button>
      </header>

      <div className="providers">
        <ProviderCard provider={state.providers.codex} />
        <ProviderCard provider={state.providers.claude} />
      </div>

      <section className={`settings${settingsOpen ? ' is-open' : ''}`}>
        <button className="settings-trigger" onClick={toggleSettings} aria-expanded={settingsOpen}>
          <span>Settings</span>
          <span className="chevron" aria-hidden="true">⌄</span>
        </button>
        {settingsOpen && (
          <div className="settings-content">
            <fieldset>
              <legend>Menu bar values only</legend>
              <label className="switch-row">
                <span><strong>Show 5-hour limits</strong><small>Short usage window</small></span>
                <input type="checkbox" checked={state.settings.showFiveHour} onChange={(event) => void updateSettings({ showFiveHour: event.target.checked })} />
                <i aria-hidden="true" />
              </label>
              <label className="switch-row">
                <span><strong>Show weekly limits</strong><small>Long usage window</small></span>
                <input type="checkbox" checked={state.settings.showWeekly} onChange={(event) => void updateSettings({ showWeekly: event.target.checked })} />
                <i aria-hidden="true" />
              </label>
            </fieldset>

            <fieldset>
              <legend>Claude data source</legend>
              <div className="segmented" role="radiogroup" aria-label="Claude data source">
                <label><input type="radio" name="claude-source" checked={state.settings.claudeSource === 'oauth'} onChange={() => void updateSettings({ claudeSource: 'oauth' })} /><span>OAuth</span></label>
                <label><input type="radio" name="claude-source" checked={state.settings.claudeSource === 'desktop'} onChange={() => void updateSettings({ claudeSource: 'desktop' })} /><span>Desktop</span></label>
                <label><input type="radio" name="claude-source" checked={state.settings.claudeSource === 'local'} onChange={() => void updateSettings({ claudeSource: 'local' })} /><span>Local</span></label>
              </div>
              <p className="source-note">Desktop reads Claude’s local usage history. If OAuth or Local has no data, LimitBar falls back to Desktop. Tokens are never stored.</p>
            </fieldset>

            <label className="switch-row standalone">
              <span><strong>Launch at login</strong><small>Keep limits one click away</small></span>
              <input type="checkbox" checked={state.settings.launchAtLogin} onChange={(event) => void updateSettings({ launchAtLogin: event.target.checked })} />
              <i aria-hidden="true" />
            </label>

            {!isPreview && <button className="quit-button" onClick={() => window.limitBar.quit()}>Quit LimitBar</button>}
          </div>
        )}
      </section>
    </main>
  )
}
