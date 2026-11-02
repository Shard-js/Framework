import fs from "node:fs";
import path from "node:path";
import colors from "picocolors";
import type { ApiRouter } from "@shardjs-framework/api";
import { importModule } from "../utils/moduleLoader.js";
import { ApplicationCommandType } from "../discord/types/interactions.js";
import { resolveCommandType } from "../deploy/deployCommands.js";
import type {
  CommandDefinition,
  EventDefinition,
  MiddlewareDefinition,
  ComponentDefinition,
  ModalDefinition,
  ShardPlugin,
} from "../types/index.js";

function normalizePath(p: string): string {
  return path.resolve(p).replace(/\\/g, "/");
}

export interface FileRouterOptions {
  distDir?: string;
  isProduction?: boolean;
}

export class FileRouter {
  public rootDir: string;
  public srcDir: string;
  public isProduction: boolean;
  public distDir?: string;

  public commands: Map<string, CommandDefinition> = new Map();
  public events: Map<string, EventDefinition[]> = new Map();
  public middlewares: Map<string, MiddlewareDefinition> = new Map();
  public components: Map<string, ComponentDefinition> = new Map();
  public modals: Map<string, ModalDefinition> = new Map();
  public directoryMiddlewares: Map<string, MiddlewareDefinition[]> = new Map();
  public plugins: ShardPlugin[] = [];
  public apiRouter?: ApiRouter;

  private fileDefinitions: Map<string, { type: string; key: string }> = new Map();

  public getCommand(
    name: string,
    type: ApplicationCommandType = ApplicationCommandType.ChatInput
  ): CommandDefinition | undefined {
    const lower = name.toLowerCase();
    if (type !== ApplicationCommandType.ChatInput) {
      const specific = this.commands.get(`${type}:${lower}`);
      if (specific) return specific;
    }
    return this.commands.get(lower);
  }

  public async loadDirectoryMiddlewares(): Promise<void> {
    this.directoryMiddlewares.clear();
    const commandsDir = path.join(this.srcDir, "commands");
    if (!fs.existsSync(commandsDir)) return;

    const files = this.getFilesRecursively(commandsDir, /^_middleware\.(ts|js|mjs)$/);
    for (const file of files) {
      try {
        const mod = await this.importModule(file);
        if (!mod) continue;

        const rawList = Array.isArray(mod) ? mod : [mod];
        const mwList: MiddlewareDefinition[] = [];

        for (const item of rawList) {
          if (typeof item === "function") {
            mwList.push({ run: item, filePath: file });
          } else if (item && typeof item.run === "function") {
            mwList.push({ ...item, filePath: file });
          }
        }

        if (mwList.length > 0) {
          const relDir = path.dirname(path.relative(commandsDir, file)).replace(/\\/g, "/");
          const key = relDir === "." ? "" : relDir;
          this.directoryMiddlewares.set(key, mwList);
          this.fileDefinitions.set(normalizePath(file), { type: "middleware", key: `dir:${key}` });
        }
      } catch (err: any) {
        console.error(
          colors.red(`[shard] Error loading directory middleware ${file}:`),
          err.message
        );
      }
    }
  }

  public getDirectoryMiddlewaresForFile(filePath: string): MiddlewareDefinition[] {
    const commandsDir = path.join(this.srcDir, "commands");
    const rel = path.relative(commandsDir, filePath).replace(/\\/g, "/");
    if (rel.startsWith("..")) return [];

    const dir = path.dirname(rel);
    const levels: string[] = [""];

    if (dir !== ".") {
      const parts = dir.split("/");
      let current = "";
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        levels.push(current);
      }
    }

