# Architecture Guide — Shard.js

Shard.js is a modular, standalone TypeScript framework for building scalable Discord applications and Web APIs. It provides Next.js-like conventions (file-based routing, middleware, built-in REST API) while communicating directly with Discord's API v10 without any runtime dependency on `discord.js` or `@discordjs/*`.

---

## 1. System Overview & Monorepo Structure

Shard.js is organized as a Turborepo monorepo powered by `pnpm`:

```
shard-framework/
├── packages/
│   ├── core/              # @shardjs/core: Discord protocol engine, file router, bot runtime
│   ├── api/               # @shardjs/api: Standalone HTTP server & dynamic route handler
│   ├── cli/               # @shardjs/cli: CLI tool (`shard dev`, `build`, `deploy`, `doctor`)
│   ├── create-shard/      # create-shard: Interactive project scaffolding CLI
│   └── plugin-drizzle/    # @shardjs/plugin-drizzle: Official Drizzle ORM plugin
├── examples/
│   └── basic-bot/         # Production-ready reference bot with commands, events, and API
├── turbo.json             # Turborepo task graph
└── pnpm-workspace.yaml    # Workspace package definitions
```

---

## 2. Discord Protocol Engine (`@shardjs/core`)

The engine implements Discord API v10 specifications natively using standard Node.js built-ins (`node:http`, `node:crypto`, `node:zlib`, global `fetch`) and a lightweight, pinned WebSocket layer (`ws@8.18.0` encapsulated behind `IWebSocket`).

```
                    ┌─────────────────────────┐
                    │      Discord API        │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │ Gateway (WSS)                                 │ REST (HTTPS)
        ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│        ShardManager           │               │          RestClient           │
│  ┌─────────────────────────┐  │               │  ┌─────────────────────────┐  │
│  │ Shard 0 (Heartbeat,     │  │               │  │ RateLimiter (Buckets)   │  │
│  │ Jitter, ACK, Reconnect) │  │               │  └────────────┬────────────┘  │
│  └─────────────────────────┘  │               │               │               │
│  ┌─────────────────────────┐  │               │  Global 429 & Retry-After     │
│  │ Shard N (Session resume)│  │               │  Exponential 5xx backoff      │
│  └─────────────────────────┘  │               └───────────────┬───────────────┘
└───────────────┬───────────────┘                               │
                │                                               │
                └───────────────────────┬───────────────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │            Client             │
                        │  - LRU Caches (Guilds/Users)  │
                        │  - Enriched Entity wrappers   │
                        │  - Unified Event Dispatcher   │
                        └───────────────┬───────────────┘
                                        ▼
                        ┌───────────────────────────────┐
                        │          FileRouter           │
                        │  - Slash Commands (Options)   │
                        │  - Components & Modals        │
                        │  - Onion Middleware Pipeline  │
                        └───────────────────────────────┘
```

### 2.1 Gateway Architecture (`src/discord/gateway/`)

- **`IWebSocket` & `NodeWsAdapter`**: Gateway networking is completely decoupled from any specific WebSocket implementation. The `NodeWsAdapter` wraps `ws@8.18.0` behind the clean `IWebSocket` interface.
- **`Shard`**:
  - Implements Discord Gateway v10 state machine (Connecting, Identifying, Resuming, Ready, Reconnecting, Disconnected).
  - Handles **Heartbeat Jitter**: When Opcode 10 (Hello) arrives with `heartbeat_interval`, the initial heartbeat is scheduled with a random jitter (`heartbeat_interval * Math.random()`) to avoid thundering herd on Discord gateway clusters.
  - **Heartbeat ACK & Zombie Socket Termination**: If Opcode 11 (Heartbeat ACK) is not received before the next heartbeat cycle, the connection is treated as a zombie socket, terminated immediately (`ws.terminate()`), and an exponential reconnect cycle is triggered.
  - **Resume vs Re-Identify**: Shard persists `session_id` and sequence number (`seq`). Upon reconnecting, Opcode 6 (Resume) is attempted. If invalidated (Opcode 9 with `resumable: false`), the session is wiped and Opcode 2 (Identify) is dispatched.
  - **Zlib Inflation**: Handles compressed binary gateway frames transparently.
- **`ShardManager`**: Automatically calculates total shard counts via `/gateway/bot` if not explicitly provided, orchestrates shard instances, and manages gateway rate limits.

### 2.2 REST Client & Rate Limiting (`src/discord/rest/`)

- **`RateLimiter`**:
  - Implements Discord bucket-based rate limiting per route.
  - Generates route keys accounting for Discord top-level parameters (`/channels/:id`, `/guilds/:id`, `/webhooks/:id`).
  - Maintains per-bucket queues with promise chains ensuring requests never exceed Discord header limits (`X-RateLimit-Remaining`, `X-RateLimit-Reset-After`).
  - **Global 429 Handling**: Pauses all bucket queues across all routes until global reset time expires.
  - **5xx Exponential Backoff**: Automatically retries 500, 502, 503, and 504 errors up to configured `maxRetries` (default: 3) with exponential backoff.
- **`RestClient`**:
  - Standardized methods: `get()`, `post()`, `put()`, `patch()`, `delete()`, `request()`.
  - Type-safe Discord error handling: throws `DiscordAPIError` with Discord error code, human-readable message, and detailed field validations; throws `RateLimitError` or `HTTPError` for HTTP-level exceptions.

