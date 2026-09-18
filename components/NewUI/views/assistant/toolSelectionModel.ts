/**
 * toolSelectionModel — the vocabulary of the assistant editor's Tools & APIs panel.
 *
 * React-free on purpose, in the manner of `driveBrowserModel`: the selection
 * algebra is the only part of the panel with a real contract (what ends up in
 * `def.data.tools` / `builtInOperations`), so it lives apart from the pixels and
 * can be reasoned about — and tested — alone.
 *
 * Ported from behaviour that used to be spread across four old-UI components,
 * all of which stay in place for the classic editor (NEW_UI_GUIDE §1):
 *
 *   components/AssistantApi/ApiIntegrationsPanel.tsx  — composite on/off algebra (100-157)
 *   components/AssistantApi/ApiItem.tsx               — binding construction (44-83)
 *   components/AssistantApi/ApiSelector.tsx           — op search
 *   components/Agent/AgentToolsSelector.tsx           — agent-tool search, id convention
 *
 * Four defects are fixed rather than ported. Each is called out at its function.
 */

import { OpBindingMode, OpBindings, OpDef, Schema } from '@/types/op';
import {
    COMPOSITE_FUNCTION_CATEGORIES,
    CompositeFunction,
} from '@/utils/app/compositeFunctions';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything the panel owns, in one value.
 *
 * `tools` is the state of record — full `OpDef` objects, exactly as the backend
 * needs them to execute (`url`, `method`, `data`, `parameters`). The row types
 * below are view-models derived *from* it and must never be written back into it,
 * or a saved assistant loses the fields that make its tools callable.
 *
 * `compositeIds` is UI-only and deliberately NOT persisted (see
 * `inferSelectedComposites`). `builtInOperations` holds agent-tool *map keys*.
 */
export interface ToolSelectionState {
    compositeIds: string[];
    tools: OpDef[];
    builtInOperations: string[];
}

/** One row in the browse list — agent tools and integration ops normalized alike. */
export interface SelectableToolRow {
    /**
     * What gets persisted. For an op this is `OpDef.id`; for an agent tool it is
     * the **map key** from `Object.entries(availableAgentTools)`, never
     * `tool_name` — `builtInOperations` is matched by key on the backend.
     */
    id: string;
    /** Display name, already title-cased where the source was snake_case. */
    label: string;
    /** Raw name, kept for search: users type "microsoftListMessages", not "Microsoft List Messages". */
    rawName: string;
    description: string;
    tags: string[];
    kind: 'op' | 'agentTool';
    /** Present only for `kind: 'op'` — drives the parameter-binding editor. */
    parameters?: Schema;
}

