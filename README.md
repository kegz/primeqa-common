# @primeqa/common

Shared utilities, middleware, and types for PrimeQA microservices.

## Features

- ✅ **Authentication & Authorization** - JWT validation, permission checks, tenant isolation
- ✅ **Error Handling** - Standardized error responses with correlation IDs
- ✅ **HTTP Client** - Service-to-service communication with retries and header propagation
- ✅ **Rate Limiting** - Configurable rate limiting with in-memory cache
- ✅ **Idempotency** - Prevent duplicate POST requests
- ✅ **Validation** - Joi schema validation middleware
- ✅ **Pagination** - Standardized pagination parsing and response formatting
- ✅ **Security** - Helmet security headers, secrets masking, request sanitization
- ✅ **Observability** - Request correlation IDs, structured logging

## Installation

```bash
npm install @primeqa/common
```

## Quick Start

### Basic Setup

```typescript
import express from "express";
import {
  setupCommonsMiddleware,
  authenticate,
  requirePermission,
  validateBody,
  success,
} from "@primeqa/common";

const app = express();

// Apply common middleware
setupCommonsMiddleware(app);

// Protected route example
app.get(
  "/api/users",
  authenticate,
  requirePermission("users.read"),
  async (req, res, next) => {
    try {
      const users = await getUsersFromDB();
      return success(res, users, "Users retrieved");
    } catch (err) {
      next(err);
    }
  },
);

app.listen(3000);
```

## HTTP Client (Service-to-Service Communication)

The HTTP client provides robust service-to-service communication with automatic retries, timeout handling, and header propagation.

### Features

- ✅ Automatic timeout handling (default: 10s)
- ✅ Retry logic for GET requests with exponential backoff
- ✅ Auth header propagation from incoming requests
- ✅ Correlation ID propagation for distributed tracing
- ✅ Automatic 503 mapping for dependency failures (network errors, 5xx)
- ✅ TypeScript support with generics

### Basic Usage

```typescript
import { httpClient } from "@primeqa/common";

// Simple GET request
const response = await httpClient.get<User>(
  "https://user-service.com/api/users/123",
);
console.log(response.data);

// POST with body
const newUser = await httpClient.post("https://user-service.com/api/users", {
  name: "John Doe",
  email: "john@example.com",
});
```

### Propagate Headers from Request

```typescript
app.get("/api/projects/:id", authenticate, async (req, res, next) => {
  try {
    // Automatically propagates Authorization and X-Correlation-Id headers
    const project = await httpClient.get<Project>(
      `https://project-service.com/api/projects/${req.params.id}`,
      { req }, // Pass Express request object
    );

    return success(res, project.data);
  } catch (err) {
    next(err); // 503 if service unavailable
  }
});
```

### Create a Service-Specific Client

```typescript
import { createHttpClient } from "@primeqa/common";

const userServiceClient = createHttpClient({
  baseUrl: process.env.USER_SERVICE_URL || "http://localhost:3002",
  timeout: 10000,
  retries: 2,
  headers: {
    "X-Service-Name": "project-service",
  },
});

// Use relative paths
const user = await userServiceClient.get<User>("/api/users/123", { req });
const newUser = await userServiceClient.post("/api/users", userData, { req });
```

### Custom Options

```typescript
const response = await httpClient.get("https://slow-api.com/data", {
  timeout: 30000, // 30 seconds
  retries: 3, // Retry up to 3 times (GET only)
  retryDelay: 2000, // 2 seconds between retries
  propagateAuth: false, // Don't propagate Authorization header
  headers: {
    "X-API-Key": process.env.API_KEY,
  },
});
```

### Error Handling

```typescript
try {
  const data = await httpClient.get("https://api.example.com/data", { req });
} catch (error) {
  // Network errors, timeouts, and 5xx responses are mapped to 503
  // error instanceof AppError === true
  // error.status === 503
  // error.code === ErrorCode.INTERNAL_ERROR
  next(error); // Pass to error middleware
}
```

## API Reference

### Middlewares

#### `authenticate`

Validates JWT token from Authorization header.

```typescript
app.get("/protected", authenticate, handler);
```

#### `requirePermission(permission: string)`

Checks if authenticated user has specific permission.

```typescript
app.post("/users", authenticate, requirePermission("users.create"), handler);
```

#### `requireTenant`

Ensures user has tenant context and attaches to `req.tenantId`.

```typescript
app.get("/data", authenticate, requireTenant, handler);
```

#### `enforceTenantOnBody(fieldName = 'tenantId')`

Prevents cross-tenant data manipulation by forcing tenant ID on request body.

```typescript
app.post("/projects", authenticate, enforceTenantOnBody("tenantId"), handler);
```

#### `validateBody(schema: ObjectSchema)`

Validates request body against Joi schema.

```typescript
import Joi from "joi";

