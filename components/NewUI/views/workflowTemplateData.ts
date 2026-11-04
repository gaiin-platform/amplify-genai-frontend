/**
 * Pure helpers for the New UI Workflows view. React-free so they are unit-testable.
 *
 * `/list-workflow-templates` returns METADATA ONLY (name, description, schemas, flags and
 * owner), never the `template` body that holds the steps. Those come from
 * `/get-workflow-template`, one template at a time. The classic builder therefore loads a
 * template's steps when it is selected; reading `template.steps` off a list item always
 * gives nothing, which showed up as "0 steps" everywhere and empty previews.
 */
import type { AstWorkflow } from '@/types/assistantWorkflows';

const isTerminateStep = (step: { tool?: string; stepName?: string }): boolean =>
  step.tool === 'terminate' || step.stepName === 'done';

/** True once the template's steps have been fetched (a list item has none). */
export function hasLoadedSteps(workflow: AstWorkflow): boolean {
  return Array.isArray(workflow.template?.steps);
}

/** Number of real (non-terminate) steps, or `null` while they have not been fetched. */
export function knownStepCount(workflow: AstWorkflow): number | null {
  const steps = workflow.template?.steps;
  if (!Array.isArray(steps)) return null;
  return steps.filter((step) => !isTerminateStep(step)).length;
}

/**
 * Combine a list item with the full template from `/get-workflow-template`. The list item
 * contributes fields the full response lacks (e.g. `user`); the result always has a steps list.
 */
export function mergeFullTemplate(listed: AstWorkflow | undefined, full: AstWorkflow): AstWorkflow {
  return {
    ...(listed ?? {}),
    ...full,
    template: { ...(full.template ?? {}), steps: full.template?.steps ?? [] },
  } as AstWorkflow;
}

/** Replace the template with the same id; other items keep their identity. */
export function replaceTemplate(templates: AstWorkflow[], full: AstWorkflow): AstWorkflow[] {
  const index = templates.findIndex((t) => t.templateId === full.templateId);
  if (index === -1) return templates;
  const next = templates.slice();
  next[index] = mergeFullTemplate(templates[index], full);
  return next;
}
