---
title: Backpressure Patterns
category: Code Quality
tags: [async, flow-control, resilience, performance]
summary: How to use backpressure to write more resilient async code that handles load gracefully.
---

## What is backpressure?

Backpressure is a mechanism where a data consumer signals to a producer to slow down when it cannot keep up with the rate of incoming data. Think of it like a highway on-ramp meter light — it regulates flow to prevent the highway (your system) from becoming gridlocked.

## When to apply

- Processing streams of data (file I/O, network, queues)
- API endpoints receiving bursty traffic
- Pipeline stages with differing throughput
- Any producer-consumer relationship where speed mismatch is possible

## Patterns

### 1. Bounded queues

```typescript
// ❌ Unbounded — memory grows without limit
const queue: Task[] = [];
queue.push(newTask); // always succeeds, OOM eventually

// ✅ Bounded — producer must wait when full
const queue = new BoundedQueue<Task>(1000);
await queue.enqueue(newTask); // blocks when full
```

### 2. Stream backpressure (Node.js)

Always respect the boolean return from `.write()`:

```typescript
// ✅ Correct: pause when write returns false
const writable = getWritableStream();
for (const chunk of chunks) {
  const ok = writable.write(chunk);
  if (!ok) {
    await new Promise((resolve) => writable.once("drain", resolve));
  }
}
```

### 3. Rate limiting at the API boundary

```typescript
// Apply token-bucket or sliding-window rate limiting
// Return 429 with Retry-After header
if (!rateLimiter.allow(request)) {
  return new Response("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": "5" },
  });
}
```

### 4. Reactive pull-based processing

```typescript
// Consumer pulls work when ready, rather than being pushed to
async function worker(queue: AsyncIterable<Job>) {
  for await (const job of queue) {
    await processJob(job); // natural backpressure — next pull waits
  }
}
```

## Anti-patterns to avoid

- **Dropping data silently** — always log or metric when shedding load
- **Infinite retry without delay** — use exponential backoff with jitter
- **Buffering everything in memory** — bound your buffers, use disk or external queues for overflow
- **Ignoring stream.write() return value** — this is the #1 cause of memory issues in Node.js stream processing
