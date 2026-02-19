type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  event: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, payload: LogPayload): void {
  const record = {
    ts: new Date().toISOString(),
    level,
    ...payload,
  };
  const line = `${JSON.stringify(record)}\n`;
  if (level === "error") {
    process.stderr.write(line);
    return;
  }
  process.stdout.write(line);
}

export function logInfo(event: string, details: Record<string, unknown> = {}): void {
  emit("info", { event, ...details });
}

export function logWarn(event: string, details: Record<string, unknown> = {}): void {
  emit("warn", { event, ...details });
}

export function logError(event: string, details: Record<string, unknown> = {}): void {
  emit("error", { event, ...details });
}

