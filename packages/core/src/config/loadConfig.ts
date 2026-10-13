import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import colors from "picocolors";
import { GatewayIntentBits } from "discord.js";
import { importModule } from "../utils/moduleLoader.js";
import type { ShardConfig } from "../types/index.js";

/**
 * Loads environment files in priority:
 * 1. .env.local
 * 2. .env.[mode]
 * 3. .env
 */
export function loadEnvFiles(
  rootDir: string = process.cwd(),
  mode: string = process.env.NODE_ENV || "development"
): void {
  const envFiles = [
    path.join(rootDir, ".env.local"),
    path.join(rootDir, `.env.${mode}`),
    path.join(rootDir, ".env"),
  ];

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      dotenv.config({ path: envFile, override: false });
    }
  }
}

/**
 * Finds the shard configuration file in the project root
 */
export function findConfigFile(rootDir: string = process.cwd()): string | null {
  const candidates = [
    "shard.config.ts",
    "shard.config.js",
    "shard.config.mjs",
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(rootDir, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Resolves intents from string names or numbers
 */
export function normalizeIntents(
  intents?: (GatewayIntentBits | number | keyof typeof GatewayIntentBits)[]
): GatewayIntentBits[] {
  if (!intents || intents.length === 0) {
    return [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
  }

  return intents.map((intent) => {
    if (typeof intent === "string") {
      const bit = (GatewayIntentBits as any)[intent];
      if (bit === undefined) {
        throw new Error(`Unknown GatewayIntent: "${intent}"`);
      }
      return bit;
    }
    return intent;
  });
}

/**
 * Loads and validates shard.config.(ts|js)
 */
export async function loadConfig(
  rootDir: string = process.cwd()
): Promise<{ config: ShardConfig; configPath: string | null }> {
  loadEnvFiles(rootDir);

  const configPath = findConfigFile(rootDir);
  let rawConfig: ShardConfig = {};

  if (configPath) {
    try {
      rawConfig = await importModule(configPath, rootDir);
    } catch (err: any) {
      console.warn(
        colors.yellow(`[shard] Could not load ${configPath}: ${err.message}`)
      );
    }
  }

  // Validate environment variables if schema provided
  if (rawConfig.env) {
    const parseResult = rawConfig.env.safeParse(process.env);
    if (!parseResult.success) {
      console.error(
        colors.red("\n❌ Environment validation failed:")
      );
      for (const issue of parseResult.error.issues) {
        console.error(
          colors.red(`  • ${issue.path.join(".")}: ${issue.message}`)
        );
      }
      throw new Error("Invalid environment configuration.");
    }
  }

  // Fallback to process.env.DISCORD_TOKEN if not explicitly given
  if (!rawConfig.token && process.env.DISCORD_TOKEN) {
    rawConfig.token = process.env.DISCORD_TOKEN;
  }

  return { config: rawConfig, configPath };
}
