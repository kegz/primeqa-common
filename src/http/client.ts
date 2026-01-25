import { Request } from "express";

import { AppError } from "../errors/AppError";
import { ErrorCode } from "../types/api";

export interface HttpClientOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  propagateAuth?: boolean;
  propagateCorrelationId?: boolean;
}

export interface HttpClientResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 1_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableMethod = (method: string): boolean => {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
};

const isRetryableError = (error: unknown): boolean => {
  const err = error as Record<string, unknown>;
  return (
    err.code === "ECONNREFUSED" ||
    err.code === "ENOTFOUND" ||
    err.code === "ETIMEDOUT" ||
    err.name === "AbortError" ||
    (typeof err.status === "number" && err.status >= 500 && err.status !== 501)
  );
};

export const httpRequest = async <T = unknown>(
  method: string,
  url: string,
  options: HttpClientOptions & { body?: unknown; req?: Request } = {},
): Promise<HttpClientResponse<T>> => {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    headers = {},
    body,
    req,
    propagateAuth = true,
    propagateCorrelationId = true,
  } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };
  if (req && propagateAuth) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      finalHeaders["Authorization"] = authHeader;
    }
  }
  if (req && propagateCorrelationId) {
    const correlationId = req.correlationId || req.headers["x-correlation-id"];
    if (correlationId) {
      finalHeaders["X-Correlation-Id"] = Array.isArray(correlationId)
        ? correlationId[0]
        : correlationId;
    }
  }

  const shouldRetry = isRetryableMethod(method);
  const maxAttempts = shouldRetry ? retries + 1 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      timeoutId.unref?.();

      const response = await fetch(url, {
        method,
        headers: finalHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let data: T;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }
      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status}: ${response.statusText}`,
        ) as Error & { status?: number; data?: T };
        error.status = response.status;
        error.data = data;
        if (shouldRetry && attempt < maxAttempts && isRetryableError(error)) {
          lastError = error;
          await sleep(retryDelay * attempt);
          continue;
        }
        if (response.status >= 500) {
          throw new AppError(
            ErrorCode.INTERNAL_ERROR,
            `Dependency service failed: ${response.statusText}`,
            503,
            { url, status: response.status },
          );
        }

        throw error;
      }

      return {
        data,
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      lastError = err;
      if (error instanceof AppError) {
        throw error;
      }
      if (shouldRetry && attempt < maxAttempts && isRetryableError(error)) {
        await sleep(retryDelay * attempt);
        continue;
      }
      if (
        err.code === "ECONNREFUSED" ||
        err.code === "ENOTFOUND" ||
        err.name === "AbortError"
      ) {
        const errorMessage =
          typeof err.message === "string" ? err.message : "Unknown error";
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          "Service unavailable or timed out",
          503,
          { url, originalError: errorMessage },
        );
      }
      throw error;
    }
  }
  const errorMsg =
    typeof (lastError as Record<string, unknown> | undefined)?.message ===
    "string"
      ? String((lastError as Record<string, unknown>).message)
      : "Unknown error";
  throw new AppError(
    ErrorCode.INTERNAL_ERROR,
    `Request failed after ${maxAttempts} attempts`,
    503,
    { url, originalError: errorMsg },
  );
};

export const httpClient = {
  get: <T = unknown>(
    url: string,
    options?: HttpClientOptions & { req?: Request },
  ) => httpRequest<T>("GET", url, options),

  post: <T = unknown>(
    url: string,
    body: unknown,
    options?: HttpClientOptions & { req?: Request },
  ) => httpRequest<T>("POST", url, { ...options, body }),

  put: <T = unknown>(
    url: string,
    body: unknown,
    options?: HttpClientOptions & { req?: Request },
  ) => httpRequest<T>("PUT", url, { ...options, body }),

  patch: <T = unknown>(
    url: string,
    body: unknown,
    options?: HttpClientOptions & { req?: Request },
  ) => httpRequest<T>("PATCH", url, { ...options, body }),

  delete: <T = unknown>(
    url: string,
    options?: HttpClientOptions & { req?: Request },
  ) => httpRequest<T>("DELETE", url, options),
};

export const createHttpClient = (
  defaults: HttpClientOptions & { baseUrl?: string } = {},
) => {
  const { baseUrl, ...defaultOptions } = defaults;

  return {
    get: <T = unknown>(
      path: string,
      options?: HttpClientOptions & { req?: Request },
    ) => {
      const url = baseUrl ? `${baseUrl}${path}` : path;
      return httpRequest<T>("GET", url, { ...defaultOptions, ...options });
    },

    post: <T = unknown>(
      path: string,
      body: unknown,
      options?: HttpClientOptions & { req?: Request },
    ) => {
      const url = baseUrl ? `${baseUrl}${path}` : path;
      return httpRequest<T>("POST", url, {
        ...defaultOptions,
        ...options,
        body,
      });
    },

    put: <T = unknown>(
      path: string,
      body: unknown,
      options?: HttpClientOptions & { req?: Request },
    ) => {
      const url = baseUrl ? `${baseUrl}${path}` : path;
      return httpRequest<T>("PUT", url, {
        ...defaultOptions,
        ...options,
        body,
      });
    },

    patch: <T = unknown>(
      path: string,
      body: unknown,
      options?: HttpClientOptions & { req?: Request },
    ) => {
      const url = baseUrl ? `${baseUrl}${path}` : path;
      return httpRequest<T>("PATCH", url, {
        ...defaultOptions,
        ...options,
        body,
      });
    },

    delete: <T = unknown>(
      path: string,
      options?: HttpClientOptions & { req?: Request },
    ) => {
      const url = baseUrl ? `${baseUrl}${path}` : path;
      return httpRequest<T>("DELETE", url, {
        ...defaultOptions,
        ...options,
      });
    },
  };
};
