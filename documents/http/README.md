HTTP

- Purpose: Robust HTTP client with timeout, retries, and header propagation.

Core API

- `httpRequest(method, url, options?)` → `{ data, status, headers }`
  - `method`: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  - `url`: absolute or configured base + path
  - `options`:
    - `timeout` (ms, default 10000): aborts request after duration
    - `retries` (default 2): number of retry attempts for retryable methods
    - `retryDelay` (ms, default 1000): exponential backoff base
    - `headers`: additional headers
    - `propagateAuth` (default true): copy `Authorization` from `req`
    - `propagateCorrelationId` (default true): copy correlation from `req`
    - `body`: serializable object; JSON-encoded
    - `req`: source Express request for header propagation

- Convenience:
  - `httpClient.get(url, options?)`
  - `httpClient.post(url, body, options?)`
  - `httpClient.put(url, body, options?)`
  - `httpClient.patch(url, body, options?)`
  - `httpClient.delete(url, options?)`

- Instance:
  - `createHttpClient({ baseUrl?, timeout?, retries?, retryDelay?, headers?, propagateAuth?, propagateCorrelationId? })`
    - Returns `{ get, post, put, patch, delete }` with defaults applied.

Behavior

- Timeout: `AbortController` cancels; throws `AppError(INTERNAL_ERROR, 503)`.
- Retries: GET/HEAD/OPTIONS only; exponential backoff; skips POST/PUT/PATCH.
- Error mapping:
  - 5xx responses → `AppError(INTERNAL_ERROR, 503)`
  - `ECONNREFUSED`, `ENOTFOUND`, `AbortError` → `AppError(INTERNAL_ERROR, 503)`
  - Others re-throw native error.
- Response detection:
  - If `content-type` includes `application/json` → `response.json()`
  - Else → `response.text()`

Guidance

- Keep bodies JSON-serializable; avoid circular refs.
- Use `req` to propagate `Authorization` and correlation IDs across services.
- Prefer instances via `createHttpClient` for service-specific defaults.

Implementation Guide

Basic request with timeout and retries:

```typescript
import { httpRequest } from "../http/client";

// Simple GET
const { data, status } = await httpRequest(
  "GET",
  "https://api.example.com/users/123",
);
console.log(`Status: ${status}`, data);

// POST with body and custom options
const result = await httpRequest("POST", "https://api.example.com/items", {
  body: { name: "Item", price: 99 },
  timeout: 5000, // 5 seconds
  retries: 1, // 1 retry for retryable errors
  headers: { "X-Custom": "value" },
});
```

Propagating headers across services:

```typescript
import { httpClient } from "../http/client";

app.get("/dashboard", authenticate, async (req, res, next) => {
  try {
    // httpClient.get automatically propagates Authorization and correlation ID
    const { data } = await httpClient.get("https://user-service/profile", {
      req, // Pass source request for header propagation
    });

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
```

Service client instance:

```typescript
import { createHttpClient } from "../http/client";

// Create client for external service
const userServiceClient = createHttpClient({
  baseUrl: process.env.USER_SERVICE_URL || "http://localhost:3001",
  timeout: 5000,
  retries: 2,
  propagateAuth: true,
});

// Use throughout app
export const getUserProfile = async (userId: string, req: Request) => {
  const { data } = await userServiceClient.get(`/users/${userId}`, { req });
  return data;
};
```

Error handling:

```typescript
import { AppError } from "../errors/AppError";
import { ErrorCode } from "../types/api";

try {
  await httpClient.post("https://api.example.com/webhook", { event: "test" });
} catch (err) {
  if (err instanceof AppError) {
    if (err.code === ErrorCode.INTERNAL_ERROR) {
      // Network/5xx/timeout error; status is 503
      console.error("Dependency unavailable", err.details);
    }
  } else {
    // Other errors (4xx, malformed response, etc.)
    console.error("Request failed", err.message);
  }
  throw err;
}
```
