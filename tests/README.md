# Mode Atlas smoke tests

These tests use Playwright against the static app.

## First-time setup

```bash
npm install
npx playwright install
```

## Run smoke tests

```bash
npm run test:smoke
```

## Run headed

```bash
npm run test:headed
```

The Playwright config starts a local static server with:

```bash
python3 -m http.server 4173
```

The tests seed stable localStorage state before each run so Reading/Writing flows are predictable and do not depend on the tester's real browser save data.

## Container note

This config can use a system Chromium when `npx playwright install` is not available:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:smoke
```

On normal local machines, prefer the standard Playwright browser install.

## Backend ownership tests

These do not need a browser or Firebase connection:

```bash
npm run test:backend
```

They exercise the localStorage fallback, idempotent cloud UI binding, stale-account hydration protection, and serialized/coalesced Firestore sync ownership.

## Release validation

```bash
npm run release:check
```

This rebuilds revisioned assets, runs the static ownership/file-structure audit, and runs both backend and frontend regression tests.
# Native appearance regression checks

`npm run release:check` includes semantic palette contrast and ownership checks.
`npm run test:polish` also runs native Light/Dark screenshots, System/manual theme
switching and website-paint parity against `fixtures/web-theme-baseline.txt`.
Fetch that commit before a local parity run, or supply an equivalent local Git
reference with `MODE_ATLAS_WEB_THEME_BASE`. Change the baseline only when website
appearance is intentionally changed. See `docs/ios-theme-system.md`.
