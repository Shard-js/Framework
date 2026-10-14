import fs from "node:fs";
import path from "node:path";
import colors from "picocolors";
import type { ApiRouter } from "@shardjs/api";
import { importModule } from "../utils/moduleLoader.js";
import type {
  CommandDefinition,
  EventDefinition,
  MiddlewareDefinition,
  ComponentDefinition,
  ModalDefinition,
  ShardPlugin,
} from "../types/index.js";

export class FileRouter {
  public rootDir: string;
  public srcDir: string;

  public commands: Map<string, CommandDefinition> = new Map();
  public events: Map<string, EventDefinition[]> = new Map();
  public middlewares: Map<string, MiddlewareDefinition> = new Map();
  public components: Map<string, ComponentDefinition> = new Map();
  public modals: Map<string, ModalDefinition> = new Map();
  public plugins: ShardPlugin[] = [];
  public apiRouter?: ApiRouter;

  // Track definitions by file path to enable clean HMR deregistrations (Issue #1)
  private fileDefinitions: Map<string, { type: string; key: string }> = new Map();

  constructor(rootDir: string = process.cwd(), apiRouter?: ApiRouter) {
    this.rootDir = rootDir;
    this.srcDir = fs.existsSync(path.join(rootDir, "src"))
      ? path.join(rootDir, "src")
      : rootDir;
    this.apiRouter = apiRouter;
  }

  public async loadAll(): Promise<void> {
    this.commands.clear();
    this.events.clear();
    this.middlewares.clear();
    this.components.clear();
    this.modals.clear();
    this.fileDefinitions.clear();
    this.plugins = [];
    if (this.apiRouter) {
      this.apiRouter.clear();
    }

    await this.loadMiddlewares();
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
    const commandsDir = path.join(this.srcDir, "commands");
    const files = this.getFilesRecursively(commandsDir);

    for (const file of files) {
      try {
        const commandDef: CommandDefinition = await this.importModule(file);
        if (commandDef && typeof commandDef.run === "function") {
          if (!commandDef.name) {
            const rel = path.relative(commandsDir, file);
            const base = rel.replace(/\.(ts|js|mjs)$/, "");
            commandDef.name = base.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
          }
          commandDef.filePath = file;
          const key = commandDef.name.toLowerCase();
          this.commands.set(key, commandDef);
          this.fileDefinitions.set(path.resolve(file), { type: "command", key });
        }
      } catch (err: any) {
        console.error(
          colors.red(`[shard] Error loading command ${file}:`),
          err.message
        );
      }
    }
  }

  public async loadEvents(): Promise<void> {
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

          const list = this.events.get(eventDef.event) || [];
          list.push(eventDef);
          this.events.set(eventDef.event, list);
          this.fileDefinitions.set(path.resolve(file), { type: "event", key: eventDef.event });
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
          this.fileDefinitions.set(path.resolve(file), { type: "middleware", key: name });
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
    const compDir = path.join(this.srcDir, "components");
    const files = this.getFilesRecursively(compDir);

    for (const file of files) {
      try {
        const compDef: ComponentDefinition = await this.importModule(file);
        if (compDef && typeof compDef.run === "function") {
          const key = compDef.customId.toString();
          compDef.filePath = file;
          this.components.set(key, compDef);
          this.fileDefinitions.set(path.resolve(file), { type: "component", key });
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
    const modalDir = path.join(this.srcDir, "modals");
    const files = this.getFilesRecursively(modalDir);

    for (const file of files) {
      try {
        const modalDef: ModalDefinition = await this.importModule(file);
        if (modalDef && typeof modalDef.run === "function") {
          const key = modalDef.customId.toString();
          modalDef.filePath = file;
          this.modals.set(key, modalDef);
          this.fileDefinitions.set(path.resolve(file), { type: "modal", key });
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

  /**
   * Reloads a specific file in place (Hot Module Replacement)
   * Cleans existing definitions from that specific file to prevent duplicate listeners (Issue #1).
   */
  public async reloadFile(filePath: string): Promise<string | null> {
    const absPath = path.resolve(filePath);
    const existing = this.fileDefinitions.get(absPath);

    if (existing) {
      if (existing.type === "event") {
        const list = this.events.get(existing.key) || [];
        this.events.set(
          existing.key,
          list.filter((e) => path.resolve(e.filePath || "") !== absPath)
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
      this.fileDefinitions.delete(absPath);
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
