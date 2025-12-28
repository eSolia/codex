# Durable Objects for Hanawa (Tiptap Editor)

## Why This Matters

Hanawa's Tiptap-based editor will likely need **real-time collaborative editing** — multiple users working on the same document simultaneously. Durable Objects are purpose-built for exactly this scenario.

---

## The Core Problem

When two users edit the same document at the same time:

```
User A: "The quick brown fox"  →  adds "lazy" before "fox"
User B: "The quick brown fox"  →  deletes "quick"

Without coordination:
  User A sees: "The quick brown lazy fox"
  User B sees: "The brown fox"
  Database: ¯\_(ツ)_/¯
```

Traditional databases can't serialize these operations fast enough for real-time typing. You need a single point of coordination.

---

## How Durable Objects Solve This

Each document gets its own Durable Object instance:

```
┌─────────────┐
│  User A     │───WebSocket───┐
└─────────────┘               │
                              ▼
                    ┌───────────────────┐
                    │  DO: doc-abc123   │
                    │                   │
                    │  • Canonical state│
                    │  • Operation log  │
                    │  • Connected users│
                    └───────────────────┘
                              ▲
┌─────────────┐               │
│  User B     │───WebSocket───┘
└─────────────┘
```

**Key properties:**

- All edits route to the same instance (no race conditions)
- Single-threaded execution (operations applied in order)
- WebSocket support (real-time broadcast to all connected users)
- Private durable storage (document persists even when no one is connected)

---

## Tiptap + Durable Objects Architecture

Tiptap uses [Yjs](https://yjs.dev/) or [Hocuspocus](https://hocuspocus.dev/) for collaboration. The typical pattern:

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Tiptap Editor                                   │   │
│  │  └── Yjs Document (local replica)               │   │
│  │       └── WebSocket Provider                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ WebSocket (Yjs sync protocol)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Durable Object                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  • Yjs document (authoritative)                 │   │
│  │  • Connected clients list                        │   │
│  │  • Broadcast updates to all clients              │   │
│  │  • Persist to DO storage on changes              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Sketch

```typescript
// Durable Object for a single document
export class DocumentRoom {
  private connections: Set<WebSocket> = new Set();
  private yDoc: Y.Doc;

  constructor(private state: DurableObjectState) {
    this.yDoc = new Y.Doc();
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      await this.handleSession(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    // Handle REST endpoints (load, save, etc.)
  }

  private async handleSession(ws: WebSocket) {
    ws.accept();
    this.connections.add(ws);

    // Send current document state
    ws.send(Y.encodeStateAsUpdate(this.yDoc));

    ws.addEventListener("message", (event) => {
      // Apply update to authoritative doc
      Y.applyUpdate(this.yDoc, new Uint8Array(event.data));
      
      // Broadcast to other clients
      for (const conn of this.connections) {
        if (conn !== ws) conn.send(event.data);
      }
      
      // Persist (debounced in practice)
      this.state.storage.put("doc", Y.encodeStateAsUpdate(this.yDoc));
    });

    ws.addEventListener("close", () => this.connections.delete(ws));
  }
}
```

---

## Existing Solutions to Evaluate

| Option | Description | Cloudflare Fit |
|--------|-------------|----------------|
| **[Hocuspocus](https://hocuspocus.dev/)** | Official Tiptap collab server | Needs adaptation for DO |
| **[y-durableobjects](https://github.com/nicksrandall/y-durableobjects)** | Community Yjs + DO binding | Good starting point |
| **[PartyKit](https://partykit.io/)** | Abstraction over Durable Objects | Simplifies WebSocket handling |
| **Roll your own** | Direct Yjs + DO implementation | Full control, more work |

---

## Cost Considerations

Durable Objects bill for:

- **Requests**: Each WebSocket message counts
- **Duration**: Time the object is active (has connections or recent activity)
- **Storage**: Per-GB stored

For a CMS with moderate concurrent editing, costs should be reasonable. Heavy real-time usage (many simultaneous editors, frequent saves) will scale up.

---

## Trade-offs

| Pros | Cons |
|------|------|
| True real-time sync | More complex than REST |
| No race conditions | Latency to DO location |
| Built-in WebSocket support | Debugging distributed state |
| Scales per-document | Cost scales with active documents |

---

## Next Steps

1. **Prototype**: Minimal Tiptap + Yjs + Durable Object proof-of-concept
2. **Evaluate y-durableobjects**: See if it fits Hanawa's needs
3. **Consider PartyKit**: May simplify initial implementation
4. **Define persistence model**: How often to snapshot, history retention
5. **Plan offline support**: Yjs handles offline; decide on sync strategy

---

## References

- [Cloudflare Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [Tiptap Collaboration](https://tiptap.dev/docs/editor/extensions/functionality/collaboration)
- [Yjs Documentation](https://docs.yjs.dev/)
- [PartyKit](https://docs.partykit.io/)
