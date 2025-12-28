# Hanawa: Comments System Specification

Inline and document-level commenting with threaded discussions.

## Overview

Comments enable asynchronous collaboration. Reviewers can leave feedback on specific content, authors can respond, and the discussion is preserved as part of the document's history.

Think of it like Google Docs comments, but with compliance-grade audit trails and integration with the workflow system.

```
┌─────────────────────────────────────────────────────────────────┐
│  COMMENT TYPES                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INLINE COMMENTS                    DOCUMENT COMMENTS           │
│  ────────────────                   ─────────────────           │
│  Attached to specific text          General feedback            │
│  Highlighted in editor              Sidebar panel               │
│  Position tracked                   No position                 │
│                                                                 │
│  "This paragraph needs              "Overall the document       │
│   more detail about..."              looks good, but..."        │
│                                                                 │
│  Both support:                                                  │
│  • Threaded replies                                            │
│  • @mentions with notifications                                │
│  • Resolution status                                           │
│  • Edit history                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Primary Tables

```sql
-- Comments table
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  
  -- Threading
  parent_id TEXT,                      -- NULL for root comments
  thread_id TEXT NOT NULL,             -- Groups replies together
  
  -- Type and position
  comment_type TEXT NOT NULL,          -- 'inline', 'document', 'suggestion'
  
  -- For inline comments: position in document
  anchor_start INTEGER,                -- ProseMirror position start
  anchor_end INTEGER,                  -- ProseMirror position end
  anchor_text TEXT,                    -- The text that was highlighted
  anchor_path TEXT,                    -- JSON path for robustness
  
  -- Content
  content TEXT NOT NULL,               -- The comment text (supports markdown)
  content_html TEXT,                   -- Rendered HTML
  
  -- For suggestions: the proposed change
  suggestion_text TEXT,
  
  -- Status
  status TEXT DEFAULT 'open',          -- 'open', 'resolved', 'rejected'
  resolved_by TEXT,
  resolved_at INTEGER,
  resolution_note TEXT,
  
  -- Author
  author_id TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT,
  
  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  -- Soft delete
  deleted_at INTEGER,
  deleted_by TEXT,
  
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);

CREATE INDEX idx_comments_document ON comments(document_id, created_at);
CREATE INDEX idx_comments_thread ON comments(thread_id);
CREATE INDEX idx_comments_author ON comments(author_email);
CREATE INDEX idx_comments_status ON comments(document_id, status);

