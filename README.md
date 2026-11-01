# Shard.js

> **The Next.js for Discord Bots** — A modern, fully standalone TypeScript framework for building scalable Discord bots with file-based routing, built-in REST API, middleware, plugins, and zero-downtime hot reloading. Built directly on the official Discord API v10 with zero runtime dependency on `discord.js`.

---

## Key Features

- **Standalone Discord Engine**: Built directly on Discord API v10 with native Gateway (sharding, heartbeat jitter, ACK detection, session resume) and REST client (bucket-based rate limiting, global 429 backoff, 5xx retry).
- **Next.js Developer Experience**: Zero-boilerplate file-based routing for Slash Commands, Gateway Events, Component handlers, and HTTP Route Handlers.
- **Built-in Web REST API**: Route Handlers (`src/app/api/**/route.ts`) powered by Web Standard `Request` and `Response` with parameter validation and path-traversal protection.
- **Zero-Gateway-Drop Hot Reloading**: Hot module replacement for commands and events that keeps the Discord Gateway connection alive without hitting Discord identify rate limits.
- **End-to-End Type Safety**: Pure TypeScript architecture with native Discord entities, fluent builders (`EmbedBuilder`, `ActionRowBuilder`, `ButtonBuilder`, `ModalBuilder`), and bitfield permissions (`PermissionsBitField`).
- **Onion Middleware Pipeline**: Composable middlewares (`defineMiddleware`) with fail-closed security for authentication and rate-limiting.
- **Extensible Plugin System**: Add database connections (Drizzle ORM), dashboards, or custom CLI commands seamlessly.
- **Dedicated CLI & Docker Tooling**: Manage your application with `shard dev`, `shard build`, `shard start`, `shard deploy`, `shard doctor`, and hardened `shard docker:build`.

---

## Monorepo Architecture

```
shard-framework/
├── packages/
│   ├── core/            # @shardjs/core: Standalone Discord protocol engine & bot runtime
│   ├── api/             # @shardjs/api: Built-in HTTP Route Handler web server
│   ├── cli/             # @shardjs/cli: The `shard` command line tool
│   ├── create-shard/    # create-shard: Interactive project scaffolding
│   └── plugin-drizzle/  # @shardjs/plugin-drizzle: Official Drizzle ORM plugin
├── examples/
│   └── basic-bot/       # Showcase bot with Slash Commands, Events, and API
├── turbo.json           # Turborepo task orchestration
└── pnpm-workspace.yaml  # pnpm workspace definition
```

---

## Quick Start

### 1. Create a New Bot

```bash
# Using create-shard
npx create-shard my-bot

# Or using the shard CLI
shard create my-bot
cd my-bot
```

### 2. Configure Your Bot

Edit `shard.config.ts` and set your `DISCORD_TOKEN` in `.env`:

```ts
// shard.config.ts
import { defineConfig, GatewayIntentBits } from "@shardjs/core";

export default defineConfig({
  token: process.env.DISCORD_TOKEN,
  devGuildId: process.env.DEV_GUILD_ID,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
  api: {
    port: 3000,
    prefix: "/api",
  },
});
```

### 3. Start Development Server

```bash
shard dev
```

Your Discord bot is online, listening for gateway events, and your REST API server is live on `http://127.0.0.1:3000/api`!

---

## File-Based Routing Conventions

```
src/
├── commands/            # Slash Commands & Subcommands
│   ├── ping.ts          # /ping
│   └── moderation/
│       └── ban.ts       # /ban (with permission flags & options)
├── events/              # Discord Gateway Events
│   ├── ready.ts         # 'ready' event
│   └── messageCreate.ts # 'messageCreate' event
├── components/          # Buttons and Select Menus
│   └── confirm.ts       # customId handler
├── modals/              # Modal Submissions
│   └── feedback.ts      # modal customId handler
├── app/api/             # Web API Route Handlers
│   ├── health/
│   │   └── route.ts     # GET /api/health
│   └── guilds/
│       └── [id]/
│           └── route.ts # GET, POST /api/guilds/:id
├── middleware/          # Composable Middlewares
│   └── auth.ts          # Route & command guards
└── plugins/             # Local bot plugins
    └── database.ts
```

