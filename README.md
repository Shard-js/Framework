# 💎 shard

> **The Next.js for Discord Bots** — A modern, type-safe TypeScript framework for building scalable Discord bots with file-based routing, built-in REST API, middleware, plugins, and zero-downtime hot reloading.

---

## 🚀 Vision & Key Features

* **⚡ Next.js Developer Experience:** Zero boilerplate file-based routing for Slash Commands, Gateway Events, and HTTP Route Handlers.
* **🌐 Built-in Web REST API:** Built-in Route Handlers (`src/app/api/**/route.ts`) powered by Web Standard `Request` and `Response`.
* **🔄 Zero-Gateway-Drop Hot Reloading:** Hot module replacement for commands and events that keeps the Discord WebSocket connection alive without hitting Discord identify rate limits.
* **🛡️ End-to-End Type Safety:** Deep TypeScript integration using `discord-api-types/v10` and Zod environment validation.
* **🧅 Onion Middleware Pipeline:** Composable middlewares (`defineMiddleware`) for permissions, rate-limiting, and cooldowns.
* **🔌 Extensible Plugin System:** Add database connections (Drizzle, Prisma), OAuth2 dashboards, or custom CLI commands seamlessly.
* **🛠️ Dedicated CLI:** Run everything with `shard dev`, `shard build`, `shard start`, `shard deploy`, and `shard doctor`.

---

## 📦 Monorepo Architecture

```
shard-framework/
├── packages/
│   ├── core/            # @shardjs/core: Runtime abstractions, bot engine, router
│   ├── api/             # @shardjs/api: Built-in HTTP Route Handler web server
│   ├── cli/             # @shardjs/cli: The `shard` command line binary
│   ├── create-shard/    # create-shard: Interactive project scaffolding
│   └── plugin-drizzle/  # @shardjs/plugin-drizzle: Official Drizzle ORM plugin
├── examples/
│   └── basic-bot/       # Showcase bot with Slash Commands, Events, and API
├── turbo.json           # Turborepo task orchestration
└── pnpm-workspace.yaml  # pnpm workspace definition
```

---

## ⚡ Quick Start

### 1. Create a New Bot

```bash
# Using create-shard
npx create-shard my-bot

# Or using the shard CLI directly
shard create my-bot
cd my-bot
```

### 2. Configure Your Bot

Edit `shard.config.ts` and set your `DISCORD_TOKEN` in `.env`:

```ts
// shard.config.ts
import { defineConfig } from "@shardjs/core";
import { GatewayIntentBits } from "discord-api-types/v10";

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

Your Discord bot is online, listening for gateway events, and your REST API server is live on `http://localhost:3000/api`!

---

## 📁 File-Based Routing Conventions

```
src/
├── commands/            # Slash Commands & Context Menus
│   ├── ping.ts          # /ping
│   └── moderation/
│       └── ban.ts       # /ban (with permission flags & options)
├── events/              # Discord Gateway Events
│   ├── ready.ts         # 'ready' event
│   └── messageCreate.ts # 'messageCreate' event
├── app/api/             # Web API Route Handlers
│   ├── health/
│   │   └── route.ts     # GET /api/health
│   └── guilds/
│       └── [id]/
│           └── route.ts # GET, POST /api/guilds/:id
├── middleware/          # Composable Middlewares
│   └── auth.ts          # Global and route-level guards
└── plugins/             # Local bot plugins
    └── database.ts
```

---

## 📝 Code Examples

### 1. Slash Command (`src/commands/ping.ts`)

```ts
import { defineCommand } from "@shardjs/core";

export default defineCommand({
  name: "ping",
  description: "Check bot latency",
  async run({ interaction, bot }) {
    await interaction.reply({
      content: `🏓 Pong! WebSocket Ping: **${bot.ws.ping}ms**`,
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
  async run(client) {
    console.log(`🤖 Logged in as ${client.user.tag}`);
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
    members: guild.memberCount,
  });
});

export const POST = defineRoute(async ({ request, params, bot }) => {
  const { message, channelId } = await request.json();
  const channel = bot.channels.cache.get(channelId);
  if (channel?.isTextBased()) {
    await channel.send(message);
    return Response.json({ success: true });
  }
  return Response.json({ error: "Invalid channel" }, { status: 400 });
});
```

### 4. Middleware (`src/middleware/auth.ts`)

```ts
import { defineMiddleware } from "@shardjs/core";

export default defineMiddleware({
  name: "auth",
  async run(ctx, next) {
    if (ctx.interaction?.isChatInputCommand()) {
      console.log(`[auth] Guarding command /${ctx.interaction.commandName}`);
    }
    await next();
  },
});
```

### 5. Plugin (`packages/plugin-drizzle`)

```ts
import { definePlugin } from "@shardjs/core";

declare module "@shardjs/core" {
  interface ShardContext {
    db: any;
  }
}

export default definePlugin({
  name: "drizzle",
  cli(cmd) {
    cmd.command("db:migrate", "Run migrations").action(async () => {
      console.log("Migrating database...");
    });
  },
  async setup({ inject }) {
    inject("db", myDatabaseInstance);
  },
});
```

---

## 🛠️ CLI Reference

| Command | Flags | Description |
| :--- | :--- | :--- |
| `shard create [name]` | | Scaffolds a new bot project |
| `shard dev` | `-p, --port <port>` | Starts development mode with Hot Module Reloading |
| `shard build` | `--outDir <dir>` | Compiles TypeScript project into `.shard/dist` |
| `shard start` | `-p, --port <port>` | Runs compiled bot in production mode |
| `shard deploy` | `-g, --guild <id>`, `--global`, `--clean` | Deploys Slash Commands to Discord REST API |
| `shard doctor` | | Health check for tokens, intents, node version & files |
| `shard docker:build` | `[tag]` | Builds optimized multi-stage Docker container |
| `shard docker:run` | `[tag]`, `-p, --port` | Runs container with `.env` file mounted |

---

## 📜 License

MIT © shard contributors
