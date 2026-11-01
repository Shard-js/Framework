import colors from "picocolors";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export type LogFormat = "json" | "pretty";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  defaultContext?: Record<string, any>;
  destination?: (entry: LogEntry, formatted: string) => void;
}

const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export interface Logger {
  level: LogLevel;
  format: LogFormat;
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(
    message: string,
    errorOrContext?: Error | Record<string, any>,
    context?: Record<string, any>
  ): void;
  child(defaultContext: Record<string, any>): Logger;
}

export class DefaultLogger implements Logger {
  public level: LogLevel;
  public format: LogFormat;
  private defaultContext: Record<string, any>;
  private destination?: (entry: LogEntry, formatted: string) => void;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? (process.env.LOG_LEVEL as LogLevel) ?? "info";
    this.format =
      options.format ??
      ((process.env.LOG_FORMAT as LogFormat) ||
        (process.env.NODE_ENV === "production" ? "json" : "pretty"));
    this.defaultContext = options.defaultContext || {};
    this.destination = options.destination;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_WEIGHTS[level] >= LEVEL_WEIGHTS[this.level];
  }

  private write(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const mergedContext = {
      ...this.defaultContext,
      ...context,
    };

    const hasContext = Object.keys(mergedContext).length > 0;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(hasContext ? { context: mergedContext } : {}),
      ...(error
        ? {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          }
        : {}),
    };

    let formatted: string;
    if (this.format === "json") {
      formatted = JSON.stringify(entry);
    } else {
      const timeStr = colors.dim(entry.timestamp.substring(11, 19));
      let levelBadge: string;
      switch (level) {
        case "debug":
          levelBadge = colors.magenta("[DEBUG]");
          break;
        case "info":
          levelBadge = colors.cyan("[INFO] ");
          break;
        case "warn":
          levelBadge = colors.yellow("[WARN] ");
          break;
        case "error":
          levelBadge = colors.red("[ERROR]");
          break;
        default:
          levelBadge = `[${level.toUpperCase()}]`;
      }

      const ctxStr = hasContext ? ` ${colors.dim(JSON.stringify(mergedContext))}` : "";
      const errStr = error
        ? `\n  ${colors.red(error.stack || `${error.name}: ${error.message}`)}`
        : "";

      formatted = `${timeStr} ${levelBadge} ${message}${ctxStr}${errStr}`;
    }

    if (this.destination) {
      this.destination(entry, formatted);
    } else {
      if (level === "error") {
        console.error(formatted);
      } else if (level === "warn") {
        console.warn(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.write("debug", message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.write("info", message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.write("warn", message, context);
  }

  public error(
    message: string,
    errorOrContext?: Error | Record<string, any>,
    context?: Record<string, any>
  ): void {
    let err: Error | undefined;
    let ctx = context;

    if (errorOrContext instanceof Error) {
      err = errorOrContext;
    } else if (typeof errorOrContext === "object" && errorOrContext !== null) {
      ctx = { ...errorOrContext, ...context };
    }

    this.write("error", message, ctx, err);
  }

  public child(bindings: Record<string, any>): Logger {
    return new DefaultLogger({
      level: this.level,
      format: this.format,
      defaultContext: {
        ...this.defaultContext,
        ...bindings,
      },
      destination: this.destination,
    });
  }
}

export function createLogger(options?: LoggerOptions): Logger {
  return new DefaultLogger(options);
}
