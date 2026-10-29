/**
 * NewLayeredAssistantBuilder — create and edit layered assistants (personal and group) in the New UI.
 * Replaces the old `LayeredAssistantBuilder` + `LayeredBuilderHost` + the admin interface's layered tabs.
 *
 * A layered assistant is a tree: parents ("routers") hold a decision guide and route each conversation
 * to one of their members; members are assistants or further parents. The builder is three panels —
 *   tree (outline, mini map, add sub-parent)  ·  node editor  ·  assistant picker
 * — then cards for group settings and publishing. Every tree rule is in `layeredTreeModel`, the save
 * payload rule (the backend clears any omitted setting) in `layeredAssistantDataModel`, publishing
 * decisions in `layeredPublishModel`, AI prompts/parsing in `layeredAiModel`.
 *
 * Hosting: a fixed full-viewport dialog (the 1100px creation shell is too narrow for three panels).
 * The host supplies `onSave`, which writes the right way for the scope (personal vs the group API) and
 * returns the saved record (with its `assistantId`) or null on failure.
 *
 * Save order is the old builder's: a new layered assistant that wants a link is saved first (a link
 * needs an id), the link is registered, then it is saved again with the link. Unlike the old builder,
 * a link that was typed but never validated blocks the save with a reason instead of being skipped.
 *
 * Closing with unsaved changes asks first. Escape closes only the topmost layer.
 */

import React, { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { IconAlertTriangle, IconLoader2, IconPlus, IconSparkles, IconUsers, IconWorld, IconX, IconSettings } from '@tabler/icons-react';
import HomeContext from '@/components/Home/home.context';
import { Group } from '@/types/groups';
import { Prompt } from '@/types/prompt';
import { AssistantDefinition } from '@/types/assistant';
import { AttachedDocument } from '@/types/attacheddocument';
import { DefaultModels } from '@/types/model';
import { MessageType, newMessage } from '@/types/chat';
import {
    LayeredAssistant,
    LayeredAssistantNode,
    RouterContextField,
    RouterNode,
    createLayeredAssistant,
    isLeafNode,
    isRouterNode,
} from '@/types/layeredAssistant';
import { addAssistantPath } from '@/services/assistantService';
import { deleteFile } from '@/services/fileService';
import { promptForData } from '@/utils/app/llm';
import { isAssistant } from '@/utils/app/assistants';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { TextControl } from '@/components/NewUI/shared/FormControls';
import { InfoTooltip } from '@/components/NewUI/shared/InfoTooltip';
import { CapabilityCard } from '../CapabilityCard';
import {
    DropPosition,
    addLeaf,
    addSubParent,
    assignedLeafIds,
    assistantRefId,
    countNodes,
    deleteNode,
    findNode,
    indentNode,
    moveNode,
    moveNodeStep,
    moveOptions,
    outdentNode,
    routerContextOptions,
    setRouterContext,
    unresolvedLeaves,
    updateNode,
    validateForSave,
} from '../layeredTreeModel';
import { AiField, buildFieldRequest, summarizeAssistant } from '../layeredAiModel';
import {
    LayeredSettings,
    buildLayeredForSave,
    readLayeredSettings,
} from '../layeredAssistantDataModel';
import { PUBLIC_ACCESS, PublishState, publishBlocker, shouldCallAddPath } from '../layeredPublishModel';
import { LayeredTreeOutline, KeyboardMove } from './LayeredTreeOutline';
import { LayeredTreeMap } from './LayeredTreeMap';
import { LayeredNodeEditor } from './LayeredNodeEditor';
import { LayeredAssistantPicker } from './LayeredAssistantPicker';
import { LayeredAiGenerator } from './LayeredAiGenerator';
import { LayeredSettingsPanel } from './LayeredSettingsPanel';
import { LayeredPublishPanel } from './LayeredPublishPanel';

export interface NewLayeredAssistantBuilderProps {
    /** Existing layered assistant to edit; omit to create one. */
    initialData?: LayeredAssistant;
    /** Group scope: members come from the group's assistants and saves go through the groups API. */
    group?: Group;
    /** Override the assistants that can be added (defaults to your own editable ones, or the group's). */
    assistants?: Prompt[];
    /** Persist it. Return the saved record (with `assistantId`) or null if it failed. */
    onSave: (la: LayeredAssistant) => Promise<LayeredAssistant | null>;
    onClose: () => void;
}

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';
const sectionLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 };

