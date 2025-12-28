# Hanawa: Workflow Engine Specification

Multi-stage approval workflows for content governance.

## Overview

Compliance documentation requires controlled publication. Content shouldn't go live until reviewed, approved, and—for sensitive material—explicitly authorized. The workflow engine enforces these gates.

Think of it like a relay race: the document passes through stages, each runner (reviewer) must complete their leg before the next can begin.

```
┌─────────────────────────────────────────────────────────────────┐
│  WORKFLOW CONCEPT                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────┐    ┌──────────┐    ┌─────────┐    ┌───────────┐      │
│  │Draft │───▶│ Internal │───▶│ Legal   │───▶│ Published │      │
│  │      │    │ Review   │    │ Review  │    │           │      │
│  └──────┘    └──────────┘    └─────────┘    └───────────┘      │
│                 │    ▲          │    ▲                          │
│                 │    │          │    │                          │
│                 └────┘          └────┘                          │
│              Revisions       Revisions                         │
│                                                                 │
│  At each gate:                                                  │
│  • Specific people/roles must approve                          │
│  • Comments explain changes needed                             │
│  • Audit trail records every transition                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Workflow Definition Tables

```sql
-- Workflow templates
CREATE TABLE workflow_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  collection TEXT,              -- Apply to specific collection, NULL = all
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

-- Stages within a workflow
CREATE TABLE workflow_stages (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  stage_order INTEGER NOT NULL,      -- 1, 2, 3...
  stage_type TEXT NOT NULL,          -- 'draft', 'review', 'approval', 'published'
  
  -- Approval requirements
  approval_type TEXT DEFAULT 'any',  -- 'any', 'all', 'sequential'
  required_approvers TEXT,           -- JSON: role names or user emails
  min_approvals INTEGER DEFAULT 1,
  
  -- Automation
  auto_advance BOOLEAN DEFAULT FALSE,
  auto_advance_after INTEGER,        -- Hours to wait before auto-advance
  
  -- Notifications
  notify_on_enter TEXT,              -- JSON: who to notify
  notify_on_exit TEXT,
  
  FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE
);

CREATE INDEX idx_stages_workflow ON workflow_stages(workflow_id, stage_order);

-- Stage transitions (allowed paths)
CREATE TABLE workflow_transitions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  from_stage_id TEXT NOT NULL,
  to_stage_id TEXT NOT NULL,
  transition_type TEXT NOT NULL,     -- 'advance', 'reject', 'skip'
  requires_comment BOOLEAN DEFAULT FALSE,
  allowed_roles TEXT,                -- JSON: who can trigger this transition
  
  FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (from_stage_id) REFERENCES workflow_stages(id),
  FOREIGN KEY (to_stage_id) REFERENCES workflow_stages(id)
);
```

### Document Workflow State

```sql
-- Current workflow state per document
CREATE TABLE document_workflow_state (
  document_id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  current_stage_id TEXT NOT NULL,
  
  -- Approval tracking
  approvals TEXT,                    -- JSON: array of {userId, email, at, comment}
  rejections TEXT,                   -- JSON: array of {userId, email, at, comment}
  
  -- Timing
  entered_stage_at INTEGER NOT NULL,
  deadline INTEGER,                  -- Optional: when approval is needed by
  
  -- History
  previous_stage_id TEXT,
  
  FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id),
  FOREIGN KEY (current_stage_id) REFERENCES workflow_stages(id)
);

