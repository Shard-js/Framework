import fs from "node:fs";
import path from "node:path";
import colors from "picocolors";

export type ProjectTemplate = "minimal" | "api-drizzle" | "moderation";

export interface CreateOptions {
  template?: ProjectTemplate | string;
}

export async function runCreate(
  name: string = "my-shard-bot",
  options: CreateOptions = {}
): Promise<void> {
  const targetDir = path.resolve(process.cwd(), name);
  const template: ProjectTemplate =
    options.template === "api-drizzle" || options.template === "drizzle"
      ? "api-drizzle"
      : options.template === "moderation"
      ? "moderation"
      : "minimal";

  console.log(
    colors.cyan(
      colors.bold(
        `\n🛠️ shard create - Scaffolding new bot project (${template}) in: ${name}\n`
      )
    )
  );

  if (fs.existsSync(targetDir)) {
    console.error(colors.red(`❌ Directory '${name}' already exists!`));
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
    },
    include: ["src/**/*", "shard.config.ts"],
  };
  fs.writeFileSync(
    path.join(targetDir, "tsconfig.json"),
    JSON.stringify(tsConfig, null, 2)
  );

  fs.writeFileSync(
    path.join(targetDir, ".gitignore"),
    "node_modules/\n.shard/\n.env\n.env.local\ndist/\n*.db\n"
  );
  fs.writeFileSync(
    path.join(targetDir, ".env.example"),
    "DISCORD_TOKEN=your_bot_token_here\n"
  );
  fs.writeFileSync(
    path.join(targetDir, ".env"),
    "DISCORD_TOKEN=your_bot_token_here\n"
  );

  switch (template) {
    case "api-drizzle":
      scaffoldApiDrizzle(targetDir, name);
      break;
    case "moderation":
      scaffoldModeration(targetDir, name);
      break;
    case "minimal":
    default:
      scaffoldMinimal(targetDir, name);
      break;
  }

  console.log(
    colors.green(`✨ Successfully created project '${name}' using template '${template}'!`)
  );
  console.log(colors.cyan("\nNext steps:"));
  console.log(`  1. cd ${name}`);
  console.log("  2. Add your bot token to .env");
  console.log("  3. pnpm install (or npm install)");
  console.log("  4. shard dev\n");
}

