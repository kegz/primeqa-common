Utils

- Purpose: Shared utilities for environment, safety, pagination, and responses.

Available

- `cacheCleanup.ts`: Periodic cleanup for in-memory stores (e.g., rate limit cache).
- `constants.ts`: Common constants used across modules.
- `env.ts`: Environment variable parsing and defaults.
- `pagination.ts`: Helpers to compute pages and metadata.
- `response.ts`: Format success/error responses consistently.
- `safety.ts`: Safety helpers (e.g., type guards, invariant checks).
- `sanitize.ts`: Input sanitization to prevent injection.
- `secrets.ts`: Secrets loading and caching.
- `user.ts`: User-related helpers.
- `validation.ts`: Joi schema builders and validators.

Guidance

- Keep utilities pure and side-effect free when possible.
- Reuse response/pagination helpers to avoid duplication.
- Centralize env parsing to simplify configuration management.

Implementation Guide

Response formatting:

```typescript
import { success, fail, buildPaginationMeta } from "../utils/response";
import { ErrorCode } from "../types/api";

// Success response
app.get("/api/items/:id", async (req, res, next) => {
  try {
    const item = await db.items.findById(req.params.id);
    if (!item) {
      return fail(
        res,
        404,
        "Item not found",
        ErrorCode.NOT_FOUND,
        req.correlationId,
      );
    }
    return success(res, item, "Item retrieved");
  } catch (err) {
    next(err);
  }
});

// Paged response
app.get("/api/items", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const [items, total] = await Promise.all([
      db.items.find({ skip: (page - 1) * pageSize, limit: pageSize }),
      db.items.count(),
    ]);

    const meta = buildPaginationMeta(total, page, pageSize);
    return res.status(200).json({
      success: true,
      data: items,
      meta,
    });
  } catch (err) {
    next(err);
  }
});
```

Validation utilities:

```typescript
import { isObjectId, isISODate, isEnumValue } from "../utils/validation";
import Joi from "joi";

// Custom validators in Joi schema
const schema = Joi.object({
  userId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!isObjectId(value)) {
        return helpers.error("string.pattern.base");
      }
      return value;
    }),
  createdAt: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!isISODate(value)) {
        return helpers.error("date.base");
      }
      return value;
    }),
  status: Joi.string()
    .required()
    .custom((value, helpers) => {
      const valid = isEnumValue(value, ["active", "inactive", "pending"]);
      if (!valid) {
        return helpers.error("any.only");
      }
      return value;
    }),
});
```

Environment parsing:

```typescript
import { env } from "../utils/env";

// In config or startup
const dbUrl = env("DATABASE_URL", "mongodb://localhost");
const jwtSecret = env("JWT_SECRET"); // Throws if missing
const port = env.number("PORT", 3000);
const enableLogging = env.bool("ENABLE_LOGGING", true);
```

Cache cleanup for rate limiting:

```typescript
import { _cleanupRateLimitCache } from "../middlewares/rateLimit.middleware";

// Periodically clean expired entries
setInterval(() => {
  _cleanupRateLimitCache(Date.now());
}, 60_000); // Every minute
```

Secret loading:

```typescript
import { loadSecrets } from "../utils/secrets";

// Cache secrets
const secrets = await loadSecrets(["JWT_SECRET", "DB_PASSWORD"]);
console.log(secrets.JWT_SECRET); // From env or vault
```
