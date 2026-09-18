/**
 * assistantDraftContract.test.ts
 *
 * Unit tests for the AI assistant draft patch contract.
 * Covers: parsing, normalization, permission filtering, and stale-response guard.
 */

import { describe, it, expect } from 'vitest';
import {
  parseAssistantDraftPatch,
  filterDraftPatch,
  safeChangesToApply,
  type AssistantDraftPatch,
  type DraftFilterOptions,
} from '../assistantDraftContract';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_PATCH: AssistantDraftPatch = {
  version: 1,
  requestId: 'req-001',
  changes: {
    name: 'My Assistant',
    description: 'Helps with tasks.',
  },
};

const FULL_OPTS: DraftFilterOptions = {
  allowManagedAccess: true,
  allowTeamAccess: true,
  permittedModelIds: ['model-a', 'model-b'],
  permittedSourceIds: ['src-1', 'src-2'],
  permittedSkillIds: ['skill-x'],
  permittedIntegrationIds: ['int-y'],
  allowWebsiteUrls: true,
  allowEmailEvents: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. parseAssistantDraftPatch
// ─────────────────────────────────────────────────────────────────────────────

describe('parseAssistantDraftPatch', () => {
  it('accepts a valid minimal patch object', () => {
    const r = parseAssistantDraftPatch(VALID_PATCH);
    expect(r.ok).toBe(true);
  });

  it('accepts a valid minimal patch as a JSON string', () => {
    const r = parseAssistantDraftPatch(JSON.stringify(VALID_PATCH));
    expect(r.ok).toBe(true);
  });

  it('extracts JSON when model wraps it in prose', () => {
    const prose = `Here is the patch you requested:\n${JSON.stringify(VALID_PATCH)}\nLet me know if you need changes.`;
    const r = parseAssistantDraftPatch(prose);
    expect(r.ok).toBe(true);
  });

  it('rejects a patch missing the version field', () => {
    const bad = { requestId: 'r1', changes: {} };
    const r = parseAssistantDraftPatch(bad);
    expect(r.ok).toBe(false);
  });

  it('rejects version !== 1', () => {
    const bad = { version: 2, requestId: 'r1', changes: {} };
    const r = parseAssistantDraftPatch(bad);
    expect(r.ok).toBe(false);
  });

  it('rejects an array', () => {
    const r = parseAssistantDraftPatch([VALID_PATCH]);
    expect(r.ok).toBe(false);
  });

  it('rejects a primitive', () => {
    const r = parseAssistantDraftPatch('not json');
    expect(r.ok).toBe(false);
  });

  it('rejects null', () => {
    const r = parseAssistantDraftPatch(null);
    expect(r.ok).toBe(false);
  });

  it('rejects unknown keys in changes (strict mode)', () => {
    const bad = {
      version: 1,
      requestId: 'r1',
      changes: { name: 'X', createAssistant: true }, // action-bearing key
    };
    const r = parseAssistantDraftPatch(bad);
    expect(r.ok).toBe(false);
  });

  it('rejects action-bearing key at root level', () => {
    const bad = {
      version: 1,
      requestId: 'r1',
      action: 'createAssistant', // must not be allowed
      changes: {},
    };
    const r = parseAssistantDraftPatch(bad);
    expect(r.ok).toBe(false);
  });

  it('normalizes string whitespace', () => {
    const r = parseAssistantDraftPatch({
      version: 1,
      requestId: 'r1',
      changes: { name: '  My   Assistant  ' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.changes.name).toBe('My Assistant');
    }
  });

  it('removes whitespace-only names after normalization (field becomes absent)', () => {
    const r = parseAssistantDraftPatch({
      version: 1,
      requestId: 'r1',
      changes: { name: '   ' }, // only whitespace
    });
    // Zod validates the raw '   ' (length 3) as ok; normalisation strips it to
    // undefined and cleanUndefined removes the key. Parse result is ok:true with
    // name absent — callers treat absent as "no change to this field."
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.changes.name).toBeUndefined();
    }
  });

  it('deduplicates tags', () => {
    const r = parseAssistantDraftPatch({
      version: 1,
      requestId: 'r1',
      changes: { tags: ['a', 'a', 'b', ' a '] },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.changes.tags).toEqual(['a', 'b']);
    }
  });

  it('validates email addresses in managedAccess.emails', () => {
    const r = parseAssistantDraftPatch({
      version: 1,
      requestId: 'r1',
      changes: {
        accessType: 'managed',
        managedAccess: { visibility: 'specific', emails: ['notanemail'] },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts valid managedAccess', () => {
    const r = parseAssistantDraftPatch({
      version: 1,
      requestId: 'r1',
      changes: {
        accessType: 'managed',
        managedAccess: {
          visibility: 'specific',
          emails: ['user@example.com'],
          slug: 'my-assistant',
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('accepts collaborative with groupId', () => {
    const r = parseAssistantDraftPatch({
      version: 1,
      requestId: 'r1',
      changes: {
        accessType: 'collaborative',
        groupId: 'grp-123',
      },
    });
    expect(r.ok).toBe(true);
  });

  it('accepts a full valid patch', () => {
    const r = parseAssistantDraftPatch({
      version: 1,
      requestId: 'req-full',
      rationale: 'User wants a coding assistant.',
      changes: {
        name: 'Code Helper',
        description: 'A helpful coding assistant.',
        instructions: 'You are an expert programmer.',
        disclaimer: 'Verify code before running.',
        tags: ['code', 'dev'],
        conversationTags: ['programming'],
        enforceModel: true,
        enforcedModelId: 'model-a',
        dataSourceSuggestions: [{ id: 'src-1', label: 'Codebase', reason: 'Relevant' }],
        skillSuggestions: [{ id: 'skill-x', reason: 'Useful' }],
        integrationSuggestions: [{ id: 'int-y' }],
        emailEventSuggestion: {
          enabled: true,
          tag: 'coding-help',
          systemPrompt: 'You are an expert.',
          userPrompt: 'Please assist.',
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. filterDraftPatch
// ─────────────────────────────────────────────────────────────────────────────

describe('filterDraftPatch', () => {
  it('passes through a compliant patch unchanged', () => {
    const r = filterDraftPatch(VALID_PATCH, FULL_OPTS);
    expect(r.changes).toEqual(VALID_PATCH.changes);
  });

  it('strips managed accessType when allowManagedAccess is false', () => {
    const patch: AssistantDraftPatch = {
      ...VALID_PATCH,
      changes: {
        accessType: 'managed',
        managedAccess: { visibility: 'public' },
      },
    };
    const r = filterDraftPatch(patch, { ...FULL_OPTS, allowManagedAccess: false });
    expect(r.changes.accessType).toBeUndefined();
    expect(r.changes.managedAccess).toBeUndefined();
  });

  it('strips collaborative accessType when allowTeamAccess is false', () => {
    const patch: AssistantDraftPatch = {
      ...VALID_PATCH,
      changes: { accessType: 'collaborative', groupId: 'g1' },
    };
    const r = filterDraftPatch(patch, { ...FULL_OPTS, allowTeamAccess: false });
    expect(r.changes.accessType).toBeUndefined();
    expect(r.changes.groupId).toBeUndefined();
  });

  it('strips groupId when allowTeamAccess is false even without accessType', () => {
    const patch: AssistantDraftPatch = {
      ...VALID_PATCH,
      changes: { groupId: 'g1' },
    };
    const r = filterDraftPatch(patch, { ...FULL_OPTS, allowTeamAccess: false });
    expect(r.changes.groupId).toBeUndefined();
  });

  it('strips enforcedModelId when model is not in permitted list', () => {
    const patch: AssistantDraftPatch = {
      ...VALID_PATCH,
      changes: { enforceModel: true, enforcedModelId: 'model-forbidden' },
    };
    const r = filterDraftPatch(patch, FULL_OPTS);
    expect(r.changes.enforcedModelId).toBeUndefined();
    expect(r.changes.enforceModel).toBeUndefined();
  });

  it('keeps enforcedModelId when model is permitted', () => {
    const patch: AssistantDraftPatch = {
      ...VALID_PATCH,
      changes: { enforceModel: true, enforcedModelId: 'model-a' },
    };
    const r = filterDraftPatch(patch, FULL_OPTS);
    expect(r.changes.enforcedModelId).toBe('model-a');
  });

  it('filters data source suggestions to known IDs', () => {
    const patch: AssistantDraftPatch = {
      ...VALID_PATCH,
      changes: {
        dataSourceSuggestions: [
          { id: 'src-1', label: 'Known' },
          { id: 'src-unknown', label: 'Unknown' },
        ],
      },
    };
    const r = filterDraftPatch(patch, FULL_OPTS);
    expect(r.changes.dataSourceSuggestions).toHaveLength(1);
    expect(r.changes.dataSourceSuggestions![0].id).toBe('src-1');
  });

  it('allows data source suggestions without an ID (user-provided new source)', () => {
    const patch: AssistantDraftPatch = {
      ...VALID_PATCH,
      changes: {
        dataSourceSuggestions: [{ label: 'Some website' }],
      },
    };
    const r = filterDraftPatch(patch, FULL_OPTS);
    expect(r.changes.dataSourceSuggestions).toHaveLength(1);
  });

  it('removes dataSourceSuggestions array when all entries are filtered', () => {
    const patch: AssistantDraftPatch = {
      ...VALID_PATCH,
      changes: {
        dataSourceSuggestions: [{ id: 'src-bad', label: 'Bad' }],
      },
    };
    const r = filterDraftPatch(patch, FULL_OPTS);
    expect(r.changes.dataSourceSuggestions).toBeUndefined();
  });

  it('strips skill suggestions for unknown skills', () => {
    const patch: AssistantDraftPatch = {
      ...VALID_PATCH,
      changes: { skillSuggestions: [{ id: 'skill-x' }, { id: 'skill-nope' }] },
    };
    const r = filterDraftPatch(patch, FULL_OPTS);
    expect(r.changes.skillSuggestions).toHaveLength(1);
  });

  it('strips email event suggestion when allowEmailEvents is false', () => {
    const patch: AssistantDraftPatch = {
      ...VALID_PATCH,
      changes: { emailEventSuggestion: { enabled: true } },
    };
    const r = filterDraftPatch(patch, { ...FULL_OPTS, allowEmailEvents: false });
    expect(r.changes.emailEventSuggestion).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. safeChangesToApply — stale-response guard
// ─────────────────────────────────────────────────────────────────────────────

describe('safeChangesToApply', () => {
  const t0 = '2024-01-01T10:00:00.000Z'; // request issued
  const t1 = '2024-01-01T10:00:05.000Z'; // user edit (after request)
  const t2 = '2024-01-01T09:59:00.000Z'; // user edit (before request)

  const patch: AssistantDraftPatch = {
    version: 1,
    requestId: 'req-stale',
    changes: {
      name: 'AI Name',
      description: 'AI Description',
      instructions: 'AI Instructions',
    },
  };

  it('applies all changes when user has not edited any fields', () => {
    const safe = safeChangesToApply(patch, {}, t0);
    expect(Object.keys(safe)).toEqual(['name', 'description', 'instructions']);
  });

  it('skips a field edited AFTER the request was issued', () => {
    const safe = safeChangesToApply(patch, { name: t1 }, t0);
    expect(safe.name).toBeUndefined();
    expect(safe.description).toBe('AI Description');
  });

  it('applies a field edited BEFORE the request was issued', () => {
    const safe = safeChangesToApply(patch, { name: t2 }, t0);
    expect(safe.name).toBe('AI Name');
  });

  it('skips multiple fields edited after the request', () => {
    const safe = safeChangesToApply(patch, { name: t1, instructions: t1 }, t0);
    expect(safe.name).toBeUndefined();
    expect(safe.instructions).toBeUndefined();
    expect(safe.description).toBe('AI Description');
  });

  it('returns an empty object when all fields were edited after the request', () => {
    const safe = safeChangesToApply(
      patch,
      { name: t1, description: t1, instructions: t1 },
      t0
    );
    expect(Object.keys(safe)).toHaveLength(0);
  });
});
