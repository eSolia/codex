# Hanawa: Real-time Collaboration Specification

Multi-user editing with presence awareness and live cursors.

## Overview

Real-time collaboration transforms Hanawa from a single-user editor into a team workspace. When multiple people work on a document, they see each other's presence, cursors, and changes—instantly.

Think of it like Google Docs, but for compliance documentation. The magic isn't just technical synchronization—it's the psychological impact of knowing your team is working together.

```
┌─────────────────────────────────────────────────────────────────┐
│  COLLABORATION ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Browser A          Durable Object           Browser B          │
│  ─────────          ───────────────          ─────────          │
│  ┌─────────┐       ┌─────────────────┐      ┌─────────┐        │
│  │ Tiptap  │◄─────►│  Document Room  │◄────►│ Tiptap  │        │
│  │ Editor  │  WS   │                 │  WS  │ Editor  │        │
│  └─────────┘       │ - Presence map  │      └─────────┘        │
│                    │ - Editor state  │                          │
│  Rick's cursor     │ - Op queue      │      Yuki's cursor      │
│  [  |  ]           │ - Sync logic    │      [    | ]           │
│                    └─────────────────┘                          │
│                            │                                    │
│                            ▼                                    │
│                    ┌───────────────┐                           │
│                    │      D1       │                           │
│                    │  (persist)    │                           │
│                    └───────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Choice: Cloudflare Durable Objects

Durable Objects provide the ideal foundation for real-time collaboration:

| Requirement | Durable Objects Solution |
|-------------|--------------------------|
| Single source of truth | One DO instance per document |
| WebSocket connections | Native WebSocket support |
| Low latency | Edge-located, close to users |
| Consistent state | Strongly consistent within DO |
| Persistent state | Built-in storage survives restarts |
| Automatic scaling | One instance per document, scales with usage |

Alternative considered: **PartyKit** (simpler API but additional service)

---

## Data Model

### Presence Data

```typescript
interface UserPresence {
  id: string;              // Unique session ID
  email: string;           // User email from CF Access
  name: string;            // Display name
  color: string;           // Assigned cursor color
  avatar?: string;         // Avatar URL if available
  
  // Editor state
  cursor: {
    from: number;          // Selection start (ProseMirror position)
    to: number;            // Selection end
  } | null;
  
  // Activity
  lastActive: number;      // Timestamp of last activity
  isIdle: boolean;         // No activity for 60s
  isEditing: boolean;      // Currently typing
}

interface RoomState {
  documentId: string;
  users: Map<string, UserPresence>;
  
  // Document state
  version: number;         // Monotonic version counter
  content: string;         // Current document content (HTML)
  lastModified: number;    // Last content change timestamp
  
  // Sync state
  pendingOps: Operation[];
}
```

### WebSocket Message Protocol

```typescript
// Client → Server messages
type ClientMessage =
  | { type: 'join'; email: string; name: string }
  | { type: 'leave' }
  | { type: 'cursor'; cursor: { from: number; to: number } | null }
  | { type: 'operation'; op: Operation; version: number }
  | { type: 'ping' }
  | { type: 'sync-request'; version: number };

// Server → Client messages
type ServerMessage =
  | { type: 'welcome'; presence: UserPresence[]; version: number; content: string }
  | { type: 'user-joined'; user: UserPresence }
  | { type: 'user-left'; userId: string }
  | { type: 'user-updated'; user: Partial<UserPresence> & { id: string } }
  | { type: 'operation'; op: Operation; userId: string; version: number }
  | { type: 'ack'; version: number }
  | { type: 'sync'; version: number; content: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };

// Editor operations (simplified from ProseMirror)
interface Operation {
  type: 'insert' | 'delete' | 'replace';
  from: number;
  to?: number;
  content?: string;
}
```

### Color Assignment

Consistent, accessible colors for user identification:

```typescript
const PRESENCE_COLORS = [
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#9333ea', // Purple
  '#ea580c', // Orange
  '#0891b2', // Cyan
  '#be185d', // Pink
  '#4f46e5', // Indigo
  '#65a30d', // Lime
  '#b91c1c', // Dark Red
];

