# Contributing to mcp-context

Thanks for your interest in contributing! This project is small and focused — every
contribution matters.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (LTS recommended)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

## Local Development Setup

```bash
# Clone the repo
git clone https://github.com/anthropics/mcp-context.git
cd mcp-context

# Install dependencies
npm install

# Build TypeScript
npm run build

# Install as a local Claude Code plugin
claude plugin:install .
```

After `plugin:install`, restart Claude Code to pick up the hook and MCP server.

## Running Tests

```bash
# All tests (29 tests across 4 suites)
npm test

# Individual suites
npm run test:store         # ContentStore unit tests
npm run test:hook          # PostToolUse hook tests
npm run test:e2e           # End-to-end flow tests
npm run test:enhancements  # Search fallback + vocabulary tests

# Benchmarks (not part of test suite)
npm run benchmark
```

Tests use Node's built-in `assert` module — no test framework required.

## Development Workflow

1. Edit source in `src/` or `hooks/`
2. Run `npm run build` (compiles TypeScript to `build/`)
3. Run `npm test` to verify
4. Restart Claude Code to pick up changes to the hook or server

The hook (`hooks/posttooluse.mjs`) is plain JavaScript — no build step needed.
Only changes to `src/*.ts` require `npm run build`.

### Type Checking

```bash
npm run typecheck   # tsc --noEmit
```

## Project Structure

```
mcp-context/
  src/
    store.ts          # ContentStore — FTS5 knowledge base, chunking, search
    server.ts         # MCP server — search, index, stats tools
  hooks/
    posttooluse.mjs   # PostToolUse hook — intercepts large MCP output
  tests/
    store.test.ts     # Unit tests for chunking + search
    hook.test.ts      # Hook behavior tests
    e2e.test.ts       # Full flow: tool output → hook → index → search
    enhancements.test.ts  # Trigram, fuzzy, vocabulary tests
    benchmark.ts      # Compression ratio benchmarks
  .claude-plugin/
    plugin.json       # Plugin manifest (MCP server config)
  build/              # Compiled output (gitignored)
```

## Submitting a Bug Report

Please include:

1. What you expected to happen
2. What actually happened
3. Steps to reproduce
4. Node.js version (`node --version`)
5. Claude Code version (`claude --version`)

## Submitting a Pull Request

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-change`
3. Make your changes
4. Run `npm test` — all tests must pass
5. Run `npm run typecheck` — no type errors
6. Commit with a descriptive message
7. Push and open a PR against `main`

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Types check (`npm run typecheck`)
- [ ] New behavior has tests
- [ ] Commit message describes what and why

## Quick Reference

| Task | Command |
|------|---------|
| Build | `npm run build` |
| Test all | `npm test` |
| Type check | `npm run typecheck` |
| Benchmark | `npm run benchmark` |
| Install plugin | `claude plugin:install .` |
