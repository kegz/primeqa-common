Types

- Purpose: Shared API and context types for consistency.

Core

- `ErrorCode`: enum of error categories.
- `SuccessResponse<T>`: `{ success: true, message?, data? }`
- `ErrorResponse`: `{ success: false, code, message, traceId?, details? }`
- `PaginationMeta`: `{ total, totalPages, page, pageSize }`
- `PagedResponse<T>`: `SuccessResponse<T[]>` + `meta`.
- `ApiResponse<T>`: union of success or error response.

Express Augmentation

- `express.d.ts`: Extends `Request` with `user`, `tenantId`, `correlationId`.

Guidance

- Always return `ApiResponse` from HTTP handlers.
- Prefer `ErrorCode` for error signaling; avoid ad-hoc strings.
- Keep `traceId`/correlation IDs consistent across services.

Implementation Guide

Request/response flow:

```typescript
import { SuccessResponse, ErrorResponse, ErrorCode } from "../types/api";
import { Request, Response } from "express";

// Handler returning typed responses
app.get("/api/items/:id", async (req: Request, res: Response) => {
  try {
    const item = await db.items.findById(req.params.id);

    if (!item) {
      const errorResp: ErrorResponse = {
        success: false,
        code: ErrorCode.NOT_FOUND,
        message: "Item not found",
        traceId: req.correlationId,
      };
      return res.status(404).json(errorResp);
    }

    const successResp: SuccessResponse<typeof item> = {
      success: true,
      message: "Item retrieved",
      data: item,
    };
    return res.json(successResp);
  } catch (err) {
    next(err);
  }
});
```

Paged responses:

```typescript
import { PagedResponse, buildPaginationMeta } from "../utils/response";

app.get("/api/items", async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;

  const total = await db.items.count();
  const items = await db.items.find({
    skip: (page - 1) * pageSize,
    limit: pageSize,
  });

  const response: PagedResponse<typeof items> = {
    success: true,
    data: items,
    meta: buildPaginationMeta(total, page, pageSize),
  };

  return res.json(response);
});
```

Express request augmentation:

```typescript
// After authenticate middleware, req.user is set (UserClaims)
// After requireTenant middleware, req.tenantId is set (string)
// After requestContext middleware, req.correlationId is set (string)

app.get("/api/self", authenticate, (req: Request, res: Response) => {
  // Type-safe access
  const user = req.user!; // UserClaims
  const tenantId = req.tenantId!; // string (if tenantId middleware applied)

  return res.json({
    success: true,
    data: { userId: user.id, tenantId },
  });
});
```
