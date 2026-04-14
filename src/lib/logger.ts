import { env } from "../env";

type Level = "debug" | "info" | "warn" | "error";

const levels: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = levels[env.LOG_LEVEL];

function shouldLog(level: Level): boolean {
  return levels[level] >= currentLevel;
}

function fmt(module: string, level: Level, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${ts}] [${level.toUpperCase()}] [${module}] ${message}${metaStr}`;
}

export function log(module: string, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog("info")) return;
  console.log(fmt(module, "info", message, meta));
}

export function logDebug(module: string, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog("debug")) return;
  console.log(fmt(module, "debug", message, meta));
}

export function logWarn(module: string, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog("warn")) return;
  console.warn(fmt(module, "warn", message, meta));
}

export function logError(module: string, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog("error")) return;
  console.error(fmt(module, "error", message, meta));
}
