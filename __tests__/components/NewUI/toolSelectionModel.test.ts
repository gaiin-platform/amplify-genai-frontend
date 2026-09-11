import { describe, it, expect } from 'vitest';
import {
    allCompositeFunctions,
    bindingsToDraft,
    buildBindings,
    capabilityCounts,
    inferSelectedComposites,
    isCompositeAvailable,
    matchesToolQuery,
    resolveOps,
    toAgentToolRow,
    toOpRow,
    toggleAgentTool,
    toggleComposite,
    toggleOp,
    withBindings,
    ToolSelectionState,
} from '@/components/NewUI/views/assistant/toolSelectionModel';
import { OpDef, Schema } from '@/types/op';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
//
// Op names are the real ones from utils/app/compositeFunctions, so the composite
// catalogue under test resolves against them. The subset pairs exercised below
// (draftEmail ⊂ sendEmail, readEmail ⊂ deleteEmail) exist in the real catalogue.
// ─────────────────────────────────────────────────────────────────────────────

const op = (name: string, over: Partial<OpDef> = {}): OpDef => ({
    id: `id-${name}`,
    name,
    url: `/ops/${name}`,
    method: 'POST',
    description: `${name} description`,
    type: 'http',
    parameters: { type: 'object', properties: {} },
    ...over,
});

const OUTLOOK_OPS = [
    op('microsoftListMessages'),
    op('microsoftGetMessageDetails'),
    op('microsoftDeleteMessage'),
    op('microsoftCreateDraft'),
    op('microsoftSendDraft'),
];

const composite = (id: string) => {
    const fn = allCompositeFunctions().find((f) => f.id === id);
    if (!fn) throw new Error(`fixture drift: composite "${id}" no longer exists`);
    return fn;
};

const empty: ToolSelectionState = { compositeIds: [], tools: [], builtInOperations: [] };

const names = (state: ToolSelectionState) => state.tools.map((t) => t.name).sort();

describe('composite catalogue', () => {
    it('flattens every category', () => {
        expect(allCompositeFunctions().length).toBeGreaterThan(20);
    });

    it('resolves only ops that actually exist', () => {
        const readEmail = composite('readEmail');
        expect(resolveOps(readEmail, OUTLOOK_OPS).map((o) => o.name).sort()).toEqual([
            'microsoftGetMessageDetails',
            'microsoftListMessages',
        ]);
    });

    /** Graceful degradation: ops that were never deployed must not be selectable. */
    it('is unavailable when none of its ops are deployed', () => {
        expect(isCompositeAvailable(composite('readEmail'), [])).toBe(false);
        expect(isCompositeAvailable(composite('readEmail'), [op('unrelatedOp')])).toBe(false);
        expect(isCompositeAvailable(composite('readEmail'), OUTLOOK_OPS)).toBe(true);
    });
});

