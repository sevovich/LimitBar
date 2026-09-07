# LimitBar

LimitBar is a small, local-first macOS menu-bar app that shows how much of your Codex and Claude subscription limits remains.

`68/39 · 53/27` means Codex has 68% of its 5-hour allowance and 39% of its weekly allowance left; Claude has 53% and 27% left. The tray icon uses green for Codex and orange for Claude, in that order.

## What it does

- Shows Codex and Claude together in the macOS menu bar.
- Displays **remaining** percentages for 5-hour and weekly windows.
- Lets you choose which windows appear in the menu bar; the popover always keeps both windows available.
- Reads Codex limits through the locally installed Codex CLI.
- Uses Claude Code's existing OAuth sign-in by default, with an optional local snapshot mode.
- Refreshes every five minutes and keeps the last successful reading when a provider is temporarily unavailable.
- Stores no access tokens. Cached usage data and settings stay on your Mac.

## Requirements

- Apple Silicon Mac
- macOS 14 or newer
- Node.js 22 or newer
- Codex CLI installed and signed in
- Claude Code installed and signed in (for Claude limits)

## Build and run

```bash
git clone git@github.com:sevovich/LimitBar.git
cd LimitBar
npm install
npm run dev
```

`npm run dev` builds the app and opens it as a menu-bar process. There is no Dock icon.

To create an unsigned Apple Silicon app bundle:

```bash
npm run package:dir
```

The result is written to `release/mac-arm64/LimitBar.app`. To build and copy it into `~/Applications`:

```bash
npm run install:local
```

Because the app is unsigned, macOS may block the first launch. Right-click **LimitBar.app**, choose **Open**, then confirm. Friends building it from source can follow the same process; an Apple Developer account is not required.

## Data sources

### Codex

LimitBar starts `codex app-server` locally and asks it for the signed-in account's current rate-limit windows. It never reads or stores the Codex access token.

### Claude — OAuth (default)

LimitBar checks `claude auth status`, then reads Claude Code's existing credential from macOS Keychain and calls Anthropic's usage endpoint. macOS may ask you to approve Keychain access on first use. The token is held only in memory for that request.

### Claude — local snapshot

This option installs a small status-line helper into Claude Code's settings. Claude Code writes its limit data to `~/.limitbar/claude-usage.json`; LimitBar only reads that file. An existing Claude status-line command is preserved and chained, then restored if you switch back to OAuth.

Local snapshots require a Claude Code version that includes `rate_limits` in status-line input. If no snapshot exists, open Claude Code and send a message once.

## Development

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The renderer is React and TypeScript; Electron owns the macOS tray, local process calls, Keychain access, caching, and login-item setting. Context isolation and renderer sandboxing remain enabled.

## Privacy and caveats

- No telemetry and no remote LimitBar service.
- Only sanitized percentages, reset times, settings, and provider status are cached.
- Provider endpoints and local CLI response formats are not public compatibility promises and may change.
- This project is unofficial and is not affiliated with OpenAI or Anthropic.

## License

MIT
