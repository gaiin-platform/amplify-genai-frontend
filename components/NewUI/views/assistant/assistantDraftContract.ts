/**
 * assistantDraftContract.ts
 *
 * Typed, Zod-validated contract for AI-produced assistant draft patches.
 *
 * Design rules (from NEW_UI_GUIDE.md / Phase-0 plan):
 *   • AI output is pure data. It CANNOT nominate service calls or actions.
 *   • Every suggested value is validated against currently permitted options.
 *   • Fields modified by the user after a request began are NEVER overwritten.
 *   • Creation is always an explicit user action via the existing save pipeline.
 *
 * Import Zod (already in package.json) only. No React, no service imports.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Field identifiers
// ─────────────────────────────────────────────────────────────────────────────

export const ASSISTANT_DRAFT_FIELDS = [
  'name',
  'description',
  'instructions',
  'disclaimer',
  'tags',
  'conversationTags',
  'enforceModel',
  'enforcedModelId',
  'accessType',
  'managedAccess',
  'groupId',
  'dataSourceSuggestions',
  'skillSuggestions',
  'integrationSuggestions',
  'emailEventSuggestion',
] as const;

export type AssistantDraftField = (typeof ASSISTANT_DRAFT_FIELDS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// 2. Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const ManagedAccessSchema = z.object({
  visibility: z.enum(['public', 'specific']),
  slug: z.string().max(128).optional(),
  emails: z.array(z.string().email()).max(200).optional(),
});

const DataSourceSuggestionSchema = z.object({
  id: z.string().max(256).optional(),
  label: z.string().min(1).max(256),
  reason: z.string().max(512).optional(),
});

const IdReasonSchema = z.object({
  id: z.string().min(1).max(256),
  reason: z.string().max(512).optional(),
});

const EmailEventSuggestionSchema = z.object({
  enabled: z.boolean(),
  tag: z.string().max(128).optional(),
  systemPrompt: z.string().max(4096).optional(),
  userPrompt: z.string().max(4096).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Changes schema — every key is optional, no extra keys allowed
// ─────────────────────────────────────────────────────────────────────────────

const AssistantDraftChangesSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  instructions: z.string().max(32768).optional(),
  disclaimer: z.string().max(2000).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  conversationTags: z.array(z.string().max(100)).max(50).optional(),
  enforceModel: z.boolean().optional(),
  enforcedModelId: z.string().max(256).nullable().optional(),
  accessType: z.enum(['private', 'managed', 'collaborative']).optional(),
  managedAccess: ManagedAccessSchema.optional(),
  groupId: z.string().max(256).nullable().optional(),
  dataSourceSuggestions: z.array(DataSourceSuggestionSchema).max(20).optional(),
  skillSuggestions: z.array(IdReasonSchema).max(20).optional(),
  integrationSuggestions: z.array(IdReasonSchema).max(20).optional(),
  emailEventSuggestion: EmailEventSuggestionSchema.optional(),
}).strict(); // reject unknown keys — prevents action-bearing fields slipping in

// ─────────────────────────────────────────────────────────────────────────────
// 4. Root patch schema
// ─────────────────────────────────────────────────────────────────────────────

const AssistantDraftPatchSchema = z.object({
  version: z.literal(1),
  requestId: z.string().min(1).max(128),
  rationale: z.string().max(1024).optional(),
  changes: AssistantDraftChangesSchema,
}).strict();

export type AssistantDraftPatch = z.infer<typeof AssistantDraftPatchSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 5. Per-field provenance tracking
// ─────────────────────────────────────────────────────────────────────────────

export interface DraftFieldMeta {
  /** Last value applied by AI (may differ from current form state if user edited) */
  aiValue: unknown;
  /** Value before the last AI patch was applied */
  previousValue: unknown;
  /** Whether this field passed validation when the patch was applied */
  valid: boolean;
  /** Validation error message (when valid = false) */
  validationError?: string;
  /** ISO timestamp of last AI patch for this field */
  aiPatchedAt: string;
  /** ISO timestamp of last user edit (undefined if never edited by user) */
  userEditedAt?: string;
}

// A map from field name to its provenance metadata
export type DraftProvenanceMap = Partial<Record<AssistantDraftField, DraftFieldMeta>>;

// ─────────────────────────────────────────────────────────────────────────────
// 6. Parse result
// ─────────────────────────────────────────────────────────────────────────────

export type ParseDraftResult =
  | { ok: true; patch: AssistantDraftPatch }
  | { ok: false; errors: string[] };

// ─────────────────────────────────────────────────────────────────────────────
// 7. Normalization helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a raw string value from the model: trim, collapse internal whitespace.
 * Returns undefined when the result is empty so the field is treated as absent.
 */
