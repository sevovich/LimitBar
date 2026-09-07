import type { ProviderSnapshot } from '../../shared/contracts'
import { FIVE_HOUR_MINUTES, makeLimitWindow, WEEKLY_MINUTES } from '../../shared/usage'
import { runProcess } from '../process'

const usageScript = String.raw`
using terms from application "System Events"
on collectText(theWindow)
  set values to {}
  tell application "System Events"
    repeat with itemRef in (entire contents of theWindow)
      try
        if (role of itemRef as text) is "AXStaticText" then
          set itemValue to value of itemRef as text
          if itemValue is not missing value then set end of values to itemValue
        end if
      end try
    end repeat
  end tell
  set AppleScript's text item delimiters to " "
  return values as text
end collectText
end using terms from

tell application "System Events"
  if not (exists process "Claude") then return ""
  tell process "Claude"
    if not (exists window 1) then return ""
    set currentText to my collectText(window 1)
    if currentText does not contain "Plan usage limits" then
      set candidates to entire contents of window 1
      repeat with candidate in candidates
        try
          if (role of candidate as text) is "AXButton" and (description of candidate as text) starts with "Usage:" then
            click candidate
            delay 0.4
            exit repeat
          end if
        end try
      end repeat
    end if
    return my collectText(window 1)
  end tell
end tell
`

export function parseClaudeAccessibilityUsage(
  text: string,
  now = new Date(),
): ProviderSnapshot {
  const fiveHour = matchUsage(text, /5-hour\s+limit[\s\S]{0,180}?(\d{1,3})%/i)
  const weeklyAll = matchUsage(text, /Weekly\s*[·•]\s*all\s+models[\s\S]{0,180}?(\d{1,3})%/i)
  const weeklyModel = [...text.matchAll(
    /Weekly\s*[·•]\s*([A-Za-z][A-Za-z0-9 _-]*?)\s+Resets[\s\S]{0,100}?(\d{1,3})%/gi,
  )].find((match) => match[1].trim().toLowerCase() !== 'all models')

  const windows = [
    fiveHour == null
      ? null
      : makeLimitWindow({
          id: 'five_hour',
          durationMinutes: FIVE_HOUR_MINUTES,
          usedPercent: fiveHour,
          resetsAt: relativeReset(text, /5-hour\s+limit[\s\S]{0,120}?Resets in\s+(\d+)\s+min/i, now),
        }),
    weeklyAll == null
      ? null
      : makeLimitWindow({
          id: 'seven_day',
          durationMinutes: WEEKLY_MINUTES,
          usedPercent: weeklyAll,
        }),
    weeklyModel == null || weeklyModel[1].toLowerCase() === 'all models'
      ? null
      : makeLimitWindow({
          id: `weekly_scoped_${weeklyModel[1].toLowerCase()}`,
          durationMinutes: WEEKLY_MINUTES,
          usedPercent: Number(weeklyModel[2]),
          modelName: weeklyModel[1].trim(),
        }),
  ].filter((window): window is NonNullable<typeof window> => window !== null)

  if (windows.length === 0) throw new Error('Claude Desktop usage panel was not available.')

  return {
    provider: 'claude',
    displayName: 'Claude',
    source: 'desktop',
    status: 'ready',
    plan: findPlan(text),
    windows,
    updatedAt: now.toISOString(),
    error: null,
    retryAfter: null,
  }
}

export async function probeClaudeAccessibility(): Promise<ProviderSnapshot> {
  try {
    const result = await runProcess('/usr/bin/osascript', ['-e', usageScript], { timeoutMs: 10_000 })
    if (result.exitCode !== 0) {
      return unavailable(accessibilityError(result.stderr))
    }
    return parseClaudeAccessibilityUsage(result.stdout)
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : 'Claude Desktop usage is unavailable.')
  }
}

function matchUsage(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function relativeReset(text: string, pattern: RegExp, now: Date): string | null {
  const match = text.match(pattern)
  if (!match) return null
  const minutes = Number(match[1])
  return Number.isFinite(minutes) ? new Date(now.getTime() + minutes * 60_000).toISOString() : null
}

function findPlan(text: string): string | null {
  const match = text.match(/Plan\s+usage\s+limits\s*[·•]\s*([^\n]+)/i)
  return match?.[1]?.trim() || null
}

function accessibilityError(stderr: string): string {
  if (/assisted access|assisterad tillgång|not allowed|not permitted|-25211/i.test(stderr)) {
    return 'Allow /usr/bin/osascript in System Settings → Privacy & Security → Accessibility, then restart LimitBar.'
  }
  return stderr.trim() || 'Claude Desktop usage is unavailable.'
}

function unavailable(message: string): ProviderSnapshot {
  return {
    provider: 'claude',
    displayName: 'Claude',
    source: 'desktop',
    status: 'unavailable',
    plan: null,
    windows: [],
    updatedAt: null,
    error: message,
    retryAfter: null,
  }
}
