# Claude CLI authentication as the only Claude source

## Decision

LimitBar will use Claude Code's authenticated OAuth session as its only Claude
usage source. The app will call Claude Code's auth status command, read the
credential that Claude Code stores in macOS Keychain, and request subscription
usage from Anthropic's OAuth usage endpoint.

Claude Desktop may be installed and used normally, but LimitBar will not read
its UI, local history, or credentials. Claude Desktop does not replace the
required CLI authentication step.

## User-facing behavior

- The Settings view no longer offers Claude source selection.
- The Settings view offers independent global toggles for showing the 5-hour
  and weekly reset countdowns in the menu bar.
- The Claude card identifies the source as Claude Code OAuth.
- If Claude Code is missing, not signed in, using an API key, or cannot access
  its credential, the card shows an actionable error explaining the required
  `claude` command or Keychain approval.
- The README documents the prerequisite: install Claude Code, run `claude`,
  and sign in with a Claude.ai account before launching LimitBar.
- Claude Desktop does not need to be open, and no Accessibility permission is
  required by LimitBar.

## Implementation scope

1. Remove the Desktop history provider, Accessibility provider, and Local
   snapshot provider.
2. Simplify the shared contracts and persisted settings so `oauth` is the only
   Claude source and old persisted `claudeSource` values are ignored safely.
3. Make the coordinator call the Claude OAuth provider directly and remove
   source fallback/configuration code.
4. Remove the Claude source selector and Accessibility/Local copy from the
   renderer.
5. Update tests to cover the remaining OAuth parsing and the simplified
   settings surface; remove Desktop/Accessibility tests.
6. Rewrite the README's requirements and data-source sections around CLI
   authentication and the Anthropic usage API.

## Non-goals

- No Claude Desktop UI automation or Accessibility integration.
- No attempt to decrypt or reuse Claude Desktop's separate session.
- No local status-line snapshot fallback.
- No new browser companion or background helper.

## Compatibility and privacy

The app continues to hold the access token only in memory for the usage
request. It does not save the token or send it to a LimitBar service. Existing
cached provider percentages remain usable as stale data when a refresh fails,
but cached Desktop/Local source metadata will no longer select an alternate
provider.