function normalizeString(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const trimmed = v.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalize a tags array: trim entries, deduplicate, drop empty strings.
 */
function normalizeTags(v: string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  const deduped = Array.from(new Set(v.map((t) => t.trim()).filter(Boolean)));
  return deduped.length > 0 ? deduped : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Main parse + validate function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse raw model output (a string or pre-parsed object) into a typed, validated
 * AssistantDraftPatch.
 *
 * Steps:
 *   1. JSON-parse if given a string
 *   2. Reject obviously action-bearing shapes (arrays, primitives)
 *   3. Run Zod validation
 *   4. Normalize string fields
 *   5. Return ok:true with normalized patch, or ok:false with human-readable errors
 *
 * SECURITY: This function must never execute, eval, or import any content from the
 * model output. It only validates and normalises data.
 */
export function parseAssistantDraftPatch(raw: unknown): ParseDraftResult {
  // Step 1: Parse JSON string
  let candidate: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // Find the first JSON object in the string (model may wrap it in prose)
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
      return { ok: false, errors: ['No JSON object found in model output'] };
    }
    const jsonSlice = trimmed.slice(jsonStart, jsonEnd + 1);
    try {
      candidate = JSON.parse(jsonSlice);
    } catch {
      return { ok: false, errors: ['Model output is not valid JSON'] };
    }
  }

  // Step 2: Reject non-objects
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return { ok: false, errors: ['Draft patch must be a plain JSON object'] };
  }

  // Step 3: Zod validation (strict: rejects unknown keys)
  const result = AssistantDraftPatchSchema.safeParse(candidate);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return { ok: false, errors };
  }

  // Step 4: Normalize string fields
  const p = result.data;
  const c = p.changes;

  const normalized: AssistantDraftPatch = {
    ...p,
    changes: {
      ...c,
      ...(c.name !== undefined && { name: normalizeString(c.name) }),
      ...(c.description !== undefined && { description: normalizeString(c.description) }),
      ...(c.instructions !== undefined && { instructions: c.instructions.trim() || undefined }),
      ...(c.disclaimer !== undefined && { disclaimer: normalizeString(c.disclaimer) }),
      ...(c.tags !== undefined && { tags: normalizeTags(c.tags) }),
      ...(c.conversationTags !== undefined && { conversationTags: normalizeTags(c.conversationTags) }),
    },
  };

  // Remove undefined keys introduced by normalisation (keeps the object clean)
  cleanUndefined(normalized.changes);

  return { ok: true, patch: normalized };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Permission/flag filtering
// ─────────────────────────────────────────────────────────────────────────────

export interface DraftFilterOptions {
  /** Whether assistantPathPublishing feature flag is enabled */
  allowManagedAccess: boolean;
  /** Whether assistantAdminInterface feature flag is enabled */
  allowTeamAccess: boolean;
  /** IDs of models currently permitted for selection */
  permittedModelIds: string[];
  /** IDs of data sources currently available */
  permittedSourceIds: string[];
  /** IDs of skills currently available */
  permittedSkillIds: string[];
  /** IDs of integrations currently available */
  permittedIntegrationIds: string[];
  /** Whether websiteUrls feature flag is enabled */
  allowWebsiteUrls: boolean;
  /** Whether email events feature flag is enabled */
  allowEmailEvents: boolean;
}

/**
 * Filter an already-validated patch to remove any suggestions that exceed the
 * caller's current permissions or feature flags.
 *
 * This is intentionally separate from parsing so tests can verify filtering
 * independently of schema validation.
 */
export function filterDraftPatch(
  patch: AssistantDraftPatch,
  opts: DraftFilterOptions
): AssistantDraftPatch {
  const c = { ...patch.changes };

  // Access type: strip disallowed options
  if (c.accessType === 'managed' && !opts.allowManagedAccess) {
    delete c.accessType;
    delete c.managedAccess;
  }
  if (c.accessType === 'collaborative' && !opts.allowTeamAccess) {
    delete c.accessType;
    delete c.groupId;
  }

  // Group: strip if team access not allowed
  if (!opts.allowTeamAccess) {
    delete c.groupId;
  }

  // Model enforcement: validate against permitted models
  if (c.enforcedModelId !== undefined && c.enforcedModelId !== null) {
    if (!opts.permittedModelIds.includes(c.enforcedModelId)) {
      delete c.enforcedModelId;
      delete c.enforceModel;
    }
  }

  // Data source suggestions: keep only those with known IDs
  if (c.dataSourceSuggestions) {
    c.dataSourceSuggestions = c.dataSourceSuggestions.filter(
      (s) => !s.id || opts.permittedSourceIds.includes(s.id)
    );
    if (c.dataSourceSuggestions.length === 0) delete c.dataSourceSuggestions;
  }

  // Skill suggestions
  if (c.skillSuggestions) {
    c.skillSuggestions = c.skillSuggestions.filter((s) =>
      opts.permittedSkillIds.includes(s.id)
    );
    if (c.skillSuggestions.length === 0) delete c.skillSuggestions;
  }

  // Integration suggestions
  if (c.integrationSuggestions) {
    c.integrationSuggestions = c.integrationSuggestions.filter((s) =>
      opts.permittedIntegrationIds.includes(s.id)
    );
    if (c.integrationSuggestions.length === 0) delete c.integrationSuggestions;
  }

  // Email event suggestions
  if (c.emailEventSuggestion && !opts.allowEmailEvents) {
    delete c.emailEventSuggestion;
  }

  return { ...patch, changes: c };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Stale-response guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the subset of changes from `patch` that are safe to apply, given:
 *   • `fieldEditTimes`: a map of fields edited by the user AFTER the request began
 *   • `requestIssuedAt`: ISO timestamp when this request was sent
 *
 * Fields with user edits after requestIssuedAt are excluded to prevent overwriting
 * the user's work.
 */
export function safeChangesToApply(
  patch: AssistantDraftPatch,
  fieldEditTimes: Partial<Record<AssistantDraftField, string>>,
  requestIssuedAt: string
): Partial<AssistantDraftPatch['changes']> {
  const requestTime = new Date(requestIssuedAt).getTime();
  const safe: Partial<AssistantDraftPatch['changes']> = {};

  for (const key of Object.keys(patch.changes) as AssistantDraftField[]) {
    const userEditIso = fieldEditTimes[key];
    if (userEditIso && new Date(userEditIso).getTime() > requestTime) {
      // User edited this field after the request was issued — skip it
      continue;
    }
    (safe as Record<string, unknown>)[key] = (patch.changes as Record<string, unknown>)[key];
  }

  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function cleanUndefined(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) {
      delete obj[key];
    }
  }
}
