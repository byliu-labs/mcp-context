/**
 * Benchmark: measures compression ratios for realistic MCP tool outputs.
 *
 * For each scenario, generates realistic data, indexes it via ContentStore,
 * then measures original bytes vs summary + search result bytes.
 *
 * Usage: npx tsx tests/benchmark.ts
 */

import { ContentStore } from "../src/store.js";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─────────────────────────────────────────────────────────
// Data generators
// ─────────────────────────────────────────────────────────

function generatePlaywrightSnapshot(): string {
  const roles = ["button", "link", "textbox", "heading", "img", "navigation", "main", "list", "listitem", "checkbox"];
  const names = ["Submit", "Cancel", "Home", "Settings", "Search", "Profile", "Dashboard", "Login", "Logout", "Help"];
  const lines: string[] = [
    "- document [ref=s1]",
    "  - banner [ref=s2]",
    '    - navigation "Main Navigation" [ref=s3]',
    '      - link "Home" [ref=s4]',
    '      - link "About" [ref=s5]',
    '      - link "Contact" [ref=s6]',
    "  - main [ref=s7]",
    '    - heading "Dashboard Overview" [ref=s8]',
  ];

  for (let i = 0; i < 450; i++) {
    const role = roles[i % roles.length];
    const name = names[i % names.length];
    const depth = 2 + (i % 5);
    const indent = "  ".repeat(depth);
    lines.push(`${indent}- ${role} "${name} ${i}" [ref=s${i + 100}]`);
    if (role === "textbox") {
      lines.push(`${indent}  - text "Enter your ${name.toLowerCase()} here"`);
    }
    if (role === "list") {
      for (let j = 0; j < 3; j++) {
        lines.push(`${indent}  - listitem "Item ${i}-${j}" [ref=s${2000 + i * 10 + j}]`);
      }
    }
  }

  return lines.join("\n");
}

function generateGitHubIssues(): string {
  const labels = ["bug", "enhancement", "documentation", "good first issue", "help wanted"];
  const users = ["alice", "bob", "charlie", "diana", "eve", "frank"];
  const issues = [];

  for (let i = 1; i <= 20; i++) {
    issues.push({
      number: 1000 + i,
      title: `Issue ${i}: ${["Fix memory leak in worker pool", "Add retry logic for API calls", "Update TypeScript to v5.7", "Implement caching layer for search", "Refactor database connection handling", "Add support for custom tokenizers", "Fix race condition in queue processor", "Improve error messages for invalid config", "Add health check endpoint", "Support for custom chunk sizes"][i % 10]}`,
      state: i % 3 === 0 ? "closed" : "open",
      user: { login: users[i % users.length], id: 10000 + i },
      labels: [{ name: labels[i % labels.length], color: "fc2929" }],
      assignees: i % 2 === 0 ? [{ login: users[(i + 1) % users.length] }] : [],
      created_at: `2025-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}T10:00:00Z`,
      updated_at: `2025-${String(1 + ((i + 1) % 12)).padStart(2, "0")}-${String(1 + ((i + 2) % 28)).padStart(2, "0")}T15:30:00Z`,
      body: `## Description\n\nThis issue tracks ${["a critical bug", "an enhancement request", "a documentation update", "a refactoring task", "a performance improvement"][i % 5]} in the ${["core module", "API layer", "database adapter", "search engine", "hook system"][i % 5]}.\n\n## Steps to Reproduce\n\n1. Run the application with \`npm start\`\n2. Navigate to the ${["dashboard", "settings", "profile", "search"][i % 4]} page\n3. Observe the ${["error in console", "slow response time", "incorrect output", "missing data"][i % 4]}\n\n## Expected Behavior\n\nThe system should ${["handle this gracefully", "respond within 100ms", "display correct results", "process all items"][i % 4]}.\n\n## Environment\n\n- Node.js: v20.11.0\n- OS: macOS 14.3\n- Package version: 0.1.${i}`,
      comments: i % 4,
      milestone: i % 5 === 0 ? { title: "v1.0" } : null,
      pull_request: i % 7 === 0 ? { url: `https://api.github.com/repos/org/repo/pulls/${1000 + i}` } : undefined,
    });
  }

  return JSON.stringify(issues, null, 2);
}

