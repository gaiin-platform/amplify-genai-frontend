/**
 * ToolsCapabilityPanel — Capabilities → Tools & APIs, in the new UI.
 *
 * Replaces this whole old-UI stack at this call site, all of which stays in place
 * for the classic editor (NEW_UI_GUIDE §1):
 *
 *   components/AssistantApi/ApiIntegrationsPanel.tsx  — the wrapper + composite algebra
 *   components/Agent/CompositeActionsPanel.tsx        — task-based tool cards
 *   components/Agent/AgentToolsSelector.tsx           — agent tool list
 *   components/AssistantApi/ApiSelector.tsx           — integration op list
 *   components/Admin/AdminComponents/Ops.tsx          — opsSearchToggleButtons
 *
 * Structure: task-based tools grouped by integration, then one "browse individual
 * tools" list that merges agent tools and integration ops (they were two lists
 * with identical rows, differing only in their data adapter).
 *
 * Two behavioural changes beyond the palette:
 *
 *   - Not-connected integrations no longer show an amber banner pointing at a
 *     settings deep-link that does not exist in the new UI: `openSettingsTrigger`
 *     is only listened for by `components/Layout/UserMenu`, which renders in the
 *     classic branch of home.tsx. They now offer an inline Connect button that
 *     runs the real OAuth flow, so the dead click is gone.
 *   - Parameter bindings are seeded from what was saved, so editing one parameter
 *     of a saved op no longer wipes the others.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    IconChevronDown,
    IconChevronRight,
    IconLoader2,
    IconPlugConnected,
} from '@tabler/icons-react';
import { OpBindingMode, OpDef } from '@/types/op';
import {
    COMPOSITE_FUNCTION_CATEGORIES,
    CompositeFunctionCategory,
} from '@/utils/app/compositeFunctions';
import { getIntegrationName, getOperationIcon } from '@/utils/app/integrations';
import { integrationIcon } from '@/components/NewUI/shared/integrationIcon';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';
import { SearchInput } from '@/components/NewUI/shared/SearchInput';
import { useIntegrationConnections } from '@/components/NewUI/shared/useIntegrationConnections';
import { CapabilityRow } from './CapabilityRow';
import { CompositeToolCard } from './CompositeToolCard';
import { ParameterBindingEditor } from './ParameterBindingEditor';
import {
    BindingDraft,
    ToolSelectionState,
    bindingsToDraft,
    buildBindings,
    hasConfigurableParameters,
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
} from './toolSelectionModel';

export interface ToolsCapabilityPanelProps {
    /** Live ops from the backend; null while loading. */
    availableApis: OpDef[] | null;
    selectedApis: OpDef[];
    /**
     * Taken as the state setter rather than a plain callback so every write can go
     * through the functional form — the `DriveSourcesPanel.onChange` precedent.
     */
    setSelectedApis: React.Dispatch<React.SetStateAction<OpDef[]>>;
    availableAgentTools: Record<string, any> | null;
    builtInAgentTools: string[];
    setBuiltInAgentTools: React.Dispatch<React.SetStateAction<string[]>>;
    /** Gate the parameter-binding gear. */
    allowConfiguration?: boolean;
    disabled?: boolean;
    /** Hide the agent-tools list (the old `hideApisPanel: ['tools']`). */
    showAgentTools?: boolean;
}

const sectionLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
};

const mutedNote: React.CSSProperties = {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-muted)',
};

const centeredState: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '20px 24px',
    fontSize: 12.5,
    color: 'var(--text-muted)',
    textAlign: 'center',
};

const SEARCH_BY_ITEMS = [
    { id: 'name', label: 'Name' },
    { id: 'tag', label: 'Tag' },
];

