# Packaged renderer asset fix

## Problem

Vite currently emits renderer asset URLs rooted at `/assets`. The development server resolves those URLs, but Electron loads the packaged renderer with `file://`. In that context `/assets` points at the filesystem root, so the JavaScript and stylesheet fail to load and the popover is blank.

## Design

Configure Vite with a relative base so packaged HTML refers to `./assets`. Add a build-output check that fails when the renderer entry HTML contains root-relative script or stylesheet asset URLs. Run that check automatically after every renderer build.

## Verification

Prove the check fails against the existing broken output, rebuild after the configuration change, inspect the packaged HTML, run the full test and lint suite, package for macOS arm64, and smoke-test the resulting app.