const card: React.CSSProperties = {
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
    background: 'var(--bg-raised)',
    padding: 14,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
};

const clonePublic = () => ({ ...PUBLIC_ACCESS, accessTo: { amplifyGroups: [] as string[], users: [] as string[] } });

export const NewLayeredAssistantBuilder: React.FC<NewLayeredAssistantBuilderProps> = ({
    initialData,
    group,
    assistants: assistantsProp,
    onSave,
    onClose,
}) => {
    const { state: { prompts, chatEndpoint, defaultAccount }, getDefaultModel } = useContext(HomeContext);
    const titleId = useId();
    const groupId = group?.id ?? initialData?.groupId;
    const isGroup = !!groupId;
    const groupSupportsAnalysis = !!group?.supportConvAnalysis;
    const isEdit = !!initialData?.assistantId;

    // ── Core state ───────────────────────────────────────────────────────
    const [la, setLa] = useState<LayeredAssistant>(() => {
        const base = initialData ?? createLayeredAssistant('');
        return groupId ? { ...base, groupId } : base;
    });
    const [selectedId, setSelectedId] = useState<string>(() => la.rootNode.id);
    /** True once the record exists server-side — including after a first save whose later steps failed. */
    const isSavedRecord = !!la.assistantId;
    const [settings, setSettings] = useState<LayeredSettings>(() => readLayeredSettings(initialData));
    const [astIcon, setAstIcon] = useState<AttachedDocument | undefined>(() => (initialData?.data as any)?.astIcon);
    const [publish, setPublish] = useState<PublishState>(() => {
        const saved = initialData?.astPath || ((initialData?.data as any)?.astPath as string | undefined) || '';
        const access = initialData?.astPathData ?? clonePublic();
        return {
            path: saved,
            savedPath: saved,
            available: !!saved,
            checking: false,
            error: '',
            accessData: access,
            originalAccessData: access,
        };
    });
    /** Icon files the user replaced or removed. Deleted only after a successful save, so Cancel can't orphan the saved icon. */
    const queuedIconDeletes = useRef<string[]>([]);
    const queueIconDelete = useCallback((key: string) => { queuedIconDeletes.current.push(key); }, []);
    const patchPublish = useCallback((patch: Partial<PublishState>) => setPublish((prev) => ({ ...prev, ...patch })), []);

    const [view, setView] = useState<'edit' | 'generate'>('edit');
    const [generating, setGenerating] = useState<Set<string>>(new Set());
    const [notice, setNotice] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[] | null>(null);
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    /** A generated tree waiting for the user to agree to replace the current one. */
    const [pendingGenerated, setPendingGenerated] = useState<LayeredAssistant | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // ── Assistants that can be added ─────────────────────────────────────
    const assistants = useMemo<Prompt[]>(
        () =>
            (assistantsProp ?? (group ? group.assistants ?? [] : prompts.filter((p: Prompt) => isAssistant(p) && !p.groupId)))
                .filter((p: Prompt) => !p.data || !p.data.noEdit),
        [assistantsProp, group, prompts],
    );
    const getLinked = useCallback(
        (assistantId: string) => assistants.find((a) => assistantRefId(a) === assistantId || a.id === assistantId) ?? null,
        [assistants],
    );
    const knownIds = useMemo(() => new Set(assistants.flatMap((a) => [assistantRefId(a), a.id])), [assistants]);

    // ── Derived tree state ───────────────────────────────────────────────
    const root = la.rootNode;
    const selected = findNode(root, selectedId) ?? findNode(root, root.id)!;
    const selectedNode = selected.node;
    const addTarget: RouterNode | null = isRouterNode(selectedNode) ? selectedNode : selected.parent;
    const assigned = useMemo(() => assignedLeafIds(root), [root]);
    const missing = useMemo(() => unresolvedLeaves(root, knownIds), [root, knownIds]);
    const moves = useMemo(() => moveOptions(root, selectedNode.id), [root, selectedNode.id]);

    // ── Dirty tracking ───────────────────────────────────────────────────
    const snapshot = (value: { la: LayeredAssistant; settings: LayeredSettings; publish: PublishState; astIcon: unknown }) =>
        JSON.stringify([value.la.name, value.la.description, value.la.rootNode, value.settings, value.publish.path, value.publish.accessData, (value.astIcon as any)?.id ?? null]);
    const initialSnapshot = useRef<string>('');
    if (!initialSnapshot.current) initialSnapshot.current = snapshot({ la, settings, publish, astIcon });
    const dirty = snapshot({ la, settings, publish, astIcon }) !== initialSnapshot.current;

    // ── Small helpers ────────────────────────────────────────────────────
    const noticeTimer = useRef<number | undefined>(undefined);
    const flash = (message: string) => {
        setNotice(message);
        window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
    };
    // Re-armed in the effect body (Guide §5 rule 16): StrictMode runs cleanup once on the first mount.
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; window.clearTimeout(noticeTimer.current); };
    }, []);

    const touch = (mutate: (current: RouterNode) => RouterNode) =>
        setLa((prev) => ({ ...prev, updatedAt: new Date().toISOString(), rootNode: mutate(prev.rootNode) }));

    // ── Tree actions ─────────────────────────────────────────────────────
    const handleAddSubParent = () => {
        if (!addTarget) return flash('Select a parent in the tree first.');
        const result = addSubParent(root, addTarget.id);
        if (!result.ok) return flash(result.reason);
        touch(() => result.root);
        setSelectedId(result.id);
    };

    const handleAddAssistant = (assistant: Prompt) => {
        if (!addTarget) return flash('Select a parent in the tree first.');
        const result = addLeaf(root, addTarget.id, assistant);
        if (!result.ok) return flash(result.reason);
        touch(() => result.root);
    };

    const handleRemove = (id: string) => {
        const found = findNode(root, id);
        if (!found) return;
        // Removing a parent takes its whole subtree with it — confirm that, not a lone assistant.
        if (isRouterNode(found.node) && found.node.children.length > 0) setConfirmRemoveId(id);
        else performRemove(id);
    };
    const performRemove = (id: string) => {
        const result = deleteNode(root, id);
        setConfirmRemoveId(null);
        if (!result) return;
        touch(() => result.root);
        if (id === selectedId || !findNode(result.root, selectedId)) setSelectedId(result.selectId);
    };

    const handleMoveByDrop = (dragId: string, targetId: string, position: DropPosition) => {
        const next = moveNode(root, dragId, targetId, position);
        if (next) touch(() => next);
    };
    /** Returns whether anything moved, so callers only chase focus after a real change. */
    const handleKeyboardMove = (id: string, move: KeyboardMove): boolean => {
        const next =
            move === 'up' ? moveNodeStep(root, id, 'up')
            : move === 'down' ? moveNodeStep(root, id, 'down')
            : move === 'indent' ? indentNode(root, id)
            : outdentNode(root, id);
        if (!next) return false;
        touch(() => next);
        return true;
    };

    const handleField = (field: 'name' | 'description' | 'instructions', value: string) =>
        touch((current) => updateNode(current, selectedNode.id, (node) => ({ ...node, [field]: value }) as LayeredAssistantNode));
    const handleContext = (field: RouterContextField, on: boolean) =>
        touch((current) => setRouterContext(current, selectedNode.id, field, on));

    // ── AI: one field ────────────────────────────────────────────────────
    const summaryFor = (assistantId: string, name: string) => {
        const linked = getLinked(assistantId);
        return summarizeAssistant(linked?.data?.assistant?.definition as AssistantDefinition | undefined, linked?.name ?? name);
    };
    const handleGenerate = async (field: AiField) => {
        if (!chatEndpoint) return;
        const node = selectedNode;
        const request = buildFieldRequest(node, field, summaryFor);
        if (!request) return;
        const key = `${node.id}-${field}`;
        setGenerating((prev) => new Set(prev).add(key));
        try {
            const messages = [newMessage({ role: 'user', content: request.userMessage, type: MessageType.PROMPT })];
            const response = await promptForData(chatEndpoint, messages, getDefaultModel(DefaultModels.CHEAPEST), request.systemPrompt, defaultAccount);
            if (response && alive.current) {
                touch((current) => updateNode(current, node.id, (n) => ({ ...n, [field]: response.trim() }) as LayeredAssistantNode));
            }
        } catch (e) {
            console.error('AI generation failed:', e);
            if (alive.current) flash('Couldn’t generate that just now. Please try again.');
        } finally {
            if (alive.current) setGenerating((prev) => { const next = new Set(prev); next.delete(key); return next; });
        }
    };

    const applyGenerated = (generated: LayeredAssistant) => {
        setLa((prev) => ({ ...prev, name: prev.name.trim() ? prev.name : generated.name, description: prev.description.trim() ? prev.description : generated.description, rootNode: generated.rootNode, updatedAt: new Date().toISOString() }));
        setSelectedId(generated.rootNode.id);
        setPendingGenerated(null);
        setView('edit');
        flash('Tree generated — review it, then save.');
    };

    // ── Save ─────────────────────────────────────────────────────────────
    const commitSave = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const built = buildLayeredForSave({ la, settings, isGroup, groupSupportsAnalysis, astIcon });
            let assistantId = built.assistantId;
            let resolvedPath = publish.savedPath || undefined;
            let publishError: string | null = null;
            const callAddPath = shouldCallAddPath(publish);

            // A link needs an id: a brand-new layered assistant is saved first, then published, then saved again.
            if (callAddPath && !assistantId) {
                const first = await onSave(built);
                if (!first?.assistantId) throw new Error('save-failed');
                assistantId = first.assistantId;
                // Remember it: if a later step fails, a retry must update this record, not create a second one.
                if (alive.current) setLa((prev) => ({ ...prev, assistantId }));
            }
            if (callAddPath && assistantId) {
                const link = publish.path.trim().toLowerCase();
                try {
                    const result = await addAssistantPath(assistantId, link, groupId, publish.accessData.isPublic ?? true, publish.accessData.accessTo);
                    if (result?.success) {
                        resolvedPath = link;
                        // Registered: a retry after a later failure must not register it again.
                        if (alive.current) patchPublish({ savedPath: link, originalAccessData: publish.accessData });
                        toast.success(`Published at /assistants/${link}`, { duration: 3500 });
                    } else {
                        publishError = result?.message || 'the server refused it';
                    }
                } catch {
                    publishError = 'the request failed';
                }
            }

            const saved = await onSave({
                ...built,
                assistantId,
                astPath: resolvedPath,
                astPathData: publish.accessData,
            });
            if (!saved) throw new Error('save-failed');
            if (!alive.current) return;

            // Icon files the user replaced/removed are only safe to delete now that the record no longer points at them.
            const currentKey = (astIcon as any)?.key;
            queuedIconDeletes.current.filter((key) => key !== currentKey).forEach((key) => { void deleteFile(key); });
            queuedIconDeletes.current = [];

            // The record is saved, but the link wasn't published: stay open so the typed link isn't lost.
            if (publishError) {
                setSaveError(`Saved — but the link couldn’t be published (${publishError}). Fix or change the link and save again.`);
                return;
            }
            onClose();
        } catch {
            if (alive.current) setSaveError('We couldn’t save this layered assistant. Please try again.');
        } finally {
            if (alive.current) setIsSaving(false);
        }
    };

    const handleSave = () => {
        if (isSaving) return;
        // Blockers go in the footer next to the button that was pressed — the top-of-body notice can be
        // scrolled out of view when the user is down at the Publish card.
        const validation = validateForSave(la, { knownIds });
        if (validation.error) return setSaveError(validation.error);
        const blocker = publishBlocker(publish, { isGroup });
        if (blocker) return setSaveError(blocker);
        if (generating.size > 0) return setSaveError('Wait for AI to finish writing before saving.');
        setSaveError(null);
        if (validation.warnings.length > 0) return setWarnings(validation.warnings);
        void commitSave();
    };

    // ── Closing, Escape, focus ───────────────────────────────────────────
    const requestClose = () => {
        if (isSaving) return;
        if (dirty) setConfirmDiscard(true);
        else onClose();
    };
    const layersOpen = useRef(false);
    layersOpen.current = !!warnings || !!confirmRemoveId || confirmDiscard || !!pendingGenerated;
    const requestCloseRef = useRef(requestClose);
    requestCloseRef.current = requestClose;

    const panelRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    // Nothing may change while a multi-step save is in flight: the final save sends a snapshot, so an edit
    // made now would be lost when the dialog closes. `inert` also takes the body out of the tab order.
    useEffect(() => {
        const el = bodyRef.current as (HTMLDivElement & { inert?: boolean }) | null;
        if (el) el.inert = isSaving;
    }, [isSaving]);
    useEffect(() => { panelRef.current?.focus(); }, []);
    // No dependency array on purpose: re-registering every render keeps this listener *after* any
    // dropdown a child opened in the same commit, so a child's Escape (which stops propagation) wins.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (layersOpen.current) return; // a ConfirmDialog is on top and handles its own keys
            if (e.key === 'Escape') {
                if (e.defaultPrevented) return;
                e.stopPropagation();
                requestCloseRef.current();
                return;
            }
            if (e.key === 'Tab' && panelRef.current) {
                const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
                )).filter((el) => el.offsetParent !== null);
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    });

    // ── Render ───────────────────────────────────────────────────────────
    const leafCount = countNodes(root, 'leaf');
    const routerCount = countNodes(root, 'router');
    const linkedForEditor = isLeafNode(selectedNode) ? getLinked(selectedNode.assistantId) : null;
    const linkedDefinition = linkedForEditor?.data?.assistant?.definition as AssistantDefinition | undefined;
    const removeTarget = confirmRemoveId ? findNode(root, confirmRemoveId) : null;

    return (
        <div
            data-new-ui-shell="true"
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
        >
            <style>{`
                .nui-la-panels { display: grid; grid-template-columns: minmax(250px, 310px) minmax(0, 1fr) minmax(250px, 320px); gap: 12px; }
                .nui-la-panel { height: min(560px, 62dvh); }
                @media (max-width: 960px) {
                    .nui-la-panels { grid-template-columns: minmax(0, 1fr); }
                    .nui-la-panel { height: auto; max-height: 70dvh; }
                }
            `}</style>
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                style={{
                    width: '100%', maxWidth: 1440, height: 'min(920px, 95dvh)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', outline: 'none',
                    background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 14,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)', color: 'var(--text-primary)',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 22px 12px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                            {isSavedRecord ? 'Edit layered assistant' : 'New layered assistant'}
                        </h2>
                        <InfoTooltip
                            ariaLabel="About layered assistants"
                            maxWidth={360}
                            text="A layered assistant routes each conversation to the right assistant. Parents hold a decision guide and choose among their members; members are assistants or more parents."
                        />
                        {group && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px', borderRadius: 11, background: 'var(--bg-active)', color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 600 }}>
                                <IconUsers size={12} aria-hidden="true" /> {group.name}
                            </span>
                        )}
                    </div>
                    <button type="button" aria-label="Close" onClick={requestClose} className={`${FOCUS} hover:bg-[--bg-hover]`} style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <IconX size={18} aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div ref={bodyRef} aria-busy={isSaving} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 22px 18px', display: 'flex', flexDirection: 'column', gap: 14, opacity: isSaving ? 0.7 : 1 }}>
                    {view === 'generate' ? (
                        <LayeredAiGenerator
                            assistants={assistants}
                            onBack={() => setView('edit')}
                            onApply={(generated) => {
                                // The current tree is replaced wholesale and there is no undo: ask first if it has content.
                                if (root.children.length > 0) setPendingGenerated(generated);
                                else applyGenerated(generated);
                            }}
                        />
                    ) : (
                        <>
                            {/* Name + description */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr) auto', gap: 12, alignItems: 'end' }}>
                                <div>
                                    <label htmlFor="la-name" style={sectionLabel}>Name <span style={{ color: 'var(--text-error)' }} aria-hidden="true">*</span></label>
                                    <TextControl id="la-name" value={la.name} required placeholder="e.g. Student help desk" onChange={(e) => setLa((prev) => ({ ...prev, name: e.target.value }))} />
                                </div>
                                <div>
                                    <label htmlFor="la-desc" style={sectionLabel}>Description</label>
                                    <TextControl id="la-desc" value={la.description} placeholder="What does this layered assistant help with?" onChange={(e) => setLa((prev) => ({ ...prev, description: e.target.value }))} />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setView('generate')}
                                    disabled={!chatEndpoint}
                                    title="Let AI draft the whole tree"
                                    className={`${FOCUS} disabled:opacity-50`}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-raised)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                    <IconSparkles size={15} aria-hidden="true" /> Generate with AI
                                </button>
                            </div>

                            {notice && (
                                <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-fg)', fontSize: 13 }}>
                                    <IconAlertTriangle size={15} aria-hidden="true" style={{ color: 'var(--warning-icon)' }} /> {notice}
                                </div>
                            )}

                            {/* Three panels */}
                            <div className="nui-la-panels">
                                <section className="nui-la-panel" style={card} aria-label="Tree">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Tree</h3>
                                        <button type="button" onClick={handleAddSubParent} disabled={!addTarget} title={addTarget ? `Add a sub-parent to “${addTarget.name.trim() || 'Unnamed parent'}”` : 'Select a parent first'} className={`${FOCUS} disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[--bg-active]`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 7, background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
                                            <IconPlus size={13} aria-hidden="true" /> Sub-parent
                                        </button>
                                    </div>
                                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                                        <LayeredTreeOutline root={root} selectedId={selectedNode.id} onSelect={setSelectedId} onMove={handleMoveByDrop} onKeyboardMove={handleKeyboardMove} />
                                    </div>
                                    <p role="status" style={{ margin: '8px 0 6px', fontSize: 11.5, color: missing.length ? 'var(--text-error)' : 'var(--text-muted)' }}>
                                        {routerCount} parent{routerCount === 1 ? '' : 's'} · {leafCount} assistant{leafCount === 1 ? '' : 's'}
                                        {missing.length > 0 && ` · ${missing.length} can’t be found`}
                                    </p>
                                    <LayeredTreeMap root={root} selectedId={selectedNode.id} onSelect={setSelectedId} />
                                </section>

                                <section className="nui-la-panel" style={{ ...card, overflowY: 'auto' }} aria-label="Selected item">
                                    <LayeredNodeEditor
                                        key={selectedNode.id}
                                        node={selectedNode}
                                        isRoot={selectedNode.id === root.id}
                                        linked={linkedForEditor ? { name: linkedForEditor.name, description: linkedDefinition?.description || linkedForEditor.description } : null}
                                        contextOptions={routerContextOptions(linkedDefinition)}
                                        onChangeField={handleField}
                                        onToggleContext={handleContext}
                                        onSelect={setSelectedId}
                                        onRemoveNode={handleRemove}
                                        moves={moves}
                                        onMove={(m) => handleKeyboardMove(selectedNode.id, m)}
                                        generating={generating}
                                        canGenerate={!!chatEndpoint}
                                        onGenerate={handleGenerate}
                                    />
                                </section>

                                <section className="nui-la-panel" style={card} aria-label="Assistants">
                                    <LayeredAssistantPicker assistants={assistants} assignedIds={assigned} targetName={addTarget ? addTarget.name : null} onAdd={handleAddAssistant} />
                                </section>
                            </div>

                            {/* Cards below the panels */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {isGroup && group && (
                                    <CapabilityCard icon={<IconSettings size={18} />} title="Group settings" badge={group.name} defaultOpen={isEdit}>
                                        <LayeredSettingsPanel settings={settings} onChange={setSettings} groupName={group.name} groupSupportsAnalysis={groupSupportsAnalysis} />
                                    </CapabilityCard>
                                )}
                                <CapabilityCard
                                    icon={<IconWorld size={18} />}
                                    title="Publish at a link"
                                    badge={publish.savedPath ? `/assistants/${publish.savedPath}` : undefined}
                                    defaultOpen={!!publish.savedPath}
                                >
                                    <LayeredPublishPanel value={publish} onChange={patchPublish} astIcon={astIcon} onIconChange={setAstIcon} onQueueIconDelete={queueIconDelete} assistantId={la.assistantId} groupId={groupId} />
                                </CapabilityCard>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 22px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--text-error)', minHeight: 18 }}>{saveError}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={requestClose} disabled={isSaving} className={`${FOCUS} disabled:opacity-50`} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>
                            Cancel
                        </button>
                        <button type="button" onClick={handleSave} disabled={isSaving || view === 'generate'} aria-busy={isSaving} className={`${FOCUS} disabled:opacity-60`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', fontSize: 13.5, fontWeight: 600, cursor: isSaving ? 'default' : 'pointer' }}>
                            {isSaving && <IconLoader2 size={15} aria-hidden="true" className="motion-safe:animate-spin motion-reduce:animate-none" />}
                            {isSaving ? 'Saving…' : isSavedRecord ? 'Save changes' : 'Create'}
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={!!warnings}
                variant="warning"
                title="Save with these issues?"
                message={
                    <div data-new-ui-shell="true">
                        <p style={{ margin: '0 0 8px' }}>These may stop the router from choosing well:</p>
                        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                            {(warnings ?? []).map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                    </div>
                }
                confirmLabel="Save anyway"
                cancelLabel="Keep editing"
                onCancel={() => setWarnings(null)}
                onConfirm={() => { setWarnings(null); void commitSave(); }}
            />
            <ConfirmDialog
                isOpen={!!confirmRemoveId}
                title={removeTarget && isRouterNode(removeTarget.node) ? 'Remove this parent?' : 'Remove?'}
                message={
                    removeTarget && isRouterNode(removeTarget.node)
                        ? <>“{removeTarget.node.name.trim() || 'Unnamed parent'}” and everything inside it ({countNodes(removeTarget.node, 'leaf')} assistant{countNodes(removeTarget.node, 'leaf') === 1 ? '' : 's'}, {countNodes(removeTarget.node, 'router') - 1} sub-parent{countNodes(removeTarget.node, 'router') - 1 === 1 ? '' : 's'}) will be removed from this tree. You can still cancel without saving.</>
                        : 'This will be removed from the tree.'
                }
                confirmLabel="Remove"
                onCancel={() => setConfirmRemoveId(null)}
                onConfirm={() => confirmRemoveId && performRemove(confirmRemoveId)}
            />
            <ConfirmDialog
                isOpen={!!pendingGenerated}
                variant="warning"
                title="Replace the current tree?"
                message="The generated tree will replace everything in the tree now. This can’t be undone, but nothing is saved until you press Save — Cancel closes without keeping it."
                confirmLabel="Replace tree"
                cancelLabel="Keep my tree"
                onCancel={() => { setPendingGenerated(null); setView('edit'); }}
                onConfirm={() => pendingGenerated && applyGenerated(pendingGenerated)}
            />
            <ConfirmDialog
                isOpen={confirmDiscard}
                variant="warning"
                title="Discard your changes?"
                message="You have unsaved changes to this layered assistant. If you close now they will be lost."
                confirmLabel="Discard"
                cancelLabel="Keep editing"
                onCancel={() => setConfirmDiscard(false)}
                onConfirm={() => { setConfirmDiscard(false); onClose(); }}
            />
        </div>
    );
};

export default NewLayeredAssistantBuilder;
