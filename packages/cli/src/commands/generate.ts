import fs from "node:fs";
import path from "node:path";
import colors from "picocolors";

export type GeneratorType =
  | "command"
  | "c"
  | "event"
  | "e"
  | "route"
  | "r"
  | "middleware"
  | "m"
  | "component"
  | "comp";

export function getTemplate(type: string, name: string): { filePath: string; content: string } {
  const normName = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const pascalName = normName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  switch (type.toLowerCase()) {
    case "command":
    case "c":
      return {
        filePath: `src/commands/${normName}.ts`,
        content: `import { defineCommand, SlashCommandBuilder } from "@shardjs/core";

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName("${normName}")
    .setDescription("${pascalName} command description"),

  async run(ctx) {
    await ctx.interaction.reply({
      content: "Hello from /${normName}!",
    });
  },
});
`,
      };

    case "event":
    case "e":
      return {
        filePath: `src/events/${name}.ts`,
        content: `import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "${name}",
  async run(ctx, ...args) {
    ctx.logger?.info("[shard:event] ${name} received", args);
  },
});
`,
      };

    case "route":
    case "r":
      return {
        filePath: `src/app/api/${normName}/route.ts`,
        content: `import { defineRoute } from "@shardjs/core";

export const GET = defineRoute(async ({ request, url }) => {
  return Response.json({
    message: "Hello from /api/${normName}",
    timestamp: new Date().toISOString(),
  });
});

export const POST = defineRoute(async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  return Response.json({
    success: true,
    received: body,
  });
});
`,
      };

    case "middleware":
    case "m":
      return {
        filePath: `src/middleware/${normName}.ts`,
        content: `import { defineMiddleware } from "@shardjs/core";

export default defineMiddleware({
  name: "${normName}",
  async run(ctx, next) {
    // Custom check or enrichment
    await next();
  },
});
`,
      };

    case "component":
    case "comp":
      return {
        filePath: `src/components/${normName}.ts`,
        content: `export default {
  customId: "${normName}",
  async run(ctx: any) {
    await ctx.interaction.reply({
      content: "Button or Component '${normName}' clicked!",
      ephemeral: true,
    });
  },
};
`,
      };

    default:
      throw new Error(
        `Unknown generator type "${type}". Available types: command (c), event (e), route (r), middleware (m), component (comp).`
      );
  }
}

export async function runGenerate(
  type: string,
  name: string,
  options: { force?: boolean } = {}
): Promise<void> {
  if (!type || !name) {
    console.error(
      colors.red("\n❌ Usage: shard generate <command|event|route|middleware|component> <name>\n")
    );
    process.exit(1);
  }

  const rootDir = process.cwd();
  const { filePath: relPath, content } = getTemplate(type, name);
  const targetPath = path.resolve(rootDir, relPath);

  if (fs.existsSync(targetPath) && !options.force) {
    console.error(
      colors.red(`\n✖ File already exists: ${relPath}\n`) +
        colors.yellow("  Use --force to overwrite.\n")
    );
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf-8");

  console.log(colors.green(`\n✔ Successfully generated ${relPath}`));
  console.log(colors.gray("  Restart dev server or rely on HMR to load changes.\n"));
}
