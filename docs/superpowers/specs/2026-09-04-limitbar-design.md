# LimitBar Design

## Product goal

LimitBar is a small, self-built macOS menu-bar application for Apple Silicon Macs running macOS 14 or later. It shows the remaining subscription capacity for Codex and Claude Code without requiring the user to open either application.

The menu-bar label shows both providers at the same time. The tray icon uses green for Codex and orange for Claude; the title contains compact values such as `68/39 · 53/27`, where the values are remaining percentages for the five-hour and weekly windows in that order.

## First-release scope

- Show Codex and Claude Code simultaneously.
- Show remaining percentage rather than consumed percentage.
- Support five-hour and weekly windows when returned by a provider.
- Provide global `Show 5-hour limits` and `Show weekly limits` settings.
- Show all available windows, reset times, freshness, and provider errors in a click-opened popover.
- Refresh automatically every five minutes and on demand.
- Cache the last successful sanitized reading so temporary failures do not blank the UI.
- Offer Claude `OAuth — Recommended` and `Local snapshots` data modes.
- Build locally on Apple Silicon without an Apple Developer account.

The first release does not include notifications, auto-update, App Store distribution, Intel support, multi-account support, API billing dashboards, or providers other than Codex and Claude Code.

## Architecture

LimitBar uses Electron, React, and TypeScript.

The Electron main process owns the tray, popover window, child processes, credential access, network requests, polling, persistence, and typed IPC handlers. The renderer is sandboxed, uses context isolation, has Node integration disabled, and receives only sanitized usage snapshots and settings through a narrow preload API.

Provider-specific code implements a shared interface returning normalized snapshots:

- provider identifier and display name
- available limit windows
- remaining percentage
- reset timestamp and window duration
- observation timestamp
- freshness and error state

The presentation layer does not depend on provider response formats.

## Provider data flows

### Codex

The Codex adapter launches the locally installed `codex app-server` over stdio, initializes its JSON-RPC protocol, and calls `account/rateLimits/read`. Codex continues to own and refresh its ChatGPT authentication. LimitBar does not read or persist the Codex token.

The adapter accepts primary, secondary, and named limit buckets, normalizes them by duration, and listens for rate-limit update notifications when available. Because the app-server protocol is experimental, the adapter is isolated behind fixtures and contract tests.

### Claude OAuth

OAuth mode reads Claude Code's existing OAuth credential from its macOS-managed credential storage and calls Anthropic's usage endpoint at a conservative interval. The credential remains in memory only, is sent only to Anthropic, and is never written to logs, settings, IPC, cache, or the renderer. Claude Code remains responsible for login and token refresh.

This usage endpoint is not a stable public subscription API. LimitBar therefore treats response parsing as a versioned adapter, rate-limits requests to one per five minutes, backs off after HTTP 429, and keeps the last successful reading marked as stale during failures.

### Claude local snapshots

Local mode installs an opt-in status-line wrapper that receives Claude Code's sanitized `rate_limits` fields and writes only limit percentages, reset times, and observation time to a local snapshot. If the user already has a status-line command, LimitBar chains it rather than replacing it. Removing local mode restores the previous configuration.

Local snapshots update only while a compatible Claude Code terminal session is active. The UI makes that limitation explicit through its freshness indicator.

## User interface

The tray label uses monospaced digits and compact values. With both windows enabled, it renders `short/long · short/long`; if one window is disabled, each provider renders one number. The icon provides the provider color/order cue. Missing values render as an em dash and stale values keep their last number with a visible stale state in the popover. Window toggles apply to the menu bar title only; the popover always shows both windows.

Clicking the tray opens a compact, keyboard-accessible popover with one card per provider. Each card shows remaining percentage bars, human-readable reset times, last refresh time, source mode, and any actionable error. Remaining-capacity colors progress from green to amber to red as capacity falls.

Settings live in the same popover and include the two global visibility toggles, Claude data mode, refresh action, launch-at-login toggle, and quit action. At least one limit-window toggle must remain enabled.

## Persistence and security

Settings and sanitized snapshots are stored beneath Electron's per-user application-data directory. Credentials and raw provider responses are not persisted. Logs redact authorization headers and known token shapes. No analytics or third-party network services are included.

All renderer communication uses an explicit typed preload bridge. Shell commands are not assembled from renderer input. Executable discovery is restricted to known Codex and Claude Code locations plus validated absolute paths.

## Error handling

Each provider fails independently. A Codex failure does not hide Claude data and vice versa. Expected states include CLI missing, not authenticated, unsupported CLI version, permission denied, rate limited, provider unavailable, malformed response, and stale cache.

Errors shown to the user include a concise explanation and an actionable next step such as `Run codex login`, `Run claude`, `Update Claude Code`, or `Retry now`.

## Testing and release

Unit tests cover normalization, remaining-percentage conversion, window selection, title formatting, settings constraints, freshness, and redaction. Provider contract tests use captured redacted fixtures. Integration tests exercise JSON-RPC framing, process failures, mocked Keychain output, polling, cache behavior, and IPC validation. Renderer tests cover cards and settings states.

The repository ships a source-based installer that builds an arm64 application locally and copies it to `~/Applications`. GitHub Actions runs type checking, linting, tests, and a production build. Releases may attach unsigned arm64 artifacts with clear Gatekeeper guidance, but local source builds are the primary installation path.
