# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A pure Node.js CLI tool for downloading Ximalaya audio content. This is a refactored version focused solely on command-line usage.

## Common Commands

```bash
# Run the CLI application
npm start
# or
node index.js

# Run with arguments
node index.js --download <id>          # Download single audio
node index.js --download <id> --album  # Download album

# Run tests
npm test

# Lint code
npm run lint

# Fix lint errors
npm run lint:fix
```

## Architecture

### Module Organization

- **`core/`** - Business logic modules
  - `api.js` - Ximalaya API interactions (Node.js https)
  - `audioParser.js` - Audio/album info parsing
  - `configManager.js` - Configuration read/write (stores in `./config.json`)
  - `decryptor.js` - VIP audio URL decryption
  - `downloader.js` - File download with concurrency control
  - `login.js` - CLI-based login (manual cookie input)

- **`utils/`** - Utilities (Node.js only)
  - `fileUtils.js` - File system operations using `fs` module
  - `networkUtils.js` - HTTP requests using native `https` module
  - `stringUtils.js` - String processing

- **`interfaces/`** - User interface
  - `cli.js` - Command-line interactive menu

- **`tests/`** - Tests
  - `testFramework.js` - Custom test runner
  - `*.test.js` - Unit tests

### Key Patterns

1. **ES6 Modules**: Uses native ES6 `import`/`export` syntax
2. **Config Management**: Configuration stored in `./config.json`, auto-created on first run
3. **Error Handling**: Functions return `{ success, ...data }` or `{ success: false, error }`
4. **Node.js Native**: No external HTTP libraries, uses built-in `https`/`fs` modules

### Runtime Environment

- **Node.js >= 16.0.0** required
- Pure server-side application, no browser code
- Uses `readline` for CLI interaction

## Important Notes

- No browser automation (removed puppeteer/playwright dependency)
- Login requires manual cookie extraction from browser
- Downloads use streaming to avoid memory issues with large files
- Concurrent downloads limited to prevent overwhelming the server

## File Naming Conventions

- Modules: `camelCase.js`
- Core functions: `camelCase`
- Test files: `moduleName.test.js`
- Config file: `config.json` (gitignored, created at runtime)