    const result: MiddlewareDefinition[] = [];
    for (const level of levels) {
      const list = this.directoryMiddlewares.get(level);
      if (list) {
        result.push(...list);
      }
    }
    return result;
  }

  constructor(
    rootDir: string = process.cwd(),
    apiRouter?: ApiRouter,
    options?: FileRouterOptions
  ) {
    this.rootDir = rootDir;
    this.apiRouter = apiRouter;
    this.isProduction = Boolean(options?.isProduction);
    this.distDir = options?.distDir;

    if (this.distDir && fs.existsSync(this.distDir)) {
      this.srcDir = this.distDir;
    } else if (fs.existsSync(path.join(rootDir, "src"))) {
      this.srcDir = path.join(rootDir, "src");
    } else if (fs.existsSync(path.join(rootDir, ".shard", "dist"))) {
      this.srcDir = path.join(rootDir, ".shard", "dist");
    } else {
      this.srcDir = rootDir;
    }
  }

  public async loadAll(): Promise<void> {
    this.commands.clear();
    this.events.clear();
    this.middlewares.clear();
    this.components.clear();
    this.modals.clear();
    this.directoryMiddlewares.clear();
    this.fileDefinitions.clear();
    this.plugins = [];
    if (this.apiRouter) {
      this.apiRouter.clear();
    }

    await this.loadMiddlewares();
    await this.loadDirectoryMiddlewares();
    await this.loadCommands();
    await this.loadEvents();
    await this.loadComponents();
    await this.loadModals();
    await this.loadApiRoutes();
    await this.loadPlugins();
  }

  public getFilesRecursively(dir: string, ext = /\.(ts|js|mjs)$/): string[] {
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.getFilesRecursively(fullPath, ext));
      } else if (entry.isFile() && ext.test(entry.name) && !entry.name.endsWith(".d.ts")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  private async importModule(filePath: string): Promise<any> {
    return await importModule(filePath, this.rootDir);
  }

  public async loadCommands(): Promise<void> {
    this.commands.clear();
    const commandsDir = path.join(this.srcDir, "commands");
    const files = this.getFilesRecursively(commandsDir);

    interface SubcommandEntry {
      subName: string;
      groupName?: string;
      def: CommandDefinition;
      file: string;
    }

    interface RootCommandEntry {
      rootName: string;
      def?: CommandDefinition;
      rootFile?: string;
      subcommands: SubcommandEntry[];
    }

    const rootEntries = new Map<string, RootCommandEntry>();
    const contextMenuFiles: { file: string; def: CommandDefinition; type: ApplicationCommandType }[] = [];

    for (const file of files) {
      if (path.basename(file).startsWith("_")) {
        continue;
      }

      try {
        const commandDef: CommandDefinition = await this.importModule(file);
        if (!commandDef || typeof commandDef.run !== "function") {
          continue;
        }

        commandDef.filePath = file;
        const rel = path.relative(commandsDir, file).replace(/\\/g, "/");
        const parts = rel.split("/");
        const fileName = parts[parts.length - 1];
        const base = fileName.replace(/\.(ts|js|mjs)$/, "");

        const isContextFolder =
          parts[0] === "user" ||
          parts[0] === "users" ||
          parts[0] === "message" ||
          parts[0] === "messages";

        let explicitType: ApplicationCommandType | undefined = commandDef.type
          ? resolveCommandType(commandDef.type)
          : undefined;

        if (!explicitType && isContextFolder) {
          explicitType = parts[0].startsWith("user")
            ? ApplicationCommandType.User
            : ApplicationCommandType.Message;
          commandDef.type = explicitType;
        }

        if (explicitType && explicitType !== ApplicationCommandType.ChatInput) {
          if (!commandDef.name) {
            commandDef.name = base;
          }
          contextMenuFiles.push({ file, def: commandDef, type: explicitType });
          continue;
        }

        if (parts.length === 1) {
          const rootName = (commandDef.name || base).toLowerCase();
          commandDef.name = commandDef.name || base.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
          let entry = rootEntries.get(rootName);
          if (!entry) {
            entry = { rootName, subcommands: [] };
            rootEntries.set(rootName, entry);
          }
          entry.def = commandDef;
          entry.rootFile = file;
        } else if (parts.length === 2) {
          const folderName = parts[0].toLowerCase();
          if (base === "index") {
            let entry = rootEntries.get(folderName);
            if (!entry) {
              entry = { rootName: folderName, subcommands: [] };
              rootEntries.set(folderName, entry);
            }
            if (!commandDef.name) commandDef.name = folderName;
            entry.def = commandDef;
            entry.rootFile = file;
          } else {
            let entry = rootEntries.get(folderName);
            if (!entry) {
              entry = { rootName: folderName, subcommands: [] };
              rootEntries.set(folderName, entry);
            }
            const subName = (commandDef.name || base).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
            commandDef.name = subName;
            entry.subcommands.push({
              subName,
              def: commandDef,
              file,
            });
          }
        } else if (parts.length >= 3) {
          const folderName = parts[0].toLowerCase();
          const groupName = parts[1].toLowerCase();
          let entry = rootEntries.get(folderName);
          if (!entry) {
            entry = { rootName: folderName, subcommands: [] };
            rootEntries.set(folderName, entry);
          }
          const subName = (commandDef.name || base).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
          commandDef.name = subName;
          entry.subcommands.push({
            subName,
            groupName,
            def: commandDef,
            file,
          });
        }
      } catch (err: any) {
        console.error(
          colors.red(`[shard] Error loading command ${file}:`),
          err.message
        );
      }
    }

    for (const [rootName, entry] of rootEntries.entries()) {
      if (entry.subcommands.length === 0 && entry.def) {
        const key = rootName;
        this.commands.set(key, entry.def);
        if (entry.rootFile) {
          this.fileDefinitions.set(normalizePath(entry.rootFile), { type: "command", key });
        }
      } else {
        const rootCommand: CommandDefinition = entry.def || {
          name: rootName,
          description: `${rootName} commands`,
          run: async () => {},
        };
        rootCommand.name = rootCommand.name || rootName;
        if (!rootCommand.description) {
          rootCommand.description = `${rootName} commands`;
        }

        rootCommand.subcommands = new Map();
        const rootOptions: any[] = [];

        const directSubs: SubcommandEntry[] = [];
        const groupSubs = new Map<string, SubcommandEntry[]>();

        for (const sub of entry.subcommands) {
          if (sub.groupName) {
            const list = groupSubs.get(sub.groupName) || [];
            list.push(sub);
            groupSubs.set(sub.groupName, list);
          } else {
            directSubs.push(sub);
          }
        }

        for (const [groupName, subs] of groupSubs.entries()) {
          const groupOptions: any[] = [];
          for (const s of subs) {
            rootCommand.subcommands.set(`${groupName}:${s.subName}`, s.def);
            this.fileDefinitions.set(normalizePath(s.file), {
              type: "command",
              key: `${rootName}:${groupName}:${s.subName}`,
            });
            groupOptions.push({
              name: s.subName,
              description: s.def.description || `${s.subName} subcommand`,
              type: "Subcommand",
              options: s.def.options || [],
            });
          }
          rootOptions.push({
            name: groupName,
            description: `${groupName} subcommand group`,
            type: "SubcommandGroup",
            options: groupOptions,
          });
        }

        for (const s of directSubs) {
          rootCommand.subcommands.set(s.subName, s.def);
          this.fileDefinitions.set(normalizePath(s.file), {
            type: "command",
            key: `${rootName}:${s.subName}`,
          });
          rootOptions.push({
            name: s.subName,
            description: s.def.description || `${s.subName} subcommand`,
            type: "Subcommand",
            options: s.def.options || [],
          });
        }

        rootCommand.options = rootOptions;

        if (!rootCommand.defaultMemberPermissions) {
          for (const s of entry.subcommands) {
            if (s.def.defaultMemberPermissions) {
              rootCommand.defaultMemberPermissions = s.def.defaultMemberPermissions;
              break;
            }
          }
        }
        if (rootCommand.guildOnly === undefined) {
          const hasGuildOnly = entry.subcommands.some((s) => s.def.guildOnly);
          if (hasGuildOnly) rootCommand.guildOnly = true;
        }

        const key = rootName;
        this.commands.set(key, rootCommand);
        if (entry.rootFile) {
          this.fileDefinitions.set(normalizePath(entry.rootFile), { type: "command", key });
        }
      }
    }

    for (const ctxCmd of contextMenuFiles) {
      const key = `${ctxCmd.type}:${ctxCmd.def.name.toLowerCase()}`;
      this.commands.set(key, ctxCmd.def);
      this.fileDefinitions.set(normalizePath(ctxCmd.file), { type: "command", key });
    }
  }

  public async loadEvents(): Promise<void> {
    this.events.clear();
    const eventsDir = path.join(this.srcDir, "events");
    const files = this.getFilesRecursively(eventsDir);

    for (const file of files) {
      try {
        const eventDef: EventDefinition = await this.importModule(file);
        if (eventDef && typeof eventDef.run === "function") {
          if (!eventDef.event) {
            const baseName = path.basename(file).replace(/\.(ts|js|mjs)$/, "");
            eventDef.event = baseName;
          }
          eventDef.filePath = file;
          const normFile = normalizePath(file);

          const list = this.events.get(eventDef.event) || [];
          list.push(eventDef);
          this.events.set(eventDef.event, list);
          this.fileDefinitions.set(normFile, { type: "event", key: eventDef.event });
        }
      } catch (err: any) {
        console.error(
          colors.red(`[shard] Error loading event ${file}:`),
          err.message
        );
      }
    }
  }

  public async loadMiddlewares(): Promise<void> {
    this.middlewares.clear();
    const mwDir = path.join(this.srcDir, "middleware");
    const files = this.getFilesRecursively(mwDir);

    for (const file of files) {
      try {
        const mwDef: MiddlewareDefinition = await this.importModule(file);
        if (mwDef && typeof mwDef.run === "function") {
          const name =
            mwDef.name ||
            path.basename(file).replace(/\.(ts|js|mjs)$/, "");
          mwDef.filePath = file;
          this.middlewares.set(name, mwDef);
          this.fileDefinitions.set(normalizePath(file), { type: "middleware", key: name });
        }
      } catch (err: any) {
        console.error(
          colors.red(`[shard] Error loading middleware ${file}:`),
          err.message
        );
      }
    }
  }

  public async loadComponents(): Promise<void> {
    this.components.clear();
    const compDir = path.join(this.srcDir, "components");
    const files = this.getFilesRecursively(compDir);

    for (const file of files) {
      try {
        const compDef: ComponentDefinition = await this.importModule(file);
        if (compDef && typeof compDef.run === "function") {
          const key = compDef.customId.toString();
          compDef.filePath = file;
          this.components.set(key, compDef);
          this.fileDefinitions.set(normalizePath(file), { type: "component", key });
        }
      } catch (err: any) {
        console.error(
          colors.red(`[shard] Error loading component ${file}:`),
          err.message
        );
      }
    }
  }

  public async loadModals(): Promise<void> {
    this.modals.clear();
    const modalDir = path.join(this.srcDir, "modals");
    const files = this.getFilesRecursively(modalDir);

    for (const file of files) {
      try {
        const modalDef: ModalDefinition = await this.importModule(file);
        if (modalDef && typeof modalDef.run === "function") {
          const key = modalDef.customId.toString();
          modalDef.filePath = file;
          this.modals.set(key, modalDef);
          this.fileDefinitions.set(normalizePath(file), { type: "modal", key });
        }
      } catch (err: any) {
        console.error(
          colors.red(`[shard] Error loading modal ${file}:`),
          err.message
        );
      }
    }
  }

  public async loadApiRoutes(): Promise<void> {
    if (!this.apiRouter) return;
    this.apiRouter.clear();
    const apiDir = path.join(this.srcDir, "app", "api");
    const files = this.getFilesRecursively(apiDir, /route\.(ts|js|mjs)$/);

    for (const file of files) {
      try {
        const routeMod = await this.importModule(file);
        const rel = path.relative(apiDir, file);

        const methods: Record<string, any> = {};
        for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]) {
          if (typeof routeMod[method] === "function") {
            methods[method] = routeMod[method];
          }
        }

        if (typeof routeMod.default === "function") {
          methods.GET = routeMod.default;
        }

        if (Object.keys(methods).length > 0) {
          this.apiRouter.register(rel, methods);
        }
      } catch (err: any) {
        console.error(
          colors.red(`[shard] Error loading API route ${file}:`),
          err.message
        );
      }
    }
  }

  public async loadPlugins(): Promise<void> {
    this.plugins = [];
    const pluginsDir = path.join(this.srcDir, "plugins");
    const files = this.getFilesRecursively(pluginsDir);

    for (const file of files) {
      try {
        const pluginDef: ShardPlugin = await this.importModule(file);
        if (pluginDef && pluginDef.name) {
          this.plugins.push(pluginDef);
        }
      } catch (err: any) {
        console.error(
          colors.red(`[shard] Error loading plugin ${file}:`),
          err.message
        );
      }
    }
  }

  public async reloadFile(filePath: string): Promise<string | null> {
    const normPath = normalizePath(filePath);
    const existing = this.fileDefinitions.get(normPath);

    if (existing) {
      if (existing.type === "event") {
        const list = this.events.get(existing.key) || [];
        this.events.set(
          existing.key,
          list.filter((e) => normalizePath(e.filePath || "") !== normPath)
        );
      } else if (existing.type === "command") {
        this.commands.delete(existing.key);
      } else if (existing.type === "middleware") {
        this.middlewares.delete(existing.key);
      } else if (existing.type === "component") {
        this.components.delete(existing.key);
      } else if (existing.type === "modal") {
        this.modals.delete(existing.key);
      }
      this.fileDefinitions.delete(normPath);
    }

    const normalized = filePath.replace(/\\/g, "/");

    if (normalized.includes("/commands/")) {
      await this.loadCommands();
      return "commands";
    }
    if (normalized.includes("/events/")) {
      await this.loadEvents();
      return "events";
    }
    if (normalized.includes("/components/")) {
      await this.loadComponents();
      return "components";
    }
    if (normalized.includes("/modals/")) {
      await this.loadModals();
      return "modals";
    }
    if (normalized.includes("/app/api/")) {
      await this.loadApiRoutes();
      return "api";
    }
    if (normalized.includes("/middleware/")) {
      await this.loadMiddlewares();
      return "middleware";
    }
    if (normalized.includes("/plugins/")) {
      await this.loadPlugins();
      return "plugins";
    }

    return null;
  }
}
