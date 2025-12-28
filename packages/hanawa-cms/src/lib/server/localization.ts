/**
 * Localization Service for Hanawa CMS
 * InfoSec: Field-level internationalization for bilingual content (EN/JA)
 *
 * Supports:
 * - Field-level localization (some fields universal, some localized)
 * - Fallback behavior (show default locale if translation missing)
 * - Translation status tracking with progress
 * - Translation memory for consistency
 */

/// <reference types="@cloudflare/workers-types" />

import type { AuditService, AuditContext } from "./audit";

export type Locale = "en" | "ja";
export type DocumentType = "content" | "fragment";
export type TranslationStatus =
  | "pending"
  | "in_progress"
  | "review"
  | "complete";

export interface LocalizedContent {
  [locale: string]: Record<string, unknown>;
}

export interface TranslationStatusRecord {
  id: string;
  documentId: string;
  documentType: DocumentType;
  locale: Locale;
  status: TranslationStatus;
  progressPercent: number;
  translatedFields: string[];
  pendingFields: string[];
  assignedTo?: string;
  assignedAt?: number;
  createdAt: number;
  lastUpdated: number;
  completedAt?: number;
  notes?: string;
}

export interface TranslationMemoryEntry {
  id: string;
  sourceLocale: Locale;
  targetLocale: Locale;
  sourceText: string;
  targetText: string;
  fieldName?: string;
  documentType?: DocumentType;
  confidence: number;
  usageCount: number;
}

/**
 * Create a localization service instance
 */
