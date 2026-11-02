import {
  defineCommand,
  SlashCommandBuilder,
  PermissionFlagsBits,
  cooldown,
  requireGuild,
} from "@shardjs/core";

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bans a member from the Discord guild")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName("target").setDescription("The member to ban").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the ban").setRequired(false)
    ),
  middleware: ["auth", cooldown(5), requireGuild()],
  async run({ interaction, options, bot, db }) {
    const targetUser = options.getUser("target", true);
    const reason = options.getString("reason") ?? "No reason provided";

    await interaction.deferReply({ ephemeral: true });

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
