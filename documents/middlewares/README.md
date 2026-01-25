Middlewares

- Purpose: Express middlewares for auth, safety, context, and governance.

Available

- `auth.middleware.ts`: Validates JWT, sets user context; rejects unauthorized.
- `error.middleware.ts`: Central error responder; maps `AppError` to `ErrorResponse`.
- `idempotency.middleware.ts`: Enforces idempotent request semantics.
- `logger.middleware.ts`: Request logging and timing.
- `permission.middleware.ts`: Checks user permissions/roles.
- `rateLimit.middleware.ts`: IP/key-based rate limiting; default window 60s, max 10.
- `requestContext.middleware.ts`: Correlation IDs, request-scoped metadata.
- `security.middleware.ts`: Basic security headers and checks.
- `tenant.middleware.ts`: Enforces tenant isolation; `assertTenantMatch`, `requireTenant`.
- `validate.middleware.ts`: Joi-based validation for params/body/query.

Quick Usage

- Apply rate limit:
  - `app.post('/login', loginRateLimiter, handler)`
- Validate body:
  - `app.post('/items', validate(schema), handler)`
- Require tenant:
  - `app.use(requireTenant)`
- Handle errors:
  - `app.use(errorMiddleware)`

Guidance

- Order middlewares to gather context (correlation, auth) before governance.
- Keep error messages generic; use `details` for internal context.

Implementation Guide

Middleware setup order (recommended):

```typescript
import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { requireTenant } from "../middlewares/tenant.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import {
  rateLimit,
  loginRateLimiter,
} from "../middlewares/rateLimit.middleware";
import { errorHandler } from "../middlewares/error.middleware";
import Joi from "joi";

const app = express();

// 1. Request context (correlation, request ID)
app.use(requestContextMiddleware);

// 2. Logging
app.use(logger);

// 3. Security
app.use(securityMiddleware);

// 4. Rate limiting (early to block abusers)
app.post("/login", loginRateLimiter, authenticate);

// 5. Authentication
app.use("/api", authenticate);

// 6. Tenant enforcement
app.use("/api", requireTenant);

// 7. Validation and business routes
const itemsRouter = Router();

const createItemSchema = Joi.object({
  name: Joi.string().required(),
  price: Joi.number().positive().required(),
});

itemsRouter.post(
  "/",
  validateBody(createItemSchema),
  enforceTenantOnBody(),
  (req, res, next) => {
    // Handler: req.body is validated, req.tenantId set
    try {
      const item = { ...req.body, createdAt: new Date() };
      return res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  },
);

app.use("/api/items", itemsRouter);

// 8. 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: "Route not found",
  });
});

// 9. Error handler (last)
app.use(errorHandler);
```

Auth + validation example:

```typescript
// Protect and validate
app.post(
  "/api/users/:id/email",
  authenticate, // Sets req.user
  requireTenant, // Sets req.tenantId, requires user.tenantId
  validateBody(
    Joi.object({
      email: Joi.string().email().required(),
    }),
  ),
  async (req, res, next) => {
    try {
      assertTenantMatch(req, req.params.id); // Confirm user owns resource
      const updated = await db.users.update(req.params.id, {
        email: req.body.email,
      });
      return res.json({ success: true, data: updated });
    } catch (err) {
      next(err); // errorHandler catches AppError
    }
  },
);
```

Rate limiting with custom key:

```typescript
const limiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 10, // 10 requests per window
  keyGenerator: (req) => req.user?.id || req.ip, // Per user or IP
  message: "Too many requests, try again later",
});

app.post("/api/auth/verify-code", limiter, (req, res, next) => {
  // User can send max 10 verification codes per minute
  try {
    // Send code logic
    res.json({ success: true, message: "Code sent" });
  } catch (err) {
    next(err);
  }
});
```
