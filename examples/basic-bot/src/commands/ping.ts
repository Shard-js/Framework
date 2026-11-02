import { defineCommand, SlashCommandBuilder, cooldown } from "@shardjs-framework/core";

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Displays the bot's WebSocket latency"),
  middleware: [cooldown(3)],
  async run({ interaction, bot }) {
    const ping = bot.ws.ping;
    await interaction.reply({
      content: `🏓 Pong! WebSocket Latency: **${ping}ms**`,
    });
  },
});
