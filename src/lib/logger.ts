import { isPiiKey } from "@/domain/pii";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 5;

/** Recursively replaces values under PII keys. Exported for tests. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) {
    // Error messages may echo user input; keep only name and code-like message head.
    return { name: value.name, message: value.message.slice(0, 200) };
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, isPiiKey(k) ? REDACTED : redact(v, depth + 1)]),
    );
  }
  return value;
}

function write(level: Level, message: string, fields?: Fields): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(fields ? (redact(fields) as Fields) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

/**
 * Structured server logger with key-based PII redaction (spec §11).
 * Logs stay local: shipping them to a third party is a data transfer (L1/L11).
 */
export const logger = {
  debug: (message: string, fields?: Fields) => {
    if (process.env.NODE_ENV !== "production") write("debug", message, fields);
  },
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
