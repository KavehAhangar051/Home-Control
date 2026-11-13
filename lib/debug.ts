import { FEATURE_FLAGS } from "./featureFlags";

function write(
  level: "debug" | "info" | "warn" | "error",
  scope: string,
  message: string,
  cause?: unknown,
) {
  if (level === "debug" && !FEATURE_FLAGS.debugLogging) return;

  const prefix = `[HomeControl:${scope}]`;
  // SAFETY: console[level] is guaranteed to be a callable console logging method
  const logger = console[level] as (...args: unknown[]) => void;

  if (cause === undefined) {
    logger(prefix, message);
  } else {
    logger(prefix, message, cause);
  }
}

export const debugLog = {
  debug: (scope: string, message: string, cause?: unknown) => write("debug", scope, message, cause),
  info: (scope: string, message: string, cause?: unknown) => write("info", scope, message, cause),
  warn: (scope: string, message: string, cause?: unknown) => write("warn", scope, message, cause),
  error: (scope: string, message: string, cause?: unknown) => write("error", scope, message, cause),
};
