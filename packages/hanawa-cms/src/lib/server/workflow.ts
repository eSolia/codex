/**
 * Workflow Service for Hanawa CMS
 * InfoSec: Multi-stage approval workflows for content governance
 *
 * Enforces controlled publication through review and approval stages.
 * All transitions are audited for compliance (SOC 2, ISO 27001).
 */

/// <reference types="@cloudflare/workers-types" />

import type { AuditService, AuditContext } from "./audit";
import type { VersionService } from "./versions";

export type StageType = "draft" | "review" | "approval" | "published";
export type ApprovalType = "any" | "all" | "sequential";
export type TransitionType = "advance" | "reject" | "skip";

export interface WorkflowStage {
  id: string;
  name: string;
  description?: string;
  order: number;
  type: StageType;
  approvalType: ApprovalType;
  requiredApprovers: string[];
  minApprovals: number;
  autoAdvance: boolean;
  autoAdvanceAfter?: number;
}

export interface WorkflowTransition {
  id: string;
  fromStageId: string;
  toStageId: string;
  type: TransitionType;
  requiresComment: boolean;
  allowedRoles: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  collection?: string;
  isDefault: boolean;
  isActive: boolean;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
}

export interface Approval {
  userId: string;
  email: string;
  at: number;
  comment?: string;
}

export interface DocumentWorkflowState {
  documentId: string;
  workflowId: string;
  currentStage: WorkflowStage;
  approvals: Approval[];
  rejections: Approval[];
  enteredStageAt: number;
  deadline?: number;
  availableTransitions: WorkflowTransition[];
  canCurrentUserApprove: boolean;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
}

export interface WorkflowHistoryEntry {
  id: string;
  timestamp: number;
  fromStageName?: string;
  toStageName: string;
  transitionType: string;
  actorEmail: string;
  comment?: string;
}

/**
 * Create a workflow service instance
 */
