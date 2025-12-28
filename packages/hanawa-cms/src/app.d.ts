// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AuditService, AuditContext } from "$lib/server/audit";
import type { VersionService } from "$lib/server/versions";
import type { WorkflowService } from "$lib/server/workflow";
import type { CommentsService } from "$lib/server/comments";
import type { SchedulingService } from "$lib/server/scheduling";
import type { LocalizationService } from "$lib/server/localization";
import type { AIService } from "$lib/server/ai";
import type { CodexService } from "$lib/server/codex";

declare global {
  namespace App {
    interface Error {
      message: string;
      code?: string;
    }

    interface Locals {
      user?: {
        id: string;
        email: string;
        name: string;
        role: "admin" | "editor" | "viewer";
      };
      // Core services
      requestId?: string;
      auditContext?: AuditContext;
      audit?: AuditService;
      versions?: VersionService;
      workflow?: WorkflowService;
      comments?: CommentsService;
      scheduling?: SchedulingService;
      localization?: LocalizationService;
      ai?: AIService;
      codex?: CodexService;
    }

    interface PageData {}

    interface PageState {}

    interface Platform {
      env: {
        DB: D1Database;
        R2: R2Bucket;
        AI: Ai;
        VECTORIZE?: VectorizeIndex;
        ENVIRONMENT: string;
        SESSION_SECRET?: string;
      };
      context: ExecutionContext;
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};
