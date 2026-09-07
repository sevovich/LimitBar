import type { LimitWindow, ProviderSnapshot } from '../shared/contracts'
import { getWindow, remainingTone } from '../shared/usage'
import { DualGauge } from './DualGauge'

interface ProviderCardProps {
  provider: ProviderSnapshot
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function formatReset(timestamp: string | null): string {
  if (!timestamp) return 'Reset time unavailable'
  const date = new Date(timestamp)
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60_000)
  if (Math.abs(diffMinutes) < 60) return `Resets ${relativeTime.format(diffMinutes, 'minute')}`
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 36) return `Resets ${relativeTime.format(diffHours, 'hour')}`
  return `Resets ${relativeTime.format(Math.round(diffHours / 24), 'day')}`
}

function LimitRow({ window }: { window: LimitWindow | undefined }) {
  if (!window) {
    return (
      <div className="limit-row is-missing">
        <span className="limit-name">Unavailable</span>
        <span className="limit-value">—</span>
      </div>
    )
  }
  return (
    <div className="limit-row">
      <div>
        <div className="limit-name">{window.label}</div>
        <div className="limit-reset">{formatReset(window.resetsAt)}</div>
      </div>
      <div className={`limit-value tone-text-${remainingTone(window.remainingPercent)}`}>
        {window.remainingPercent}<span>%</span>
      </div>
    </div>
  )
}

function sourceName(provider: ProviderSnapshot): string {
  if (provider.source === 'app-server') return 'Codex account'
  if (provider.source === 'oauth') return 'Claude OAuth'
  if (provider.source === 'desktop') return 'Claude Desktop'
  return 'Claude local snapshot'
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const fiveHour = getWindow(provider, 'five-hour')
  const weekly = getWindow(provider, 'weekly')
  return (
    <section className={`provider provider-${provider.provider}`} aria-labelledby={`${provider.provider}-title`}>
      <header className="provider-header">
        <div className="provider-identity">
          <span className="provider-mark" aria-hidden="true">{provider.provider === 'codex' ? 'C' : 'A'}</span>
          <div>
            <h2 id={`${provider.provider}-title`}>{provider.displayName}</h2>
            <p>{provider.plan ? `${provider.plan} · ` : ''}{sourceName(provider)}</p>
          </div>
        </div>
        <span className={`status status-${provider.status}`}>{provider.status}</span>
      </header>

      {provider.windows.length > 0 ? (
        <div className="provider-body">
          <DualGauge
            provider={provider}
          />
          <div className="limit-list">
            <LimitRow window={fiveHour} />
            <LimitRow window={weekly} />
          </div>
        </div>
      ) : (
        <div className="provider-empty">
          <span className="empty-pulse" aria-hidden="true" />
          <p>{provider.error ?? 'Waiting for usage data…'}</p>
        </div>
      )}

      {provider.error && provider.windows.length > 0 && (
        <p className="provider-warning">Showing saved data · {provider.error}</p>
      )}
    </section>
  )
}
