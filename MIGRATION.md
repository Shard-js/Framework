# Migration Guide: discord.js to Shard.js

This guide helps you migrate an existing Discord bot from `discord.js` (or an earlier version of Shard.js) to the standalone **Shard.js** framework.

---

## Key Differences at a Glance

| Feature | discord.js | Shard.js |
| :--- | :--- | :--- |
| **Dependencies** | `discord.js`, `@discordjs/*` | **Zero external Discord dependencies** (native API v10) |
| **Routing** | Manual event registration & handlers | **File-based routing** (`src/commands/`, `src/events/`) |
| **Development** | Full process restart on code change | **Zero-Gateway-Drop HMR** (Gateway stays connected) |
| **Web Server** | Needs external Express / Fastify / Koa | **Built-in Web API** (`src/app/api/**/route.ts`) |
| **Middlewares** | Custom wrappers or middleware libs | **Built-in Onion Middleware** (`defineMiddleware`) |
| **Builders** | `@discordjs/builders` | Exported directly from `@shardjs/core` |
| **CLI & Docker** | Manual build and Dockerfile scripts | Built-in `shard dev`, `build`, `deploy`, `docker:build` |

---

## 1. Package Dependencies

Remove `discord.js`, `@discordjs/builders`, `@discordjs/rest`, and `discord-api-types`:

```bash
# Remove discord.js packages
pnpm remove discord.js @discordjs/builders @discordjs/rest @discordjs/formatters discord-api-types

# Install Shard.js packages
pnpm add @shardjs/core @shardjs/api
pnpm add -D @shardjs/cli
```

---

## 2. Configuration (`shard.config.ts`)

Instead of instantiating `new Client({ intents: [...] })` manually in an entry file, define your configuration declaratively in `shard.config.ts`:

### Before (discord.js):
```ts
import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.login(process.env.DISCORD_TOKEN);
```

### After (Shard.js):
```ts
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

---

## 3. Slash Commands

Move your command handlers into `src/commands/*.ts`.

### Before (discord.js):
```ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a member")
  .addUserOption(option =>
    option.setName("target").setDescription("The member to ban").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("target", true);
  await interaction.reply({ content: `Banned ${target.username}` });
}
```

### After (Shard.js):
```ts
import { defineCommand } from "@shardjs/core";

export default defineCommand({
  name: "ban",
  description: "Ban a member",
  options: [
    {
      name: "target",
      description: "The member to ban",
      type: "User",
      required: true,
    },
  ],
  async run({ interaction }) {
    const target = interaction.options.getUser("target", true);
    await interaction.reply({
      content: `Banned ${target.username}`,
    });
  },
});
```

---

## 4. Builders (Embeds, Buttons, Select Menus, Modals)

Shard.js includes lightweight, fluent builders that mirror standard builder semantics:

### Embeds

```ts
// Import from @shardjs/core instead of discord.js / @discordjs/builders
import { EmbedBuilder } from "@shardjs/core";

const embed = new EmbedBuilder()
  .setTitle("Audit Log")
  .setDescription("Action completed successfully")
  .setColor(0x5865f2)
  .addFields(
    { name: "User", value: "JohnDoe#0001", inline: true },
    { name: "Reason", value: "Spamming", inline: true }
  )
  .setTimestamp();
```

### Components (Buttons & Action Rows)

```ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "@shardjs/core";

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("confirm_action")
    .setLabel("Confirm")
    .setStyle(ButtonStyle.Success),
  new ButtonBuilder()
    .setCustomId("cancel_action")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Danger)
);

await interaction.reply({
  content: "Are you sure?",
  components: [row],
});
```

---

## 5. Gateway Events

Move your event listeners into `src/events/*.ts`.

### Ready Event (`src/events/ready.ts`):
```ts
import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "ready",
  once: true,
  run({ bot }) {
    console.log(`Bot logged in as ${bot.user?.tag}!`);
  },
});
```

### Message Create Event (`src/events/messageCreate.ts`):
```ts
import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "messageCreate",
  async run({ bot }, message) {
    if (message.author.bot) return;

    if (message.content === "!ping") {
      await message.reply(`Pong! Ping: ${bot.ws.ping}ms`);
    }
  },
});
```

---

## 6. Permissions

Use `PermissionsBitField` and `PermissionFlags` from `@shardjs/core`:

```ts
import { PermissionsBitField, PermissionFlags } from "@shardjs/core";

// Check permissions
const permissions = new PermissionsBitField(member.permissions);

if (permissions.has(PermissionFlags.BanMembers)) {
  console.log("Member has permission to ban members.");
}
```

---

## 7. Command Deployment

Instead of writing a custom `deploy.js` script with `REST` and `Routes.applicationCommands`, use the built-in CLI:

```bash
# Deploy to development guild (instant update)
shard deploy

# Deploy globally to all guilds
shard deploy --global

# Clean deleted commands
shard deploy --clean
```