function scaffoldMinimal(targetDir: string, name: string): void {
  fs.mkdirSync(path.join(targetDir, "src/commands"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src/events"), { recursive: true });

  const pkgJson = {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "shard dev",
      build: "shard build",
      start: "shard start",
      deploy: "shard deploy",
      doctor: "shard doctor",
    },
    dependencies: {
      "@shardjs/core": "^0.2.0",
      "@shardjs/cli": "^0.2.0",
      "zod": "^3.24.2",
    },
    devDependencies: {
      typescript: "^5.7.3",
      "@types/node": "^22.13.0",
    },
  };
  fs.writeFileSync(
    path.join(targetDir, "package.json"),
    JSON.stringify(pkgJson, null, 2)
  );

  const shardConfig = `import { defineConfig, GatewayIntentBits } from "@shardjs/core";

export default defineConfig({
  token: process.env.DISCORD_TOKEN,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});
`;
  fs.writeFileSync(path.join(targetDir, "shard.config.ts"), shardConfig);

  const pingCommand = `import { defineCommand } from "@shardjs/core";

export default defineCommand({
  name: "ping",
  description: "Replies with Pong and latency",
  async run({ interaction, bot }) {
    await interaction.reply({
      content: \`🏓 Pong! WebSocket Ping: \${bot.ws.ping}ms\`,
    });
  },
});
`;
  fs.writeFileSync(path.join(targetDir, "src/commands/ping.ts"), pingCommand);

  const readyEvent = `import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "ready",
  once: true,
  async run(client) {
    console.log(\`✅ Logged in as \${client.user?.tag}!\`);
  },
});
`;
  fs.writeFileSync(path.join(targetDir, "src/events/ready.ts"), readyEvent);
}

function scaffoldApiDrizzle(targetDir: string, name: string): void {
  fs.mkdirSync(path.join(targetDir, "src/commands"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src/events"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src/app/api/health"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src/db"), { recursive: true });

  const pkgJson = {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "shard dev",
      build: "shard build",
      start: "shard start",
      deploy: "shard deploy",
      doctor: "shard doctor",
    },
    dependencies: {
      "@shardjs/core": "^0.2.0",
      "@shardjs/cli": "^0.2.0",
      "@shardjs/plugin-drizzle": "^0.2.0",
      "drizzle-orm": "^0.39.3",
      "better-sqlite3": "^11.8.1",
      "zod": "^3.24.2",
    },
    devDependencies: {
      typescript: "^5.7.3",
      "@types/node": "^22.13.0",
      "@types/better-sqlite3": "^7.6.12",
    },
  };
  fs.writeFileSync(
    path.join(targetDir, "package.json"),
    JSON.stringify(pkgJson, null, 2)
  );

  const dbSchema = `import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const guildSettings = sqliteTable("guild_settings", {
  id: text("id").primaryKey(),
  prefix: text("prefix").default("!"),
  joinedAt: integer("joined_at", { mode: "timestamp" }),
});
`;
  fs.writeFileSync(path.join(targetDir, "src/db/schema.ts"), dbSchema);

  const dbInit = `import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const sqlite = new Database("shard.db");
export const db = drizzle(sqlite, { schema });
`;
  fs.writeFileSync(path.join(targetDir, "src/db/index.ts"), dbInit);

  const shardConfig = `import { defineConfig, GatewayIntentBits } from "@shardjs/core";
import { drizzlePlugin } from "@shardjs/plugin-drizzle";
import { db } from "./src/db/index.js";

export default defineConfig({
  token: process.env.DISCORD_TOKEN,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
  api: {
    port: 3000,
    prefix: "/api",
  },
  plugins: [
    drizzlePlugin({ client: db }),
  ],
});
`;
  fs.writeFileSync(path.join(targetDir, "shard.config.ts"), shardConfig);

  const pingCommand = `import { defineCommand } from "@shardjs/core";

export default defineCommand({
  name: "ping",
  description: "Replies with Pong and latency",
  async run({ interaction, bot, db }) {
    await interaction.reply({
      content: \`🏓 Pong! WebSocket Ping: \${bot.ws.ping}ms | DB Connected: \${Boolean(db)}\`,
    });
  },
});
`;
  fs.writeFileSync(path.join(targetDir, "src/commands/ping.ts"), pingCommand);

  const healthRoute = `import { defineRoute } from "@shardjs/core";

export const GET = defineRoute(async ({ bot, db }) => {
  return Response.json({
    status: "ok",
    botOnline: Boolean(bot.isReady()),
    ping: bot.ws.ping,
    hasDb: Boolean(db),
    timestamp: new Date().toISOString(),
  });
});
`;
  fs.writeFileSync(path.join(targetDir, "src/app/api/health/route.ts"), healthRoute);

  const readyEvent = `import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "ready",
  once: true,
  async run(client) {
    console.log(\`✅ Logged in as \${client.user?.tag}!\`);
  },
});
`;
  fs.writeFileSync(path.join(targetDir, "src/events/ready.ts"), readyEvent);
}

function scaffoldModeration(targetDir: string, name: string): void {
  fs.mkdirSync(path.join(targetDir, "src/commands/moderation"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src/events"), { recursive: true });

  const pkgJson = {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "shard dev",
      build: "shard build",
      start: "shard start",
      deploy: "shard deploy",
      doctor: "shard doctor",
    },
    dependencies: {
      "@shardjs/core": "^0.2.0",
      "@shardjs/cli": "^0.2.0",
      "zod": "^3.24.2",
    },
    devDependencies: {
      typescript: "^5.7.3",
      "@types/node": "^22.13.0",
    },
  };
  fs.writeFileSync(
    path.join(targetDir, "package.json"),
    JSON.stringify(pkgJson, null, 2)
  );

  const shardConfig = `import { defineConfig, GatewayIntentBits } from "@shardjs/core";

export default defineConfig({
  token: process.env.DISCORD_TOKEN,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
  ],
});
`;
  fs.writeFileSync(path.join(targetDir, "shard.config.ts"), shardConfig);

  const moderationMiddleware = `import { defineMiddleware } from "@shardjs/core";

export default defineMiddleware(async (ctx, next) => {
  if (!ctx.interaction.inGuild()) {
    await ctx.interaction.reply({
      content: "❌ Moderation commands can only be executed inside a Discord server.",
      ephemeral: true,
    });
    return;
  }
  await next();
});
`;
  fs.writeFileSync(
    path.join(targetDir, "src/commands/moderation/_middleware.ts"),
    moderationMiddleware
  );

  const banCommand = `import { defineCommand, PermissionFlagsBits } from "@shardjs/core";

export default defineCommand({
  name: "ban",
  description: "Bans a member from the Discord guild",
  guildOnly: true,
  defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  options: [
    {
      name: "target",
      description: "The member to ban",
      type: "User",
      required: true,
    },
    {
      name: "reason",
      description: "Reason for the ban",
      type: "String",
      required: false,
    },
  ],
  async run({ interaction, options }) {
    const user = options.getUser("target", true);
    const reason = options.getString("reason") ?? "No reason provided";
    await interaction.reply({
      content: \`🔨 **\${user?.tag}** was banned.\\n**Reason:** \${reason}\`,
    });
  },
});
`;
  fs.writeFileSync(
    path.join(targetDir, "src/commands/moderation/ban.ts"),
    banCommand
  );

  const kickCommand = `import { defineCommand, PermissionFlagsBits } from "@shardjs/core";

export default defineCommand({
  name: "kick",
  description: "Kicks a member from the Discord guild",
  guildOnly: true,
  defaultMemberPermissions: PermissionFlagsBits.KickMembers,
  options: [
    {
      name: "target",
      description: "The member to kick",
      type: "User",
      required: true,
    },
    {
      name: "reason",
      description: "Reason for the kick",
      type: "String",
      required: false,
    },
  ],
  async run({ interaction, options }) {
    const user = options.getUser("target", true);
    const reason = options.getString("reason") ?? "No reason provided";
    await interaction.reply({
      content: \`👢 **\${user?.tag}** was kicked.\\n**Reason:** \${reason}\`,
    });
  },
});
`;
  fs.writeFileSync(
    path.join(targetDir, "src/commands/moderation/kick.ts"),
    kickCommand
  );

  const warnCommand = `import { defineCommand, PermissionFlagsBits } from "@shardjs/core";

export default defineCommand({
  name: "warn",
  description: "Warns a member in the Discord guild",
  guildOnly: true,
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  options: [
    {
      name: "target",
      description: "The member to warn",
      type: "User",
      required: true,
    },
    {
      name: "warning",
      description: "Warning message",
      type: "String",
      required: true,
    },
  ],
  async run({ interaction, options }) {
    const user = options.getUser("target", true);
    const warning = options.getString("warning", true);
    await interaction.reply({
      content: \`⚠️ **\${user?.tag}** has been warned: \${warning}\`,
    });
  },
});
`;
  fs.writeFileSync(path.join(targetDir, "src/commands/warn.ts"), warnCommand);

  const guildCreateEvent = `import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "guildCreate",
  async run(ctx, guild) {
    console.log(\`🏰 Bot joined guild: \${guild.name} (\${guild.id}) with \${guild.member_count} members\`);
  },
});
`;
  fs.writeFileSync(
    path.join(targetDir, "src/events/guildCreate.ts"),
    guildCreateEvent
  );

  const readyEvent = `import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "ready",
  once: true,
  async run(client) {
    console.log(\`✅ Moderation Bot online as \${client.user?.tag}!\`);
  },
});
`;
  fs.writeFileSync(path.join(targetDir, "src/events/ready.ts"), readyEvent);
}
