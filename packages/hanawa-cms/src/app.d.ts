// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AuditService, AuditContext } from '$lib/server/audit';
import type { VersionService } from '$lib/server/versions';
import type { WorkflowService } from '$lib/server/workflow';
import type { CommentsService } from '$lib/server/comments';
import type { SchedulingService } from '$lib/server/scheduling';
import type { LocalizationService } from '$lib/server/localization';
import type { AIService } from '$lib/server/ai';
import type { CodexService } from '$lib/server/codex';
import type { MediaService } from '$lib/server/media';
import type { WebhookService } from '$lib/server/webhooks';
import type { DeliveryService } from '$lib/server/delivery';

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
        role: 'admin' | 'editor' | 'viewer';
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
      media?: MediaService;
      webhooks?: WebhookService;
      delivery?: DeliveryService;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SvelteKit convention
    interface PageData {}

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- SvelteKit convention
    interface PageState {}

    interface Platform {
      env: {
        DB: D1Database;
        R2: R2Bucket;
        KV?: KVNamespace;
        AI: Ai;
        VECTORIZE?: VectorizeIndex;
        ENVIRONMENT: string;
        SESSION_SECRET?: string;
        PDF_API_KEY?: string;
        // Service binding to PDF Worker (direct worker-to-worker)
        PDF_SERVICE?: Fetcher;
        // InfoSec: Anthropic API key for AI-powered translations
        ANTHROPIC_API_KEY?: string;
      };
      context: ExecutionContext;
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};
