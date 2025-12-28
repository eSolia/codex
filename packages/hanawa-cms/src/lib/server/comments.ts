/**
 * Comments Service for Hanawa CMS
 * InfoSec: Threaded discussions with full audit trails
 *
 * Supports inline comments, document comments, and suggestions.
 * All actions are audited for compliance.
 */

/// <reference types="@cloudflare/workers-types" />

import type { AuditService, AuditContext } from './audit';
import { sanitizeComment, escapeHtml } from '../sanitize';

export type CommentType = 'inline' | 'document' | 'suggestion';
export type CommentStatus = 'open' | 'resolved' | 'rejected';

export interface CommentAnchor {
  start: number;
  end: number;
  text: string;
  path?: string;
}

export interface CommentAuthor {
  id: string;
  email: string;
  name?: string;
}

export interface Comment {
  id: string;
  documentId: string;
  parentId: string | null;
  threadId: string;
  replyCount?: number;
  type: CommentType;
  anchor?: CommentAnchor;
  content: string;
  contentHtml?: string;
  suggestionText?: string;
  status: CommentStatus;
  resolvedBy?: string;
  resolvedAt?: number;
  resolutionNote?: string;
  author: CommentAuthor;
  createdAt: number;
  updatedAt: number;
  mentions?: string[];
  reactions?: Record<string, string[]>;
}

export interface CommentThread {
  id: string;
  documentId: string;
  rootComment: Comment;
  replies: Comment[];
  status: CommentStatus;
  participantCount: number;
  lastActivity: number;
}

export interface CreateCommentData {
  type: CommentType;
  content: string;
  parentId?: string;
  anchor?: CommentAnchor;
  suggestionText?: string;
}

/**
 * Create a comments service instance
 */
