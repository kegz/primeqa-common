let cleanupIntervalHandle: NodeJS.Timeout | null = null;

export const startCacheCleanup = (intervalMs = 5 * 60 * 1000): void => {
  if (cleanupIntervalHandle) {
    console.warn("[CacheCleanup] Already running, skipping");
    return;
  }

  cleanupIntervalHandle = setInterval(() => {
    cleanupExpiredEntries();
  }, intervalMs);

  cleanupIntervalHandle.unref?.();
  console.log(`[CacheCleanup] Started with interval ${intervalMs}ms`);
};

export const stopCacheCleanup = (): void => {
  if (cleanupIntervalHandle) {
    clearInterval(cleanupIntervalHandle);
    cleanupIntervalHandle = null;
    console.log("[CacheCleanup] Stopped");
  }
};

export const cleanupExpiredEntries = (): void => {
  const now = Number(process.hrtime.bigint() / 1000000n);
  try {
    const rl = require("../middlewares/rateLimit.middleware");
    rl._cleanupRateLimitCache?.(now);
  } catch {
    void 0;
  }
  try {
    const idp = require("../middlewares/idempotency.middleware");
    idp._cleanupIdempotencyCache?.(now);
  } catch {
    void 0;
  }
};