export const ToolsCapabilityPanel: React.FC<ToolsCapabilityPanelProps> = ({
    availableApis,
    selectedApis,
    setSelectedApis,
    availableAgentTools,
    builtInAgentTools,
    setBuiltInAgentTools,
    allowConfiguration = false,
    disabled = false,
    showAgentTools = true,
}) => {
    const { connected, loading: connectionsLoading, busy, connect } = useIntegrationConnections();

    const [compositeIds, setCompositeIds] = useState<string[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(COMPOSITE_FUNCTION_CATEGORIES.map((category) => [category.id, true])),
    );
    const [taskSearch, setTaskSearch] = useState('');
    const [browseOpen, setBrowseOpen] = useState(false);
    const [browseSearch, setBrowseSearch] = useState('');
    const [searchBy, setSearchBy] = useState<'name' | 'tag'>('name');
    const [configOpenId, setConfigOpenId] = useState<string | null>(null);

    const availableOps = useMemo(() => availableApis ?? [], [availableApis]);

    /**
     * The committed selection, advanced synchronously by `mutate`.
     *
     * Reading props inside a handler means two toggles dispatched in one tick both
     * see the pre-first-toggle value and the second wins — the failure mode
     * `ApiIntegrationsPanel` had. Advancing a ref keeps sequential composition
     * correct regardless of when React re-renders; the effect below re-adopts the
     * props whenever the parent changes them from outside (an assistant load).
     */
    const committed = useRef<ToolSelectionState>({
        compositeIds: [],
        tools: selectedApis,
        builtInOperations: builtInAgentTools,
    });
    useEffect(() => {
        committed.current = {
            compositeIds,
            tools: selectedApis,
            builtInOperations: builtInAgentTools,
        };
    }, [compositeIds, selectedApis, builtInAgentTools]);

    const mutate = useCallback(
        (change: (base: ToolSelectionState) => ToolSelectionState) => {
            if (disabled) return;
            const next = change(committed.current);
            committed.current = next;
            setCompositeIds(next.compositeIds);
            setSelectedApis(next.tools);
            setBuiltInAgentTools(next.builtInOperations);
        },
        [disabled, setSelectedApis, setBuiltInAgentTools],
    );

    /**
     * Seed the composite ticks once, from what was saved.
     *
     * Deliberately not derived every render: composites nest (Draft Email's ops are
     * a strict subset of Send Email's), so a live derivation would light up the
     * subset and unticking that phantom would strip ops from the real selection.
     */
    const seeded = useRef(false);
    useEffect(() => {
        if (seeded.current) return;
        if (availableOps.length === 0) return;
        seeded.current = true;
        if (selectedApis.length > 0) {
            setCompositeIds(inferSelectedComposites(selectedApis, availableOps));
        }
    }, [availableOps, selectedApis]);

    // ── Bindings ─────────────────────────────────────────────────────────────
    /**
     * Draft bindings keyed by op id, seeded from the op's saved bindings on first
     * access. Held here rather than in each row so that configuring an op *before*
     * ticking it still carries the values across — the one good behaviour of the
     * old code, which achieved it by mutating the shared ops catalogue.
     */
    const [drafts, setDrafts] = useState<Record<string, BindingDraft>>({});

    const draftFor = useCallback(
        (op: OpDef): BindingDraft => drafts[op.id] ?? bindingsToDraft(op.bindings),
        [drafts],
    );

    /**
     * One binding edit. The write-back happens outside the state updater: calling
     * a parent setter from inside `setState(prev => …)` fires it twice under
     * StrictMode (guide §15), which is what `CompositeActionsPanel` did.
     */
    const editBinding = useCallback(
        (op: OpDef, patch: Partial<BindingDraft>) => {
            const base = drafts[op.id] ?? bindingsToDraft(op.bindings);
            const next: BindingDraft = {
                modes: { ...base.modes, ...(patch.modes ?? {}) },
                values: { ...base.values, ...(patch.values ?? {}) },
            };
            setDrafts((prev) => ({ ...prev, [op.id]: next }));

            const bindings = buildBindings(op.parameters, next.modes, next.values);
            mutate((state) => ({ ...state, tools: withBindings(state.tools, op.id, bindings) }));
        },
        [drafts, mutate],
    );

    const onParamModeChange = useCallback(
        (op: OpDef, param: string, mode: OpBindingMode) =>
            editBinding(op, { modes: { [param]: mode } }),
        [editBinding],
    );

    const onParamValueChange = useCallback(
        (op: OpDef, param: string, value: string) =>
            editBinding(op, { values: { [param]: value } }),
        [editBinding],
    );

    // ── Composite categories ─────────────────────────────────────────────────
    const connectedSet = useMemo(() => new Set(connected), [connected]);

    const isConnected = useCallback(
        (category: CompositeFunctionCategory) =>
            category.integrationIds.some((id) => connectedSet.has(id)),
        [connectedSet],
    );

    /**
     * Categories that are sub-features of another integration stay hidden until
     * their prerequisites are connected — not even listed as "not connected".
     */
    const isVisible = useCallback(
        (category: CompositeFunctionCategory) => {
            if (!category.requiresIntegrationIds?.length) return true;
            return category.requiresIntegrationIds.every((id) => connectedSet.has(id));
        },
        [connectedSet],
    );

    const filteredCategories = useMemo(() => {
        const needle = taskSearch.trim().toLowerCase();
        return COMPOSITE_FUNCTION_CATEGORIES
            .map((category) => ({
                ...category,
                functions: category.functions.filter(
                    (fn) =>
                        !needle ||
                        category.label.toLowerCase().includes(needle) ||
                        fn.name.toLowerCase().includes(needle) ||
                        fn.description.toLowerCase().includes(needle),
                ),
            }))
            .filter((category) => category.functions.length > 0 && isVisible(category));
    }, [taskSearch, isVisible]);

    const connectedCategories = filteredCategories.filter(isConnected);
    const disconnectedCategories = filteredCategories.filter((c) => !isConnected(c));

    const allExpanded =
        filteredCategories.length > 0 && filteredCategories.every((c) => expanded[c.id]);

    const toggleAll = () => {
        const next = !allExpanded;
        setExpanded(Object.fromEntries(COMPOSITE_FUNCTION_CATEGORIES.map((c) => [c.id, next])));
    };

    // ── Browse rows ──────────────────────────────────────────────────────────
    const agentRows = useMemo(() => {
        if (!showAgentTools || !availableAgentTools) return [];
        return Object.entries(availableAgentTools).map(([key, tool]) => toAgentToolRow(key, tool));
    }, [showAgentTools, availableAgentTools]);

    const opRows = useMemo(
        // Custom APIs are managed elsewhere; the old panel filtered them out here too.
        () => availableOps.filter((op) => op.type !== 'custom').map(toOpRow),
        [availableOps],
    );

    const browseRows = useMemo(
        () =>
            [...agentRows, ...opRows].filter((row) => matchesToolQuery(row, browseSearch, searchBy)),
        [agentRows, opRows, browseSearch, searchBy],
    );

    const selectedOpIds = useMemo(() => new Set(selectedApis.map((op) => op.id)), [selectedApis]);
    const selectedAgentIds = useMemo(() => new Set(builtInAgentTools), [builtInAgentTools]);
    const opById = useMemo(() => new Map(availableOps.map((op) => [op.id, op])), [availableOps]);

    const renderCategory = (category: CompositeFunctionCategory, categoryConnected: boolean) => {
        const open = expanded[category.id];
        const logo = integrationIcon(category.integrationIds[0], 14);

        return (
            <div key={category.id}>
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded((prev) => ({ ...prev, [category.id]: !prev[category.id] }))}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        width: '100%',
                        padding: '6px 4px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        outline: 'none',
                    }}
                >
                    <span
                        aria-hidden="true"
                        style={{
                            flexShrink: 0,
                            lineHeight: 0,
                            color: 'var(--text-muted)',
                            transform: open ? 'rotate(90deg)' : 'none',
                            transition: 'transform 160ms ease',
                        }}
                        className="motion-reduce:transition-none"
                    >
                        <IconChevronRight size={13} stroke={2} />
                    </span>

                    <span
                        aria-hidden="true"
                        style={{
                            display: 'grid',
                            placeItems: 'center',
                            width: 14,
                            height: 14,
                            flexShrink: 0,
                            // Not-connected reads as muted, not as a warning hue.
                            opacity: categoryConnected ? 1 : 0.4,
                        }}
                    >
                        {logo}
                    </span>

                    <span
                        style={{
                            flex: 1,
                            fontSize: 11.5,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: categoryConnected ? 'var(--text-secondary)' : 'var(--text-muted)',
                        }}
                    >
                        {category.label}
                    </span>

                    {!categoryConnected && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                            Not connected
                        </span>
                    )}
                </button>

                {open && (
                    <div style={{ paddingLeft: 20, paddingBottom: 6 }}>
                        {categoryConnected ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {category.functions.map((fn) => {
                                    const ops = resolveOps(fn, availableOps);
                                    return (
                                        <CompositeToolCard
                                            key={fn.id}
                                            fn={fn}
                                            resolvedOps={ops}
                                            selected={compositeIds.includes(fn.id)}
                                            available={!disabled && isCompositeAvailable(fn, availableOps)}
                                            onToggle={(checked) =>
                                                mutate((state) =>
                                                    toggleComposite(state, { fn, checked, availableOps }),
                                                )
                                            }
                                            configOpen={allowConfiguration && configOpenId === fn.id}
                                            onConfigToggle={
                                                allowConfiguration
                                                    ? () => setConfigOpenId((id) => (id === fn.id ? null : fn.id))
                                                    : undefined
                                            }
                                            draftFor={draftFor}
                                            onParamModeChange={onParamModeChange}
                                            onParamValueChange={onParamValueChange}
                                        />
                                    );
                                })}
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    flexWrap: 'wrap',
                                    padding: '9px 11px',
                                    borderRadius: 8,
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-app)',
                                }}
                            >
                                <span style={{ flex: 1, minWidth: 160, fontSize: 12, color: 'var(--text-muted)' }}>
                                    {`Connect ${getIntegrationName(category.integrationIds[0])} to use these tools.`}
                                </span>
                                <button
                                    type="button"
                                    disabled={Boolean(busy[category.integrationIds[0]]) || disabled}
                                    onClick={() => connect(category.integrationIds[0])}
                                    style={{
                                        flexShrink: 0,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        height: 28,
                                        padding: '0 10px',
                                        borderRadius: 6,
                                        border: 'none',
                                        background: 'var(--accent)',
                                        color: 'var(--accent-fg)',
                                        fontSize: 12,
                                        fontWeight: 500,
                                        fontFamily: 'inherit',
                                        cursor: busy[category.integrationIds[0]] ? 'progress' : 'pointer',
                                        opacity: busy[category.integrationIds[0]] || disabled ? 0.6 : 1,
                                    }}
                                >
                                    {busy[category.integrationIds[0]] ? (
                                        <IconLoader2 size={13} className="motion-safe:animate-spin" aria-hidden="true" />
                                    ) : (
                                        <IconPlugConnected size={13} aria-hidden="true" />
                                    )}
                                    Connect
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const opsLoading = availableApis === null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Task-based tools ── */}
            <div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 8,
                    }}
                >
                    <span style={{ ...sectionLabel, flex: 1, minWidth: 120 }}>Task-based tools</span>
                    {filteredCategories.length > 0 && (
                        <button
                            type="button"
                            onClick={toggleAll}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                fontSize: 11.5,
                                fontFamily: 'inherit',
                                cursor: 'pointer',
                                padding: 0,
                            }}
                        >
                            {allExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                            {allExpanded ? 'Collapse all' : 'Expand all'}
                        </button>
                    )}
                </div>

                <div style={{ marginBottom: 8 }}>
                    <SearchInput
                        value={taskSearch}
                        onChange={setTaskSearch}
                        onClear={() => setTaskSearch('')}
                        placeholder="Search tasks…"
                        aria-label="Search task-based tools"
                        fullWidth
                    />
                </div>

                {opsLoading || connectionsLoading ? (
                    <div style={centeredState}>
                        <IconLoader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />
                        <span>Loading tools…</span>
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div style={centeredState}>
                        <span>
                            {taskSearch.trim()
                                ? `No tasks match “${taskSearch.trim()}”.`
                                : 'No task-based tools are available.'}
                        </span>
                    </div>
                ) : (
                    <div
                        role="listbox"
                        aria-multiselectable="true"
                        aria-label="Task-based tools"
                        style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                        {connectedCategories.map((category) => renderCategory(category, true))}

                        {disconnectedCategories.length > 0 && connectedCategories.length > 0 && (
                            <div
                                aria-hidden="true"
                                style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 2px' }}
                            >
                                <span style={{ height: 1, flex: 1, background: 'var(--border-subtle)' }} />
                                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                    Not connected
                                </span>
                                <span style={{ height: 1, flex: 1, background: 'var(--border-subtle)' }} />
                            </div>
                        )}

                        {disconnectedCategories.map((category) => renderCategory(category, false))}
                    </div>
                )}
            </div>

            {/* ── Browse individual tools ── */}
            <div>
                <button
                    type="button"
                    aria-expanded={browseOpen}
                    onClick={() => setBrowseOpen((open) => !open)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        cursor: 'pointer',
                        ...sectionLabel,
                    }}
                >
                    <span
                        aria-hidden="true"
                        className="motion-reduce:transition-none"
                        style={{
                            lineHeight: 0,
                            color: 'var(--text-muted)',
                            transform: browseOpen ? 'rotate(90deg)' : 'none',
                            transition: 'transform 160ms ease',
                        }}
                    >
                        <IconChevronRight size={13} stroke={2} />
                    </span>
                    Browse individual tools
                </button>

                {browseOpen && (
                    <div style={{ marginTop: 8 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flexWrap: 'wrap',
                                marginBottom: 8,
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 160 }}>
                                <SearchInput
                                    value={browseSearch}
                                    onChange={setBrowseSearch}
                                    onClear={() => setBrowseSearch('')}
                                    placeholder={searchBy === 'tag' ? 'Search by tag…' : 'Search tools…'}
                                    aria-label="Search individual tools"
                                    fullWidth
                                />
                            </div>
                            <SegmentedControl
                                items={SEARCH_BY_ITEMS}
                                value={searchBy}
                                onChange={(id) => setSearchBy(id as 'name' | 'tag')}
                                size="xs"
                                aria-label="Search tools by"
                            />
                        </div>

                        <div
                            role="listbox"
                            aria-multiselectable="true"
                            aria-label="Individual tools"
                            aria-busy={opsLoading}
                            style={{
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 8,
                                background: 'var(--bg-app)',
                                maxHeight: 320,
                                overflowY: 'auto',
                            }}
                        >
                            {opsLoading ? (
                                <div style={centeredState}>
                                    <IconLoader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />
                                    <span>Loading tools…</span>
                                </div>
                            ) : browseRows.length === 0 ? (
                                <div style={centeredState}>
                                    <span>
                                        {browseSearch.trim()
                                            ? `No tools match “${browseSearch.trim()}”.`
                                            : 'No individual tools are available.'}
                                    </span>
                                </div>
                            ) : (
                                browseRows.map((row, index) => {
                                    const isOp = row.kind === 'op';
                                    const selected = isOp
                                        ? selectedOpIds.has(row.id)
                                        : selectedAgentIds.has(row.id);
                                    const opDef = isOp ? opById.get(row.id) : undefined;
                                    const configurable =
                                        allowConfiguration && isOp && hasConfigurableParameters(row.parameters);
                                    const Icon = getOperationIcon(row.rawName);

                                    return (
                                        <CapabilityRow
                                            key={`${row.kind}-${row.id}`}
                                            isFirst={index === 0}
                                            icon={<Icon size={16} />}
                                            label={row.label}
                                            description={row.description}
                                            tags={row.tags}
                                            badges={row.kind === 'agentTool' ? ['built-in'] : []}
                                            selected={selected}
                                            disabled={disabled}
                                            onToggle={(checked) =>
                                                mutate((state) =>
                                                    isOp
                                                        ? toggleOp(state, row.id, checked, availableOps)
                                                        : toggleAgentTool(state, row.id, checked),
                                                )
                                            }
                                            configureOpen={configOpenId === `op:${row.id}`}
                                            onConfigureToggle={
                                                configurable
                                                    ? () =>
                                                        setConfigOpenId((id) =>
                                                            id === `op:${row.id}` ? null : `op:${row.id}`,
                                                        )
                                                    : undefined
                                            }
                                            configurePanel={
                                                opDef ? (
                                                    <ParameterBindingPanel
                                                        op={opDef}
                                                        draft={draftFor(opDef)}
                                                        onParamModeChange={onParamModeChange}
                                                        onParamValueChange={onParamValueChange}
                                                    />
                                                ) : undefined
                                            }
                                        />
                                    );
                                })
                            )}
                        </div>

                        <p style={{ ...mutedNote, marginTop: 6 }}>
                            Individual tools give finer control than a task-based tool, but the
                            assistant has to work out how to chain them itself.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

/** Small adapter so the row's `configurePanel` stays a plain node. */
const ParameterBindingPanel: React.FC<{
    op: OpDef;
    draft: BindingDraft;
    onParamModeChange: (op: OpDef, param: string, mode: OpBindingMode) => void;
    onParamValueChange: (op: OpDef, param: string, value: string) => void;
}> = ({ op, draft, onParamModeChange, onParamValueChange }) => (
    <ParameterBindingEditor
        paramSource={op.parameters}
        paramModes={draft.modes}
        paramValues={draft.values}
        onParamModeChange={(param, mode) => onParamModeChange(op, param, mode)}
        onParamValueChange={(param, value) => onParamValueChange(op, param, value)}
    />
);

export default ToolsCapabilityPanel;