function assignColor(email: string, existingColors: Set<string>): string {
  // Deterministic color from email (consistent across sessions)
  const hash = simpleHash(email);
  const preferredIndex = hash % PRESENCE_COLORS.length;
  
  // Try preferred color first
  if (!existingColors.has(PRESENCE_COLORS[preferredIndex])) {
    return PRESENCE_COLORS[preferredIndex];
  }
  
  // Find first available
  for (const color of PRESENCE_COLORS) {
    if (!existingColors.has(color)) {
      return color;
    }
  }
  
  // All taken, use preferred anyway
  return PRESENCE_COLORS[preferredIndex];
}
```

---

## Durable Object Implementation

### Document Room DO

```typescript
// src/collaboration/DocumentRoom.ts

import type { DurableObjectState, WebSocket } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
}

interface Session {
  socket: WebSocket;
  presence: UserPresence;
  quit: boolean;
}

export class DocumentRoom {
  state: DurableObjectState;
  env: Env;
  
  sessions: Map<string, Session> = new Map();
  documentId: string | null = null;
  documentVersion: number = 0;
  documentContent: string = '';
  lastSaveTime: number = 0;
  saveTimeout: ReturnType<typeof setTimeout> | null = null;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Restore state from storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<{
        documentId: string;
        version: number;
        content: string;
      }>('document');
      