-- Mentions table
CREATE TABLE comment_mentions (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  mentioned_email TEXT NOT NULL,
  notified_at INTEGER,
  read_at INTEGER,
  
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX idx_mentions_user ON comment_mentions(mentioned_email, notified_at);

-- Reactions (optional)
CREATE TABLE comment_reactions (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  reaction TEXT NOT NULL,              -- 'thumbsup', 'thumbsdown', 'heart', etc.
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  UNIQUE(comment_id, user_email, reaction)
);
```

### TypeScript Types

```typescript
interface Comment {
  id: string;
  documentId: string;
  
  // Threading
  parentId: string | null;
  threadId: string;
  replies?: Comment[];
  replyCount?: number;
  
  // Type
  type: 'inline' | 'document' | 'suggestion';
  
  // Position (for inline)
  anchor?: {
    start: number;
    end: number;
    text: string;
    path?: string;
  };
  
  // Content
  content: string;
  contentHtml?: string;
  
  // Suggestion
  suggestionText?: string;
  
  // Status
  status: 'open' | 'resolved' | 'rejected';
  resolvedBy?: string;
  resolvedAt?: number;
  resolutionNote?: string;
  
  // Author
  author: {
    id: string;
    email: string;
    name?: string;
  };
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  
  // Mentions
  mentions?: string[];
  
  // Reactions
  reactions?: Record<string, string[]>;  // reaction -> list of emails
}

interface CommentThread {
  id: string;
  documentId: string;
  rootComment: Comment;
  replies: Comment[];
  status: 'open' | 'resolved' | 'rejected';
  participantCount: number;
  lastActivity: number;
}
```

---

## API Design

### Comments Service

```typescript
// lib/server/comments.ts

export function createCommentsService(
  db: D1Database,
  audit: AuditService,
  notifications: NotificationService
) {
  return {
    /**
     * Create a new comment or reply
     */
    async create(
      documentId: string,
      data: {
        type: 'inline' | 'document' | 'suggestion';
        content: string;
        parentId?: string;
        anchor?: { start: number; end: number; text: string };
        suggestionText?: string;
      },
      context: AuditContext
    ): Promise<Comment> {
      const id = crypto.randomUUID();
      const now = Date.now();
      
      // Determine thread ID
      let threadId: string;
      if (data.parentId) {
        // Reply: use parent's thread
        const parent = await this.get(data.parentId);
        if (!parent) throw new Error('Parent comment not found');
        threadId = parent.threadId;
      } else {
        // New thread
        threadId = id;
      }
      
      // Parse mentions from content
      const mentions = this.extractMentions(data.content);
      
      // Render markdown to HTML
      const contentHtml = await this.renderMarkdown(data.content);
      
      await db.prepare(`
        INSERT INTO comments (
          id, document_id, parent_id, thread_id,
          comment_type, anchor_start, anchor_end, anchor_text,
          content, content_html, suggestion_text,
          status, author_id, author_email, author_name,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
      `).bind(
        id, documentId, data.parentId || null, threadId,
        data.type,
        data.anchor?.start || null,
        data.anchor?.end || null,
        data.anchor?.text || null,
        data.content, contentHtml, data.suggestionText || null,
        context.actorId, context.actorEmail, context.actorName || null,
        now, now
      ).run();
      
      // Record mentions
      for (const email of mentions) {
        await db.prepare(`
          INSERT INTO comment_mentions (id, comment_id, mentioned_email)
          VALUES (?, ?, ?)
        `).bind(crypto.randomUUID(), id, email).run();
        
        // Send notification
        await notifications.send({
          type: 'mention',
          recipient: email,
          data: {
            commentId: id,
            documentId,
            mentionedBy: context.actorEmail,
            excerpt: data.content.slice(0, 100),
          },
        });
      }
      
      // Notify thread participants if this is a reply
      if (data.parentId) {
        const participants = await this.getThreadParticipants(threadId);
        for (const email of participants) {
          if (email !== context.actorEmail && !mentions.includes(email)) {
            await notifications.send({
              type: 'reply',
              recipient: email,
              data: {
                commentId: id,
                documentId,
                repliedBy: context.actorEmail,
                excerpt: data.content.slice(0, 100),
              },
            });
          }
        }
      }
      
      // Audit log
      await audit.log({
        action: 'comment_create',
        actionCategory: 'comment',
        resourceType: 'comment',
        resourceId: id,
        metadata: {
          documentId,
          type: data.type,
          threadId,
          isReply: !!data.parentId,
          mentionCount: mentions.length,
        },
      }, context);
      
      return this.get(id) as Promise<Comment>;
    },
    
    /**
     * Get all comments for a document
     */
    async getForDocument(
      documentId: string,
      options: {
        includeResolved?: boolean;
        threadedView?: boolean;
      } = {}
    ): Promise<Comment[] | CommentThread[]> {
      const { includeResolved = false, threadedView = true } = options;
      
      let query = `
        SELECT c.*, 
          (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) as reply_count
        FROM comments c
        WHERE c.document_id = ? AND c.deleted_at IS NULL
      `;
      
      if (!includeResolved) {
        query += ` AND (c.status = 'open' OR c.parent_id IS NOT NULL)`;
      }
      
      query += ` ORDER BY c.created_at ASC`;
      
      const { results } = await db.prepare(query).bind(documentId).all();
      const comments = results.map(this.rowToComment);
      
      if (!threadedView) {
        return comments;
      }
      
      // Group into threads
      return this.groupIntoThreads(comments);
    },
    
    /**
     * Get a single comment
     */
    async get(commentId: string): Promise<Comment | null> {
      const row = await db.prepare(`
        SELECT * FROM comments WHERE id = ? AND deleted_at IS NULL
      `).bind(commentId).first();
      
      return row ? this.rowToComment(row) : null;
    },
    
    /**
     * Update comment content
     */
    async update(
      commentId: string,
      content: string,
      context: AuditContext
    ): Promise<Comment> {
      const comment = await this.get(commentId);
      if (!comment) throw new Error('Comment not found');
      
      if (comment.author.email !== context.actorEmail) {
        throw new Error('Can only edit your own comments');
      }
      
      const contentHtml = await this.renderMarkdown(content);
      const now = Date.now();
      
      await db.prepare(`
        UPDATE comments
        SET content = ?, content_html = ?, updated_at = ?
        WHERE id = ?
      `).bind(content, contentHtml, now, commentId).run();
      
      await audit.log({
        action: 'comment_update',
        actionCategory: 'comment',
        resourceType: 'comment',
        resourceId: commentId,
        valueBefore: comment.content,
        valueAfter: content,
      }, context);
      
      return this.get(commentId) as Promise<Comment>;
    },
    
    /**
     * Resolve a comment thread
     */
    async resolve(
      commentId: string,
      note?: string,
      context: AuditContext
    ): Promise<void> {
      const comment = await this.get(commentId);
      if (!comment) throw new Error('Comment not found');
      
      // Resolve the entire thread
      await db.prepare(`
        UPDATE comments
        SET status = 'resolved', resolved_by = ?, resolved_at = ?, resolution_note = ?
        WHERE thread_id = ?
      `).bind(context.actorEmail, Date.now(), note || null, comment.threadId).run();
      
      await audit.log({
        action: 'comment_resolve',
        actionCategory: 'comment',
        resourceType: 'comment',
        resourceId: commentId,
        metadata: { threadId: comment.threadId, note },
      }, context);
      
      // Notify thread author
      if (comment.author.email !== context.actorEmail) {
        await notifications.send({
          type: 'resolved',
          recipient: comment.author.email,
          data: {
            commentId,
            documentId: comment.documentId,
            resolvedBy: context.actorEmail,
          },
        });
      }
    },
    
    /**
     * Reopen a resolved thread
     */
    async reopen(
      commentId: string,
      context: AuditContext
    ): Promise<void> {
      const comment = await this.get(commentId);
      if (!comment) throw new Error('Comment not found');
      
      await db.prepare(`
        UPDATE comments
        SET status = 'open', resolved_by = NULL, resolved_at = NULL, resolution_note = NULL
        WHERE thread_id = ?
      `).bind(comment.threadId).run();
      
      await audit.log({
        action: 'comment_reopen',
        actionCategory: 'comment',
        resourceType: 'comment',
        resourceId: commentId,
      }, context);
    },
    
    /**
     * Delete a comment (soft delete)
     */
    async delete(
      commentId: string,
      context: AuditContext
    ): Promise<void> {
      const comment = await this.get(commentId);
      if (!comment) throw new Error('Comment not found');
      
      // Only author or admin can delete
      // (admin check would be context.userRoles.includes('admin'))
      if (comment.author.email !== context.actorEmail) {
        throw new Error('Can only delete your own comments');
      }
      
      await db.prepare(`
        UPDATE comments
        SET deleted_at = ?, deleted_by = ?
        WHERE id = ?
      `).bind(Date.now(), context.actorEmail, commentId).run();
      
      await audit.log({
        action: 'comment_delete',
        actionCategory: 'comment',
        resourceType: 'comment',
        resourceId: commentId,
      }, context);
    },
    
    /**
     * Accept a suggestion (apply the change)
     */
    async acceptSuggestion(
      commentId: string,
      context: AuditContext
    ): Promise<{ from: number; to: number; text: string }> {
      const comment = await this.get(commentId);
      if (!comment) throw new Error('Comment not found');
      if (comment.type !== 'suggestion') throw new Error('Not a suggestion');
      if (!comment.suggestionText) throw new Error('No suggestion text');
      
      // Return the change to apply
      const change = {
        from: comment.anchor!.start,
        to: comment.anchor!.end,
        text: comment.suggestionText,
      };
      
      // Resolve the thread
      await this.resolve(commentId, 'Suggestion accepted', context);
      
      await audit.log({
        action: 'comment_suggestion_accepted',
        actionCategory: 'comment',
        resourceType: 'comment',
        resourceId: commentId,
        metadata: { change },
      }, context);
      
      return change;
    },
    
    /**
     * Add reaction to comment
     */
    async addReaction(
      commentId: string,
      reaction: string,
      context: AuditContext
    ): Promise<void> {
      await db.prepare(`
        INSERT INTO comment_reactions (id, comment_id, user_email, reaction, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(comment_id, user_email, reaction) DO NOTHING
      `).bind(
        crypto.randomUUID(),
        commentId,
        context.actorEmail,
        reaction,
        Date.now()
      ).run();
    },
    
    /**
     * Remove reaction from comment
     */
    async removeReaction(
      commentId: string,
      reaction: string,
      context: AuditContext
    ): Promise<void> {
      await db.prepare(`
        DELETE FROM comment_reactions
        WHERE comment_id = ? AND user_email = ? AND reaction = ?
      `).bind(commentId, context.actorEmail, reaction).run();
    },
    
    /**
     * Get unread mentions for a user
     */
    async getUnreadMentions(userEmail: string): Promise<{
      commentId: string;
      documentId: string;
      excerpt: string;
      mentionedAt: number;
    }[]> {
      const { results } = await db.prepare(`
        SELECT 
          cm.comment_id,
          c.document_id,
          c.content,
          cm.notified_at
        FROM comment_mentions cm
        JOIN comments c ON cm.comment_id = c.id
        WHERE cm.mentioned_email = ? AND cm.read_at IS NULL
        ORDER BY cm.notified_at DESC
      `).bind(userEmail).all();
      
      return results.map(row => ({
        commentId: row.comment_id as string,
        documentId: row.document_id as string,
        excerpt: (row.content as string).slice(0, 100),
        mentionedAt: row.notified_at as number,
      }));
    },
    
    /**
     * Mark mentions as read
     */
    async markMentionsRead(
      userEmail: string,
      commentIds?: string[]
    ): Promise<void> {
      if (commentIds && commentIds.length > 0) {
        await db.prepare(`
          UPDATE comment_mentions
          SET read_at = ?
          WHERE mentioned_email = ? AND comment_id IN (${commentIds.map(() => '?').join(',')})
        `).bind(Date.now(), userEmail, ...commentIds).run();
      } else {
        await db.prepare(`
          UPDATE comment_mentions
          SET read_at = ?
          WHERE mentioned_email = ? AND read_at IS NULL
        `).bind(Date.now(), userEmail).run();
      }
    },
    
    // Helper methods
    extractMentions(content: string): string[] {
      const mentionRegex = /@(\S+@\S+\.\S+)/g;
      const matches = content.matchAll(mentionRegex);
      return [...new Set([...matches].map(m => m[1]))];
    },
    
    async renderMarkdown(content: string): Promise<string> {
      // Use marked or similar
      const { marked } = await import('marked');
      return marked.parse(content);
    },
    
    rowToComment(row: Record<string, unknown>): Comment {
      return {
        id: row.id as string,
        documentId: row.document_id as string,
        parentId: row.parent_id as string | null,
        threadId: row.thread_id as string,
        replyCount: row.reply_count as number | undefined,
        type: row.comment_type as 'inline' | 'document' | 'suggestion',
        anchor: row.anchor_start ? {
          start: row.anchor_start as number,
          end: row.anchor_end as number,
          text: row.anchor_text as string,
        } : undefined,
        content: row.content as string,
        contentHtml: row.content_html as string,
        suggestionText: row.suggestion_text as string | undefined,
        status: row.status as 'open' | 'resolved' | 'rejected',
        resolvedBy: row.resolved_by as string | undefined,
        resolvedAt: row.resolved_at as number | undefined,
        resolutionNote: row.resolution_note as string | undefined,
        author: {
          id: row.author_id as string,
          email: row.author_email as string,
          name: row.author_name as string | undefined,
        },
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
      };
    },
    
    groupIntoThreads(comments: Comment[]): CommentThread[] {
      const threads = new Map<string, CommentThread>();
      
      for (const comment of comments) {
        if (!comment.parentId) {
          // Root comment
          threads.set(comment.threadId, {
            id: comment.threadId,
            documentId: comment.documentId,
            rootComment: comment,
            replies: [],
            status: comment.status,
            participantCount: 1,
            lastActivity: comment.createdAt,
          });
        }
      }
      
      // Add replies
      for (const comment of comments) {
        if (comment.parentId) {
          const thread = threads.get(comment.threadId);
          if (thread) {
            thread.replies.push(comment);
            thread.lastActivity = Math.max(thread.lastActivity, comment.createdAt);
          }
        }
      }
      
      // Calculate participant counts
      for (const thread of threads.values()) {
        const participants = new Set([thread.rootComment.author.email]);
        thread.replies.forEach(r => participants.add(r.author.email));
        thread.participantCount = participants.size;
      }
      
      return [...threads.values()].sort((a, b) => b.lastActivity - a.lastActivity);
    },
    
    async getThreadParticipants(threadId: string): Promise<string[]> {
      const { results } = await db.prepare(`
        SELECT DISTINCT author_email FROM comments WHERE thread_id = ?
      `).bind(threadId).all();
      
      return results.map(r => r.author_email as string);
    },
  };
}
```

---

## UI Components

### Comment Thread

```svelte
<!-- lib/components/comments/CommentThread.svelte -->
<script lang="ts">
  import { formatDistanceToNow } from 'date-fns';
  import { MessageSquare, Check, RotateCcw, Trash2, MoreVertical } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import CommentEditor from './CommentEditor.svelte';
  import CommentReactions from './CommentReactions.svelte';
  
  interface Props {
    thread: CommentThread;
    currentUserEmail: string;
    onReply: (content: string) => void;
    onResolve: (note?: string) => void;
    onReopen: () => void;
    onDelete: (commentId: string) => void;
    onReact: (commentId: string, reaction: string) => void;
  }
  
  let { thread, currentUserEmail, onReply, onResolve, onReopen, onDelete, onReact }: Props = $props();
  
  let showReplyEditor = $state(false);
  let replyContent = $state('');
  
  function handleSubmitReply() {
    if (replyContent.trim()) {
      onReply(replyContent);
      replyContent = '';
      showReplyEditor = false;
    }
  }
</script>

<div class="comment-thread" class:resolved={thread.status === 'resolved'}>
  <!-- Root comment -->
  <div class="comment root-comment">
    <div class="comment-header">
      <div class="author-info">
        <div class="avatar" style="background-color: {stringToColor(thread.rootComment.author.email)}">
          {getInitials(thread.rootComment.author.name || thread.rootComment.author.email)}
        </div>
        <div class="author-details">
          <span class="author-name">
            {thread.rootComment.author.name || thread.rootComment.author.email}
          </span>
          <time datetime={new Date(thread.rootComment.createdAt).toISOString()}>
            {formatDistanceToNow(thread.rootComment.createdAt, { addSuffix: true })}
          </time>
        </div>
      </div>
      
      <div class="comment-actions">
        {#if thread.status === 'open'}
          <Button variant="ghost" size="sm" onclick={() => onResolve()}>
            <Check class="w-4 h-4" />
          </Button>
        {:else}
          <Button variant="ghost" size="sm" onclick={onReopen}>
            <RotateCcw class="w-4 h-4" />
          </Button>
        {/if}
        
        {#if thread.rootComment.author.email === currentUserEmail}
          <Button variant="ghost" size="sm" onclick={() => onDelete(thread.rootComment.id)}>
            <Trash2 class="w-4 h-4" />
          </Button>
        {/if}
      </div>
    </div>
    
    <div class="comment-body">
      {@html thread.rootComment.contentHtml}
    </div>
    
    {#if thread.rootComment.type === 'suggestion'}
      <div class="suggestion-preview">
        <span class="suggestion-label">Suggested change:</span>
        <div class="suggestion-text">{thread.rootComment.suggestionText}</div>
        {#if thread.status === 'open'}
          <Button size="sm" onclick={() => acceptSuggestion(thread.rootComment.id)}>
            Accept
          </Button>
        {/if}
      </div>
    {/if}
    
    <CommentReactions
      reactions={thread.rootComment.reactions}
      currentUserEmail={currentUserEmail}
      onReact={(r) => onReact(thread.rootComment.id, r)}
    />
  </div>
  
  <!-- Replies -->
  {#if thread.replies.length > 0}
    <div class="replies">
      {#each thread.replies as reply (reply.id)}
        <div class="comment reply">
          <div class="comment-header">
            <div class="author-info">
              <div class="avatar small" style="background-color: {stringToColor(reply.author.email)}">
                {getInitials(reply.author.name || reply.author.email)}
              </div>
              <span class="author-name">{reply.author.name || reply.author.email}</span>
              <time>{formatDistanceToNow(reply.createdAt, { addSuffix: true })}</time>
            </div>
          </div>
          <div class="comment-body">
            {@html reply.contentHtml}
          </div>
        </div>
      {/each}
    </div>
  {/if}
  
  <!-- Reply editor -->
  {#if thread.status === 'open'}
    {#if showReplyEditor}
      <div class="reply-editor">
        <CommentEditor
          bind:content={replyContent}
          placeholder="Write a reply..."
          onSubmit={handleSubmitReply}
          onCancel={() => showReplyEditor = false}
        />
      </div>
    {:else}
      <button class="reply-trigger" onclick={() => showReplyEditor = true}>
        <MessageSquare class="w-4 h-4" />
        Reply
      </button>
    {/if}
  {/if}
  
  {#if thread.status === 'resolved'}
    <div class="resolved-banner">
      <Check class="w-4 h-4" />
      Resolved by {thread.rootComment.resolvedBy}
      {#if thread.rootComment.resolutionNote}
        — {thread.rootComment.resolutionNote}
      {/if}
    </div>
  {/if}
</div>

<script context="module">
  function getInitials(name: string): string {
    return name.split(/[\s@]/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }
  
  function stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 45%)`;
  }
</script>

<style>
  .comment-thread {
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .comment-thread.resolved {
    opacity: 0.7;
    background: var(--color-bg-muted);
  }
  
  .comment {
    padding: 0.75rem 1rem;
  }
  
  .comment.reply {
    padding-left: 2.5rem;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-muted);
  }
  
  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .author-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
  }
  
  .avatar.small {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.625rem;
  }
  
  .author-name {
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .author-info time {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  
  .comment-body {
    font-size: 0.875rem;
    line-height: 1.5;
  }
  
  .suggestion-preview {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--color-success-light);
    border-radius: 0.375rem;
  }
  
  .suggestion-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-success);
    display: block;
    margin-bottom: 0.25rem;
  }
  
  .replies {
    border-top: 1px solid var(--color-border);
  }
  
  .reply-editor {
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--color-border);
  }
  
  .reply-trigger {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    width: 100%;
    border: none;
    border-top: 1px solid var(--color-border);
    background: none;
    color: var(--color-text-muted);
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .reply-trigger:hover {
    background: var(--color-bg-muted);
    color: var(--color-primary);
  }
  
  .resolved-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-success-light);
    color: var(--color-success);
    font-size: 0.75rem;
  }
</style>
```

### Inline Comment Marker

For highlighting text with comments in the editor:

```svelte
<!-- lib/components/comments/InlineCommentMarker.svelte -->
<script lang="ts">
  import { MessageSquare } from 'lucide-svelte';
  
  interface Props {
    threadCount: number;
    hasUnresolved: boolean;
    onClick: () => void;
  }
  
  let { threadCount, hasUnresolved, onClick }: Props = $props();
</script>

<button
  class="inline-marker"
  class:unresolved={hasUnresolved}
  onclick={onClick}
  title="{threadCount} comment{threadCount !== 1 ? 's' : ''}"
>
  <MessageSquare class="w-3 h-3" />
  {#if threadCount > 1}
    <span class="count">{threadCount}</span>
  {/if}
</button>

<style>
  .inline-marker {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.125rem 0.25rem;
    background: var(--color-warning-light);
    border: 1px solid var(--color-warning);
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.625rem;
    color: var(--color-warning);
  }
  
  .inline-marker.unresolved {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  
  .count {
    font-weight: 600;
  }
</style>
```

### Comments Panel

Sidebar showing all document comments:

```svelte
<!-- lib/components/comments/CommentsPanel.svelte -->
<script lang="ts">
  import { MessageSquare, Filter, Plus } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import CommentThread from './CommentThread.svelte';
  import CommentEditor from './CommentEditor.svelte';
  
  interface Props {
    threads: CommentThread[];
    currentUserEmail: string;
    onCreateComment: (content: string) => void;
    onReply: (threadId: string, content: string) => void;
    onResolve: (commentId: string, note?: string) => void;
    onReopen: (commentId: string) => void;
    onDelete: (commentId: string) => void;
  }
  
  let { threads, currentUserEmail, onCreateComment, onReply, onResolve, onReopen, onDelete }: Props = $props();
  
  let showResolved = $state(false);
  let showNewComment = $state(false);
  let newCommentContent = $state('');
  
  let filteredThreads = $derived(
    showResolved ? threads : threads.filter(t => t.status === 'open')
  );
  
  let openCount = $derived(threads.filter(t => t.status === 'open').length);
  let resolvedCount = $derived(threads.filter(t => t.status === 'resolved').length);
</script>

<div class="comments-panel">
  <header class="panel-header">
    <h3>
      <MessageSquare class="w-4 h-4" />
      Comments
      {#if openCount > 0}
        <span class="count">{openCount}</span>
      {/if}
    </h3>
    
    <div class="header-actions">
      <label class="filter-toggle">
        <input type="checkbox" bind:checked={showResolved} />
        Show resolved ({resolvedCount})
      </label>
      
      <Button size="sm" onclick={() => showNewComment = true}>
        <Plus class="w-4 h-4" />
      </Button>
    </div>
  </header>
  
  {#if showNewComment}
    <div class="new-comment-editor">
      <CommentEditor
        bind:content={newCommentContent}
        placeholder="Add a comment..."
        onSubmit={() => {
          onCreateComment(newCommentContent);
          newCommentContent = '';
          showNewComment = false;
        }}
        onCancel={() => showNewComment = false}
      />
    </div>
  {/if}
  
  <div class="threads-list">
    {#each filteredThreads as thread (thread.id)}
      <CommentThread
        {thread}
        {currentUserEmail}
        onReply={(content) => onReply(thread.id, content)}
        onResolve={(note) => onResolve(thread.rootComment.id, note)}
        onReopen={() => onReopen(thread.rootComment.id)}
        onDelete={onDelete}
        onReact={() => {}}
      />
    {/each}
    
    {#if filteredThreads.length === 0}
      <div class="empty-state">
        <MessageSquare class="w-8 h-8" />
        <p>No {showResolved ? '' : 'open '}comments yet</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .comments-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid var(--color-border);
    background: var(--color-bg-surface);
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }
  
  .panel-header h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0;
  }
  
  .count {
    background: var(--color-primary);
    color: white;
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  
  .new-comment-editor {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }
  
  .threads-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
```

---

## Tiptap Integration

### Comment Extension

```typescript
// lib/editor/extensions/comments.ts

import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface CommentMarkAttributes {
  threadId: string;
  status: 'open' | 'resolved';
}

export const CommentMark = Mark.create({
  name: 'comment',
  
  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: element => element.getAttribute('data-thread-id'),
        renderHTML: attributes => ({
          'data-thread-id': attributes.threadId,
        }),
      },
      status: {
        default: 'open',
        parseHTML: element => element.getAttribute('data-status'),
        renderHTML: attributes => ({
          'data-status': attributes.status,
        }),
      },
    };
  },
  
  parseHTML() {
    return [{ tag: 'span[data-thread-id]' }];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      class: `comment-highlight comment-${HTMLAttributes['data-status']}`,
    }), 0];
  },
  
  addCommands() {
    return {
      addComment: (threadId: string) => ({ commands, state }) => {
        const { from, to } = state.selection;
        if (from === to) return false;
        
        return commands.setMark(this.name, { threadId, status: 'open' });
      },
      
      resolveComment: (threadId: string) => ({ tr, state }) => {
        state.doc.descendants((node, pos) => {
          const marks = node.marks.filter(m => 
            m.type.name === 'comment' && m.attrs.threadId === threadId
          );
          
          marks.forEach(mark => {
            tr.removeMark(pos, pos + node.nodeSize, mark);
            tr.addMark(pos, pos + node.nodeSize, 
              mark.type.create({ ...mark.attrs, status: 'resolved' })
            );
          });
        });
        
        return true;
      },
      
      removeComment: (threadId: string) => ({ tr, state }) => {
        state.doc.descendants((node, pos) => {
          const marks = node.marks.filter(m => 
            m.type.name === 'comment' && m.attrs.threadId === threadId
          );
          
          marks.forEach(mark => {
            tr.removeMark(pos, pos + node.nodeSize, mark);
          });
        });
        
        return true;
      },
    };
  },
});
```

---

## Testing Strategy

```typescript
describe('CommentsService', () => {
  it('creates a comment with thread', async () => {
    const comment = await comments.create(docId, {
      type: 'document',
      content: 'This looks good!',
    }, context);
    
    expect(comment.threadId).toBe(comment.id);
    expect(comment.status).toBe('open');
  });
  
  it('creates reply in same thread', async () => {
    const root = await comments.create(docId, { type: 'document', content: 'Question?' }, context);
    const reply = await comments.create(docId, { type: 'document', content: 'Answer!', parentId: root.id }, context);
    
    expect(reply.threadId).toBe(root.id);
  });
  
  it('extracts mentions from content', async () => {
    const comment = await comments.create(docId, {
      type: 'document',
      content: 'Hey @rick@esolia.co.jp can you review this?',
    }, context);
    
    const mentions = await db.prepare(
      `SELECT * FROM comment_mentions WHERE comment_id = ?`
    ).bind(comment.id).all();
    
    expect(mentions.results).toHaveLength(1);
    expect(mentions.results[0].mentioned_email).toBe('rick@esolia.co.jp');
  });
  
  it('resolves entire thread', async () => {
    const root = await comments.create(docId, { type: 'document', content: 'Issue' }, context);
    await comments.create(docId, { type: 'document', content: 'Reply', parentId: root.id }, context);
    
    await comments.resolve(root.id, 'Fixed', context);
    
    const threads = await comments.getForDocument(docId, { includeResolved: true });
    expect(threads[0].status).toBe('resolved');
  });
});
```

---

## Related Documents

- [01-audit-system.md](./01-audit-system.md) — Comment actions are audited
- [03-realtime-collaboration.md](./03-realtime-collaboration.md) — Real-time comment updates
- [05-workflow-engine.md](./05-workflow-engine.md) — Comments during review stages

---

*Document version: 1.0*
