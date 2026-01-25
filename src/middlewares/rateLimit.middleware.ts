import { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/AppError";
import { ErrorCode } from "../types/api";

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

type Entry = {
  count: number;
  expiresAt: number;
};

const store = new Map<string, Entry>();

const cleanupIfExpired = (key: string, now: number) => {
  const entry = store.get(key);
  if (entry && entry.expiresAt <= now) {
    store.delete(key);
  }
};

export const _cleanupRateLimitCache = (now: number) => {
  for (const key of store.keys()) {
    cleanupIfExpired(key, now);
  }
};

export const rateLimit = (options: RateLimitOptions = {}) => {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 10;
  const keyGenerator =
    options.keyGenerator ??
    ((req) =>
      req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown");
  const message = options.message ?? "Too many requests";

  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyGenerator(req);

    cleanupIfExpired(key, now);

    const entry = store.get(key);
    if (!entry) {
      store.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      return next(new AppError(ErrorCode.FORBIDDEN, message, 429));
    }

    entry.count += 1;
    store.set(key, entry);
    return next();
  };
};

export const loginRateLimiter = rateLimit({ windowMs: 60_000, max: 10 });
