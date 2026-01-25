import { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/AppError";
import { ErrorCode } from "../types/api";

type CachedResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  expiresAt: number;
};

interface IdempotencyOptions {
  ttlMs?: number;
}

const cache = new Map<string, CachedResponse>();

const cleanIfExpired = (key: string, now: number) => {
  const cached = cache.get(key);
  if (cached && cached.expiresAt <= now) {
    cache.delete(key);
  }
};

export const _cleanupIdempotencyCache = (now: number) => {
  for (const key of cache.keys()) {
    cleanIfExpired(key, now);
  }
};

export const idempotencyMiddleware = (options: IdempotencyOptions = {}) => {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST") return next();

    const key = req.header("Idempotency-Key")?.trim();
    if (!key) return next();

    const now = Date.now();
    cleanIfExpired(key, now);

    const cached = cache.get(key);
    if (cached) {
      res.status(cached.status).set(cached.headers).send(cached.body);
      return;
    }

    const captureAndStore = (body: unknown) => {
      const headers: Record<string, string> = {};
      const contentType = res.getHeader("Content-Type");
      if (typeof contentType === "string")
        headers["Content-Type"] = contentType;

      cache.set(key, {
        status: res.statusCode,
        headers,
        body,
        expiresAt: now + ttlMs,
      });
    };

    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    let stored = false;

    res.send = (body?: unknown) => {
      if (!stored) {
        captureAndStore(body);
        stored = true;
      }
      return originalSend(body);
    };

    res.json = (body?: unknown) => {
      if (!stored) {
        captureAndStore(body);
        stored = true;
      }
      return originalJson(body);
    };

    return next();
  };
};

export const requireIdempotencyKey = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const key = req.header("Idempotency-Key");
  if (!key) {
    return next(
      new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Idempotency-Key header required",
        400,
      ),
    );
  }
  return next();
};