function generateJestOutput(): string {
  const suites = [];
  const statuses = ["PASS", "PASS", "PASS", "PASS", "FAIL"];

  for (let i = 0; i < 30; i++) {
    const status = statuses[i % statuses.length];
    const suiteName = [
      "src/store.test.ts", "src/server.test.ts", "src/hook.test.ts",
      "src/utils/chunking.test.ts", "src/utils/search.test.ts",
      "src/utils/sanitize.test.ts", "src/api/routes.test.ts",
      "src/api/middleware.test.ts", "src/db/migrations.test.ts",
      "src/db/queries.test.ts",
    ][i % 10];

    const tests = [];
    for (let j = 0; j < 5 + (i % 4); j++) {
      const testStatus = status === "FAIL" && j === 0 ? "✕" : "✓";
      const duration = Math.floor(Math.random() * 200) + 5;
      tests.push(`    ${testStatus} ${["should handle empty input", "should process valid data", "should reject invalid input", "should handle concurrent requests", "should clean up resources", "should return correct results", "should handle edge cases", "should maintain state correctly", "should validate configuration"][j % 9]} (${duration} ms)`);
    }

    suites.push(` ${status} ${suiteName}\n${tests.join("\n")}`);
  }

  const totalTests = 30 * 6;
  const failedTests = 6;

  return [
    ...suites,
    "",
    "Test Suites: 6 failed, 24 passed, 30 total",
    `Tests:       ${failedTests} failed, ${totalTests - failedTests} passed, ${totalTests} total`,
    "Snapshots:   0 total",
    `Time:        ${(Math.random() * 5 + 3).toFixed(3)} s`,
    "Ran all test suites.",
    "",
    "Summary of failures:",
    "",
    "FAIL src/store.test.ts",
    "  ● should handle concurrent writes",
    "",
    "    expect(received).toBe(expected)",
    "",
    "    Expected: 42",
    "    Received: 41",
    "",
    "      at Object.<anonymous> (src/store.test.ts:156:23)",
    "      at processTicksAndRejections (node:internal/process/task_queues:95:5)",
  ].join("\n");
}

function generateOpenAPISpec(): string {
  const paths: Record<string, unknown> = {};
  const endpoints = [
    { path: "/api/users", methods: ["get", "post"] },
    { path: "/api/users/{id}", methods: ["get", "put", "delete"] },
    { path: "/api/posts", methods: ["get", "post"] },
    { path: "/api/posts/{id}", methods: ["get", "put", "delete"] },
    { path: "/api/posts/{id}/comments", methods: ["get", "post"] },
    { path: "/api/auth/login", methods: ["post"] },
    { path: "/api/auth/register", methods: ["post"] },
    { path: "/api/auth/refresh", methods: ["post"] },
    { path: "/api/search", methods: ["get"] },
    { path: "/api/settings", methods: ["get", "put"] },
    { path: "/api/notifications", methods: ["get"] },
    { path: "/api/notifications/{id}/read", methods: ["put"] },
    { path: "/api/files", methods: ["get", "post"] },
    { path: "/api/files/{id}", methods: ["get", "delete"] },
  ];

  for (const ep of endpoints) {
    const methods: Record<string, unknown> = {};
    for (const method of ep.methods) {
      methods[method] = {
        summary: `${method.toUpperCase()} ${ep.path}`,
        operationId: `${method}${ep.path.replace(/[/{}-]/g, "_")}`,
        tags: [ep.path.split("/")[2]],
        parameters: ep.path.includes("{id}") ? [{
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        }] : [],
        ...(["post", "put"].includes(method) ? {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", maxLength: 255 },
                    email: { type: "string", format: "email" },
                    role: { type: "string", enum: ["admin", "user", "moderator"] },
                    metadata: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          },
        } : {}),
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "object" },
                    meta: {
                      type: "object",
                      properties: {
                        total: { type: "integer" },
                        page: { type: "integer" },
                        per_page: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Bad request" },
          "401": { description: "Unauthorized" },
          "404": { description: "Not found" },
          "500": { description: "Internal server error" },
        },
      };
    }
    paths[ep.path] = methods;
  }

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Example API",
      version: "1.0.0",
      description: "A comprehensive REST API for managing users, posts, and authentication.",
      contact: { email: "api@example.com" },
      license: { name: "MIT" },
    },
    servers: [
      { url: "https://api.example.com/v1", description: "Production" },
      { url: "http://localhost:3000/v1", description: "Development" },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["admin", "user", "moderator"] },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Post: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            body: { type: "string" },
            author_id: { type: "string", format: "uuid" },
            published: { type: "boolean" },
          },
        },
        Error: {
          type: "object",
          properties: {
            code: { type: "integer" },
            message: { type: "string" },
            details: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  };

  return JSON.stringify(spec, null, 2);
}

