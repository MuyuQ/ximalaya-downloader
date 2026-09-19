# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A zero-production-dependency Node.js CLI tool for downloading Ximalaya audio content. v3.0.0 uses a `src/` layout with a layered architecture and a custom zero-dependency terminal UI.

## Common Commands

```bash
npm start                # Interactive CLI (same as: node index.js)
node bin/xmly.js --help  # CLI help (npm link enables global `xmly`)

npm test                 # node:test suite (no test framework dependency)
npm run test:coverage    # Tests with --experimental-test-coverage
npm run lint             # ESLint 9 flat config
npm run lint:fix         # Auto-fix style issues
```

## Architecture

```
bin/xmly.js            executable entry (package.json "bin")
src/index.js           argument parsing & command dispatch
src/cli/               presentation layer
  app.js               interactive main loop
  commands/            download / account / settings flows
  ui/                  zero-dep terminal components (ansi, select, spinner, progress, banner)
src/core/              business logic
  api.js               ALL Ximalaya endpoint calls live here (single entry point)
  audioParser.js       business objects built on top of api.js (decrypts VIP URLs)
  configManager.js     config read/write, Cookie encrypted with AES-256-GCM
  decryptor.js         VIP URL decryption algorithm
  downloader.js        worker-pool concurrency, skip-existing resume
  login.js             cookie-based login flow
src/utils/             fileUtils / networkUtils / stringUtils / crypto
tests/*.test.js        node:test unit tests (local HTTP mock servers, no external network)
```

### Key Patterns

1. **ES Modules** (`"type": "module"`), Node.js >= 18.
2. **Layering is one-directional**: `cli/` → `core/` → `utils/`. Never call platform HTTP endpoints outside `core/api.js`; never import `cli/` from `core/`.
3. **Error contract**: low-level core functions *throw*; `downloader.js` returns `{ success, ... } | { success: false, error }` result objects; CLI commands catch and render.
4. **Auth propagation**: parser/downloader functions accept an optional `auth = { cookie, bid }` to avoid re-reading config per call; when omitted they read config.
5. **Env overrides for testing**: `XIMALAYA_API_BASE`, `XIMALAYA_CONFIG_PATH`, `XIMALAYA_KEY_PATH`, `XIMALAYA_ENCRYPTION_KEY` (hex). Read at module load time — set them *before* dynamic import in tests.
6. **Terminal UI degrade**: `src/cli/ui/ansi.js` disables all ANSI output for non-TTY / `NO_COLOR`; `select()` falls back to numbered prompts when stdin is not a TTY.

### Testing Conventions

- Tests use `node:test` + `node:assert/strict`; no Jest, no custom framework.
- Network-dependent tests spin up local `http.createServer` instances on port 0 — never hit ximalaya.com.
- Config/crypto tests redirect files to `mkdtemp` temp dirs via env vars, then clean up in `after()`.
- VIP decryption has no known valid ciphertext fixture; decryptor tests cover the error contract only.

## Important Notes

- No browser automation; login is manual cookie paste from the browser.
- Downloads stream to disk (no full-file buffering); failed downloads delete partial files.
- Concurrency uses a fixed worker pool (`runTaskPool`) — do not reintroduce Promise.race-style pools.
- Retries use exponential backoff with jitter; only network errors and 5xx/429 are retried.
- `xm-sign` nonce uses `crypto.randomBytes`, not `Math.random`.

## File Naming Conventions

- Modules: `camelCase.js`; test files: `moduleName.test.js`
- Config: `config.json` (gitignored, created at runtime); key file: `.encryption.key` (gitignored)
