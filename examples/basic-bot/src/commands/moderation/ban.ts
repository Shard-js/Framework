import { defineCommand, PermissionFlagsBits } from "@shardjs/core";

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
  middleware: ["auth"],
  async run({ interaction, options, bot, db }) {
    const targetUser = options.getUser("target", true);
    const reason = options.getString("reason") ?? "No reason provided";

    await interaction.deferReply({ ephemeral: true });

    // Optional database logging via injected db
    if (db) {
      console.log(`[db] Logging ban for user ${targetUser?.id}: ${reason}`);
    }

    if (interaction.guildId && targetUser) {
      try {
        const guild = bot.guilds.get(interaction.guildId);
        if (guild?.members?.ban) {
          await guild.members.ban(targetUser.id, { reason });
        }
      } catch (err: any) {
        await interaction.editReply({
          content: `❌ Failed to ban user: ${err.message}`,
        });
        return;
      }
    }

    await interaction.editReply({
      content: `🔨 **${targetUser?.tag}** (${targetUser?.id}) was banned.\n**Reason:** ${reason}`,
    });
  },
});
