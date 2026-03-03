# mcp-context

**Keep MCP tool output out of context. Search it instead.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-18%2B-green.svg)](https://nodejs.org/)

A Claude Code plugin that intercepts large MCP tool outputs via a PostToolUse hook,
indexes them into a local FTS5 knowledge base, and replaces the context-window payload
with a ~200-byte summary. The full content stays searchable on demand.

No execution engine. No credentials. No network calls. Just index and search.

## How It Works

```
MCP tool returns 47 KB OpenAPI spec
        │
        ▼
┌──────────────────┐
│  PostToolUse     │──► Below 5 KB? → pass through unchanged
│  Hook            │
│  (posttooluse.   │──► Above 5 KB? ─┐
│   mjs)           │                 │
└──────────────────┘                 │
                                     ▼
                          ┌────────────────────┐
                          │  ContentStore       │
                          │  (SQLite FTS5)      │
                          │                     │
                          │  1. Detect type     │
                          │  2. Chunk content   │
                          │  3. Index chunks    │
                          │  4. Extract vocab   │
                          └────────┬───────────┘
                                   │
                                   ▼
                          Context receives:
                          ~200 B summary +
                          "call search() to
                           retrieve details"
                                   │
                                   ▼
                          ┌────────────────────┐
                          │  MCP Server        │
                          │  search · index ·  │
                          │  stats             │
                          │                    │
                          │  Returns snippets  │
                          │  around matches    │
                          └────────────────────┘
```

## Install

### From the Marketplace (recommended)

```bash
/plugin marketplace add byliu-labs/mcp-context
/plugin install mcp-context@mcp-context
```

Restart Claude Code after installing.

### From a Local Clone

```bash
git clone https://github.com/byliu-labs/mcp-context.git
cd mcp-context
npm install && npm run build
claude plugin:install .
```

### Manual MCP Server Only

Add to your Claude Code MCP config (hook not included):

```json
{
  "mcpServers": {
    "mcp-context": {
      "command": "node",
      "args": ["/path/to/mcp-context/build/server.js"]
    }
  }
}
```

## The Problem

MCP tools return large outputs — accessibility snapshots, API responses, test results, documentation.
Every byte enters the context window and counts against the token limit.

A single Playwright snapshot is 26 KB. An OpenAPI spec is 47 KB. A page of server logs is 60 KB.
In a session with 20+ tool calls, you burn through context fast.

## Architecture

Three components, one SQLite database:

**PostToolUse Hook** (`hooks/posttooluse.mjs`) — Intercepts MCP tool output after execution.
If output exceeds the byte threshold (default 5 KB), indexes it and replaces it with a summary.
Only intercepts `mcp__` prefixed tools; built-in tools (Bash, Read, Grep) pass through.

**ContentStore** (`src/store.ts`) — FTS5 knowledge base with content-aware chunking and
multi-layer search. Shared between hook and server via a deterministic DB path
(`/tmp/output-indexer-{pid}.db`). SQLite WAL mode handles concurrent access.

**MCP Server** (`src/server.ts`) — Exposes `search`, `index`, and `stats` tools.
The LLM calls `search()` to retrieve specific content on demand instead of having
the full output in context.

### Chunking Strategies

Content is detected and chunked by type:

| Type | Strategy | Example |
|------|----------|---------|
| **JSON** | Split by top-level keys, recurse if value > 5 KB | API responses, configs |
| **Stack trace** | Keep error + trace as single unit | Node.js, Python, Go panics |
| **Markdown** | Split by headings with breadcrumb hierarchy | Documentation, READMEs |
| **Plain text** | 50-line groups with 5-line overlap | Logs, test output |

### Search

Three-layer fallback ensures matches even with typos:

1. **Porter stemming** — FTS5 with `porter unicode61` tokenizer. Handles plurals, tenses.
2. **Trigram substring** — Matches partial words and identifiers like `handleClick`.
3. **Levenshtein fuzzy** — Corrects misspellings (edit distance 1-3 based on word length),
   then re-searches via layers 1-2.

Results return 300-character snippet windows around match positions (using FTS5 `highlight()`
markers), not full chunks — so even search results are compact.

**Throttling** — Search is rate-limited to prevent the LLM from dumping all indexed content
back into context. After 5 calls in a 2-minute window, results are reduced to 1 per query.
After 10 calls, search is blocked until the window resets.

## The Numbers

Real benchmarks from `npm run benchmark` — generates realistic data, indexes via ContentStore,
measures original bytes vs summary + search results:

| Scenario | Original | Summary | Search (top 3) | Context used | Saved |
|----------|----------|---------|----------------|--------------|-------|
| Playwright snapshot | 26.0 KB | ~200 B | 6.1 KB | 6.3 KB | **76%** |
| GitHub API (issues) | 16.2 KB | ~200 B | 4.1 KB | 4.3 KB | **73%** |
| Jest test output | 9.7 KB | ~200 B | 4.4 KB | 4.6 KB | **53%** |
| OpenAPI spec | 47.1 KB | ~200 B | 1.6 KB | 1.8 KB | **96%** |
| Node.js stack trace | 2.8 KB | ~200 B | 1.6 KB | 1.8 KB | **37%** |
| Markdown docs | 3.6 KB | ~200 B | 868 B | 1.0 KB | **71%** |
| Server access log | 60.2 KB | ~200 B | 18.1 KB | 18.2 KB | **70%** |

_Summary = hook replacement message (~200 B). Search = top 3 results via `searchWithFallback`._

Outputs below the 5 KB threshold pass through unchanged — no overhead for small results.

## Tools

### `search`

Search indexed content with multi-layer fallback.

```
search({ queries: ["error database connection", "retry logic"], source: "stack-trace-1", limit: 3 })
```

- Batch all queries in one call (array)
- Use `source` to scope results to a specific indexed output
- Returns snippet windows, not full chunks

### `index`

Manually index content into the knowledge base.

```
index({ content: "...", source: "my-docs" })
```

Useful for indexing content that didn't come through the hook (e.g., file contents,
clipboard data).

### `stats`

Session statistics: bytes indexed, bytes returned to context, savings ratio, per-tool breakdown.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OUTPUT_INDEXER_THRESHOLD` | `5120` | Byte threshold for indexing (outputs below this pass through) |

Set via environment variable:

```bash
OUTPUT_INDEXER_THRESHOLD=10240 claude
```

The SQLite database is created at `/tmp/output-indexer-{pid}.db` and cleaned up on exit.
Stale databases from crashed sessions are garbage-collected on startup (>24h old or dead PID).

## Requirements

- Node.js 18+
- Claude Code CLI

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and PR guidelines.

## License

[MIT](LICENSE)

## Acknowledgments

Search patterns and FTS5 architecture inspired by
[mksglu/claude-context-mode](https://github.com/mksglu/claude-context-mode) (MIT).