      if (stored) {
        this.documentId = stored.documentId;
        this.documentVersion = stored.version;
        this.documentContent = stored.content;
      }
    });
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const documentId = url.searchParams.get('documentId');
      const email = url.searchParams.get('email');
      const name = url.searchParams.get('name');
      
      if (!documentId || !email || !name) {
        return new Response('Missing parameters', { status: 400 });
      }
      
      // Initialize document if first connection
      if (!this.documentId) {
        this.documentId = documentId;
        await this.loadDocument(documentId);
      }
      
      // Create WebSocket pair
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      // Accept and handle the WebSocket
      await this.handleSession(server, { email, name });
      
      return new Response(null, { status: 101, webSocket: client });
    }
    
    // REST endpoints for document operations
    if (url.pathname === '/state' && request.method === 'GET') {
      return Response.json({
        documentId: this.documentId,
        version: this.documentVersion,
        users: Array.from(this.sessions.values()).map(s => s.presence),
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  async loadDocument(documentId: string) {
    const result = await this.env.DB.prepare(
      `SELECT content FROM documents WHERE id = ?`
    ).bind(documentId).first<{ content: string }>();
    
    if (result) {
      this.documentContent = result.content;
      this.documentVersion = 1;
    }
  }
  
  async handleSession(socket: WebSocket, user: { email: string; name: string }) {
    // Accept the WebSocket
    socket.accept();
    
    const sessionId = crypto.randomUUID();
    const existingColors = new Set(
      Array.from(this.sessions.values()).map(s => s.presence.color)
    );
    
    const session: Session = {
      socket,
      presence: {
        id: sessionId,
        email: user.email,
        name: user.name,
        color: assignColor(user.email, existingColors),
        cursor: null,
        lastActive: Date.now(),
        isIdle: false,
        isEditing: false,
      },
      quit: false,
    };
    
    this.sessions.set(sessionId, session);
    
    // Send welcome message with current state
    this.send(socket, {
      type: 'welcome',
      presence: Array.from(this.sessions.values()).map(s => s.presence),
      version: this.documentVersion,
      content: this.documentContent,
    });
    
    // Broadcast join to others
    this.broadcast({
      type: 'user-joined',
      user: session.presence,
    }, sessionId);
    
    // Handle messages
    socket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data as string) as ClientMessage;
        await this.handleMessage(sessionId, message);
      } catch (err) {
        console.error('Message handling error:', err);
      }
    });
    
    // Handle close
    socket.addEventListener('close', () => {
      this.sessions.delete(sessionId);
      this.broadcast({ type: 'user-left', userId: sessionId });
    });
    
    // Handle errors
    socket.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
      this.sessions.delete(sessionId);
    });
  }
  
  async handleMessage(sessionId: string, message: ClientMessage) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    switch (message.type) {
      case 'cursor':
        session.presence.cursor = message.cursor;
        session.presence.lastActive = Date.now();
        session.presence.isIdle = false;
        this.broadcast({
          type: 'user-updated',
          user: {
            id: sessionId,
            cursor: message.cursor,
            isIdle: false,
          },
        }, sessionId);
        break;
        
      case 'operation':
        await this.applyOperation(sessionId, message.op, message.version);
        break;
        
      case 'ping':
        session.presence.lastActive = Date.now();
        this.send(session.socket, { type: 'pong' });
        break;
        
      case 'sync-request':
        // Client is out of sync, send full state
        this.send(session.socket, {
          type: 'sync',
          version: this.documentVersion,
          content: this.documentContent,
        });
        break;
        
      case 'leave':
        session.quit = true;
        session.socket.close();
        this.sessions.delete(sessionId);
        this.broadcast({ type: 'user-left', userId: sessionId });
        break;
    }
  }
  
  async applyOperation(sessionId: string, op: Operation, clientVersion: number) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Check for version mismatch
    if (clientVersion !== this.documentVersion) {
      // Client is behind, they need to sync
      this.send(session.socket, {
        type: 'sync',
        version: this.documentVersion,
        content: this.documentContent,
      });
      return;
    }
    
    // Apply operation to document
    this.documentContent = applyOp(this.documentContent, op);
    this.documentVersion++;
    
    session.presence.isEditing = true;
    session.presence.lastActive = Date.now();
    
    // Acknowledge to sender
    this.send(session.socket, {
      type: 'ack',
      version: this.documentVersion,
    });
    
    // Broadcast to others
    this.broadcast({
      type: 'operation',
      op,
      userId: sessionId,
      version: this.documentVersion,
    }, sessionId);
    
    // Schedule save to D1
    this.scheduleSave();
  }
  
  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    // Debounce saves to avoid thrashing
    this.saveTimeout = setTimeout(async () => {
      await this.saveDocument();
    }, 2000);
  }
  
  async saveDocument() {
    if (!this.documentId) return;
    
    // Save to D1
    await this.env.DB.prepare(`
      UPDATE documents SET content = ?, updated_at = ? WHERE id = ?
    `).bind(this.documentContent, Date.now(), this.documentId).run();
    
    // Persist to DO storage
    await this.state.storage.put('document', {
      documentId: this.documentId,
      version: this.documentVersion,
      content: this.documentContent,
    });
    
    this.lastSaveTime = Date.now();
  }
  
  send(socket: WebSocket, message: ServerMessage) {
    try {
      socket.send(JSON.stringify(message));
    } catch (err) {
      console.error('Send error:', err);
    }
  }
  
  broadcast(message: ServerMessage, excludeSessionId?: string) {
    for (const [id, session] of this.sessions) {
      if (id !== excludeSessionId && !session.quit) {
        this.send(session.socket, message);
      }
    }
  }
}

// Helper to apply operation to content (simplified)
function applyOp(content: string, op: Operation): string {
  switch (op.type) {
    case 'insert':
      return content.slice(0, op.from) + (op.content || '') + content.slice(op.from);
    case 'delete':
      return content.slice(0, op.from) + content.slice(op.to || op.from);
    case 'replace':
      return content.slice(0, op.from) + (op.content || '') + content.slice(op.to || op.from);
    default:
      return content;
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
```

### Worker Entry Point

```typescript
// src/collaboration/index.ts

export { DocumentRoom } from './DocumentRoom';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/collab/')) {
      const documentId = url.pathname.split('/')[2];
      
      if (!documentId) {
        return new Response('Missing document ID', { status: 400 });
      }
      
      // Get Durable Object stub
      const id = env.DOCUMENT_ROOMS.idFromName(documentId);
      const room = env.DOCUMENT_ROOMS.get(id);
      
      // Forward request to DO
      return room.fetch(request);
    }
    
    return new Response('Not found', { status: 404 });
  },
};
```

### Wrangler Configuration

```toml
# wrangler.toml

