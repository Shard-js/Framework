import fs from "node:fs";
import path from "node:path";
import colors from "picocolors";

export async function runCreate(name: string = "my-shard-bot"): Promise<void> {
  const targetDir = path.resolve(process.cwd(), name);

  console.log(colors.cyan(colors.bold(`\n🛠️ shard create - Scaffolding new bot project in: ${name}\n`)));

  if (fs.existsSync(targetDir)) {
    console.error(colors.red(`❌ Directory '${name}' already exists!`));
    process.exit(1);
  }

  // Create project directories
  const dirs = [
    path.join(targetDir, "src/commands"),
    path.join(targetDir, "src/events"),
    path.join(targetDir, "src/app/api/health"),
    path.join(targetDir, "src/middleware"),
  ];

  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }

  // Write package.json
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
      "@shardjs/core": "^0.1.0",
      "@shardjs/cli": "^0.1.0",
      "discord.js": "^14.18.0",
      "discord-api-types": "^0.37.119",
      "zod": "^3.24.2",
    },
    devDependencies: {
      "typescript": "^5.7.3",
      "@types/node": "^22.13.0",
    },
  };
  fs.writeFileSync(
    path.join(targetDir, "package.json"),
    JSON.stringify(pkgJson, null, 2)
  );

  // Write tsconfig.json
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

  // Write shard.config.ts
  const shardConfig = `import { defineConfig } from "@shardjs/core";
import { GatewayIntentBits } from "discord-api-types/v10";

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
});
`;
  fs.writeFileSync(path.join(targetDir, "shard.config.ts"), shardConfig);

  // Write src/commands/ping.ts
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

  // Write src/events/ready.ts
  const readyEvent = `import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "ready",
  once: true,
  async run(client) {
    console.log(\`✅ Logged in as \${client.user.tag}!\`);
  },
});
`;
  fs.writeFileSync(path.join(targetDir, "src/events/ready.ts"), readyEvent);

  // Write src/app/api/health/route.ts
  const healthRoute = `import { defineRoute } from "@shardjs/core";

export const GET = defineRoute(async ({ bot }) => {
  return Response.json({
    status: "ok",
    botOnline: Boolean(bot.isReady()),
    ping: bot.ws.ping,
    timestamp: new Date().toISOString(),
  });
});
`;
  fs.writeFileSync(path.join(targetDir, "src/app/api/health/route.ts"), healthRoute);

  // Write .env.example
  fs.writeFileSync(
    path.join(targetDir, ".env.example"),
    "DISCORD_TOKEN=your_bot_token_here\n"
  );
  fs.writeFileSync(
    path.join(targetDir, ".env"),
    "DISCORD_TOKEN=your_bot_token_here\n"
  );

  // Write .gitignore
  fs.writeFileSync(
    path.join(targetDir, ".gitignore"),
    "node_modules/\n.shard/\n.env\n.env.local\ndist/\n"
  );

  console.log(colors.green(`✨ Successfully created project '${name}'!`));
  console.log(colors.cyan("\nNext steps:"));
  console.log(`  1. cd ${name}`);
  console.log("  2. Add your bot token to .env");
  console.log("  3. pnpm install (or npm install)");
  console.log("  4. shard dev\n");
}