const schema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
});

app.post("/users", validateBody(schema), handler);
```

#### `rateLimit(options?)`

Rate limiting middleware with in-memory cache.

```typescript
import { rateLimit, loginRateLimiter } from "@primeqa/common";

// Custom rate limit
app.post("/api/data", rateLimit({ windowMs: 60000, max: 100 }), handler);

// Pre-configured login limiter (10 req/min)
app.post("/auth/login", loginRateLimiter, handler);
```

#### `idempotencyMiddleware(options?)`

Prevents duplicate POST requests using Idempotency-Key header.

```typescript
import { idempotencyMiddleware } from "@primeqa/common";

app.post(
  "/orders",
  authenticate,
  idempotencyMiddleware({ ttlMs: 5 * 60 * 1000 }),
  handler,
);
```

### Utilities

#### Response Helpers

```typescript
import { success, fail, pagedResponse } from "@primeqa/common";

// Success response
return success(res, data, "Operation successful");
// => { success: true, message: '...', data: {...} }

// Error response (prefer throwing AppError)
return fail(res, 404, "Not found", ErrorCode.NOT_FOUND);

// Paginated response
return pagedResponse(res, items, total, page, pageSize);
// => { success: true, data: [...], meta: { total, totalPages, page, pageSize } }
```

#### Pagination

```typescript
import { parsePagination } from "@primeqa/common";

const { page, pageSize, skip, limit, sort, order } = parsePagination(
  req.query,
  {
    page: 1,
    pageSize: 50,
    maxPageSize: 200,
  },
);

const items = await db.find().skip(skip).limit(limit);
```

#### User Context

```typescript
import { getUserContext } from "@primeqa/common";

const { userId, tenantId, role, permissions } = getUserContext(req);
// Throws 401 if user not authenticated
```

#### Validation

```typescript
import { isObjectId, isISODate, isEnumValue } from '@primeqa/common';

if (!isObjectId(id)) throw new AppError(...);
if (!isISODate(date)) throw new AppError(...);
if (!isEnumValue(status, ['active', 'inactive'])) throw new AppError(...);
```

### Error Handling

#### AppError Class

```typescript
import { AppError, ErrorCode } from "@primeqa/common";

throw new AppError(
  ErrorCode.NOT_FOUND,
  "User not found",
  404,
  { userId: "123" }, // optional details
);
```

#### Error Codes

```typescript
enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
```

### Cache Management

```typescript
import { startCacheCleanup, stopCacheCleanup } from "@primeqa/common";

// Start periodic cleanup (recommended)
startCacheCleanup(5 * 60 * 1000); // Every 5 minutes

// Stop cleanup on shutdown
process.on("SIGTERM", () => {
  stopCacheCleanup();
  server.close();
});
```

## Developer Documentation

Comprehensive guides and implementation patterns are available in the [`documents/`](./documents/) folder:

- **[documents/errors/README.md](./documents/errors/README.md)** - `AppError` construction, error flows, and error code usage
- **[documents/http/README.md](./documents/http/README.md)** - HTTP client patterns, timeout/retry handling, service client instances
- **[documents/middlewares/README.md](./documents/middlewares/README.md)** - Middleware setup order, auth chains, validation patterns, rate limiting
- **[documents/types/README.md](./documents/types/README.md)** - Request/response typing, paged responses, Express augmentation
- **[documents/utils/README.md](./documents/utils/README.md)** - Response helpers, validation utilities, env parsing, cache cleanup

### Quick Links

- [Full documentation index](./documents/README.md)
- [Error handling guide](./documents/errors/README.md)
- [HTTP client guide](./documents/http/README.md)
- [Middleware setup](./documents/middlewares/README.md)

## TypeScript Support

All exports are fully typed. Extend Express types:

```typescript
import { UserClaims } from "@primeqa/common";

// Types are already extended in express.d.ts
app.get("/me", authenticate, (req, res) => {
  const userId = req.user?.userId; // TypeScript knows about req.user
  const correlationId = req.correlationId; // TypeScript knows about this too
});
```

## Environment Variables

Required environment variables for your services:

```bash
JWT_SECRET=your-secret-key              # Required for authenticate middleware
USER_SERVICE_URL=http://localhost:3002  # For service-to-service calls
PROJECT_SERVICE_URL=http://localhost:3001
```

## Testing

```bash
npm run build       # Compile TypeScript
npm run lint        # Run ESLint
npm run format      # Format with Prettier
```

## License

MIT

## Contributing

1. All middlewares must handle errors via `next(error)`
2. Use `AppError` for known error conditions
3. Include correlation ID in all error responses
4. Add JSDoc comments for public APIs
5. Ensure TypeScript strict mode compliance

## Support

For issues or questions, contact the PrimeQA team.