name = "hanawa-collaboration"

[[durable_objects.bindings]]
name = "DOCUMENT_ROOMS"
class_name = "DocumentRoom"

[[migrations]]
tag = "v1"
new_classes = ["DocumentRoom"]

[[d1_databases]]
binding = "DB"
database_name = "hanawa-production"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## Client-Side Integration

### Collaboration Hook

```typescript
// lib/collaboration/useCollaboration.ts

import { onMount, onDestroy } from 'svelte';

interface UseCollaborationOptions {
  documentId: string;
  email: string;
  name: string;
  onPresenceChange?: (users: UserPresence[]) => void;
  onOperation?: (op: Operation, userId: string) => void;
  onSync?: (content: string, version: number) => void;
  onError?: (error: Error) => void;
}

export function useCollaboration(options: UseCollaborationOptions) {
  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  let version = 0;
  let presence: UserPresence[] = [];
  let isConnected = false;
  
  function connect() {
    const wsUrl = new URL('/collab/' + options.documentId, location.href);
    wsUrl.protocol = wsUrl.protocol.replace('http', 'ws');
    wsUrl.searchParams.set('documentId', options.documentId);
    wsUrl.searchParams.set('email', options.email);
    wsUrl.searchParams.set('name', options.name);
    
    socket = new WebSocket(wsUrl.toString());
    
    socket.onopen = () => {
      isConnected = true;
      reconnectAttempts = 0;
      startHeartbeat();
    };
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      handleMessage(message);
    };
    
    socket.onclose = () => {
      isConnected = false;
      stopHeartbeat();
      scheduleReconnect();
    };
    
    socket.onerror = (event) => {
      options.onError?.(new Error('WebSocket error'));
    };
  }
  
  function handleMessage(message: ServerMessage) {
    switch (message.type) {
      case 'welcome':
        version = message.version;
        presence = message.presence;
        options.onPresenceChange?.(presence);
        options.onSync?.(message.content, message.version);
        break;
        
      case 'user-joined':
        presence = [...presence, message.user];
        options.onPresenceChange?.(presence);
        break;
        
      case 'user-left':
        presence = presence.filter(u => u.id !== message.userId);
        options.onPresenceChange?.(presence);
        break;
        
      case 'user-updated':
        presence = presence.map(u => 
          u.id === message.user.id ? { ...u, ...message.user } : u
        );
        options.onPresenceChange?.(presence);
        break;
        
      case 'operation':
        version = message.version;
        options.onOperation?.(message.op, message.userId);
        break;
        
      case 'ack':
        version = message.version;
        break;
        
      case 'sync':
        version = message.version;
        options.onSync?.(message.content, message.version);
        break;
    }
  }
  
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  
  function startHeartbeat() {
    heartbeatInterval = setInterval(() => {
      send({ type: 'ping' });
    }, 30000);
  }
  
  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }
  
  function scheduleReconnect() {
    if (reconnectAttempts >= 5) {
      options.onError?.(new Error('Failed to reconnect after 5 attempts'));
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttempts++;
    
    setTimeout(connect, delay);
  }
  
  function send(message: ClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
  
  function sendOperation(op: Operation) {
    send({ type: 'operation', op, version });
  }
  
  function updateCursor(cursor: { from: number; to: number } | null) {
    send({ type: 'cursor', cursor });
  }
  
  function disconnect() {
    send({ type: 'leave' });
    socket?.close();
    stopHeartbeat();
  }
  
  // Lifecycle
  onMount(() => {
    connect();
  });
  
  onDestroy(() => {
    disconnect();
  });
  
  return {
    get isConnected() { return isConnected; },
    get presence() { return presence; },
    get version() { return version; },
    sendOperation,
    updateCursor,
    disconnect,
  };
}
```

