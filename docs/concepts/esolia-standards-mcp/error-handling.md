---
title: Error Handling Standards
category: Code Quality
tags: [errors, resilience, logging, typescript]
summary: Consistent error handling patterns across all eSolia TypeScript/JavaScript projects.
---

## Principles

1. **Errors are values** — handle them explicitly, never swallow them silently
2. **Fail fast, recover gracefully** — detect problems early, provide clear recovery paths
3. **Structured over unstructured** — use typed errors with codes, not bare strings
4. **Log context, not noise** — include what happened, where, and what to do about it

## Custom error classes

Define domain-specific errors with codes:

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Usage
throw new AppError(
  "User not found",
  "USER_NOT_FOUND",
  404,
  { userId: "abc-123" }
);
```

## Result pattern (preferred for expected failures)

Use a Result type instead of throwing for expected error cases:

```typescript
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function findUser(id: string): Promise<Result<User>> {
  const user = await db.users.find(id);
  if (!user) {
    return { ok: false, error: new AppError("User not found", "USER_NOT_FOUND", 404) };
  }
  return { ok: true, value: user };
}

// Caller handles both cases explicitly
const result = await findUser("abc-123");
if (!result.ok) {
  // handle error — type-safe, no try/catch needed
  return respond(result.error.statusCode, result.error.message);
}
const user = result.value; // TypeScript narrows to User
```

## Try/catch guidelines

Reserve try/catch for truly unexpected errors:

```typescript
// ✅ Catch at boundaries, not everywhere
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const appErr = err instanceof AppError
      ? err
      : new AppError("Internal error", "INTERNAL_ERROR", 500);

    logger.error({
      code: appErr.code,
      message: appErr.message,
      context: appErr.context,
      stack: appErr.stack,
    });

    ctx.status = appErr.statusCode;
    ctx.body = { error: appErr.code, message: appErr.message };
  }
});

// ❌ Don't do this — hides bugs
try {
  doSomething();
} catch {
  // silently swallowed
}
```

## Logging standards

Use structured logging with consistent fields:

```typescript
logger.error({
  event: "payment_failed",
  code: "STRIPE_DECLINED",
  userId: user.id,
  amount: payment.amount,
  stripeError: err.message,
});
```

Required fields for all error logs: `event`, `code`. Include relevant entity IDs and the original error message. Never log sensitive data (passwords, tokens, PII).