export function createLocalizationService(db: D1Database, audit?: AuditService) {
  return {
    /**
     * Get localized content for a document
     */
    async getLocalized(
      documentId: string,
      locale: Locale,
      options: {
        documentType?: DocumentType;
        fallback?: boolean;
        markFallbacks?: boolean;
      } = {}
    ): Promise<{
      content: Record<string, unknown>;
      fallbacks?: string[];
      defaultLocale: Locale;
      availableLocales: Locale[];
    }> {
      const { documentType = "content", fallback = true, markFallbacks = false } = options;

      const table = documentType === "fragment" ? "fragments" : "content";

      const doc = await db
        .prepare(
          `SELECT default_locale, available_locales, localized_content
           FROM ${table} WHERE id = ?`
        )
        .bind(documentId)
        .first<{
          default_locale: string;
          available_locales: string;
          localized_content: string | null;
        }>();

      if (!doc) {
        throw new Error(`${documentType} not found: ${documentId}`);
      }

      const defaultLocale = (doc.default_locale || "en") as Locale;
      const availableLocales = JSON.parse(doc.available_locales || '["en"]') as Locale[];
      const localizedContent: LocalizedContent = JSON.parse(
        doc.localized_content || "{}"
      );

      const localeContent = localizedContent[locale] || {};
      const defaultContent = localizedContent[defaultLocale] || {};

      // If no fallback requested, just return locale content
      if (!fallback) {
        return {
          content: localeContent,
          defaultLocale,
          availableLocales,
        };
      }

      // Merge with fallback
      const merged: Record<string, unknown> = { ...defaultContent, ...localeContent };
      const fallbacks: string[] = [];

      // Track which fields are using fallback
      if (markFallbacks) {
        for (const key of Object.keys(defaultContent)) {
          if (!(key in localeContent) && key in defaultContent) {
            fallbacks.push(key);
          }
        }
      }

      return {
        content: merged,
        fallbacks: markFallbacks ? fallbacks : undefined,
        defaultLocale,
        availableLocales,
      };
    },

    /**
     * Save localized content for a document
     */
    async saveLocalized(
      documentId: string,
      locale: Locale,
      fields: Record<string, unknown>,
      options: {
        documentType?: DocumentType;
        context?: AuditContext;
      } = {}
    ): Promise<void> {
      const { documentType = "content", context } = options;
      const table = documentType === "fragment" ? "fragments" : "content";

      // Get current content
      const doc = await db
        .prepare(
          `SELECT localized_content, available_locales FROM ${table} WHERE id = ?`
        )
        .bind(documentId)
        .first<{
          localized_content: string | null;
          available_locales: string;
        }>();

      if (!doc) {
        throw new Error(`${documentType} not found: ${documentId}`);
      }

      const content: LocalizedContent = JSON.parse(doc.localized_content || "{}");
      const availableLocales: Locale[] = JSON.parse(doc.available_locales || '["en"]');

      // Merge new fields with existing
      content[locale] = { ...(content[locale] || {}), ...fields };

      // Add locale to available if not present
      if (!availableLocales.includes(locale)) {
        availableLocales.push(locale);
      }

      await db
        .prepare(
          `UPDATE ${table}
           SET localized_content = ?, available_locales = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          JSON.stringify(content),
          JSON.stringify(availableLocales),
          documentId
        )
        .run();

      // Update translation status
      await this.updateTranslationProgress(documentId, locale, {
        documentType,
        translatedFields: Object.keys(fields),
      });

      // Audit log
      if (audit && context) {
        await audit.log(
          {
            action: "update",
            actionCategory: "content",
            resourceType: documentType,
            resourceId: documentId,
            changeSummary: `Updated ${locale} translation: ${Object.keys(fields).join(", ")}`,
            metadata: { locale, fields: Object.keys(fields) },
          },
          context
        );
      }
    },

    /**
     * Set default locale for a document
     */
    async setDefaultLocale(
      documentId: string,
      locale: Locale,
      options: { documentType?: DocumentType; context?: AuditContext } = {}
    ): Promise<void> {
      const { documentType = "content", context } = options;
      const table = documentType === "fragment" ? "fragments" : "content";

      await db
        .prepare(`UPDATE ${table} SET default_locale = ? WHERE id = ?`)
        .bind(locale, documentId)
        .run();

      if (audit && context) {
        await audit.log(
          {
            action: "update",
            actionCategory: "content",
            resourceType: documentType,
            resourceId: documentId,
            changeSummary: `Set default locale to ${locale}`,
            metadata: { defaultLocale: locale },
          },
          context
        );
      }
    },

    /**
     * Get translation status for a document
     */
    async getTranslationStatus(
      documentId: string,
      locale: Locale,
      documentType: DocumentType = "content"
    ): Promise<TranslationStatusRecord | null> {
      const row = await db
        .prepare(
          `SELECT * FROM translation_status
           WHERE document_id = ? AND document_type = ? AND locale = ?`
        )
        .bind(documentId, documentType, locale)
        .first();

      return row ? this.rowToTranslationStatus(row) : null;
    },

    /**
     * Update translation progress
     */
    async updateTranslationProgress(
      documentId: string,
      locale: Locale,
      options: {
        documentType?: DocumentType;
        translatedFields?: string[];
        status?: TranslationStatus;
        assignedTo?: string;
        notes?: string;
      } = {}
    ): Promise<void> {
      const { documentType = "content", translatedFields, status, assignedTo, notes } = options;
      const now = Date.now();

      // Get or create status record
      const existing = await this.getTranslationStatus(documentId, locale, documentType);

      if (existing) {
        // Update existing record
        const newTranslatedFields = translatedFields
          ? [...new Set([...existing.translatedFields, ...translatedFields])]
          : existing.translatedFields;

        const updates: string[] = ["last_updated = ?"];
        const values: (string | number | null)[] = [now];

        if (translatedFields) {
          updates.push("translated_fields = ?");
          values.push(JSON.stringify(newTranslatedFields));
        }

        if (status) {
          updates.push("status = ?");
          values.push(status);
          if (status === "complete") {
            updates.push("completed_at = ?");
            values.push(now);
          }
        }

        if (assignedTo !== undefined) {
          updates.push("assigned_to = ?", "assigned_at = ?");
          values.push(assignedTo, now);
        }

        if (notes !== undefined) {
          updates.push("notes = ?");
          values.push(notes);
        }

        values.push(existing.id);

        await db
          .prepare(
            `UPDATE translation_status SET ${updates.join(", ")} WHERE id = ?`
          )
          .bind(...values)
          .run();
      } else {
        // Create new record
        const id = crypto.randomUUID();

        await db
          .prepare(
            `INSERT INTO translation_status (
              id, document_id, document_type, locale, status,
              translated_fields, assigned_to, assigned_at,
              created_at, last_updated, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            documentId,
            documentType,
            locale,
            status || "pending",
            JSON.stringify(translatedFields || []),
            assignedTo || null,
            assignedTo ? now : null,
            now,
            now,
            notes || null
          )
          .run();
      }
    },

    /**
     * Get translation queue (documents needing translation)
     */
    async getTranslationQueue(
      locale: Locale,
      options: {
        status?: TranslationStatus;
        documentType?: DocumentType;
        assignedTo?: string;
        limit?: number;
      } = {}
    ): Promise<(TranslationStatusRecord & { documentTitle: string })[]> {
      const { status, documentType, assignedTo, limit = 50 } = options;

      let query = `
        SELECT ts.*,
          CASE ts.document_type
            WHEN 'content' THEN (SELECT title FROM content WHERE id = ts.document_id)
            WHEN 'fragment' THEN (SELECT name FROM fragments WHERE id = ts.document_id)
          END as document_title
        FROM translation_status ts
        WHERE ts.locale = ?
      `;

      const params: (string | number)[] = [locale];

      if (status) {
        query += ` AND ts.status = ?`;
        params.push(status);
      } else {
        query += ` AND ts.status != 'complete'`;
      }

      if (documentType) {
        query += ` AND ts.document_type = ?`;
        params.push(documentType);
      }

      if (assignedTo) {
        query += ` AND ts.assigned_to = ?`;
        params.push(assignedTo);
      }

      query += ` ORDER BY ts.last_updated DESC LIMIT ?`;
      params.push(limit);

      const { results } = await db.prepare(query).bind(...params).all();

      return results.map((row) => ({
        ...this.rowToTranslationStatus(row),
        documentTitle: (row.document_title as string) || "Untitled",
      }));
    },

    /**
     * Assign translation to a user
     */
    async assignTranslation(
      documentId: string,
      locale: Locale,
      assignedTo: string,
      options: { documentType?: DocumentType; context?: AuditContext } = {}
    ): Promise<void> {
      const { documentType = "content", context } = options;

      await this.updateTranslationProgress(documentId, locale, {
        documentType,
        assignedTo,
        status: "in_progress",
      });

      if (audit && context) {
        await audit.log(
          {
            action: "update",
            actionCategory: "content",
            resourceType: documentType,
            resourceId: documentId,
            changeSummary: `Assigned ${locale} translation to ${assignedTo}`,
            metadata: { locale, assignedTo },
          },
          context
        );
      }
    },

    /**
     * Mark translation as complete
     */
    async markTranslationComplete(
      documentId: string,
      locale: Locale,
      options: { documentType?: DocumentType; context?: AuditContext } = {}
    ): Promise<void> {
      const { documentType = "content", context } = options;

      await this.updateTranslationProgress(documentId, locale, {
        documentType,
        status: "complete",
      });

      if (audit && context) {
        await audit.log(
          {
            action: "update",
            actionCategory: "content",
            resourceType: documentType,
            resourceId: documentId,
            changeSummary: `Marked ${locale} translation as complete`,
            metadata: { locale },
          },
          context
        );
      }
    },

    /**
     * Add entry to translation memory
     */
    async addToTranslationMemory(
      sourceLocale: Locale,
      targetLocale: Locale,
      sourceText: string,
      targetText: string,
      options: {
        fieldName?: string;
        documentType?: DocumentType;
        confidence?: number;
      } = {}
    ): Promise<void> {
      const { fieldName, documentType, confidence = 1.0 } = options;
      const now = Date.now();
      const sourceHash = await this.hashText(sourceText);

      // Check if entry exists
      const existing = await db
        .prepare(
          `SELECT id, usage_count FROM translation_memory
           WHERE source_locale = ? AND target_locale = ? AND source_hash = ?`
        )
        .bind(sourceLocale, targetLocale, sourceHash)
        .first<{ id: string; usage_count: number }>();

      if (existing) {
        // Update existing entry
        await db
          .prepare(
            `UPDATE translation_memory
             SET target_text = ?, confidence = ?, usage_count = ?, last_used_at = ?
             WHERE id = ?`
          )
          .bind(targetText, confidence, existing.usage_count + 1, now, existing.id)
          .run();
      } else {
        // Create new entry
        await db
          .prepare(
            `INSERT INTO translation_memory (
              id, source_locale, target_locale, source_text, target_text,
              field_name, document_type, confidence, usage_count,
              created_at, last_used_at, source_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            sourceLocale,
            targetLocale,
            sourceText,
            targetText,
            fieldName || null,
            documentType || null,
            confidence,
            now,
            now,
            sourceHash
          )
          .run();
      }
    },

    /**
     * Look up translation from memory
     */
    async lookupTranslation(
      sourceLocale: Locale,
      targetLocale: Locale,
      sourceText: string
    ): Promise<TranslationMemoryEntry | null> {
      const sourceHash = await this.hashText(sourceText);

      const row = await db
        .prepare(
          `SELECT * FROM translation_memory
           WHERE source_locale = ? AND target_locale = ? AND source_hash = ?
           ORDER BY confidence DESC, usage_count DESC
           LIMIT 1`
        )
        .bind(sourceLocale, targetLocale, sourceHash)
        .first();

      if (!row) return null;

      // Update usage count
      await db
        .prepare(
          `UPDATE translation_memory
           SET usage_count = usage_count + 1, last_used_at = ?
           WHERE id = ?`
        )
        .bind(Date.now(), row.id)
        .run();

      return {
        id: row.id as string,
        sourceLocale: row.source_locale as Locale,
        targetLocale: row.target_locale as Locale,
        sourceText: row.source_text as string,
        targetText: row.target_text as string,
        fieldName: row.field_name as string | undefined,
        documentType: row.document_type as DocumentType | undefined,
        confidence: row.confidence as number,
        usageCount: row.usage_count as number,
      };
    },

    /**
     * Search translation memory for similar texts
     */
    async searchTranslationMemory(
      sourceLocale: Locale,
      targetLocale: Locale,
      searchText: string,
      options: { limit?: number } = {}
    ): Promise<TranslationMemoryEntry[]> {
      const { limit = 10 } = options;

      // Simple LIKE search (for more advanced matching, consider FTS5)
      const { results } = await db
        .prepare(
          `SELECT * FROM translation_memory
           WHERE source_locale = ? AND target_locale = ?
             AND source_text LIKE ?
           ORDER BY confidence DESC, usage_count DESC
           LIMIT ?`
        )
        .bind(sourceLocale, targetLocale, `%${searchText}%`, limit)
        .all();

      return results.map((row) => ({
        id: row.id as string,
        sourceLocale: row.source_locale as Locale,
        targetLocale: row.target_locale as Locale,
        sourceText: row.source_text as string,
        targetText: row.target_text as string,
        fieldName: row.field_name as string | undefined,
        documentType: row.document_type as DocumentType | undefined,
        confidence: row.confidence as number,
        usageCount: row.usage_count as number,
      }));
    },

    /**
     * Get localization statistics
     */
    async getStats(
      locale: Locale
    ): Promise<{
      pending: number;
      inProgress: number;
      review: number;
      complete: number;
      total: number;
    }> {
      const result = await db
        .prepare(
          `SELECT
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) as review,
            SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as complete,
            COUNT(*) as total
           FROM translation_status
           WHERE locale = ?`
        )
        .bind(locale)
        .first<{
          pending: number;
          in_progress: number;
          review: number;
          complete: number;
          total: number;
        }>();

      return {
        pending: result?.pending || 0,
        inProgress: result?.in_progress || 0,
        review: result?.review || 0,
        complete: result?.complete || 0,
        total: result?.total || 0,
      };
    },

    // Helper: Hash text for translation memory lookup
    async hashText(text: string): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(text.toLowerCase().trim());
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    },

    // Helper: Convert row to TranslationStatusRecord
    rowToTranslationStatus(row: Record<string, unknown>): TranslationStatusRecord {
      return {
        id: row.id as string,
        documentId: row.document_id as string,
        documentType: row.document_type as DocumentType,
        locale: row.locale as Locale,
        status: row.status as TranslationStatus,
        progressPercent: (row.progress_percent as number) || 0,
        translatedFields: JSON.parse((row.translated_fields as string) || "[]"),
        pendingFields: JSON.parse((row.pending_fields as string) || "[]"),
        assignedTo: row.assigned_to as string | undefined,
        assignedAt: row.assigned_at as number | undefined,
        createdAt: row.created_at as number,
        lastUpdated: row.last_updated as number,
        completedAt: row.completed_at as number | undefined,
        notes: row.notes as string | undefined,
      };
    },
  };
}

export type LocalizationService = ReturnType<typeof createLocalizationService>;
