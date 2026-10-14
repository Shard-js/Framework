import fs from "node:fs";
import path from "node:path";
import colors from "picocolors";
import { RestClient, Endpoints, loadConfig, normalizeIntents } from "@shardjs/core";

export async function runDoctor(): Promise<void> {
  const rootDir = process.cwd();
  console.log(colors.cyan(colors.bold("\n🩺 shard doctor - Diagnostic & Health Check\n")));

  let passed = 0;
  let warnings = 0;
  let errors = 0;

  function pass(msg: string) {
    console.log(colors.green(`  ✔ ${msg}`));
    passed++;
  }
  function warn(msg: string) {
    console.log(colors.yellow(`  ⚠ ${msg}`));
    warnings++;
  }
  function fail(msg: string) {
    console.log(colors.red(`  ✖ ${msg}`));
    errors++;
  }

  // 1. Node.js Version Check
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split(".")[0], 10);
  if (major >= 18) {
    pass(`Node.js version v${nodeVersion} (Supported >= 18)`);
  } else {
    fail(`Node.js version v${nodeVersion} is too old. Please upgrade to Node 18 or 20+`);
  }

  // 2. Config File Check
  const { config, configPath } = await loadConfig(rootDir);
  if (configPath) {
    pass(`Configuration file found: ${path.basename(configPath)}`);
  } else {
    warn("No shard.config.(ts|js) found in project root.");
  }

  // 3. Environment & Token Check
  const token = config.token || process.env.DISCORD_TOKEN;
  if (!token) {
    fail("DISCORD_TOKEN is missing! Set DISCORD_TOKEN in .env or shard.config.ts");
  } else {
    // Mask token for security
    const masked =
      token.length > 10
        ? `${token.slice(0, 8)}...${token.slice(-4)}`
        : "********";
    pass(`Discord Token detected (${masked})`);

    // 4. Test Discord REST Connection
    try {
      const rest = new RestClient({ token });
      const user: any = await rest.get(Endpoints.userMe());
      pass(`Discord API Connection successful! Authenticated as: ${user.username}#${user.discriminator || "0"} (ID: ${user.id})`);
    } catch (err: any) {
      fail(`Discord API Authentication failed: ${err.message}`);
    }
  }

  // 5. Intents Check
  try {
    const intents = normalizeIntents(config.intents);
    pass(`Intents configured: ${intents.length} bitmask(s) active`);
  } catch (err: any) {
    fail(`Intents configuration error: ${err.message}`);
  }

  // 6. Directory Structure Check
  const src = fs.existsSync(path.join(rootDir, "src"))
    ? path.join(rootDir, "src")
    : rootDir;

  const checks = [
    { name: "Commands", dir: path.join(src, "commands") },
    { name: "Events", dir: path.join(src, "events") },
    { name: "API Routes", dir: path.join(src, "app", "api") },
    { name: "Middleware", dir: path.join(src, "middleware") },
  ];

  for (const c of checks) {
    if (fs.existsSync(c.dir)) {
      pass(`Directory ${c.name} found (${path.relative(rootDir, c.dir)})`);
    } else {
      warn(`Optional directory ${c.name} not found (${path.relative(rootDir, c.dir)})`);
    }
  }

  console.log("\n" + colors.bold("Diagnostic Summary:"));
  console.log(
    `  ${colors.green(`${passed} passed`)} | ${colors.yellow(`${warnings} warnings`)} | ${colors.red(`${errors} errors`)}\n`
  );

  if (errors > 0) {
    process.exit(1);
  }
}
