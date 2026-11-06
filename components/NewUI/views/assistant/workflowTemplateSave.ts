/**
 * What the assistant editor stores for a selected workflow template. React-free so it is
 * unit-testable. Mirrors the classic `AssistantModal` save (components/Promptbar/components/
 * AssistantModal.tsx, "removing workflow template" block).
 *
 * Two ids are involved:
 *   - `baseWorkflowTemplateId`  — the shared base template the user picked.
 *   - `workflowTemplateId`      — the assistant's OWN copy of it, with the user's choices
 *                                 applied (disabled segments, filled-in parameters).
 *
 * The backend runs `workflowTemplateId` and only falls back to the base id when it is
 * missing (userDefinedAssistants.js). Saving the base id as `workflowTemplateId` therefore
 * runs the unconfigured base template and discards every configurable step/parameter, and
 * on an already-configured assistant it overwrites the saved copy.
 */
import type { AstWorkflow } from '@/types/assistantWorkflows';

export type WorkflowSaveDecision =
  /** The user configured the workflow: register this as the assistant's own template. */
  | { kind: 'register'; workflow: AstWorkflow }
  /** Nothing changed: store this id as `workflowTemplateId`. */
  | { kind: 'keep'; workflowTemplateId: string }
  /** Saving now would lose configuration; show `message` and stop. */
  | { kind: 'blocked'; message: string };

export interface WorkflowSaveInput {
  /** The selected base template. The caller handles "none selected" itself. */
  baseWorkflowTemplateId: string;
  /** The assistant's own template id currently in the editor (cleared when the base changes). */
  astWorkflowTemplateId: string | undefined;
  /** `workflowTemplateId` as stored before this edit (undefined for a new assistant). */
  savedWorkflowTemplateId: string | undefined;
  /**
   * The template last reported by `AssistantWorkflowDisplay`: set while the user is
   * configuring (a first setup, or after "Edit Template"), `null` when just viewing.
   */
  currentWorkflowTemplate: AstWorkflow | null;
}

export function decideWorkflowTemplateSave({
  baseWorkflowTemplateId,
  astWorkflowTemplateId,
  savedWorkflowTemplateId,
  currentWorkflowTemplate,
}: WorkflowSaveInput): WorkflowSaveDecision {
  if (currentWorkflowTemplate?.template?.steps) {
    return { kind: 'register', workflow: currentWorkflowTemplate };
  }

  // The base template was switched, so the saved copy no longer applies, and the new
  // template's setup has not reported anything (still loading). Don't drop the config silently.
  if (!currentWorkflowTemplate && astWorkflowTemplateId !== savedWorkflowTemplateId) {
    return {
      kind: 'blocked',
      message: 'Please wait for the workflow template to finish loading, and confirm its settings, before saving the assistant.',
    };
  }

  return { kind: 'keep', workflowTemplateId: astWorkflowTemplateId ?? baseWorkflowTemplateId };
}