export interface BindingDraft {
    modes: Record<string, OpBindingMode>;
    values: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite catalogue
// ─────────────────────────────────────────────────────────────────────────────

/** Every composite across every category, flattened once. */
export const allCompositeFunctions = (): CompositeFunction[] =>
    COMPOSITE_FUNCTION_CATEGORIES.flatMap((category) => category.functions);

const compositeById = (id: string): CompositeFunction | undefined =>
    allCompositeFunctions().find((fn) => fn.id === id);

/**
 * The live ops a composite actually resolves to.
 *
 * A composite names ops by string; only some of them may be deployed. Resolving
 * against `availableOps` rather than trusting the catalogue is what lets the panel
 * degrade gracefully instead of saving a tool the backend cannot execute.
 */
export const resolveOps = (fn: CompositeFunction, availableOps: OpDef[]): OpDef[] => {
    const wanted = new Set(fn.operations);
    return availableOps.filter((op) => wanted.has(op.name));
};

/** At least one of the composite's ops exists in the live list. */
export const isCompositeAvailable = (fn: CompositeFunction, availableOps: OpDef[]): boolean =>
    resolveOps(fn, availableOps).length > 0;

// ─────────────────────────────────────────────────────────────────────────────
// Selection writes — one mutator per user action
// ─────────────────────────────────────────────────────────────────────────────

const withoutOpNames = (tools: OpDef[], names: Set<string>): OpDef[] =>
    tools.filter((tool) => !names.has(tool.name));

const appendMissing = (tools: OpDef[], incoming: OpDef[]): OpDef[] => {
    const present = new Set(tools.map((tool) => tool.name));
    const additions = incoming.filter((op) => !present.has(op.name));
    return additions.length > 0 ? [...tools, ...additions] : tools;
};

export interface ToggleCompositeInput {
    fn: CompositeFunction;
    checked: boolean;
    availableOps: OpDef[];
}

/**
 * Tick or untick one composite.
 *
 * The only composite mutator, and it returns both halves of the change
 * (`compositeIds` and `tools`) so the panel can commit them in a single
 * functional `setState`. The old panel derived its next value from the captured
 * `selectedApis` *prop* and called the setter with a literal array, so two
 * toggles batched into one tick lost the first — the same failure
 * `DriveSourcesPanel` documents for drive rows.
 *
 * Unticking removes only the ops that no *other* still-ticked composite needs.
 * Composites overlap heavily (several Outlook tasks all start with
 * `microsoftListMessages`), so a naive removal would silently break a sibling
 * the user never touched.
 */
export const toggleComposite = (
    state: ToolSelectionState,
    { fn, checked, availableOps }: ToggleCompositeInput,
): ToolSelectionState => {
    const ops = resolveOps(fn, availableOps);

    if (checked) {
        if (state.compositeIds.includes(fn.id)) return state;
        return {
            ...state,
            compositeIds: [...state.compositeIds, fn.id],
            tools: appendMissing(state.tools, ops),
        };
    }

    const remainingIds = state.compositeIds.filter((id) => id !== fn.id);

    // Op names still required by another ticked composite.
    const stillNeeded = new Set(
        remainingIds.flatMap((id) => {
            const other = compositeById(id);
            return other ? other.operations : [];
        }),
    );

    const droppable = new Set(ops.map((op) => op.name).filter((name) => !stillNeeded.has(name)));

    return {
        ...state,
        compositeIds: remainingIds,
        tools: droppable.size > 0 ? withoutOpNames(state.tools, droppable) : state.tools,
    };
};

/** Tick or untick a single integration op from the browse list. */
export const toggleOp = (
    state: ToolSelectionState,
    id: string,
    checked: boolean,
    availableOps: OpDef[],
): ToolSelectionState => {
    if (!checked) {
        return { ...state, tools: state.tools.filter((tool) => tool.id !== id) };
    }
    const op = availableOps.find((candidate) => candidate.id === id);
    if (!op) return state;
    if (state.tools.some((tool) => tool.id === id)) return state;
    return { ...state, tools: [...state.tools, op] };
};

/**
 * Tick or untick a built-in agent tool.
 *
 * `id` is the map key from `Object.entries(availableAgentTools)`. Passing
 * `tool_name` instead would save a value the backend cannot resolve.
 */
export const toggleAgentTool = (
    state: ToolSelectionState,
    id: string,
    checked: boolean,
): ToolSelectionState => {
    if (checked) {
        if (state.builtInOperations.includes(id)) return state;
        return { ...state, builtInOperations: [...state.builtInOperations, id] };
    }
    return {
        ...state,
        builtInOperations: state.builtInOperations.filter((tool) => tool !== id),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Edit-mode seed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which composites should show as ticked for an assistant loaded from the backend.
 *
 * `compositeIds` is UI-only state seeded *once* by this function, rather than
 * derived on every render, and that distinction matters: composites nest. The
 * ops of "Draft Email" are a strict subset of "Send Email"'s, so a live
 * derivation would light up Draft Email whenever Send Email was picked, and
 * unticking the phantom would then strip ops out from under the real selection.
 *
 * A composite is a candidate when every one of its *resolvable* ops is saved.
 * Candidates whose op set is a strict subset of another candidate's are dropped,
 * so only the maximal — the one the user actually chose — survives.
 */
export const inferSelectedComposites = (tools: OpDef[], availableOps: OpDef[]): string[] => {
    const saved = new Set(tools.map((tool) => tool.name));
    const available = new Set(availableOps.map((op) => op.name));

    const candidates = allCompositeFunctions()
        .map((fn) => ({
            id: fn.id,
            resolvable: fn.operations.filter((name) => available.has(name)),
        }))
        .filter(({ resolvable }) => resolvable.length > 0 && resolvable.every((name) => saved.has(name)));

    const isStrictSubset = (inner: string[], outer: string[]): boolean => {
        if (inner.length >= outer.length) return false;
        const outerSet = new Set(outer);
        return inner.every((name) => outerSet.has(name));
    };

    return candidates
        .filter((candidate) =>
            !candidates.some(
                (other) => other.id !== candidate.id && isStrictSubset(candidate.resolvable, other.resolvable),
            ),
        )
        .map((candidate) => candidate.id);
};

// ─────────────────────────────────────────────────────────────────────────────
// Parameter bindings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the persisted binding map from the editor's draft.
 *
 * The keep/drop rule is a faithful port of `ApiItem#updateApiWithBindings`: a
 * parameter is recorded when it has a value, or when it is explicitly `manual`
 * (a manual parameter with no value yet is still a decision the user made, and
 * dropping it would silently flip the row back to `ai`).
 */
export const buildBindings = (
    parameters: Schema | undefined,
    modes: Record<string, OpBindingMode>,
    values: Record<string, string>,
): OpBindings => {
    if (!parameters?.properties) return {};

    const bindings: OpBindings = {};
    Object.keys(parameters.properties).forEach((param) => {
        const mode = modes[param] ?? 'ai';
        const value = values[param] ?? '';
        if (value || mode === 'manual') bindings[param] = { value, mode };
    });
    return bindings;
};

/**
 * Rehydrate the editor from saved bindings.
 *
 * The old editors mounted with empty `paramModes`/`paramValues`, so touching one
 * parameter of a saved op rebuilt the whole map from nothing and wiped every
 * *other* parameter the user had configured. Seeding from the saved value is the
 * fix; `buildBindings(bindingsToDraft(b))` round-trips.
 */
export const bindingsToDraft = (bindings?: OpBindings): BindingDraft => {
    const draft: BindingDraft = { modes: {}, values: {} };
    if (!bindings) return draft;
    Object.entries(bindings).forEach(([param, binding]) => {
        draft.modes[param] = binding.mode;
        draft.values[param] = binding.value;
    });
    return draft;
};

/**
 * Replace one op's bindings, purely.
 *
 * `ApiItem` assigned `api.bindings = bindings` on an element of the shared
 * `availableApis` array, so configuration leaked into the catalogue and outlived
 * unticking the row. Nothing here mutates its input.
 */
export const withBindings = (tools: OpDef[], opId: string, bindings: OpBindings): OpDef[] =>
    tools.map((tool) => (tool.id === opId ? { ...tool, bindings } : tool));

export const hasConfigurableParameters = (parameters?: Schema): boolean =>
    Boolean(parameters?.properties && Object.keys(parameters.properties).length > 0);

// ─────────────────────────────────────────────────────────────────────────────
// Row view-models
// ─────────────────────────────────────────────────────────────────────────────

/** Port of `ApiItem`'s tag filter — these two carry no information for a user. */
const HIDDEN_TAGS = new Set(['default', 'all']);

const visibleTags = (tags?: string[]): string[] =>
    (tags ?? []).filter((tag) => !HIDDEN_TAGS.has(tag));

/** snake_case / kebab-case / dotted → Title Case, matching `snakeCaseToTitleCase`. */
const titleize = (raw: string): string =>
    raw
        .split(/[-_.\s]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

export const toOpRow = (op: OpDef): SelectableToolRow => ({
    id: op.id,
    label: op.name,
    rawName: op.name,
    description: op.description ?? '',
    tags: visibleTags(op.tags),
    kind: 'op',
    parameters: op.parameters,
});

/**
 * `key` is the map key and becomes the row id — see `toggleAgentTool`. Note that
 * `NewScheduledTasksView` uses `tool.tool_name || key` for its own display list;
 * that adapter must not be reused here, because this id is persisted.
 */
export const toAgentToolRow = (key: string, tool: { tool_name?: string; description?: string; tags?: string[] }): SelectableToolRow => ({
    id: key,
    label: titleize(tool.tool_name ?? key),
    rawName: tool.tool_name ?? key,
    description: tool.description ?? '',
    tags: visibleTags(tool.tags),
    kind: 'agentTool',
});

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row against one query.
 *
 * Name search strips separators from both sides, so "list messages" finds
 * `microsoftListMessages` and "microsoftlistmessages" does too — the old code
 * only stripped spaces from the term, which made the humanized labels
 * unsearchable by the words they display.
 */
export const matchesToolQuery = (
    row: SelectableToolRow,
    term: string,
    by: 'name' | 'tag',
): boolean => {
    const needle = term.trim().toLowerCase();
    if (!needle) return true;

    if (by === 'tag') {
        return row.tags.some((tag) => tag.toLowerCase().includes(needle));
    }

    const squash = (value: string) => value.replace(/[-_.\s]+/g, '').toLowerCase();
    return (
        squash(row.label).includes(squash(needle)) ||
        squash(row.rawName).includes(squash(needle)) ||
        row.description.toLowerCase().includes(needle)
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Counts
// ─────────────────────────────────────────────────────────────────────────────

export const capabilityCounts = (
    state: ToolSelectionState,
): { composites: number; ops: number; agentTools: number; total: number } => ({
    composites: state.compositeIds.length,
    ops: state.tools.length,
    agentTools: state.builtInOperations.length,
    total: state.tools.length + state.builtInOperations.length,
});
