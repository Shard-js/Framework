import colors from "picocolors";
import { FileRouter, loadConfig, deployCommands } from "@shardjs/core";

export interface DeployCliOptions {
  guild?: string;
  global?: boolean;
  clean?: boolean;
}

export async function runDeploy(options: DeployCliOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  console.log(colors.cyan(colors.bold("\n🚀 shard deploy - Registering Application Commands...\n")));

  const { config } = await loadConfig(rootDir);
  const router = new FileRouter(rootDir);
  await router.loadCommands();

  const commandList = Array.from(router.commands.values());

  if (commandList.length === 0 && !options.clean) {
    console.warn(colors.yellow("⚠️ No slash commands found in src/commands to deploy."));
    return;
  }

  console.log(colors.gray(`Found ${commandList.length} command(s):`));
  for (const cmd of commandList) {
    console.log(colors.gray(`  • /${cmd.name} - ${cmd.description}`));
  }
  console.log("");

  try {
    const res = await deployCommands(commandList, config, {
      guildId: options.guild,
      global: options.global,
      clean: options.clean,
    });

    console.log(
      colors.green(
        `\n✅ Successfully deployed ${res.count} command(s) to ${res.target}!`
      )
    );
  } catch (err: any) {
    console.error(colors.red("\n❌ Failed to deploy commands:"), err.message);
    process.exit(1);
  }
}