---

## Code Examples

### 1. Slash Command (`src/commands/ping.ts`)

```ts
import { defineCommand } from "@shardjs/core";

export default defineCommand({
  name: "ping",
  description: "Check bot latency",
  async run({ interaction, bot }) {
    await interaction.reply({
      content: `Pong! WebSocket Ping: **${bot.ws.ping}ms**`,
    });
  },
});
```

### 2. Gateway Event (`src/events/ready.ts`)

```ts
import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "ready",
  once: true,
  run({ bot }) {
    console.log(`Logged in as ${bot.user?.tag || "Unknown"}!`);
  },
});
```

### 3. Web Route Handler (`src/app/api/guilds/[id]/route.ts`)

```ts
import { defineRoute } from "@shardjs/core";

export const GET = defineRoute(async ({ params, bot }) => {
  const guild = bot.guilds.cache.get(params.id);
  if (!guild) {
    return Response.json({ error: "Guild not found" }, { status: 404 });
  }

  return Response.json({
    id: guild.id,
    name: guild.name,
    memberCount: guild.member_count ?? guild.memberCount,
  });
});
```

*Security defaults: The API server is hardened out of the box with a 1 MB body-size limit (HTTP 413), 30s request timeout, 15s headers timeout, strict CORS origin checks (`*` with credentials rejected at startup), and constant-time `timingSafeEqual` authentication.*

### 4. Middleware (`src/middleware/auth.ts`)

Middlewares protect specific commands by name (`middleware: ["auth"]`) or apply globally. Use a fail-closed approach to ensure unauthenticated requests never slip through:

```ts
import { defineMiddleware, PermissionsBitField, PermissionFlagsBits } from "@shardjs/core";

export default defineMiddleware({
  name: "auth",
  async run(ctx, next) {
    // Fail-closed: ensure interaction context exists for command guards
    if (!ctx.interaction) {
      throw new Error("Unauthorized: Interaction context required.");
    }

    const perms = new PermissionsBitField(ctx.interaction.member?.permissions || "0");
    if (!perms.has(PermissionFlagsBits.BanMembers)) {
      await ctx.interaction.reply({
        content: "You do not have permission to execute this command.",
        ephemeral: true,
      });
      return;
    }

    await next();
  },
});
```
*Tip: Attach named middleware to specific commands (e.g. `middleware: ["auth"]` in `src/commands/moderation/ban.ts`) so commands like `/ping` remain public.*

### 5. Modals & Text Inputs (`src/commands/feedback.ts`)

```ts
import { defineCommand, ModalBuilder, TextInputBuilder, ActionRowBuilder } from "@shardjs/core";

export default defineCommand({
  name: "feedback",
  description: "Send feedback to the developers",
  async run({ interaction }) {
    const modal = new ModalBuilder()
      .setCustomId("modal-feedback")
      .setTitle("Feedback Form")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("feedback-input")
            .setLabel("What can we improve?")
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  },
});
```

### 6. Drizzle ORM Plugin

```ts
import { drizzlePlugin } from "@shardjs/plugin-drizzle";
import { db } from "./db/client.js";

export default defineConfig({
  plugins: [
    drizzlePlugin({ client: db }),
  ],
});
```

---

## Entity Conventions & Naming

Shard.js provides high-level camelCase helper properties on interactions and cached entities, while raw payloads from Discord are preserved:
- **Client & Entities**: High-level helpers (`interaction.user`, `message.reply()`, `guild.members.ban()`).
- **Gateway Events**: Emitted in standard camelCase (`messageCreate`, `voiceStateUpdate`, `guildRoleCreate`).
- **Cache Parity**: Caches support both direct access (`bot.guilds.get(id)`) and discord.js style (`bot.guilds.cache.get(id)`).
- **Raw Discord Fields**: Discord API v10 raw snake_case properties are always accessible via `interaction.raw` or directly on the entity (e.g. `member_count`, `channel_id`).