### Tiptap Integration

```typescript
// lib/collaboration/CollaborationExtension.ts

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

interface CollaborationOptions {
  collaboration: ReturnType<typeof useCollaboration>;
}

export const CollaborationExtension = Extension.create<CollaborationOptions>({
  name: 'hanawa-collaboration',
  
  addOptions() {
    return {
      collaboration: null as any,
    };
  },
  
  addProseMirrorPlugins() {
    const { collaboration } = this.options;
    
    return [
      new Plugin({
        key: new PluginKey('hanawa-collaboration'),
        
        view: () => ({
          update: (view, prevState) => {
            // Send cursor position on selection change
            if (!view.state.selection.eq(prevState.selection)) {
              const { from, to } = view.state.selection;
              collaboration.updateCursor({ from, to });
            }
          },
        }),
        
        appendTransaction: (transactions, oldState, newState) => {
          // Check for content changes
          for (const tr of transactions) {
            if (tr.docChanged) {
              // Extract operations and send to collaboration
              tr.steps.forEach((step, i) => {
                const op = stepToOperation(step);
                if (op) {
                  collaboration.sendOperation(op);
                }
              });
            }
          }
          return null;
        },
      }),
    ];
  },
});

function stepToOperation(step: any): Operation | null {
  // Convert ProseMirror step to our operation format
  // This is simplified—real implementation needs proper step handling
  if (step.slice?.content?.size > 0) {
    return {
      type: 'insert',
      from: step.from,
      to: step.to,
      content: step.slice.content.textBetween(0, step.slice.content.size),
    };
  }
  if (step.from < step.to) {
    return {
      type: 'delete',
      from: step.from,
      to: step.to,
    };
  }
  return null;
}
```

---

## UI Components

### Presence Avatars

```svelte
<!-- lib/components/collaboration/PresenceAvatars.svelte -->
<script lang="ts">
  interface Props {
    users: UserPresence[];
    maxVisible?: number;
  }
  
  let { users, maxVisible = 5 }: Props = $props();
  
  let visibleUsers = $derived(users.slice(0, maxVisible));
  let overflowCount = $derived(Math.max(0, users.length - maxVisible));
</script>

<div class="presence-avatars">
  {#each visibleUsers as user (user.id)}
    <div 
      class="avatar"
      style="--user-color: {user.color}"
      class:idle={user.isIdle}
      title="{user.name}{user.isEditing ? ' (editing)' : ''}"
    >
      {#if user.avatar}
        <img src={user.avatar} alt={user.name} />
      {:else}
        <span class="initials">{getInitials(user.name)}</span>
      {/if}
      
      {#if user.isEditing}
        <span class="editing-indicator"></span>
      {/if}
    </div>
  {/each}
  
  {#if overflowCount > 0}
    <div class="avatar overflow">
      <span>+{overflowCount}</span>
    </div>
  {/if}
</div>

<script context="module">
  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
</script>

<style>
  .presence-avatars {
    display: flex;
    flex-direction: row-reverse;
  }
  
  .avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    background: var(--user-color);
    border: 2px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -0.5rem;
    position: relative;
    transition: transform 0.15s, opacity 0.15s;
  }
  
  .avatar:hover {
    transform: translateY(-2px);
    z-index: 10;
  }
  
  .avatar.idle {
    opacity: 0.6;
  }
  
  .avatar img {
    width: 100%;
    height: 100%;
    border-radius: 9999px;
    object-fit: cover;
  }
  
  .initials {
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
  }
  
  .editing-indicator {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 10px;
    height: 10px;
    background: #22c55e;
    border: 2px solid white;
    border-radius: 9999px;
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }
  
  .overflow {
    background: var(--color-bg-muted);
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 500;
  }
</style>
```

