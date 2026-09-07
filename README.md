# LimitBar

LimitBar is a small, local-first macOS menu-bar app that shows how much of your Codex and Claude subscription limits remains.

The menu bar shows one LimitBar item with colored provider markers. A green Codex marker and an orange Claude marker might read `🟢 68/39   🟠 53/27`; those are the remaining percentages for the 5-hour and weekly windows.

Reset countdowns are optional per window and use compact `d`, `h`, and `m` units, for example `🟢 68 2h14m/39 2d3h14m`.

## What it does

- Shows Codex and Claude together in the macOS menu bar.
- Displays **remaining** percentages for 5-hour and weekly windows.
- Lets you choose which windows and compact reset countdowns appear in the menu bar; the popover always keeps both windows available.
- Reads Codex limits through the locally installed Codex CLI.
- Uses Claude Code's existing OAuth sign-in and Anthropic's usage API for Claude limits.
- Refreshes every five minutes and keeps the last successful reading when a provider is temporarily unavailable.
- Uses a macOS single-instance lock so launching it twice cannot create duplicate menu items.
- Stores no access tokens. Cached usage data and settings stay on your Mac.

## Requirements

- Apple Silicon Mac
- macOS 14 or newer
- Node.js 22 or newer
- Codex CLI installed and signed in
- Claude Code installed and signed in with a Claude.ai account (for Claude limits)

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

### Claude — Claude Code OAuth

Claude Code authentication is required. Install Claude Code, run `claude`, and complete the Claude.ai sign-in flow before starting LimitBar. LimitBar checks `claude auth status`, then reads Claude Code's existing credential from macOS Keychain and calls Anthropic's usage endpoint. macOS may ask you to approve Keychain access on first use. The token is held only in memory for that request.

Using Claude Desktop does not replace this step. Claude Desktop can be installed, open, or closed; LimitBar does not inspect its UI, local files, credentials, or Accessibility tree.

If Claude Code is missing, not signed in, using an API key, or blocked from reading its Keychain credential, the Claude card explains the required action. API-key authentication does not expose Claude subscription limit windows.

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