function generateStackTrace(): string {
  return `Error: Connection refused to database at 127.0.0.1:5432
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1607:16)
    at Connection._handleErrorEvent (/app/node_modules/pg/lib/connection.js:128:12)
    at Connection.connect (/app/node_modules/pg/lib/connection.js:75:10)
    at Pool._connect (/app/node_modules/pg/lib/pool.js:215:19)
    at Pool.connect (/app/node_modules/pg/lib/pool.js:195:10)
    at QueryExecutor.execute (/app/src/db/executor.ts:42:28)
    at UserRepository.findById (/app/src/repositories/user.ts:23:20)
    at UserService.getUser (/app/src/services/user.ts:31:24)
    at AuthMiddleware.authenticate (/app/src/middleware/auth.ts:56:18)
    at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:149:13)
    at Route.dispatch (/app/node_modules/express/lib/router/route.js:119:3)

The above error occurred during request processing:

TypeError: Cannot read properties of undefined (reading 'rows')
    at QueryExecutor.execute (/app/src/db/executor.ts:48:22)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at UserRepository.findById (/app/src/repositories/user.ts:25:18)
    at UserService.getUser (/app/src/services/user.ts:33:20)
    at async /app/src/routes/users.ts:15:22

Error: ENOENT: no such file or directory, open '/app/config/database.yml'
    at Object.openSync (node:fs:601:3)
    at Object.readFileSync (node:fs:469:35)
    at loadConfig (/app/src/config/loader.ts:12:22)
    at DatabasePool.initialize (/app/src/db/pool.ts:28:20)
    at Application.bootstrap (/app/src/app.ts:45:16)
    at Object.<anonymous> (/app/src/index.ts:8:1)

Additional context:
  Environment: production
  Node version: v20.11.0
  Database: PostgreSQL 16.1
  Connection string: postgres://user:***@db.internal:5432/myapp
  Pool size: 10 (0 active, 0 idle)
  Last successful query: 2025-01-15T14:23:45.123Z
  Uptime: 3h 42m
  Memory usage: 245MB / 512MB

Previous errors in this session:
  [14:20:12] WARN: Connection pool exhausted, waiting for available connection
  [14:20:15] WARN: Query timeout after 5000ms: SELECT * FROM users WHERE id = $1
  [14:20:18] ERROR: Connection reset by peer
  [14:21:00] WARN: Retrying connection (attempt 1/3)
  [14:21:05] WARN: Retrying connection (attempt 2/3)
  [14:21:10] WARN: Retrying connection (attempt 3/3)
  [14:21:15] ERROR: All retry attempts exhausted

Stack trace from worker thread:
Error: Worker thread crashed
    at Worker.<anonymous> (/app/src/workers/manager.ts:67:15)
    at Worker.emit (node:events:519:28)
    at Worker.[kOnErrorMessage] (node:internal/worker:326:10)
    at Worker.[kOnMessage] (node:internal/worker:337:37)
    at MessagePort.<anonymous> (node:internal/worker:232:12)
    at MessagePort.[kMessageListener] (node:events:816:20)
    at MessagePort.emit (node:events:519:28)`;
}

