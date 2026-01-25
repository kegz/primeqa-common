PrimeQA Common: Developer Documents

- Purpose: Quick references for core modules used across services.

Structure

- errors: `AppError` and `ErrorCode` usage.
- http: HTTP client features (`httpRequest`, `httpClient`, `createHttpClient`).
- middlewares: Express middlewares for auth, validation, rate limiting, tenant, etc.
- types: API response and shared types; Express request augmentation.
- utils: Shared helpers for env, sanitize, response, pagination, secrets.

Getting Started

- Browse subfolder READMEs for patterns and examples.
- Follow error and response shapes to keep APIs consistent.

Tips

- Propagate correlation IDs and auth headers through HTTP client options.
- Use Joi validation in `validate.middleware.ts` to stop bad inputs early.
- Prefer throwing `AppError` with appropriate `ErrorCode` over generic `Error`.

Common Patterns

1. **Full request pipeline**
   - Request → correlationId → auth → tenant check → validation → handler → error middleware

2. **Service-to-service calls**
   - Use `httpClient` with `req` to propagate auth and correlation IDs.
   - Catch `AppError` with `INTERNAL_ERROR` code for graceful degradation.

3. **Tenant isolation**
   - Apply `requireTenant` to protected routes.
   - Use `assertTenantMatch` in handlers to verify resource ownership.
   - Use `enforceTenantOnBody` to inject tenant ID on creates.

4. **Error handling**
   - Throw `AppError` with specific `ErrorCode` in route logic.
   - Let `errorMiddleware` handle response formatting.
   - Avoid logging sensitive data in error details.

5. **Validation**
   - Define Joi schemas once, reuse via middleware.
   - Use `stripUnknown: true` to prevent injection.
   - Provide clear error details for client debugging.

Quick Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with JWT_SECRET, DATABASE_URL, etc.

# Run tests
npm test

# Start server
npm start
```