### Remote Cursors

Overlay showing other users' cursor positions:

```svelte
<!-- lib/components/collaboration/RemoteCursors.svelte -->
<script lang="ts">
  interface Props {
    users: UserPresence[];
    editorElement: HTMLElement | null;
    getPositionCoords: (pos: number) => { top: number; left: number } | null;
  }
  
  let { users, editorElement, getPositionCoords }: Props = $props();
  
  let cursorPositions = $derived(
    users
      .filter(u => u.cursor !== null)
      .map(u => {
        const coords = getPositionCoords(u.cursor!.from);
        return coords ? { user: u, coords } : null;
      })
      .filter(Boolean)
  );
</script>

{#if editorElement}
  <div class="remote-cursors">
    {#each cursorPositions as cursor (cursor.user.id)}
      <div
        class="remote-cursor"
        style="
          top: {cursor.coords.top}px;
          left: {cursor.coords.left}px;
          --cursor-color: {cursor.user.color};
        "
      >
        <div class="cursor-line"></div>
        <div class="cursor-label">{cursor.user.name}</div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .remote-cursors {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 50;
  }
  
  .remote-cursor {
    position: absolute;
    transform: translateY(-2px);
  }
  
  .cursor-line {
    width: 2px;
    height: 1.2em;
    background: var(--cursor-color);
    animation: blink 1s ease infinite;
  }
  
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .cursor-label {
    position: absolute;
    top: -1.25em;
    left: 0;
    background: var(--cursor-color);
    color: white;
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem 0.25rem 0.25rem 0;
    white-space: nowrap;
    font-weight: 500;
  }
</style>
```

### Connection Status

```svelte
<!-- lib/components/collaboration/ConnectionStatus.svelte -->
<script lang="ts">
  import { Wifi, WifiOff, Cloud, CloudOff } from 'lucide-svelte';
  
  interface Props {
    isConnected: boolean;
    lastSaved?: number;
    isSaving?: boolean;
  }
  
  let { isConnected, lastSaved, isSaving = false }: Props = $props();
  
  let savedText = $derived(() => {
    if (isSaving) return 'Saving...';
    if (!lastSaved) return '';
    const seconds = Math.floor((Date.now() - lastSaved) / 1000);
    if (seconds < 5) return 'Saved just now';
    if (seconds < 60) return `Saved ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `Saved ${minutes}m ago`;
  });
</script>