function generateMarkdownDocs(): string {
  const sections = [
    "# MCP Protocol Reference\n\nThe Model Context Protocol (MCP) enables communication between AI assistants and external tools.",
    "## Architecture\n\nMCP uses a client-server architecture where:\n- The **client** is the AI assistant\n- The **server** provides tools, resources, and prompts\n- Communication happens over **stdio** or **SSE**\n\n### Transport Layer\n\nTwo transport mechanisms are supported:\n\n1. **stdio**: Server runs as a subprocess, communicating via stdin/stdout\n2. **Server-Sent Events (SSE)**: Server runs as an HTTP endpoint\n\n```typescript\nimport { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';\n\nconst transport = new StdioServerTransport();\nawait server.connect(transport);\n```",
    "## Tools\n\nTools are functions that the server exposes to the AI assistant.\n\n### Defining Tools\n\n```typescript\nserver.registerTool(\n  'search',\n  {\n    title: 'Search Content',\n    description: 'Search indexed content by query',\n    inputSchema: z.object({\n      query: z.string().describe('Search query'),\n      limit: z.number().optional().default(5),\n    }),\n  },\n  async ({ query, limit }) => {\n    const results = await db.search(query, limit);\n    return {\n      content: [{ type: 'text', text: JSON.stringify(results) }],\n    };\n  },\n);\n```\n\n### Tool Response Format\n\nTools return content arrays with typed entries:\n\n| Type | Description | Use Case |\n|------|-------------|----------|\n| `text` | Plain text or markdown | Most responses |\n| `image` | Base64-encoded image | Screenshots, charts |\n| `resource` | URI reference | File paths, URLs |",
    "## Resources\n\nResources provide read-only data that the AI can access.\n\n### Static Resources\n\n```typescript\nserver.resource('config', 'application://config', async (uri) => ({\n  contents: [{\n    uri: uri.href,\n    mimeType: 'application/json',\n    text: JSON.stringify(config),\n  }],\n}));\n```\n\n### Dynamic Resources\n\nUse resource templates for dynamic content:\n\n```typescript\nserver.resource(\n  'user-profile',\n  new ResourceTemplate('users://{userId}/profile', { list: undefined }),\n  async (uri, { userId }) => ({\n    contents: [{\n      uri: uri.href,\n      text: await getUserProfile(userId),\n    }],\n  }),\n);\n```",
    "## Hooks\n\nClaude Code supports lifecycle hooks that run before or after tool execution.\n\n### PostToolUse Hook\n\nThe PostToolUse hook receives the tool response and can modify it:\n\n```json\n{\n  \"hook_event_name\": \"PostToolUse\",\n  \"tool_name\": \"mcp__server__tool\",\n  \"tool_input\": { \"query\": \"example\" },\n  \"tool_response\": {\n    \"content\": [{ \"type\": \"text\", \"text\": \"result data\" }]\n  }\n}\n```\n\nTo modify the output, write JSON to stdout:\n\n```json\n{\n  \"hookSpecificOutput\": {\n    \"hookEventName\": \"PostToolUse\",\n    \"updatedMCPToolOutput\": \"replacement summary\"\n  }\n}\n```\n\n### Use Cases\n\n- **Context compression**: Index large outputs, return summaries\n- **Filtering**: Remove sensitive data before it enters context\n- **Enrichment**: Add metadata or cross-references\n- **Monitoring**: Log tool usage patterns",
    "## Error Handling\n\nMCP servers should handle errors gracefully:\n\n```typescript\ntry {\n  const result = await riskyOperation();\n  return { content: [{ type: 'text', text: result }] };\n} catch (error) {\n  return {\n    content: [{ type: 'text', text: `Error: ${error.message}` }],\n    isError: true,\n  };\n}\n```\n\n### Error Codes\n\n| Code | Meaning | Recovery |\n|------|---------|----------|\n| -32700 | Parse error | Fix JSON syntax |\n| -32600 | Invalid request | Check request format |\n| -32601 | Method not found | Verify tool name |\n| -32602 | Invalid params | Check parameter types |\n| -32603 | Internal error | Server-side issue |",
  ];

  return sections.join("\n\n---\n\n");
}