-- Workflow history (full audit)
CREATE TABLE workflow_history (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  
  -- Transition
  from_stage_id TEXT,
  to_stage_id TEXT NOT NULL,
  transition_type TEXT NOT NULL,
  
  -- Actor
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  
  -- Context
  comment TEXT,
  metadata TEXT,                     -- JSON: additional context
  
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX idx_workflow_history_doc ON workflow_history(document_id, timestamp DESC);
```

### TypeScript Types

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  collection?: string;
  isDefault: boolean;
  isActive: boolean;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
}

interface WorkflowStage {
  id: string;
  name: string;
  description?: string;
  order: number;
  type: 'draft' | 'review' | 'approval' | 'published';
  approvalType: 'any' | 'all' | 'sequential';
  requiredApprovers: string[];  // Roles or emails
  minApprovals: number;
  autoAdvance: boolean;
  autoAdvanceAfter?: number;    // Hours
}

interface WorkflowTransition {
  id: string;
  fromStageId: string;
  toStageId: string;
  type: 'advance' | 'reject' | 'skip';
  requiresComment: boolean;
  allowedRoles: string[];
}

interface DocumentWorkflowState {
  documentId: string;
  workflowId: string;
  currentStage: WorkflowStage;
  approvals: Approval[];
  rejections: Rejection[];
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

interface Approval {
  userId: string;
  email: string;
  at: number;
  comment?: string;
}
```

---

## Workflow Templates

### Default Workflow: Simple Review

```typescript
const simpleReviewWorkflow: WorkflowDefinition = {
  id: 'workflow_simple',
  name: 'Simple Review',
  description: 'Single review stage before publication',
  isDefault: true,
  isActive: true,
  stages: [
    {
      id: 'stage_draft',
      name: 'Draft',
      order: 1,
      type: 'draft',
      approvalType: 'any',
      requiredApprovers: [],
      minApprovals: 0,
      autoAdvance: false,
    },
    {
      id: 'stage_review',
      name: 'Review',
      order: 2,
      type: 'review',
      approvalType: 'any',
      requiredApprovers: ['editor', 'admin'],
      minApprovals: 1,
      autoAdvance: false,
    },
    {
      id: 'stage_published',
      name: 'Published',
      order: 3,
      type: 'published',
      approvalType: 'any',
      requiredApprovers: [],
      minApprovals: 0,
      autoAdvance: false,
    },
  ],
  transitions: [
    { id: 't1', fromStageId: 'stage_draft', toStageId: 'stage_review', type: 'advance', requiresComment: false, allowedRoles: ['author', 'editor', 'admin'] },
    { id: 't2', fromStageId: 'stage_review', toStageId: 'stage_published', type: 'advance', requiresComment: false, allowedRoles: ['editor', 'admin'] },
    { id: 't3', fromStageId: 'stage_review', toStageId: 'stage_draft', type: 'reject', requiresComment: true, allowedRoles: ['editor', 'admin'] },
    { id: 't4', fromStageId: 'stage_published', toStageId: 'stage_draft', type: 'reject', requiresComment: true, allowedRoles: ['admin'] },
  ],
};
```

### Compliance Workflow: Multi-Stage Approval

```typescript
const complianceWorkflow: WorkflowDefinition = {
  id: 'workflow_compliance',
  name: 'Compliance Review',
  description: 'Multi-stage review for compliance documentation',
  collection: 'compliance-controls',
  isDefault: false,
  isActive: true,
  stages: [
    {
      id: 'stage_draft',
      name: 'Draft',
      order: 1,
      type: 'draft',
      approvalType: 'any',
      requiredApprovers: [],
      minApprovals: 0,
      autoAdvance: false,
    },
    {
      id: 'stage_internal',
      name: 'Internal Review',
      order: 2,
      type: 'review',
      approvalType: 'any',
      requiredApprovers: ['compliance-team'],
      minApprovals: 1,
      autoAdvance: false,
    },
    {
      id: 'stage_legal',
      name: 'Legal Review',
      order: 3,
      type: 'approval',
      approvalType: 'all',
      requiredApprovers: ['legal@esolia.co.jp', 'compliance-officer'],
      minApprovals: 2,
      autoAdvance: false,
    },
    {
      id: 'stage_final',
      name: 'Final Approval',
      order: 4,
      type: 'approval',
      approvalType: 'any',
      requiredApprovers: ['admin'],
      minApprovals: 1,
      autoAdvance: false,
    },
    {
      id: 'stage_published',
      name: 'Published',
      order: 5,
      type: 'published',
      approvalType: 'any',
      requiredApprovers: [],
      minApprovals: 0,
      autoAdvance: false,
    },
  ],
  transitions: [
    // Forward paths
    { id: 't1', fromStageId: 'stage_draft', toStageId: 'stage_internal', type: 'advance', requiresComment: false, allowedRoles: ['author', 'editor', 'admin'] },
    { id: 't2', fromStageId: 'stage_internal', toStageId: 'stage_legal', type: 'advance', requiresComment: false, allowedRoles: ['compliance-team', 'admin'] },
    { id: 't3', fromStageId: 'stage_legal', toStageId: 'stage_final', type: 'advance', requiresComment: false, allowedRoles: ['legal', 'compliance-officer', 'admin'] },
    { id: 't4', fromStageId: 'stage_final', toStageId: 'stage_published', type: 'advance', requiresComment: false, allowedRoles: ['admin'] },
    
    // Rejection paths
    { id: 'r1', fromStageId: 'stage_internal', toStageId: 'stage_draft', type: 'reject', requiresComment: true, allowedRoles: ['compliance-team', 'admin'] },
    { id: 'r2', fromStageId: 'stage_legal', toStageId: 'stage_internal', type: 'reject', requiresComment: true, allowedRoles: ['legal', 'compliance-officer', 'admin'] },
    { id: 'r3', fromStageId: 'stage_final', toStageId: 'stage_legal', type: 'reject', requiresComment: true, allowedRoles: ['admin'] },
    
    // Unpublish
    { id: 'r4', fromStageId: 'stage_published', toStageId: 'stage_draft', type: 'reject', requiresComment: true, allowedRoles: ['admin'] },
  ],
};
```

---

## API Design

### Workflow Service

```typescript
// lib/server/workflow.ts

export function createWorkflowService(
  db: D1Database,
  audit: AuditService,
  versions: VersionService
) {
  return {
    /**
     * Get available workflows
     */
    async getWorkflows(collection?: string): Promise<WorkflowDefinition[]> {
      const query = collection
        ? `SELECT * FROM workflow_definitions WHERE is_active = 1 AND (collection = ? OR collection IS NULL)`
        : `SELECT * FROM workflow_definitions WHERE is_active = 1`;
      
      const { results } = await db.prepare(query)
        .bind(...(collection ? [collection] : []))
        .all();
      
      // Load stages and transitions for each
      return Promise.all(results.map(async (row) => {
        const stages = await this.getStages(row.id);
        const transitions = await this.getTransitions(row.id);
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          collection: row.collection,
          isDefault: Boolean(row.is_default),
          isActive: Boolean(row.is_active),
          stages,
          transitions,
        };
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
      const state = await db.prepare(`
        SELECT 
          dws.*,
          ws.name as stage_name,
          ws.stage_type,
          ws.approval_type,
          ws.required_approvers,
          ws.min_approvals
        FROM document_workflow_state dws
        JOIN workflow_stages ws ON dws.current_stage_id = ws.id
        WHERE dws.document_id = ?
      `).bind(documentId).first();
      
      if (!state) return null;
      
      const workflow = await this.getWorkflow(state.workflow_id);
      const currentStage = workflow.stages.find(s => s.id === state.current_stage_id)!;
      const approvals = JSON.parse(state.approvals || '[]');
      const rejections = JSON.parse(state.rejections || '[]');
      
      // Determine available transitions for current user
      const availableTransitions = workflow.transitions.filter(t => {
        if (t.fromStageId !== state.current_stage_id) return false;
        
        // Check if user can trigger this transition
        return t.allowedRoles.some(role => 
          userRoles.includes(role) || role === userId
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
        workflowId: state.workflow_id,
        currentStage,
        approvals,
        rejections,
        enteredStageAt: state.entered_stage_at,
        deadline: state.deadline,
        availableTransitions,
        canCurrentUserApprove: canApprove,
        progress: {
          current: currentStage.order,
          total: workflow.stages.length,
          percentage: Math.round((currentStage.order / workflow.stages.length) * 100),
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
      const firstStage = workflow.stages.find(s => s.order === 1)!;
      
      await db.prepare(`
        INSERT INTO document_workflow_state (
          document_id, workflow_id, current_stage_id,
          approvals, rejections, entered_stage_at
        ) VALUES (?, ?, ?, '[]', '[]', ?)
      `).bind(documentId, workflowId, firstStage.id, Date.now()).run();
      
      // Record in history
      await this.recordHistory(documentId, null, firstStage.id, 'advance', context);
      
      // Audit log
      await audit.log({
        action: 'create',
        actionCategory: 'workflow',
        resourceType: 'document_workflow',
        resourceId: documentId,
        metadata: { workflowId, stageName: firstStage.name },
      }, context);
    },
    
    /**
     * Submit for review (advance to next stage)
     */
    async submit(
      documentId: string,
      comment?: string,
      context: AuditContext
    ): Promise<{ success: boolean; newStage?: WorkflowStage; error?: string }> {
      const state = await this.getState(documentId, context.actorId, []);
      if (!state) {
        return { success: false, error: 'Document has no workflow' };
      }
      
      // Find advance transition from current stage
      const transition = state.availableTransitions.find(t => t.type === 'advance');
      if (!transition) {
        return { success: false, error: 'No available transition' };
      }
      
      return this.executeTransition(documentId, transition.id, comment, context);
    },
    
    /**
     * Approve at current stage
     */
    async approve(
      documentId: string,
      comment?: string,
      context: AuditContext
    ): Promise<{ success: boolean; advanced?: boolean; newStage?: WorkflowStage; error?: string }> {
      const state = await this.getState(documentId, context.actorId, []);
      if (!state) {
        return { success: false, error: 'Document has no workflow' };
      }
      
      if (!state.canCurrentUserApprove) {
        return { success: false, error: 'User cannot approve at this stage' };
      }
      
      // Check if already approved
      const alreadyApproved = state.approvals.some(a => a.userId === context.actorId);
      if (alreadyApproved) {
        return { success: false, error: 'Already approved by this user' };
      }
      
      // Add approval
      const newApproval: Approval = {
        userId: context.actorId,
        email: context.actorEmail,
        at: Date.now(),
        comment,
      };
      
      const approvals = [...state.approvals, newApproval];
      
      await db.prepare(`
        UPDATE document_workflow_state
        SET approvals = ?
        WHERE document_id = ?
      `).bind(JSON.stringify(approvals), documentId).run();
      
      // Audit log
      await audit.log({
        action: 'approve',
        actionCategory: 'workflow',
        resourceType: 'document',
        resourceId: documentId,
        changeSummary: `Approved at ${state.currentStage.name}`,
        metadata: { stageId: state.currentStage.id, comment },
      }, context);
      
      // Check if stage requirements are met
      const requirementsMet = this.areRequirementsMet(
        state.currentStage,
        approvals
      );
      
      if (requirementsMet) {
        // Auto-advance to next stage
        const advanceTransition = state.availableTransitions.find(t => t.type === 'advance');
        if (advanceTransition) {
          const result = await this.executeTransition(
            documentId,
            advanceTransition.id,
            'Auto-advanced after approval requirements met',
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
      comment: string,  // Required for rejections
      context: AuditContext
    ): Promise<{ success: boolean; newStage?: WorkflowStage; error?: string }> {
      const state = await this.getState(documentId, context.actorId, []);
      if (!state) {
        return { success: false, error: 'Document has no workflow' };
      }
      
      // Find reject transition from current stage
      const transition = state.availableTransitions.find(t => t.type === 'reject');
      if (!transition) {
        return { success: false, error: 'No rejection path available' };
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
    ): Promise<{ success: boolean; newStage?: WorkflowStage; error?: string }> {
      const state = await this.getState(documentId, context.actorId, []);
      if (!state) {
        return { success: false, error: 'Document has no workflow' };
      }
      
      const transition = state.availableTransitions.find(t => t.id === transitionId);
      if (!transition) {
        return { success: false, error: 'Transition not available' };
      }
      
      if (transition.requiresComment && !comment) {
        return { success: false, error: 'Comment required for this transition' };
      }
      
      const workflow = await this.getWorkflow(state.workflowId);
      const newStage = workflow.stages.find(s => s.id === transition.toStageId)!;
      
      // Update workflow state
      await db.prepare(`
        UPDATE document_workflow_state
        SET 
          current_stage_id = ?,
          previous_stage_id = ?,
          approvals = '[]',
          rejections = CASE WHEN ? = 'reject' THEN ? ELSE '[]' END,
          entered_stage_at = ?
        WHERE document_id = ?
      `).bind(
        newStage.id,
        state.currentStage.id,
        transition.type,
        transition.type === 'reject' 
          ? JSON.stringify([{ userId: context.actorId, email: context.actorEmail, at: Date.now(), comment }])
          : '[]',
        Date.now(),
        documentId
      ).run();
      
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
      if (newStage.type === 'published') {
        const doc = await db.prepare(
          `SELECT content, title FROM documents WHERE id = ?`
        ).bind(documentId).first();
        
        if (doc) {
          await versions.create(documentId, {
            content: doc.content as string,
            contentFormat: 'html',
            title: doc.title as string,
            versionType: 'publish',
            versionLabel: 'Published',
            versionNotes: comment || 'Published via workflow',
          }, context);
        }
        
        // Update document status
        await db.prepare(`
          UPDATE documents SET status = 'published', published_at = ? WHERE id = ?
        `).bind(Date.now(), documentId).run();
      }
      
      // Audit log
      await audit.log({
        action: transition.type === 'advance' ? 'submit_review' : 'reject',
        actionCategory: 'workflow',
        resourceType: 'document',
        resourceId: documentId,
        changeSummary: `${transition.type === 'advance' ? 'Advanced' : 'Rejected'} from ${state.currentStage.name} to ${newStage.name}`,
        metadata: { fromStage: state.currentStage.id, toStage: newStage.id, comment },
      }, context);
      
      // Send notifications
      await this.sendNotifications(documentId, newStage, transition.type, context);
      
      return { success: true, newStage };
    },
    
    /**
     * Get workflow history for document
     */
    async getHistory(documentId: string): Promise<WorkflowHistoryEntry[]> {
      const { results } = await db.prepare(`
        SELECT 
          wh.*,
          ws_from.name as from_stage_name,
          ws_to.name as to_stage_name
        FROM workflow_history wh
        LEFT JOIN workflow_stages ws_from ON wh.from_stage_id = ws_from.id
        JOIN workflow_stages ws_to ON wh.to_stage_id = ws_to.id
        WHERE wh.document_id = ?
        ORDER BY wh.timestamp DESC
      `).bind(documentId).all();
      
      return results.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        fromStageName: row.from_stage_name,
        toStageName: row.to_stage_name,
        transitionType: row.transition_type,
        actorEmail: row.actor_email,
        comment: row.comment,
      }));
    },
    
    // Helper methods
    async getWorkflow(id: string): Promise<WorkflowDefinition> {
      // Implementation...
    },
    
    async getStages(workflowId: string): Promise<WorkflowStage[]> {
      // Implementation...
    },
    
    async getTransitions(workflowId: string): Promise<WorkflowTransition[]> {
      // Implementation...
    },
    
    canUserApprove(
      stage: WorkflowStage,
      userId: string,
      userRoles: string[],
      existingApprovals: Approval[]
    ): boolean {
      if (stage.type !== 'review' && stage.type !== 'approval') {
        return false;
      }
      
      const alreadyApproved = existingApprovals.some(a => a.userId === userId);
      if (alreadyApproved) return false;
      
      // Check if user matches required approvers
      return stage.requiredApprovers.some(approver => 
        userRoles.includes(approver) || approver === userId
      );
    },
    
    areRequirementsMet(stage: WorkflowStage, approvals: Approval[]): boolean {
      if (stage.type === 'draft') return true;
      if (stage.type === 'published') return true;
      
      if (stage.approvalType === 'any') {
        return approvals.length >= stage.minApprovals;
      }
      
      if (stage.approvalType === 'all') {
        // All required approvers must approve
        return stage.requiredApprovers.every(approver =>
          approvals.some(a => a.email === approver || a.userId === approver)
        );
      }
      
      return approvals.length >= stage.minApprovals;
    },
    
    async recordHistory(
      documentId: string,
      fromStageId: string | null,
      toStageId: string,
      transitionType: string,
      context: AuditContext,
      comment?: string
    ): Promise<void> {
      await db.prepare(`
        INSERT INTO workflow_history (
          id, document_id, timestamp,
          from_stage_id, to_stage_id, transition_type,
          actor_id, actor_email, comment
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        documentId,
        Date.now(),
        fromStageId,
        toStageId,
        transitionType,
        context.actorId,
        context.actorEmail,
        comment || null
      ).run();
    },
    
    async sendNotifications(
      documentId: string,
      stage: WorkflowStage,
      transitionType: string,
      context: AuditContext
    ): Promise<void> {
      // Implementation: send emails, Slack notifications, etc.
    },
  };
}
```

---

## UI Components

### Workflow Status Bar

```svelte
<!-- lib/components/workflow/WorkflowStatusBar.svelte -->
<script lang="ts">
  import { 
    Circle, CheckCircle, Clock, AlertCircle, 
    ChevronRight, Send, XCircle 
  } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  
  interface Props {
    state: DocumentWorkflowState;
    onSubmit: () => void;
    onApprove: () => void;
    onReject: () => void;
  }
  
  let { state, onSubmit, onApprove, onReject }: Props = $props();
  
  const stageIcons = {
    draft: Circle,
    review: Clock,
    approval: AlertCircle,
    published: CheckCircle,
  };