<div class="connection-status" class:disconnected={!isConnected}>
  {#if isConnected}
    <Wifi class="w-4 h-4 text-green-500" />
    <span class="status-text">Connected</span>
  {:else}
    <WifiOff class="w-4 h-4 text-red-500" />
    <span class="status-text">Disconnected</span>
  {/if}
  
  {#if savedText}
    <span class="save-status" class:saving={isSaving}>
      {isSaving ? <Cloud class="w-3 h-3 animate-pulse" /> : null}
      {savedText}
    </span>
  {/if}
</div>

<style>
  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  
  .status-text {
    font-weight: 500;
  }
  
  .disconnected .status-text {
    color: var(--color-danger);
  }
  
  .save-status {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding-left: 0.5rem;
    border-left: 1px solid var(--color-border);
  }
  
  .save-status.saving {
    color: var(--color-primary);
  }
</style>
```

---

## Implementation Notes

### Conflict Resolution Strategy

For Hanawa, we use a simplified OT approach:

1. **Optimistic updates**: Apply changes locally immediately
2. **Server ordering**: DO is the single source of truth for operation order
3. **Version checking**: Reject operations from stale clients
4. **Resync on conflict**: Send full document state to out-of-sync clients

This trades some concurrent editing smoothness for simplicity. For compliance documentation (where typically 1-3 people edit a document), this is acceptable.

### Tiptap Collaboration Extension

Tiptap has built-in collaboration support via `@tiptap/extension-collaboration` and `@tiptap/extension-collaboration-cursor`. Consider using these with Y.js for more robust conflict resolution:

```typescript
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Y.js provides CRDT-based conflict resolution
const ydoc = new Y.Doc();
const provider = new WebsocketProvider(
  'wss://hanawa.workers.dev/collab',
  documentId,
  ydoc
);

const editor = new Editor({
  extensions: [
    StarterKit,
    Collaboration.configure({ document: ydoc }),
    CollaborationCursor.configure({
      provider,
      user: { name: userName, color: userColor },
    }),
  ],
});
```

This is more battle-tested than a custom implementation.

### Scaling Considerations

| Users per Document | Approach |
|--------------------|----------|
| 1-5 | Simple DO with operation broadcasting |
| 5-20 | Y.js with CRDT for conflict resolution |
| 20+ | Consider read-only viewers with separate edit queue |

For Hanawa's use case (small teams, compliance docs), the simple approach works.

---

## Testing Strategy

### Unit Tests

```typescript
describe('DocumentRoom', () => {
  it('assigns unique colors to users', () => {
    const room = new DocumentRoom(mockState, mockEnv);
    
    // Connect three users
    await room.handleSession(mockSocket1, { email: 'a@test.com', name: 'A' });
    await room.handleSession(mockSocket2, { email: 'b@test.com', name: 'B' });
    await room.handleSession(mockSocket3, { email: 'c@test.com', name: 'C' });
    
    const colors = Array.from(room.sessions.values()).map(s => s.presence.color);
    const uniqueColors = new Set(colors);
    
    expect(uniqueColors.size).toBe(3);
  });
  
  it('broadcasts operations to other users', async () => {
    const room = new DocumentRoom(mockState, mockEnv);
    
    await room.handleSession(mockSocket1, { email: 'a@test.com', name: 'A' });
    await room.handleSession(mockSocket2, { email: 'b@test.com', name: 'B' });
    
    // User A sends operation
    room.handleMessage(session1Id, {
      type: 'operation',
      op: { type: 'insert', from: 0, content: 'Hello' },
      version: 1,
    });
    
    // User B should receive it
    expect(mockSocket2.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"operation"')
    );
    
    // User A should receive ack, not broadcast
    expect(mockSocket1.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"ack"')
    );
  });
});
```

### Integration Tests

```typescript
describe('Collaboration Integration', () => {
  it('syncs content between two editors', async () => {
    // Connect two clients
    const client1 = new WebSocket(`ws://localhost/collab/${docId}?...`);
    const client2 = new WebSocket(`ws://localhost/collab/${docId}?...`);
    
    await waitForOpen(client1);
    await waitForOpen(client2);
    
    // Client 1 inserts text
    client1.send(JSON.stringify({
      type: 'operation',
      op: { type: 'insert', from: 0, content: 'Hello' },
      version: 1,
    }));
    
    // Client 2 should receive operation
    const message = await waitForMessage(client2);
    expect(message.type).toBe('operation');
    expect(message.op.content).toBe('Hello');
  });
});
```

---

## Migration Path

### From Single-User to Collaborative

1. **Deploy DO infrastructure**: Add Durable Object binding to wrangler.toml
2. **Add WebSocket endpoint**: Route `/collab/:documentId` to DO
3. **Update editor**: Add collaboration hook and extensions
4. **Test with flag**: Enable per-user or per-document
5. **Gradual rollout**: Start with internal team, then clients

### Feature Flag

```typescript
// lib/features.ts
export function isCollaborationEnabled(user: User, document: Document): boolean {
  // Roll out gradually
  if (user.email.endsWith('@esolia.co.jp')) return true;
  if (document.collection === 'beta-docs') return true;
  return false;
}
```

---

## Related Documents

- [01-audit-system.md](./01-audit-system.md) — Log collaborative edits
- [02-version-control.md](./02-version-control.md) — Versions during collaboration
- [04-comments-system.md](./04-comments-system.md) — Inline comments with presence

---

*Document version: 1.0*