---

## Feature-Matrix vs. discord.js

| Feature | Shard.js | discord.js | Notes |
| :--- | :---: | :---: | :--- |
| **Discord API Target** | v10 | v10 | Native implementation without external Discord wrappers |
| **Gateway Engine** | ✅ Native | ✅ Native | Auto-reconnect, resume, jitter, heartbeat ACK |
| **Identify Rate Limiting** | ✅ Queue (5s / bucket) | ✅ Queue (5s / bucket) | Respects `max_concurrency` from Discord `/gateway/bot` |
| **REST Engine** | ✅ Native (fetch) | ✅ Undici / REST | Sequential route bucket rate limiting, global 429 backoff |
| **Multipart Uploads** | ✅ Web FormData | ✅ Custom Multipart | File uploads in channel send, interaction replies, followups |
| **Slash Commands** | ✅ Declarative | ✅ Manual builders | Extended options: min/max value, length, channel types, localizations |
| **Context Menus** | ✅ User & Message | ✅ User & Message | Fully routed through `FileRouter` and `defineCommand` |
| **Folder-based Subcommands** | ✅ Built-in | ❌ Manual tree | Nested commands (e.g. `src/commands/moderation/ban.ts` -> `/moderation ban`) |
| **Directory Middleware** | ✅ Cascade | ❌ Manual | `_middleware.ts` runs in order: Global -> Folder -> Command |
| **File-based Routing** | ✅ Built-in | ❌ External loaders | Auto-discovers commands, events, components, modals, API |
| **Hot Module Replacement (HMR)** | ✅ Zero-Gateway-Drop | ❌ Full restart | Reloads commands, events, routes without dropping Gateway connection |
| **Built-in Web API** | ✅ Built-in (`@shardjs/api`) | ❌ Express/Fastify | Native Web Standard Request/Response, Next.js-style routes |
| **Serverless Webhook Mode** | ✅ Built-in Ed25519 | ⚠️ Requires external | Handles Discord HTTP interactions directly via Webhooks |
| **Test Mock Helpers** | ✅ Built-in | ❌ Community mocks | `createMockInteraction()`, `createMockClient()`, `createMockRouteContext()` |
| **Voice / Audio** | ❌ None | ✅ `@discordjs/voice` | Shard.js does not provide native voice/audio streaming |
| **Autocomplete Interactions** | ✅ Built-in | ✅ Built-in | Supported via `autocomplete(ctx)` on command definitions |
| **Partials** | ❌ Not needed | ✅ Supported | Raw entities accessible directly; configurable LRU cache limits |
| **Bundle Size & Dependencies** | 🪶 Extremely lean | 📦 Heavy | 0 runtime Discord dependencies, fast cold starts |

---

## CLI Reference

| Command | Flags | Description |
| :--- | :--- | :--- |
| `shard create [name]` | | Scaffolds a new bot project |
| `shard dev` | `-p, --port <port>` | Starts development mode with Hot Module Reloading |
| `shard build` | `--outDir <dir>` | Compiles TypeScript project into `.shard/dist` |
| `shard start` | `-p, --port <port>` | Runs compiled bot in production mode |
| `shard deploy` | `-g, --guild <id>`, `--global`, `--clean` | Deploys Slash Commands to Discord REST API |
| `shard doctor` | | Health check for tokens, intents, node version & files |
| `shard docker:build` | `[tag]` | Builds optimized, hardened multi-stage Docker container |
| `shard docker:run` | `[tag]`, `-p, --port` | Runs container with `.env` file mounted |

---

## Documentation

- [Architecture Guide](ARCHITECTURE.md) — Comprehensive technical guide to Gateway, REST, routing, and security.
- [Migration Guide](MIGRATION.md) — Step-by-step guide for migrating from `discord.js`.
- [Contributing](CONTRIBUTING.md) — Development setup, monorepo workflow, and contribution guidelines.

---

## License

MIT © shard contributors