describe('selection algebra — the four cases', () => {
    it('checking a composite appends its resolved ops', () => {
        const next = toggleComposite(empty, {
            fn: composite('readEmail'),
            checked: true,
            availableOps: OUTLOOK_OPS,
        });
        expect(next.compositeIds).toEqual(['readEmail']);
        expect(names(next)).toEqual(['microsoftGetMessageDetails', 'microsoftListMessages']);
    });

    it('two composites sharing an op do not duplicate it', () => {
        const first = toggleComposite(empty, {
            fn: composite('readEmail'),
            checked: true,
            availableOps: OUTLOOK_OPS,
        });
        const second = toggleComposite(first, {
            fn: composite('deleteEmail'),
            checked: true,
            availableOps: OUTLOOK_OPS,
        });
        expect(second.compositeIds).toEqual(['readEmail', 'deleteEmail']);
        // listMessages + getMessageDetails are in both; each appears once.
        expect(names(second)).toEqual([
            'microsoftDeleteMessage',
            'microsoftGetMessageDetails',
            'microsoftListMessages',
        ]);
    });

    /**
     * The rule from ApiIntegrationsPanel:117-128 — unticking must not strip ops
     * out from under a sibling the user never touched.
     */
    it('unchecking keeps ops another checked composite still needs', () => {
        let state = toggleComposite(empty, {
            fn: composite('readEmail'),
            checked: true,
            availableOps: OUTLOOK_OPS,
        });
        state = toggleComposite(state, {
            fn: composite('deleteEmail'),
            checked: true,
            availableOps: OUTLOOK_OPS,
        });
        state = toggleComposite(state, {
            fn: composite('deleteEmail'),
            checked: false,
            availableOps: OUTLOOK_OPS,
        });

        expect(state.compositeIds).toEqual(['readEmail']);
        // deleteMessage was only deleteEmail's — gone. The other two survive.
        expect(names(state)).toEqual(['microsoftGetMessageDetails', 'microsoftListMessages']);
    });

    it('unchecking the last composite removes all of its ops', () => {
        let state = toggleComposite(empty, {
            fn: composite('readEmail'),
            checked: true,
            availableOps: OUTLOOK_OPS,
        });
        state = toggleComposite(state, {
            fn: composite('readEmail'),
            checked: false,
            availableOps: OUTLOOK_OPS,
        });
        expect(state.compositeIds).toEqual([]);
        expect(state.tools).toEqual([]);
    });
});

describe('purity', () => {
    it('does not mutate the input state', () => {
        const before: ToolSelectionState = { compositeIds: [], tools: [], builtInOperations: [] };
        toggleComposite(before, { fn: composite('readEmail'), checked: true, availableOps: OUTLOOK_OPS });
        expect(before).toEqual({ compositeIds: [], tools: [], builtInOperations: [] });
    });

    /**
     * Guard for the batching bug: the old panel derived its next value from the
     * captured `selectedApis` prop and called the setter with a literal array, so
     * two toggles in one tick kept only the last. Applied in sequence to the same
     * input, both must survive.
     */
    it('two toggles applied in sequence both survive', () => {
        const draft = composite('draftEmail');
        const read = composite('readEmail');
        const state = toggleComposite(
            toggleComposite(empty, { fn: read, checked: true, availableOps: OUTLOOK_OPS }),
            { fn: draft, checked: true, availableOps: OUTLOOK_OPS },
        );
        expect(state.compositeIds.sort()).toEqual(['draftEmail', 'readEmail']);
        expect(names(state)).toEqual([
            'microsoftCreateDraft',
            'microsoftGetMessageDetails',
            'microsoftListMessages',
        ]);
    });
});

describe('inferSelectedComposites — edit-mode seed', () => {
    /**
     * draftEmail's ops (microsoftCreateDraft) are a strict subset of sendEmail's
     * (microsoftCreateDraft + microsoftSendDraft). A saved sendEmail must light up
     * sendEmail alone — otherwise unticking the phantom draftEmail would strip
     * createDraft out from under the real selection.
     */
    it('prefers the maximal composite over its subset', () => {
        const saved = resolveOps(composite('sendEmail'), OUTLOOK_OPS);
        const inferred = inferSelectedComposites(saved, OUTLOOK_OPS);
        expect(inferred).toContain('sendEmail');
        expect(inferred).not.toContain('draftEmail');
    });

    it('infers the subset when only the subset is saved', () => {
        const saved = resolveOps(composite('draftEmail'), OUTLOOK_OPS);
        const inferred = inferSelectedComposites(saved, OUTLOOK_OPS);
        expect(inferred).toContain('draftEmail');
        expect(inferred).not.toContain('sendEmail');
    });

    it('infers nothing when a composite is only partly saved', () => {
        // sendEmail needs both; only one is present.
        const inferred = inferSelectedComposites([op('microsoftSendDraft')], OUTLOOK_OPS);
        expect(inferred).not.toContain('sendEmail');
    });

    it('infers nothing from an empty tools list', () => {
        expect(inferSelectedComposites([], OUTLOOK_OPS)).toEqual([]);
    });

    /** An undeployed op must not block inference of the rest. */
    it('ignores ops that are not deployed', () => {
        const partialOps = [op('microsoftCreateDraft')]; // microsoftSendDraft not deployed
        const inferred = inferSelectedComposites([op('microsoftCreateDraft')], partialOps);
        expect(inferred).toContain('sendEmail');
    });
});