export function createCommentsService(db: D1Database, audit?: AuditService) {
  return {
    /**
     * Create a new comment or reply
     */
    async create(
      documentId: string,
      data: CreateCommentData,
      context: AuditContext
    ): Promise<Comment> {
      const id = crypto.randomUUID();
      const now = Date.now();

      // Determine thread ID
      let threadId: string;
      if (data.parentId) {
        const parent = await this.get(data.parentId);
        if (!parent) throw new Error('Parent comment not found');
        threadId = parent.threadId;
      } else {
        threadId = id;
      }

      // Parse mentions from content
      const mentions = this.extractMentions(data.content);

      // Render markdown to HTML (simplified)
      const contentHtml = this.renderMarkdown(data.content);

      await db
        .prepare(
          `INSERT INTO comments (
            id, document_id, parent_id, thread_id,
            comment_type, anchor_start, anchor_end, anchor_text, anchor_path,
            content, content_html, suggestion_text,
            status, author_id, author_email, author_name,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          documentId,
          data.parentId || null,
          threadId,
          data.type,
          data.anchor?.start || null,
          data.anchor?.end || null,
          data.anchor?.text || null,
          data.anchor?.path || null,
          data.content,
          contentHtml,
          data.suggestionText || null,
          context.actorId,
          context.actorEmail,
          context.actorName || null,
          now,
          now
        )
        .run();

      // Record mentions
      for (const email of mentions) {
        await db
          .prepare(
            `INSERT INTO comment_mentions (id, comment_id, mentioned_email, notified_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(crypto.randomUUID(), id, email, now)
          .run();
      }

      // Audit log
      if (audit) {
        await audit.log(
          {
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
          },
          context
        );
      }

      return (await this.get(id)) as Comment;
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
          (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id AND r.deleted_at IS NULL) as reply_count
        FROM comments c
        WHERE c.document_id = ? AND c.deleted_at IS NULL
      `;

      if (!includeResolved) {
        query += ` AND (c.status = 'open' OR c.parent_id IS NOT NULL)`;
      }

      query += ` ORDER BY c.created_at ASC`;

      const { results } = await db.prepare(query).bind(documentId).all();
      const comments = results.map((row) => this.rowToComment(row));

      if (!threadedView) {
        return comments;
      }

      return this.groupIntoThreads(comments);
    },

    /**
     * Get a single comment
     */
    async get(commentId: string): Promise<Comment | null> {
      const row = await db
        .prepare(`SELECT * FROM comments WHERE id = ? AND deleted_at IS NULL`)
        .bind(commentId)
        .first();

      return row ? this.rowToComment(row) : null;
    },

    /**
     * Update comment content
     */
    async update(commentId: string, content: string, context: AuditContext): Promise<Comment> {
      const comment = await this.get(commentId);
      if (!comment) throw new Error('Comment not found');

      if (comment.author.email !== context.actorEmail) {
        throw new Error('Can only edit your own comments');
      }

      const contentHtml = this.renderMarkdown(content);
      const now = Date.now();

      await db
        .prepare(`UPDATE comments SET content = ?, content_html = ?, updated_at = ? WHERE id = ?`)
        .bind(content, contentHtml, now, commentId)
        .run();

      if (audit) {
        await audit.log(
          {
            action: 'comment_update',
            actionCategory: 'comment',
            resourceType: 'comment',
            resourceId: commentId,
            valueBefore: comment.content,
            valueAfter: content,
          },
          context
        );
      }

      return (await this.get(commentId)) as Comment;
    },

    /**
     * Resolve a comment thread
     */
    async resolve(
      commentId: string,
      note: string | undefined,
      context: AuditContext
    ): Promise<void> {
      const comment = await this.get(commentId);
      if (!comment) throw new Error('Comment not found');

      await db
        .prepare(
          `UPDATE comments
           SET status = 'resolved', resolved_by = ?, resolved_at = ?, resolution_note = ?
           WHERE thread_id = ?`
        )
        .bind(context.actorEmail, Date.now(), note || null, comment.threadId)
        .run();

      if (audit) {
        await audit.log(
          {
            action: 'comment_resolve',
            actionCategory: 'comment',
            resourceType: 'comment',
            resourceId: commentId,
            metadata: { threadId: comment.threadId, note },
          },
          context
        );
      }
    },

    /**
     * Reopen a resolved thread
     */
    async reopen(commentId: string, context: AuditContext): Promise<void> {
      const comment = await this.get(commentId);
      if (!comment) throw new Error('Comment not found');

      await db
        .prepare(
          `UPDATE comments
           SET status = 'open', resolved_by = NULL, resolved_at = NULL, resolution_note = NULL
           WHERE thread_id = ?`
        )
        .bind(comment.threadId)
        .run();

      if (audit) {
        await audit.log(
          {
            action: 'comment_update',
            actionCategory: 'comment',
            resourceType: 'comment',
            resourceId: commentId,
            changeSummary: 'Reopened thread',
          },
          context
        );
      }
    },

    /**
     * Delete a comment (soft delete)
     */
    async delete(commentId: string, context: AuditContext): Promise<void> {
      const comment = await this.get(commentId);
      if (!comment) throw new Error('Comment not found');

      if (comment.author.email !== context.actorEmail) {
        throw new Error('Can only delete your own comments');
      }

      await db
        .prepare(`UPDATE comments SET deleted_at = ?, deleted_by = ? WHERE id = ?`)
        .bind(Date.now(), context.actorEmail, commentId)
        .run();

      if (audit) {
        await audit.log(
          {
            action: 'comment_delete',
            actionCategory: 'comment',
            resourceType: 'comment',
            resourceId: commentId,
          },
          context
        );
      }
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
      if (!comment.anchor) throw new Error('No anchor position');

      const change = {
        from: comment.anchor.start,
        to: comment.anchor.end,
        text: comment.suggestionText,
      };

      await this.resolve(commentId, 'Suggestion accepted', context);

      if (audit) {
        await audit.log(
          {
            action: 'comment_update',
            actionCategory: 'comment',
            resourceType: 'comment',
            resourceId: commentId,
            changeSummary: 'Suggestion accepted',
            metadata: { change },
          },
          context
        );
      }

      return change;
    },

    /**
     * Add reaction to comment
     */
    async addReaction(commentId: string, reaction: string, context: AuditContext): Promise<void> {
      await db
        .prepare(
          `INSERT INTO comment_reactions (id, comment_id, user_email, reaction, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(comment_id, user_email, reaction) DO NOTHING`
        )
        .bind(crypto.randomUUID(), commentId, context.actorEmail, reaction, Date.now())
        .run();
    },

    /**
     * Remove reaction from comment
     */
    async removeReaction(
      commentId: string,
      reaction: string,
      context: AuditContext
    ): Promise<void> {
      await db
        .prepare(
          `DELETE FROM comment_reactions
           WHERE comment_id = ? AND user_email = ? AND reaction = ?`
        )
        .bind(commentId, context.actorEmail, reaction)
        .run();
    },

    /**
     * Get reactions for a comment
     */
    async getReactions(commentId: string): Promise<Record<string, string[]>> {
      const { results } = await db
        .prepare(`SELECT reaction, user_email FROM comment_reactions WHERE comment_id = ?`)
        .bind(commentId)
        .all();

      const reactions: Record<string, string[]> = {};
      for (const row of results) {
        const reaction = row.reaction as string;
        const email = row.user_email as string;
        if (!reactions[reaction]) {
          reactions[reaction] = [];
        }
        reactions[reaction].push(email);
      }
      return reactions;
    },

    /**
     * Get unread mentions for a user
     */
    async getUnreadMentions(
      userEmail: string
    ): Promise<{ commentId: string; documentId: string; excerpt: string; mentionedAt: number }[]> {
      const { results } = await db
        .prepare(
          `SELECT cm.comment_id, c.document_id, c.content, cm.notified_at
           FROM comment_mentions cm
           JOIN comments c ON cm.comment_id = c.id
           WHERE cm.mentioned_email = ? AND cm.read_at IS NULL
           ORDER BY cm.notified_at DESC`
        )
        .bind(userEmail)
        .all();

      return results.map((row) => ({
        commentId: row.comment_id as string,
        documentId: row.document_id as string,
        excerpt: (row.content as string).slice(0, 100),
        mentionedAt: row.notified_at as number,
      }));
    },

    /**
     * Mark mentions as read
     */
    async markMentionsRead(userEmail: string, commentIds?: string[]): Promise<void> {
      if (commentIds && commentIds.length > 0) {
        const placeholders = commentIds.map(() => '?').join(',');
        await db
          .prepare(
            `UPDATE comment_mentions SET read_at = ?
             WHERE mentioned_email = ? AND comment_id IN (${placeholders})`
          )
          .bind(Date.now(), userEmail, ...commentIds)
          .run();
      } else {
        await db
          .prepare(
            `UPDATE comment_mentions SET read_at = ?
             WHERE mentioned_email = ? AND read_at IS NULL`
          )
          .bind(Date.now(), userEmail)
          .run();
      }
    },

    /**
     * Get comment count for document
     */
    async getCount(
      documentId: string,
      options: { status?: CommentStatus } = {}
    ): Promise<{ total: number; open: number; resolved: number }> {
      const result = await db
        .prepare(
          `SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
           FROM comments
           WHERE document_id = ? AND deleted_at IS NULL AND parent_id IS NULL`
        )
        .bind(documentId)
        .first<{ total: number; open: number; resolved: number }>();

      return {
        total: result?.total || 0,
        open: result?.open || 0,
        resolved: result?.resolved || 0,
      };
    },

    // Helper methods
    extractMentions(content: string): string[] {
      const mentionRegex = /@(\S+@\S+\.\S+)/g;
      const matches = content.matchAll(mentionRegex);
      return [...new Set([...matches].map((m) => m[1]))];
    },

    renderMarkdown(content: string): string {
      // InfoSec: Escape user input first, then apply formatting
      // This prevents XSS while allowing basic markdown
      const escaped = escapeHtml(content);
      const formatted = escaped
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
      return sanitizeComment(formatted);
    },

    rowToComment(row: Record<string, unknown>): Comment {
      return {
        id: row.id as string,
        documentId: row.document_id as string,
        parentId: row.parent_id as string | null,
        threadId: row.thread_id as string,
        replyCount: row.reply_count as number | undefined,
        type: row.comment_type as CommentType,
        anchor: row.anchor_start
          ? {
              start: row.anchor_start as number,
              end: row.anchor_end as number,
              text: row.anchor_text as string,
              path: row.anchor_path as string | undefined,
            }
          : undefined,
        content: row.content as string,
        contentHtml: row.content_html as string | undefined,
        suggestionText: row.suggestion_text as string | undefined,
        status: row.status as CommentStatus,
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

      // First pass: create threads from root comments
      for (const comment of comments) {
        if (!comment.parentId) {
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

      // Second pass: add replies
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
        thread.replies.forEach((r) => participants.add(r.author.email));
        thread.participantCount = participants.size;
      }

      return [...threads.values()].sort((a, b) => b.lastActivity - a.lastActivity);
    },

    async getThreadParticipants(threadId: string): Promise<string[]> {
      const { results } = await db
        .prepare(`SELECT DISTINCT author_email FROM comments WHERE thread_id = ?`)
        .bind(threadId)
        .all();

      return results.map((r) => r.author_email as string);
    },
  };
}

export type CommentsService = ReturnType<typeof createCommentsService>;
