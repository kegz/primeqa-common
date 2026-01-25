Errors

- Purpose: Centralized application errors using `AppError` and `ErrorCode`.

Overview

- `AppError`: Standard error class with `code`, `status`, `details`.
- `ErrorCode`: Enumerates error categories used across APIs.

`AppError`

- Fields:
  - `code`: one of `ErrorCode`
  - `status`: HTTP status to surface (e.g., 400, 401, 429, 503)
  - `message`: human-readable error description
  - `details`: optional payload for debugging or client use
- Construction:
  - new `AppError(code, message, status, details?)`
- Behavior:
  - Extends `Error`; preserves prototype for `instanceof` checks.

Error Codes

- `VALIDATION_ERROR`: Input fails schema/constraints.
- `UNAUTHORIZED`: Missing/invalid credentials.
- `FORBIDDEN`: Authenticated but not permitted.
- `NOT_FOUND`: Resource missing.
- `CONFLICT`: Resource state conflict.
- `INTERNAL_ERROR`: Dependency failure, timeouts, unexpected runtime errors.

Usage Patterns

- Throwing:
  - Validation: new `AppError(ErrorCode.VALIDATION_ERROR, 'Invalid payload', 400)`
  - Auth: new `AppError(ErrorCode.UNAUTHORIZED, 'Invalid token', 401)`
  - Permissions: new `AppError(ErrorCode.FORBIDDEN, 'Not allowed', 403)`
  - Not found: new `AppError(ErrorCode.NOT_FOUND, 'No such item', 404)`
  - Conflict: new `AppError(ErrorCode.CONFLICT, 'Already exists', 409)`
  - Dependency/timeout: new `AppError(ErrorCode.INTERNAL_ERROR, 'Service unavailable', 503)`

- Mapping external errors to `AppError`:
  - Network/timeout/5xx → `INTERNAL_ERROR` with `status` 503.

- Response shape:
  - Error responses should follow `ErrorResponse` with `success: false`, `code`, `message`, optional `traceId` and `details`.

Examples

- Throw inside middleware:
  - On rate limit: new `AppError(ErrorCode.FORBIDDEN, 'Too many requests', 429)`

- HTTP client mapping:
  - Wrap network failures: new `AppError(ErrorCode.INTERNAL_ERROR, 'Service unavailable or timed out', 503, { url })`

Guidance

- Prefer specific codes over `INTERNAL_ERROR` when cause is known.
- Avoid leaking sensitive data via `message` or `details`.
- Keep `details` serializable; avoid large objects to prevent response bloat.

Implementation Guide

Basic construction:

```typescript
import { AppError } from "../errors/AppError";
import { ErrorCode } from "../types/api";

// Validation error
throw new AppError(ErrorCode.VALIDATION_ERROR, "Email is required", 400, {
  field: "email",
});

// Authorization
throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid token", 401);

// Permission denied
throw new AppError(ErrorCode.FORBIDDEN, "Insufficient permissions", 403, {
  required: "admin",
  current: "user",
});
```

Error flow with middleware:

```typescript
import { errorHandler } from "../middlewares/error.middleware";

// In Express app setup
app.use(routes);
app.use(errorHandler); // Catch all AppError and native Error

// In route handlers
app.post("/items", (req, res, next) => {
  try {
    if (!req.body.name) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Name is required", 400);
    }
    // Process...
  } catch (err) {
    next(err); // Passes to errorHandler
  }
});
```

External error mapping:

```typescript
import { httpClient } from "../http/client";

try {
  await httpClient.get("https://external.api/data");
} catch (err) {
  if (err instanceof AppError && err.code === ErrorCode.INTERNAL_ERROR) {
    // Handle dependency failure (5xx, timeout, connection error)
    return res.status(503).json({
      success: false,
      code: err.code,
      message: "Service temporarily unavailable",
    });
  }
  throw err;
}
```