describe('single-row toggles', () => {
    it('adds and removes an op by id', () => {
        const added = toggleOp(empty, 'id-microsoftListMessages', true, OUTLOOK_OPS);
        expect(added.tools).toHaveLength(1);
        // The full OpDef is kept — url/method are what make it executable.
        expect(added.tools[0].url).toBe('/ops/microsoftListMessages');
        expect(added.tools[0].method).toBe('POST');

        const removed = toggleOp(added, 'id-microsoftListMessages', false, OUTLOOK_OPS);
        expect(removed.tools).toEqual([]);
    });

    it('ignores an unknown op id', () => {
        expect(toggleOp(empty, 'nope', true, OUTLOOK_OPS)).toBe(empty);
    });

    it('does not add the same op twice', () => {
        const once = toggleOp(empty, 'id-microsoftListMessages', true, OUTLOOK_OPS);
        expect(toggleOp(once, 'id-microsoftListMessages', true, OUTLOOK_OPS).tools).toHaveLength(1);
    });

    it('adds and removes an agent tool', () => {
        const added = toggleAgentTool(empty, 'exec_code', true);
        expect(added.builtInOperations).toEqual(['exec_code']);
        expect(toggleAgentTool(added, 'exec_code', false).builtInOperations).toEqual([]);
    });
});

describe('parameter bindings', () => {
    const params: Schema = {
        type: 'object',
        properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
    };

    /** Port of ApiItem:70 — a value, or an explicit manual mode, is worth keeping. */
    it('keeps manual with an empty value and drops empty ai', () => {
        const bindings = buildBindings(params, { to: 'manual', subject: 'ai' }, { body: 'hello' });
        expect(bindings.to).toEqual({ value: '', mode: 'manual' });
        expect(bindings.body).toEqual({ value: 'hello', mode: 'ai' });
        expect(bindings.subject).toBeUndefined();
    });

    it('returns an empty map for a parameterless op', () => {
        expect(buildBindings(undefined, {}, {})).toEqual({});
        expect(buildBindings({ type: 'object', properties: {} }, {}, {})).toEqual({});
    });

    it('round-trips through bindingsToDraft', () => {
        const original = buildBindings(params, { to: 'manual', body: 'manual' }, { to: 'a@b.c', body: 'hi' });
        const draft = bindingsToDraft(original);
        expect(buildBindings(params, draft.modes, draft.values)).toEqual(original);
    });

    /**
     * The bug this fixes: the old editor mounted with an empty draft, so editing
     * one parameter of a saved op rebuilt the map from nothing and wiped the rest.
     * Seeding from the saved bindings preserves the untouched parameters.
     */
    it('seeding from saved bindings preserves untouched parameters', () => {
        const saved = buildBindings(params, { to: 'manual', subject: 'manual' }, { to: 'a@b.c', subject: 'Hi' });
        const draft = bindingsToDraft(saved);

        // User now edits only `body`.
        const edited = buildBindings(params, draft.modes, { ...draft.values, body: 'text' });

        expect(edited.to).toEqual({ value: 'a@b.c', mode: 'manual' });
        expect(edited.subject).toEqual({ value: 'Hi', mode: 'manual' });
        expect(edited.body).toEqual({ value: 'text', mode: 'ai' });
    });

    it('bindingsToDraft tolerates undefined', () => {
        expect(bindingsToDraft(undefined)).toEqual({ modes: {}, values: {} });
    });

    /** Guard for ApiItem:76, which assigned onto an element of availableApis. */
    it('withBindings does not mutate the input tools or their elements', () => {
        const source = op('microsoftCreateDraft');
        const tools = [source];
        const next = withBindings(tools, source.id, { to: { value: 'a@b.c', mode: 'manual' } });

        expect(source.bindings).toBeUndefined();
        expect(tools[0]).toBe(source);
        expect(next[0]).not.toBe(source);
        expect(next[0].bindings).toEqual({ to: { value: 'a@b.c', mode: 'manual' } });
    });

    it('withBindings leaves other tools untouched', () => {
        const a = op('microsoftCreateDraft');
        const b = op('microsoftSendDraft');
        const next = withBindings([a, b], a.id, {});
        expect(next[1]).toBe(b);
    });
});

