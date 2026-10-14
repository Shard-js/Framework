import { cac } from "cac";
import colors from "picocolors";
import { loadConfig } from "@shardjs/core";
import { runDev } from "./commands/dev.js";
import { runBuild } from "./commands/build.js";
import { runStart } from "./commands/start.js";
import { runDeploy } from "./commands/deploy.js";
import { runDoctor } from "./commands/doctor.js";
import { runCreate } from "./commands/create.js";
import { runDockerBuild, runDockerRun } from "./commands/docker.js";

export {
  runDev,
  runBuild,
  runStart,
  runDeploy,
  runDoctor,
  runCreate,
  runDockerBuild,
  runDockerRun,
};

export async function runCli(argv = process.argv): Promise<void> {
  const cli = cac("shard");

  // Load config to check for plugin CLI extensions
  let plugins: any[] = [];
  try {
    const { config } = await loadConfig(process.cwd());
    if (config?.plugins) {
      plugins = config.plugins;
    }
  } catch {
    // ignore config errors during initial commands like create
  }

  // shard create <name>
  cli
    .command("create [name]", "Create a new shard Discord bot project")
    .action(async (name) => {
      await runCreate(name);
    });

  // shard dev
  cli
    .command("dev", "Start bot in development mode with Hot Module Reloading")
    .option("-p, --port <port>", "Port for the built-in HTTP Web API", {
      default: 3000,
    })
    .action(async (options) => {
      await runDev({ port: Number(options.port) });
    });

  // shard build
  cli
    .command("build", "Build optimized ESM production bundle")
    .option("--outDir <dir>", "Output directory", { default: ".shard/dist" })
    .action(async (options) => {
      await runBuild({ outDir: options.outDir });
    });

  // shard start
  cli
    .command("start", "Start compiled bot in production mode")
    .option("-p, --port <port>", "Port for the HTTP Web API")
    .action(async (options) => {
      await runStart({ port: options.port ? Number(options.port) : undefined });
    });

  // shard deploy
  cli
    .command("deploy", "Deploy application slash commands to Discord")
    .option("-g, --guild <id>", "Target Guild ID for instant deployment")
    .option("--global", "Deploy commands globally across Discord")
    .option("--clean", "Clear all commands on target")
    .action(async (options) => {
      await runDeploy(options);
    });

  // shard doctor
  cli
    .command("doctor", "Validate environment, tokens, intents and project health")
    .action(async () => {
      await runDoctor();
    });

  // shard docker build & shard docker run
  cli
    .command("docker:build [tag]", "Build a production Docker container image")
    .action(async (tag) => {
      await runDockerBuild(tag);
    });

  cli
    .command("docker:run [tag]", "Run Docker container with .env file")
    .option("-p, --port <port>", "Port to expose", { default: "3000" })
    .action(async (tag, options) => {
      await runDockerRun(tag, options.port);
    });

  // Allow registered plugins to extend the CLI
  for (const plugin of plugins) {
    if (typeof plugin.cli === "function") {
      try {
        plugin.cli(cli);
      } catch (err: any) {
        console.warn(
          colors.yellow(`[shard] Warning: Plugin '${plugin.name}' failed to extend CLI: ${err.message}`)
        );
      }
    }
  }

  cli.help();
  cli.version("0.2.0");

  try {
    cli.parse(argv, { run: false });
    await cli.runMatchedCommand();
  } catch (err: any) {
    console.error(colors.red(`\n❌ Error: ${err.message}`));
    process.exit(1);
  }
}