</script>

<div class="workflow-status-bar">
  <div class="current-stage">
    <svelte:component 
      this={stageIcons[state.currentStage.type]} 
      class="w-5 h-5 {state.currentStage.type === 'published' ? 'text-green-500' : 'text-blue-500'}"
    />
    <span class="stage-name">{state.currentStage.name}</span>
  </div>
  
  <div class="progress-indicator">
    <span class="progress-text">
      Step {state.progress.current} of {state.progress.total}
    </span>
    <div class="progress-bar">
      <div 
        class="progress-fill"
        style="width: {state.progress.percentage}%"
      ></div>
    </div>
  </div>
  
  <div class="actions">
    {#if state.currentStage.type === 'draft'}
      <Button onclick={onSubmit} size="sm">
        <Send class="w-4 h-4 mr-1" />
        Submit for Review
      </Button>
    {:else if state.canCurrentUserApprove}
      <Button variant="outline" onclick={onReject} size="sm">
        <XCircle class="w-4 h-4 mr-1" />
        Request Changes
      </Button>
      <Button onclick={onApprove} size="sm">
        <CheckCircle class="w-4 h-4 mr-1" />
        Approve
      </Button>
    {:else if state.currentStage.type !== 'published'}
      <span class="waiting-text">Waiting for approval...</span>
    {/if}
  </div>
</div>

<style>
  .workflow-status-bar {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 1rem;
    background: var(--color-bg-surface);
    border-bottom: 1px solid var(--color-border);
  }
  
  .current-stage {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .stage-name {
    font-weight: 600;
  }
  
  .progress-indicator {
    flex: 1;
    max-width: 200px;
  }
  
  .progress-text {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    display: block;
    margin-bottom: 0.25rem;
  }
  
  .progress-bar {
    height: 4px;
    background: var(--color-bg-muted);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.3s ease;
  }
  
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }
  
  .waiting-text {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
```

### Workflow Stage Visualization

```svelte
<!-- lib/components/workflow/WorkflowStages.svelte -->
<script lang="ts">
  interface Props {
    stages: WorkflowStage[];
    currentStageId: string;
    history?: WorkflowHistoryEntry[];
  }
  
  let { stages, currentStageId, history = [] }: Props = $props();
  
  function getStageStatus(stage: WorkflowStage): 'completed' | 'current' | 'upcoming' {
    const currentIndex = stages.findIndex(s => s.id === currentStageId);
    const stageIndex = stages.findIndex(s => s.id === stage.id);
    
    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) return 'current';
    return 'upcoming';
  }
</script>

<div class="workflow-stages">
  {#each stages as stage, index (stage.id)}
    {@const status = getStageStatus(stage)}
    
    <div class="stage" class:completed={status === 'completed'} class:current={status === 'current'}>
      <div class="stage-indicator">
        {#if status === 'completed'}
          <CheckCircle class="w-6 h-6 text-green-500" />
        {:else if status === 'current'}
          <div class="current-dot"></div>
        {:else}
          <div class="upcoming-dot"></div>
        {/if}
      </div>
      
      <div class="stage-content">
        <span class="stage-name">{stage.name}</span>
        {#if stage.description}
          <span class="stage-description">{stage.description}</span>
        {/if}
      </div>
    </div>
    
    {#if index < stages.length - 1}
      <div class="connector" class:active={status === 'completed'}></div>
    {/if}
  {/each}
</div>

<style>
  .workflow-stages {
    display: flex;
    align-items: flex-start;
    gap: 0;
    padding: 1rem;
  }
  
  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 100px;
    text-align: center;
  }
  
  .stage-indicator {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
  }
  
  .current-dot {
    width: 1rem;
    height: 1rem;
    background: var(--color-primary);
    border-radius: 9999px;
    animation: pulse 2s infinite;
  }
  
  .upcoming-dot {
    width: 0.75rem;
    height: 0.75rem;
    background: var(--color-border);
    border-radius: 9999px;
  }
  
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0); }
  }
  
  .stage-name {
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .stage.completed .stage-name {
    color: var(--color-text-muted);
  }
  
  .stage-description {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  
  .connector {
    flex: 1;
    height: 2px;
    background: var(--color-border);
    margin-top: 1rem;
    min-width: 2rem;
  }
  
  .connector.active {
    background: var(--color-primary);
  }
</style>
```

---

## Implementation Notes

### Parallel Approvals

For stages with `approvalType: 'all'`, multiple approvers can approve in any order:

```typescript
// All three must approve, order doesn't matter
{
  approvalType: 'all',
  requiredApprovers: ['legal@esolia.co.jp', 'compliance@esolia.co.jp', 'cfo@esolia.co.jp'],
  minApprovals: 3,
}
```

### Sequential Approvals

For sensitive content, require specific approval order:

```typescript
{
  approvalType: 'sequential',
  requiredApprovers: ['manager', 'director', 'vp'],  // Must approve in this order
}
```

Implementation tracks which approver is "active":

```typescript
function getNextRequiredApprover(stage: WorkflowStage, approvals: Approval[]): string | null {
  if (stage.approvalType !== 'sequential') return null;
  
  const approvedBy = new Set(approvals.map(a => a.userId));
  
  for (const approver of stage.requiredApprovers) {
    if (!approvedBy.has(approver)) {
      return approver;
    }
  }
  
  return null;  // All approved
}
```

### Deadline Enforcement

Optional deadline tracking with notifications:

```typescript
// When entering a review stage
await db.prepare(`
  UPDATE document_workflow_state
  SET deadline = ?
  WHERE document_id = ?
`).bind(
  Date.now() + (48 * 60 * 60 * 1000),  // 48 hours
  documentId
).run();

// Cron job to check deadlines
export async function checkDeadlines(db: D1Database) {
  const { results } = await db.prepare(`
    SELECT document_id, deadline, current_stage_id
    FROM document_workflow_state
    WHERE deadline IS NOT NULL AND deadline < ?
  `).bind(Date.now()).all();
  
  for (const doc of results) {
    await sendDeadlineWarning(doc.document_id);
  }
}
```

---

## Testing Strategy

```typescript
describe('WorkflowService', () => {
  it('initializes document with first stage', async () => {
    await workflow.initialize(docId, 'workflow_simple', context);
    const state = await workflow.getState(docId, userId, []);
    
    expect(state?.currentStage.order).toBe(1);
    expect(state?.currentStage.type).toBe('draft');
  });
  
  it('advances to next stage on submit', async () => {
    await workflow.initialize(docId, 'workflow_simple', context);
    await workflow.submit(docId, undefined, context);
    
    const state = await workflow.getState(docId, userId, []);
    expect(state?.currentStage.order).toBe(2);
  });
  
  it('requires all approvers for approval_type=all', async () => {
    await workflow.initialize(docId, 'workflow_compliance', context);
    
    // Advance to legal review
    await workflow.submit(docId, undefined, context);
    await workflow.approve(docId, undefined, { ...context, actorEmail: 'reviewer@esolia.co.jp' });
    
    // Legal review requires two approvers
    const state1 = await workflow.getState(docId, userId, ['legal']);
    expect(state1?.currentStage.name).toBe('Legal Review');
    
    await workflow.approve(docId, undefined, { ...context, actorEmail: 'legal@esolia.co.jp' });
    
    // Still waiting for second approver
    const state2 = await workflow.getState(docId, userId, []);
    expect(state2?.currentStage.name).toBe('Legal Review');
    
    await workflow.approve(docId, undefined, { ...context, actorEmail: 'compliance@esolia.co.jp' });
    
    // Now advances
    const state3 = await workflow.getState(docId, userId, []);
    expect(state3?.currentStage.name).toBe('Final Approval');
  });
  
  it('requires comment for rejection', async () => {
    await workflow.initialize(docId, 'workflow_simple', context);
    await workflow.submit(docId, undefined, context);
    
    const result = await workflow.reject(docId, '', context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Comment required');
  });
});
```

---

## Related Documents

- [01-audit-system.md](./01-audit-system.md) — All workflow transitions are audited
- [02-version-control.md](./02-version-control.md) — Publish creates version snapshot
- [06-scheduled-publishing.md](./06-scheduled-publishing.md) — Schedule for future publication

---

*Document version: 1.0*