### 2.3 Builders (`src/discord/builders/`)

Provides a fluent, chainable API for crafting Discord objects with zero external dependencies:
- **`EmbedBuilder`**: Titles, descriptions, authors, fields, images, thumbnails, footers, colors, and timestamps.
- **`ActionRowBuilder`**: Holds components (buttons, select menus).
- **`ButtonBuilder`**: Labels, styles (`Primary`, `Secondary`, `Success`, `Danger`, `Link`), emojis, disabled flags.
- **`StringSelectMenuBuilder`**: Select menus with options, min/max values, placeholders.
- **`TextInputBuilder`**: Text inputs for modals (`Short`, `Paragraph`).
- **`ModalBuilder`**: Modals with title, customId, and component rows.
- **`PermissionsBitField`**: High-performance BigInt bitwise permission calculations and human-readable flags.

### 2.4 Interaction Model (`src/discord/interactions/`)

- **`CommandInteraction`**:
  - Encapsulates Discord application command payloads.
  - Provides `reply()`, `deferReply()`, `editReply()`, `deleteReply()`, `followUp()`.
  - Includes **`CommandOptionResolver`**: Recursively resolves subcommands, subcommand groups, strings, integers, numbers, booleans, users, members, channels, roles, and attachments.
- **`AutocompleteInteraction`**: Provides `respond()` with option choices for autocomplete queries.
- **`ComponentInteraction`**: Handles button clicks and select menu selections with `update()` and `deferUpdate()`.
- **`ModalInteraction`**: Handles modal submissions and extracts field values by input customId.

### 2.5 Client & Cache Layer (`src/discord/client/`)

- **`Client`**:
  - Event-driven bot client extending Node.js `EventEmitter`.
  - Manages REST client, shard manager, and client state.
  - Enriches raw Gateway events with helper methods (e.g. `message.reply()`, `channel.send()`, `guild.members.ban()`).
- **`ClientCache`**:
  - In-memory cache with bounded size (`maxSize`) and LRU eviction to prevent unbounded memory growth.
  - Optional sweeping intervals for stale items.

---

## 3. Routing & Runtime (`@shardjs/core`)

### 3.1 File-Based Routing (`FileRouter`)

Scans user project directories and registers handlers automatically:
- `src/commands/**/*.ts`: Slash commands and subcommands.
- `src/events/**/*.ts`: Gateway events (e.g. `ready.ts`, `messageCreate.ts`).
- `src/components/**/*.ts`: Button and select menu component handlers.
- `src/modals/**/*.ts`: Modal submission handlers.
- `src/middleware/**/*.ts`: Pre-command validation and authorization.

### 3.2 Hot Module Replacement (HMR)

In development mode (`shard dev`):
- Uses `chokidar` to monitor file system modifications.
- Reloads modified command and event modules dynamically.
- **Zero-Gateway-Drop**: The Gateway WebSocket connection remains open and active during reload, preventing Discord identify rate limits and bot downtime.
- **No Listener Leaks**: Cleans up previous command and event registrations using normalized file paths before registering reloaded handlers.

### 3.3 Onion Middleware Pipeline

- Middlewares execute in an onion pattern (`ctx, next`).
- **Fail-Closed Execution**: If any middleware rejects or throws an error, command execution halts immediately. Undefined or missing middleware references are rejected at startup to avoid runtime security vulnerabilities.

---

## 4. Built-in Web REST API (`@shardjs/api`)

- Next.js-style file-based route handlers (`src/app/api/**/route.ts`).
- Operates on Web Standard `Request` and `Response` objects.
- **Dynamic Route Matching**: Supports `[param]` and `[...catchAll]` segments.
  - Regex-escapes static path segments to prevent regex injection attacks.
  - Validates parameter names and safe-decodes URI segments with path-traversal protection.
- **Hardened HTTP Server**:
  - Defaults bind host to `127.0.0.1` (safe local development) and warns on `0.0.0.0`.
  - Configurable `maxBodySize` streaming limit (default: 1MB) returning `413 Payload Too Large`.
  - Strict CORS origin validation: enforces `Vary: Origin`, forbids wildcard origin with credentials, and returns `403 Forbidden` on unauthorized preflight requests.
  - Returns `405 Method Not Allowed` with compliant `Allow` header when the path matches but the requested HTTP verb is not defined.
  - Transparent `HEAD` request support by dispatching to `GET` handler and omitting response body.
  - Central error handling and clean status code propagation (400, 401, 403, 404, 405, 413, 429, 500) preventing unhandled process crashes.
  - Server timeout guards (`requestTimeout`, `headersTimeout`, `keepAliveTimeout`) and connection limits (`maxConnections`).
  - Client-disconnect stream cancellation.
  - Built-in sliding-window IP rate limiter with automatic expired entry pruning.
  - Fail-fast configuration validation on startup via Zod schemas.

---

## 5. Security Architecture

1. **Zero External Discord Dependencies**: All protocol communication is audited and maintained internally.
2. **Timing-Safe Authentication**: API routes support cryptographic `timingSafeEqual` comparison to eliminate timing attacks.
3. **No Unsanitized Subprocesses**: CLI commands execute child processes directly without `shell: true`, neutralizing argument injection vectors.
4. **Hardened Docker Images**: Multi-stage Docker builds generate non-root containers (`USER node`), pinned dependencies, and stripped sourcemaps in production.
