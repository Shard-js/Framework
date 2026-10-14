import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import colors from "picocolors";
import { z } from "zod";
import { GatewayIntentBits } from "../discord/types/gateway.js";
import { importModule } from "../utils/moduleLoader.js";
import type { ShardConfig } from "../types/index.js";

export const apiServerConfigSchema = z
  .object({
    port: z.number().int().min(1).max(65535).optional(),
    host: z.string().min(1).optional(),
    prefix: z.string().startsWith("/").optional(),
    cors: z
      .object({
        origin: z.union([z.string(), z.array(z.string())]).optional(),
        methods: z.array(z.string()).optional(),
        headers: z.array(z.string()).optional(),
        credentials: z.boolean().optional(),
      })
      .optional(),
    publicUrl: z.string().url().optional(),
    allowedHosts: z.array(z.string()).optional(),
    trustHostHeader: z.boolean().optional(),
    maxBodySize: z.number().int().positive().optional(),
    requestTimeoutMs: z.number().int().positive().optional(),
    headersTimeoutMs: z.number().int().positive().optional(),
    keepAliveTimeoutMs: z.number().int().positive().optional(),
    maxConnections: z.number().int().positive().optional(),
    rateLimit: z
      .object({
        windowMs: z.number().int().positive().optional(),
        max: z.number().int().positive().optional(),
      })
      .optional(),
    auth: z
      .object({
        bearer: z.string().min(1).optional(),
        apiKey: z.string().min(1).optional(),
      })
      .optional(),
  })
  .strict()
  .optional();

export const shardConfigSchema = z
  .object({
    token: z.string().min(1).optional(),
    intents: z.array(z.union([z.number(), z.string()])).optional(),
    devGuildId: z.string().optional(),
    api: apiServerConfigSchema,
    env: z.any().optional(),
    plugins: z.array(z.object({ name: z.string() }).passthrough()).optional(),
    clientOptions: z.record(z.any()).optional(),
  })
  .passthrough();

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

export function normalizeIntents(
  intents?: (GatewayIntentBits | number | keyof typeof GatewayIntentBits)[]
): number[] {
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
      console.error(
        colors.red(`[shard] Fatal: Failed to load configuration file at "${configPath}": ${err.message}`)
      );
      throw new Error(`Failed to load configuration file "${configPath}": ${err.message}`);
    }
  }

  if (!rawConfig.token && process.env.DISCORD_TOKEN) {
    rawConfig.token = process.env.DISCORD_TOKEN;
  }

  const validationResult = shardConfigSchema.safeParse(rawConfig);
  if (!validationResult.success) {
    const errorDetails = validationResult.error.issues
      .map((i) => `  • ${i.path.join(".") || "config"}: ${i.message}`)
      .join("\n");
    console.error(colors.red(`\n❌ [shard] Invalid configuration:\n${errorDetails}\n`));
    throw new Error(`Invalid shard configuration:\n${errorDetails}`);
  }

  if (rawConfig.env) {
    const parseResult = rawConfig.env.safeParse(process.env);
    if (!parseResult.success) {
      const errorDetails = parseResult.error.issues
        .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      console.error(colors.red(`\n❌ [shard] Environment validation failed:\n${errorDetails}\n`));
      throw new Error(`Invalid environment configuration:\n${errorDetails}`);
    }
  }

  return { config: rawConfig, configPath };
}