export function createWorkflowService(
  db: D1Database,
  audit?: AuditService,
  versions?: VersionService
) {
  return {
    /**
     * Get available workflows
     */
    async getWorkflows(collection?: string): Promise<WorkflowDefinition[]> {
      const query = collection
        ? `SELECT * FROM workflow_definitions WHERE is_active = 1 AND (collection = ? OR collection IS NULL)`
        : `SELECT * FROM workflow_definitions WHERE is_active = 1`;

      const { results } = await db
        .prepare(query)
        .bind(...(collection ? [collection] : []))
        .all();

      return Promise.all(
        results.map(async (row) => {
          const stages = await this.getStages(row.id as string);
          const transitions = await this.getTransitions(row.id as string);
          return {
            id: row.id as string,
            name: row.name as string,
            description: row.description as string | undefined,
            collection: row.collection as string | undefined,
            isDefault: Boolean(row.is_default),
            isActive: Boolean(row.is_active),
            stages,
            transitions,
          };
        })
      );
    },

    /**
     * Get a single workflow by ID
     */
    async getWorkflow(id: string): Promise<WorkflowDefinition | null> {
      const row = await db
        .prepare(`SELECT * FROM workflow_definitions WHERE id = ?`)
        .bind(id)
        .first();

      if (!row) return null;

      const stages = await this.getStages(id);
      const transitions = await this.getTransitions(id);

      return {
        id: row.id as string,
        name: row.name as string,
        description: row.description as string | undefined,
        collection: row.collection as string | undefined,
        isDefault: Boolean(row.is_default),
        isActive: Boolean(row.is_active),
        stages,
        transitions,
      };
    },

    /**
     * Get stages for a workflow
     */
    async getStages(workflowId: string): Promise<WorkflowStage[]> {
      const { results } = await db
        .prepare(
          `SELECT * FROM workflow_stages WHERE workflow_id = ? ORDER BY stage_order`
        )
        .bind(workflowId)
        .all();

      return results.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        description: row.description as string | undefined,
        order: row.stage_order as number,
        type: row.stage_type as StageType,
        approvalType: (row.approval_type as ApprovalType) || "any",
        requiredApprovers: row.required_approvers
          ? JSON.parse(row.required_approvers as string)
          : [],
        minApprovals: (row.min_approvals as number) || 1,
        autoAdvance: Boolean(row.auto_advance),
        autoAdvanceAfter: row.auto_advance_after as number | undefined,
      }));
    },

    /**
     * Get transitions for a workflow
     */
    async getTransitions(workflowId: string): Promise<WorkflowTransition[]> {
      const { results } = await db
        .prepare(`SELECT * FROM workflow_transitions WHERE workflow_id = ?`)
        .bind(workflowId)
        .all();

      return results.map((row) => ({
        id: row.id as string,
        fromStageId: row.from_stage_id as string,
        toStageId: row.to_stage_id as string,
        type: row.transition_type as TransitionType,
        requiresComment: Boolean(row.requires_comment),
        allowedRoles: row.allowed_roles
          ? JSON.parse(row.allowed_roles as string)
          : [],
      }));
    },

    /**
     * Get document's current workflow state
     */
    async getState(
      documentId: string,
      userId: string,
      userRoles: string[]
    ): Promise<DocumentWorkflowState | null> {
      const state = await db
        .prepare(
          `SELECT dws.*, ws.name as stage_name, ws.stage_type, ws.stage_order,
                  ws.approval_type, ws.required_approvers, ws.min_approvals
           FROM document_workflow_state dws
           JOIN workflow_stages ws ON dws.current_stage_id = ws.id
           WHERE dws.document_id = ?`
        )
        .bind(documentId)
        .first();

      if (!state) return null;

      const workflow = await this.getWorkflow(state.workflow_id as string);
      if (!workflow) return null;

      const currentStage = workflow.stages.find(
        (s) => s.id === state.current_stage_id
      );
      if (!currentStage) return null;

      const approvals: Approval[] = state.approvals
        ? JSON.parse(state.approvals as string)
        : [];
      const rejections: Approval[] = state.rejections
        ? JSON.parse(state.rejections as string)
        : [];

      // Determine available transitions for current user
      const availableTransitions = workflow.transitions.filter((t) => {
        if (t.fromStageId !== state.current_stage_id) return false;

        // Check if user can trigger this transition
        return t.allowedRoles.some(
          (role) => userRoles.includes(role) || role === userId
        );
      });

      // Check if user can approve at this stage
      const canApprove = this.canUserApprove(
        currentStage,
        userId,
        userRoles,
        approvals
      );

      return {
        documentId,
        workflowId: state.workflow_id as string,
        currentStage,
        approvals,
        rejections,
        enteredStageAt: state.entered_stage_at as number,
        deadline: state.deadline as number | undefined,
        availableTransitions,
        canCurrentUserApprove: canApprove,
        progress: {
          current: currentStage.order,
          total: workflow.stages.length,
          percentage: Math.round(
            (currentStage.order / workflow.stages.length) * 100
          ),
        },
      };
    },

    /**
     * Initialize workflow for new document
     */
    async initialize(
      documentId: string,
      workflowId: string,
      context: AuditContext
    ): Promise<void> {
      const workflow = await this.getWorkflow(workflowId);
      if (!workflow) throw new Error("Workflow not found");

      const firstStage = workflow.stages.find((s) => s.order === 1);
      if (!firstStage) throw new Error("Workflow has no stages");

      await db
        .prepare(
          `INSERT INTO document_workflow_state (
            document_id, workflow_id, current_stage_id,
            approvals, rejections, entered_stage_at
          ) VALUES (?, ?, ?, '[]', '[]', ?)`
        )
        .bind(documentId, workflowId, firstStage.id, Date.now())
        .run();

      // Record in history
      await this.recordHistory(
        documentId,
        null,
        firstStage.id,
        "advance",
        context
      );

      // Audit log
      if (audit) {
        await audit.log(
          {
            action: "create",
            actionCategory: "workflow",
            resourceType: "document_workflow",
            resourceId: documentId,
            metadata: { workflowId, stageName: firstStage.name },
          },
          context
        );
      }
    },

    /**
     * Submit for review (advance to next stage)
     */
    async submit(
      documentId: string,
      comment: string | undefined,
      context: AuditContext
    ): Promise<{
      success: boolean;
      newStage?: WorkflowStage;
      error?: string;
    }> {
      const state = await this.getState(documentId, context.actorId, []);
      if (!state) {
        return { success: false, error: "Document has no workflow" };
      }

      // Find advance transition from current stage
      const transition = state.availableTransitions.find(
        (t) => t.type === "advance"
      );
      if (!transition) {
        return { success: false, error: "No available transition" };
      }

      return this.executeTransition(documentId, transition.id, comment, context);
    },

    /**
     * Approve at current stage
     */
    async approve(
      documentId: string,
      comment: string | undefined,
      context: AuditContext
    ): Promise<{
      success: boolean;
      advanced?: boolean;
      newStage?: WorkflowStage;
      error?: string;
    }> {
      const state = await this.getState(documentId, context.actorId, []);
      if (!state) {
        return { success: false, error: "Document has no workflow" };
      }

      if (!state.canCurrentUserApprove) {
        return { success: false, error: "User cannot approve at this stage" };
      }

      // Check if already approved
      const alreadyApproved = state.approvals.some(
        (a) => a.userId === context.actorId
      );
      if (alreadyApproved) {
        return { success: false, error: "Already approved by this user" };
      }

      // Add approval
      const newApproval: Approval = {
        userId: context.actorId,
        email: context.actorEmail,
        at: Date.now(),
        comment,
      };

      const approvals = [...state.approvals, newApproval];

      await db
        .prepare(
          `UPDATE document_workflow_state SET approvals = ? WHERE document_id = ?`
        )
        .bind(JSON.stringify(approvals), documentId)
        .run();

      // Audit log
      if (audit) {
        await audit.log(
          {
            action: "approve",
            actionCategory: "workflow",
            resourceType: "document",
            resourceId: documentId,
            changeSummary: `Approved at ${state.currentStage.name}`,
            metadata: { stageId: state.currentStage.id, comment },
          },
          context
        );
      }

      // Check if stage requirements are met
      const requirementsMet = this.areRequirementsMet(
        state.currentStage,
        approvals
      );

      if (requirementsMet) {
        // Auto-advance to next stage
        const advanceTransition = state.availableTransitions.find(
          (t) => t.type === "advance"
        );
        if (advanceTransition) {
          const result = await this.executeTransition(
            documentId,
            advanceTransition.id,
            "Auto-advanced after approval requirements met",
            context
          );
          return { success: true, advanced: true, newStage: result.newStage };
        }
      }

      return { success: true, advanced: false };
    },

    /**
     * Reject and return to previous stage
     */
    async reject(
      documentId: string,
      comment: string,
      context: AuditContext
    ): Promise<{
      success: boolean;
      newStage?: WorkflowStage;
      error?: string;
    }> {
      if (!comment) {
        return { success: false, error: "Comment required for rejection" };
      }

      const state = await this.getState(documentId, context.actorId, []);
      if (!state) {
        return { success: false, error: "Document has no workflow" };
      }

      // Find reject transition from current stage
      const transition = state.availableTransitions.find(
        (t) => t.type === "reject"
      );
      if (!transition) {
        return { success: false, error: "No rejection path available" };
      }

      return this.executeTransition(documentId, transition.id, comment, context);
    },

    /**
     * Execute a workflow transition
     */
    async executeTransition(
      documentId: string,
      transitionId: string,
      comment: string | undefined,
      context: AuditContext
    ): Promise<{
      success: boolean;
      newStage?: WorkflowStage;
      error?: string;
    }> {
      const state = await this.getState(documentId, context.actorId, []);
      if (!state) {
        return { success: false, error: "Document has no workflow" };
      }

      const transition = state.availableTransitions.find(
        (t) => t.id === transitionId
      );
      if (!transition) {
        return { success: false, error: "Transition not available" };
      }

      if (transition.requiresComment && !comment) {
        return { success: false, error: "Comment required for this transition" };
      }

      const workflow = await this.getWorkflow(state.workflowId);
      if (!workflow) {
        return { success: false, error: "Workflow not found" };
      }

      const newStage = workflow.stages.find((s) => s.id === transition.toStageId);
      if (!newStage) {
        return { success: false, error: "Target stage not found" };
      }

      // Update workflow state
      const rejectionData =
        transition.type === "reject"
          ? JSON.stringify([
              {
                userId: context.actorId,
                email: context.actorEmail,
                at: Date.now(),
                comment,
              },
            ])
          : "[]";

      await db
        .prepare(
          `UPDATE document_workflow_state
           SET current_stage_id = ?, previous_stage_id = ?,
               approvals = '[]', rejections = ?, entered_stage_at = ?
           WHERE document_id = ?`
        )
        .bind(
          newStage.id,
          state.currentStage.id,
          rejectionData,
          Date.now(),
          documentId
        )
        .run();

      // Record history
      await this.recordHistory(
        documentId,
        state.currentStage.id,
        newStage.id,
        transition.type,
        context,
        comment
      );

      // If publishing, create version snapshot
      if (newStage.type === "published" && versions) {
        const doc = await db
          .prepare(`SELECT body, title FROM content WHERE id = ?`)
          .bind(documentId)
          .first();

        if (doc) {
          await versions.create(
            documentId,
            {
              content: doc.body as string,
              contentFormat: "html",
              title: doc.title as string,
              versionType: "publish",
              versionLabel: "Published",
              versionNotes: comment || "Published via workflow",
            },
            context
          );
        }

        // Update document status
        await db
          .prepare(
            `UPDATE content SET status = 'published', published_at = ? WHERE id = ?`
          )
          .bind(Date.now(), documentId)
          .run();
      }

      // Audit log
      if (audit) {
        await audit.log(
          {
            action: transition.type === "advance" ? "submit_review" : "reject",
            actionCategory: "workflow",
            resourceType: "document",
            resourceId: documentId,
            changeSummary: `${transition.type === "advance" ? "Advanced" : "Rejected"} from ${state.currentStage.name} to ${newStage.name}`,
            metadata: {
              fromStage: state.currentStage.id,
              toStage: newStage.id,
              comment,
            },
          },
          context
        );
      }

      return { success: true, newStage };
    },

    /**
     * Get workflow history for document
     */
    async getHistory(documentId: string): Promise<WorkflowHistoryEntry[]> {
      const { results } = await db
        .prepare(
          `SELECT wh.*, ws_from.name as from_stage_name, ws_to.name as to_stage_name
           FROM workflow_history wh
           LEFT JOIN workflow_stages ws_from ON wh.from_stage_id = ws_from.id
           JOIN workflow_stages ws_to ON wh.to_stage_id = ws_to.id
           WHERE wh.document_id = ?
           ORDER BY wh.timestamp DESC`
        )
        .bind(documentId)
        .all();

      return results.map((row) => ({
        id: row.id as string,
        timestamp: row.timestamp as number,
        fromStageName: row.from_stage_name as string | undefined,
        toStageName: row.to_stage_name as string,
        transitionType: row.transition_type as string,
        actorEmail: row.actor_email as string,
        comment: row.comment as string | undefined,
      }));
    },

    /**
     * Check if user can approve at stage
     */
    canUserApprove(
      stage: WorkflowStage,
      userId: string,
      userRoles: string[],
      existingApprovals: Approval[]
    ): boolean {
      if (stage.type !== "review" && stage.type !== "approval") {
        return false;
      }

      const alreadyApproved = existingApprovals.some(
        (a) => a.userId === userId
      );
      if (alreadyApproved) return false;

      // Check if user matches required approvers
      return stage.requiredApprovers.some(
        (approver) => userRoles.includes(approver) || approver === userId
      );
    },

    /**
     * Check if stage requirements are met
     */
    areRequirementsMet(stage: WorkflowStage, approvals: Approval[]): boolean {
      if (stage.type === "draft") return true;
      if (stage.type === "published") return true;

      if (stage.approvalType === "any") {
        return approvals.length >= stage.minApprovals;
      }

      if (stage.approvalType === "all") {
        return stage.requiredApprovers.every((approver) =>
          approvals.some((a) => a.email === approver || a.userId === approver)
        );
      }

      return approvals.length >= stage.minApprovals;
    },

    /**
     * Record workflow history
     */
    async recordHistory(
      documentId: string,
      fromStageId: string | null,
      toStageId: string,
      transitionType: string,
      context: AuditContext,
      comment?: string
    ): Promise<void> {
      await db
        .prepare(
          `INSERT INTO workflow_history (
            id, document_id, timestamp,
            from_stage_id, to_stage_id, transition_type,
            actor_id, actor_email, comment
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          documentId,
          Date.now(),
          fromStageId,
          toStageId,
          transitionType,
          context.actorId,
          context.actorEmail,
          comment || null
        )
        .run();
    },

    /**
     * Get default workflow for a collection
     */
    async getDefaultWorkflow(
      collection?: string
    ): Promise<WorkflowDefinition | null> {
      const workflows = await this.getWorkflows(collection);

      // First, try to find a default workflow for the collection
      let workflow = workflows.find((w) => w.isDefault && w.collection === collection);

      // If no collection-specific default, get the global default
      if (!workflow) {
        workflow = workflows.find((w) => w.isDefault && !w.collection);
      }

      // Fallback to any active workflow
      if (!workflow && workflows.length > 0) {
        workflow = workflows[0];
      }

      return workflow || null;
    },
  };
}

export type WorkflowService = ReturnType<typeof createWorkflowService>;
