# LimitBar Implementation Plan

1. Scaffold a strict Electron, React, Vite, and TypeScript project for macOS arm64, with separate main, preload, renderer, and shared packages.
2. Add the normalized usage domain model, settings schema, cache schema, validation, remaining-percentage helpers, title formatter, and unit tests.
3. Build a secure Electron shell with a tray title, frameless popover, typed preload bridge, isolated renderer, settings persistence, polling coordinator, and independent provider state.
4. Implement the Codex app-server JSON-RPC client and rate-limit adapter with mocked process fixtures and actionable error mapping.
5. Implement Claude OAuth credential discovery and usage fetching with redaction, timeout, conservative polling, 429 backoff, and response fixtures.
6. Implement the optional Claude status-line snapshot source with reversible configuration chaining and stale-data handling.
7. Build the React popover with provider cards, remaining-capacity bars, reset times, freshness, errors, global five-hour/weekly toggles, Claude source selection, refresh, launch-at-login, and quit.
8. Add accessible keyboard behavior, light/dark appearance, compact menu-bar formatting, and resilient popover positioning.
9. Add an arm64 local build/install script, project documentation, privacy and security notes, troubleshooting, and an MIT license.
10. Run formatting, linting, type checking, unit tests, integration tests, production packaging, and a local smoke test before pushing the verified main branch to `git@github.com:sevovich/LimitBar.git`.
