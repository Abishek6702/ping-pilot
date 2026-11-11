const SENSITIVE_KEY_PATTERN = /(secret|password|pass|token|authorization|cookie|jwt|api[_-]?key)/i;

/**
 * Recursively redacts sensitive keys and Bearer tokens from structured log metadata.
 */
function redactSensitive(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactSensitive(item, depth + 1));
  }

  if (typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSensitive(v, depth + 1);
      }
    }
    return out;
  }

  return value;
}

/**
 * Emits a structured log line suitable for Render/cloud log aggregation without exposing secrets.
 */
function logEvent(level, event, meta = {}) {
  const safeMeta = meta && typeof meta === "object" ? redactSensitive(meta) : {};
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeMeta,
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else if (level === "warn") {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

module.exports = {
  redactSensitive,
  logEvent,
};

