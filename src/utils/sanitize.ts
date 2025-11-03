export const sanitize = <T extends Record<string, unknown>>(obj: T): T => {
  if (!obj) return obj;

  const clone = { ...obj };
  const sensitiveKeys = ["password", "token", "secret", "authorization"];

  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      (clone as Record<string, unknown>)[key] = "***";
    }
  }

  return clone;
};