function generateAccessLog(): string {
  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
  const paths = [
    "/api/users", "/api/users/123", "/api/posts", "/api/posts/456",
    "/api/auth/login", "/api/search?q=test", "/api/settings",
    "/api/files/upload", "/health", "/metrics",
    "/api/notifications", "/api/comments/789",
  ];
  const statuses = [200, 200, 200, 201, 204, 301, 400, 401, 403, 404, 500];
  const ips = ["192.168.1.100", "10.0.0.42", "172.16.0.15", "192.168.2.200", "10.1.1.1"];
  const agents = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "curl/8.4.0",
    "PostmanRuntime/7.36.0",
    "node-fetch/3.3.0",
    "Python/3.12 aiohttp/3.9.1",
  ];

  const lines: string[] = [];
  const baseTime = new Date("2025-01-15T10:00:00Z");

  for (let i = 0; i < 500; i++) {
    const time = new Date(baseTime.getTime() + i * 1200);
    const method = methods[i % methods.length];
    const path = paths[i % paths.length];
    const status = statuses[i % statuses.length];
    const ip = ips[i % ips.length];
    const agent = agents[i % agents.length];
    const size = Math.floor(Math.random() * 50000) + 100;
    const duration = (Math.random() * 2000 + 5).toFixed(3);

    const dateStr = time.toISOString().replace("T", " ").replace(/\.\d+Z/, "");
    lines.push(
      `${ip} - - [${dateStr}] "${method} ${path} HTTP/1.1" ${status} ${size} "-" "${agent}" ${duration}ms`
    );
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────
// Benchmark runner
// ─────────────────────────────────────────────────────────

interface Scenario {
  name: string;
  generate: () => string;
  query: string;
}

const scenarios: Scenario[] = [
  { name: "Playwright snapshot", generate: generatePlaywrightSnapshot, query: "button Submit" },
  { name: "GitHub API (issues)", generate: generateGitHubIssues, query: "memory leak worker pool" },
  { name: "Jest test output", generate: generateJestOutput, query: "concurrent writes failed" },
  { name: "OpenAPI spec", generate: generateOpenAPISpec, query: "authentication bearer JWT" },
  { name: "Node.js stack trace", generate: generateStackTrace, query: "connection refused database" },
  { name: "Markdown docs", generate: generateMarkdownDocs, query: "PostToolUse hook response" },
  { name: "Server access log", generate: generateAccessLog, query: "500 error internal" },
];

const SUMMARY_BYTES = 200; // approximate hook summary size

console.log("\n## Benchmark Results\n");
console.log("| Scenario | Original | Summary | Search (top 3) | Context used | Saved |");
console.log("|----------|----------|---------|----------------|--------------|-------|");

for (const scenario of scenarios) {
  const dbPath = join(tmpdir(), `benchmark-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const store = new ContentStore(dbPath);

  try {
    const content = scenario.generate();
    const originalBytes = Buffer.byteLength(content);

    // Index
    store.index(content, scenario.name);

    // Search
    const results = store.searchWithFallback(scenario.query, 3);
    const searchBytes = results.reduce((sum, r) => sum + Buffer.byteLength(r.content), 0);

    // Calculate
    const contextUsed = SUMMARY_BYTES + searchBytes;
    const savedPct = ((1 - contextUsed / originalBytes) * 100).toFixed(0);

    const kb = (b: number) => {
      if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
      return `${b} B`;
    };

    console.log(
      `| ${scenario.name} | ${kb(originalBytes)} | ~${SUMMARY_BYTES} B | ${kb(searchBytes)} | ${kb(contextUsed)} | **${savedPct}%** |`
    );
  } finally {
    store.cleanup();
  }
}

console.log("\n_Summary = hook replacement message (~200 B). Search = top 3 results via `searchWithFallback`._\n");