describe('row view-models', () => {
    it('an op row carries its parameters and id', () => {
        const row = toOpRow(op('microsoftListMessages', { tags: ['default', 'all', 'email'] }));
        expect(row.id).toBe('id-microsoftListMessages');
        expect(row.kind).toBe('op');
        expect(row.parameters).toBeDefined();
        // `default` and `all` carry no information for a user (ApiItem:23).
        expect(row.tags).toEqual(['email']);
    });

    /**
     * `builtInOperations` is matched by map key on the backend, so the row id must
     * be the key — NOT tool_name. NewScheduledTasksView's `tool.tool_name || key`
     * adapter must not be reused here.
     */
    it('an agent-tool row keeps the map key as its id', () => {
        const row = toAgentToolRow('exec_code', { tool_name: 'execute_code', description: 'Runs code' });
        expect(row.id).toBe('exec_code');
        expect(row.rawName).toBe('execute_code');
        expect(row.label).toBe('Execute Code');
        expect(row.kind).toBe('agentTool');
    });

    it('falls back to the key when tool_name is absent', () => {
        expect(toAgentToolRow('read_file', {}).label).toBe('Read File');
        expect(toAgentToolRow('read_file', {}).rawName).toBe('read_file');
    });
});

describe('search', () => {
    const row = toOpRow(op('microsoftListMessages', { tags: ['email', 'outlook'] }));
    const agent = toAgentToolRow('exec_code', { tool_name: 'execute_code', description: 'Runs python' });

    it('matches everything on an empty term', () => {
        expect(matchesToolQuery(row, '', 'name')).toBe(true);
        expect(matchesToolQuery(row, '   ', 'tag')).toBe(true);
    });

    it('matches the raw camelCase name', () => {
        expect(matchesToolQuery(row, 'microsoftList', 'name')).toBe(true);
    });

    /** The humanized label must be searchable by the words it displays. */
    it('matches a spaced query against a separator-joined name', () => {
        expect(matchesToolQuery(agent, 'execute code', 'name')).toBe(true);
        expect(matchesToolQuery(agent, 'executecode', 'name')).toBe(true);
    });

    it('matches on description', () => {
        expect(matchesToolQuery(agent, 'python', 'name')).toBe(true);
    });

    it('matches by tag only in tag mode', () => {
        expect(matchesToolQuery(row, 'outlook', 'tag')).toBe(true);
        expect(matchesToolQuery(row, 'nonsense', 'tag')).toBe(false);
    });

    it('does not match an unrelated term', () => {
        expect(matchesToolQuery(row, 'sharepoint', 'name')).toBe(false);
    });
});

describe('capabilityCounts', () => {
    it('counts ops and agent tools together, composites apart', () => {
        const state: ToolSelectionState = {
            compositeIds: ['readEmail'],
            tools: [op('a'), op('b')],
            builtInOperations: ['exec_code'],
        };
        expect(capabilityCounts(state)).toEqual({ composites: 1, ops: 2, agentTools: 1, total: 3 });
    });
});
