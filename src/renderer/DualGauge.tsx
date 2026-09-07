import type { LimitWindow, ProviderSnapshot } from '../shared/contracts'
import { getWindow, remainingTone } from '../shared/usage'

interface DualGaugeProps {
  provider: ProviderSnapshot
}

function Ring({
  window,
  radius,
  className,
}: {
  window: LimitWindow | undefined
  radius: number
  className: string
}) {
  const circumference = 2 * Math.PI * radius
  const remaining = window?.remainingPercent ?? 0
  const dashOffset = circumference * (1 - remaining / 100)

  return (
    <circle
      className={`gauge-value ${className} tone-${remainingTone(remaining)}`}
      cx="48"
      cy="48"
      r={radius}
      strokeDasharray={circumference}
      strokeDashoffset={window ? dashOffset : circumference}
    />
  )
}

export function DualGauge({ provider }: DualGaugeProps) {
  const fiveHour = getWindow(provider, 'five-hour')
  const weekly = getWindow(provider, 'weekly')
  const primary = fiveHour ?? weekly

  return (
    <div className="gauge" aria-label={`${provider.displayName} ${primary?.remainingPercent ?? 0}% remaining`}>
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <circle className="gauge-track gauge-track-outer" cx="48" cy="48" r="41" />
        <Ring window={weekly} radius={41} className="gauge-outer" />
        <circle className="gauge-track gauge-track-inner" cx="48" cy="48" r="32" />
        <Ring window={fiveHour} radius={32} className="gauge-inner" />
      </svg>
      <div className="gauge-center">
        <span className="gauge-number">{primary?.remainingPercent ?? '—'}</span>
        <span className="gauge-unit">% left</span>
      </div>
    </div>
  )
}
