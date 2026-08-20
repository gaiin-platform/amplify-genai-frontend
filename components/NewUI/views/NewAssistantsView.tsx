/**
 * NewAssistantsView — New UI replacement for AssistantGallery.
 * Four tabs: My Assistants | Shared with Me | Teams | Layered Assistants
 * (Prompt Templates moved to Settings → Customize → Prompt Templates)
 *
 * Design tokens from styles/globals.css:
 *   --bg-app, --bg-sidebar, --bg-raised, --bg-hover, --bg-active
 *   --border-subtle, --text-primary, --text-secondary, --text-muted, --accent
 */

import React, { useContext, useState, useMemo, useRef, useEffect } from 'react';
import {
    IconX,
    IconRobot,
    IconUsers,
    IconGitBranch,
    IconLoader2,
    IconSearch,
    IconPlus,
    IconPencil,
    IconTrash,
    IconSettings,
    IconChevronRight,
} from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Prompt } from '@/types/prompt';
import { Group, GroupAccessType } from '@/types/groups';
import { LayeredAssistant, createLayeredAssistant } from '@/types/layeredAssistant';
import { Assistant, AssistantDefinition, AssistantProviderID } from '@/types/assistant';
import { handleStartConversationWithPrompt } from '@/utils/app/prompts';
import { isAssistant, getAssistants, handleUpdateAssistantPrompt } from '@/utils/app/assistants';
import { deleteLayeredAssistant, saveLayeredAssistant } from '@/services/assistantService';
import { AssistantModal } from '@/components/Promptbar/components/AssistantModal';
import { useSession } from 'next-auth/react';
import { getUserIdentifier } from '@/utils/app/data';
import { NewUIAssistantCreationModal } from './NewUIAssistantCreationModal';
import { AstPathData } from '@/components/Promptbar/components/AssistantModalComponents/AssistantPathEditor';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';

// ── Types ─────────────────────────────────────────────────────────────────────

type MainTab = 'individual' | 'shared' | 'group' | 'layered';

// ── Shared row component ──────────────────────────────────────────────────────

interface RowProps {
    icon?: React.ReactNode;
    name: string;
    description?: string;
    onClick: () => void;
    onEdit?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
    isDeleting?: boolean;
    /** Optional access-type pill badge (Private / Shared / URL) */
    accessBadge?: { label: string; bg: string; color: string };
}

const AssistantRow: React.FC<RowProps> = ({
    icon,
    name,
    description,
    onClick,
    onEdit,
    onDelete,
    isDeleting,
    accessBadge,
}) => {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            className="group relative flex items-center gap-3 px-3 py-2.5 rounded-[8px] cursor-pointer transition-colors duration-100"
            style={{ backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onClick}
        >
            {/* Icon square */}
            <div
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-[8px]"
                style={{ backgroundColor: 'var(--bg-raised)' }}
            >
                {icon || <IconRobot size={18} style={{ color: 'var(--text-muted)' }} />}
            </div>

            {/* Name + description */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <p
                        className="text-[14px] font-medium truncate"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        {name}
                    </p>
                    {accessBadge && (
                        <span
                            className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                            style={{ background: accessBadge.bg, color: accessBadge.color }}
                        >
                            {accessBadge.label}
                        </span>
                    )}
                </div>
                {description && (
                    <p
                        className="text-[12px] truncate"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {description}
                    </p>
                )}
            </div>

            {/* Hover actions */}
            <div
                className={`flex items-center gap-1 transition-opacity duration-100 ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="flex items-center gap-1 h-[28px] px-2.5 rounded-[6px] text-[12px] transition-colors"
                    style={{
                        backgroundColor: 'var(--bg-hover)',
                        color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                    title={`Chat with ${name}`}
                >
                    Chat
                    <IconChevronRight size={12} />
                </button>

                {onEdit && (
                    <button
                        className="flex items-center justify-center h-[28px] w-[28px] rounded-[6px] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                        }}
                        onClick={onEdit}
                        title="Edit"
                    >
                        <IconPencil size={14} />
                    </button>
                )}

                {onDelete && (
                    <button
                        className="flex items-center justify-center h-[28px] w-[28px] rounded-[6px] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                            (e.currentTarget as HTMLElement).style.color = '#e05252';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                        }}
                        onClick={onDelete}
                        title="Delete"
                        disabled={isDeleting}
                    >
                        {isDeleting
                            ? <IconLoader2 size={14} className="animate-spin" />
                            : <IconTrash size={14} />
                        }
                    </button>
                )}
            </div>
        </div>
    );
};

// ── Section heading ───────────────────────────────────────────────────────────

const SectionHeading: React.FC<{ label: string; count?: number }> = ({ label, count }) => (
    <div className="flex items-center gap-2 px-3 pt-5 pb-1.5">
        <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
        >
            {label}
        </span>
        {count !== undefined && (
            <span
                className="text-[11px] px-1.5 py-0.5 rounded-full"
                style={{
                    backgroundColor: 'var(--bg-raised)',
                    color: 'var(--text-muted)',
                }}
            >
                {count}
            </span>
        )}
    </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ message: string; subMessage?: string; onAction?: () => void; actionLabel?: string }> = ({
    message,
    subMessage,
    onAction,
    actionLabel,
}) => (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        <IconRobot size={32} className="mb-4 opacity-20" style={{ color: 'var(--text-muted)' }} />
        <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {message}
        </p>
        {subMessage && (
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {subMessage}
            </p>
        )}
        {onAction && actionLabel && (
            <button
                onClick={onAction}
                className="mt-4 flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent)' }}
            >
                <IconPlus size={14} />
                {actionLabel}
            </button>
        )}
    </div>
);

// ── Search input ──────────────────────────────────────────────────────────────

const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({
    value,
    onChange,
    placeholder = 'Search…',
}) => (
    <div className="relative">
        <IconSearch
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
        />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-[34px] pl-9 pr-3 rounded-[8px] text-[13px] border focus:outline-none w-[200px] transition-colors"
            style={{
                backgroundColor: 'var(--bg-raised)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
            }}
        />
    </div>
);

// ── Tab 1: My Assistants ──────────────────────────────────────────────────────

const MyAssistantsTab: React.FC = () => {
    const {
        state: { prompts, statsService, availableModels, selectedAssistant, featureFlags, groups },
        dispatch: homeDispatch,
        handleNewConversation,
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);
    useEffect(() => { promptsRef.current = prompts; }, [prompts]);

    const groupsRef = useRef(groups);
    useEffect(() => { groupsRef.current = groups; }, [groups]);

    const [search, setSearch] = useState('');
    const [showAssistantModal, setShowAssistantModal] = useState(false);
    // Unified creation modal (replaces two-step NewAssistantTypeSelector + AssistantModal flow)
    const [showCreationModal, setShowCreationModal] = useState(false);
    const [selectedForEdit, setSelectedForEdit] = useState<Prompt | null>(null);

    const canEdit = (p: Prompt) => !p.data?.noEdit;

    // Mirrors Promptbar.tsx's visiblePrompts filter: hide prompts/assistants marked
    // data.hidden unless featureFlags.overrideInvisiblePrompts is set.
    const isVisible = (p: Prompt) => featureFlags.overrideInvisiblePrompts || !p.data?.hidden;

    // My Assistants = assistants I own/manage (canEdit=true), no groupId.
    // Shared-with-me assistants (noEdit=true) are in the "Shared with Me" tab.
    const allAssistants = useMemo(() =>
        prompts
            .filter((p: Prompt) => isAssistant(p) && !p.groupId && canEdit(p) && isVisible(p))
            .sort((a: Prompt, b: Prompt) => a.name.localeCompare(b.name)),
        [prompts, featureFlags.overrideInvisiblePrompts]
    );

    const filtered = useMemo(() => {
        if (!search.trim()) return allAssistants;
        const q = search.toLowerCase();
        return allAssistants.filter((p: Prompt) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
    }, [allAssistants, search]);

    const handleStartConversation = (p: Prompt) => {
        if (isAssistant(p) && p.data) {
            homeDispatch({ field: 'selectedAssistant', value: p.data.assistant });
        }
        statsService.startConversationEvent(p);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, p, availableModels);
        homeDispatch({ field: 'page', value: 'chat' });
    };

    // Open the unified creation modal (replaced two-step selector + AssistantModal flow)
    const handleNewAssistantClick = () => {
        setShowCreationModal(true);
    };

    const handleEditAssistant = (e: React.MouseEvent, p: Prompt) => {
        e.stopPropagation();
        setSelectedForEdit(p);
        setShowAssistantModal(true);
    };

    // Used only for the EDIT path (edit icon on existing rows).
    // Creation is now handled internally by NewUIAssistantCreationModal.
    const handleUpdateAssistant = (updatedPrompt: Prompt) => {
        handleUpdateAssistantPrompt(updatedPrompt, promptsRef.current, homeDispatch, selectedAssistant);
    };

    // Derive the access-type badge for a row: Private / Shared / URL
    const getAccessBadge = (p: Prompt): { label: string; bg: string; color: string } => {
        const def = p.data?.assistant?.definition as AssistantDefinition | undefined;
        const astPath = def?.astPath || (def?.data?.astPath as string | undefined);
        const astPathData = def?.data?.astPathData as AstPathData | undefined;
        if (!astPath) {
            return { label: 'Private', bg: 'var(--bg-active)', color: 'var(--text-muted)' };
        }
        if (astPathData?.isPublic === false) {
            return {
                label: 'Shared',
                bg: 'rgba(217,119,87,0.12)',
                color: 'var(--accent)',
            };
        }
        return { label: 'URL', bg: 'rgba(58,167,100,0.12)', color: '#3aa764' };
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header row */}
            <div
                className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                <SearchInput value={search} onChange={setSearch} placeholder="Search assistants…" />
                <button
                    onClick={handleNewAssistantClick}
                    className="flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                >
                    <IconPlus size={14} />
                    New Assistant
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
                {filtered.length === 0 ? (
                    !search ? (
                        <EmptyState
                            message="No assistants yet"
                            subMessage="Create your first assistant to get started"
                            onAction={handleNewAssistantClick}
                            actionLabel="Create your first assistant"
                        />
                    ) : (
                        <EmptyState message="No assistants match your search" />
                    )
                ) : (
                    filtered.map((p: Prompt) => (
                        <AssistantRow
                            key={p.id}
                            name={p.name}
                            description={p.description}
                            accessBadge={getAccessBadge(p)}
                            onClick={() => handleStartConversation(p)}
                            onEdit={(e) => handleEditAssistant(e, p)}
                        />
                    ))
                )}
            </div>

            {/* Unified creation modal — replaces NewAssistantTypeSelector + AssistantModal create flow */}
            {showCreationModal && (
                <NewUIAssistantCreationModal
                    onClose={() => setShowCreationModal(false)}
                />
            )}

            {/* AssistantModal — EDIT path only (edit icon on existing rows) */}
            {showAssistantModal && selectedForEdit && (
                <AssistantModal
                    assistant={selectedForEdit}
                    onCancel={() => {
                        setShowAssistantModal(false);
                        setSelectedForEdit(null);
                    }}
                    onSave={() => {
                        setShowAssistantModal(false);
                        setSelectedForEdit(null);
                    }}
                    onUpdateAssistant={handleUpdateAssistant}
                    loadingMessage="Saving assistant…"
                    loc=""
                    disableEdit={false}
                />
            )}
        </div>
    );
};

// ── Tab 1b: Shared with Me ────────────────────────────────────────────────────

const SharedWithMeTab: React.FC = () => {
    const {
        state: { prompts, statsService, availableModels, featureFlags },
        dispatch: homeDispatch,
        handleNewConversation,
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);
    useEffect(() => { promptsRef.current = prompts; }, [prompts]);

    const [search, setSearch] = useState('');

    // Shared assistants = those with noEdit=true (read-only access), no groupId.
    // Group assistants (including those I can only read) are in the Teams tab.
    const isVisible = (p: Prompt) => featureFlags.overrideInvisiblePrompts || !p.data?.hidden;

    const allShared = useMemo(() =>
        prompts
            .filter((p: Prompt) =>
                isAssistant(p) &&
                !p.groupId &&
                p.data?.noEdit === true &&
                isVisible(p)
            )
            .sort((a: Prompt, b: Prompt) => a.name.localeCompare(b.name)),
        [prompts, featureFlags.overrideInvisiblePrompts]
    );

    const filtered = useMemo(() => {
        if (!search.trim()) return allShared;
        const q = search.toLowerCase();
        return allShared.filter((p: Prompt) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
    }, [allShared, search]);

    const handleStartConversation = (p: Prompt) => {
        if (isAssistant(p) && p.data) {
            homeDispatch({ field: 'selectedAssistant', value: p.data.assistant });
        }
        statsService.startConversationEvent(p);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, p, availableModels);
        homeDispatch({ field: 'page', value: 'chat' });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header row */}
            <div
                className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search shared assistants…"
                />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
                {filtered.length === 0 ? (
                    !search ? (
                        <EmptyState
                            message="No shared assistants"
                            subMessage="Assistants that others share with you will appear here"
                        />
                    ) : (
                        <EmptyState message="No shared assistants match your search" />
                    )
                ) : (
                    filtered.map((p: Prompt) => (
                        <AssistantRow
                            key={p.id}
                            name={p.name}
                            description={p.description}
                            onClick={() => handleStartConversation(p)}
                            // Read-only: no edit button
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// ── Tab 2: Group Assistants ───────────────────────────────────────────────────

const GroupAssistantsTab: React.FC = () => {
    const {
        state: { groups, prompts, statsService, featureFlags, availableModels, selectedAssistant },
        dispatch: homeDispatch,
        handleNewConversation,
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);
    useEffect(() => { promptsRef.current = prompts; }, [prompts]);

    const groupsRef = useRef(groups);
    useEffect(() => { groupsRef.current = groups; }, [groups]);

    // Unified creation modal for new group assistants
    const [showGroupCreationModal, setShowGroupCreationModal] = useState(false);
    // AssistantModal still used for the edit path (edit icon → admin interface)
    const [showGroupAssistantModal, setShowGroupAssistantModal] = useState(false);
    const [groupAssistantForEdit, setGroupAssistantForEdit] = useState<Prompt | null>(null);

    const { data: session } = useSession();
    const userIdentifier = getUserIdentifier(session?.user);

    const [search, setSearch] = useState('');

    const hasAdminAccess = (group: Group) => {
        if (!userIdentifier || !featureFlags.assistantAdminInterface) return false;
        const access = group.members?.[userIdentifier];
        return access === GroupAccessType.ADMIN || access === GroupAccessType.WRITE;
    };

    const anyAdminAccess = groups.some((g: Group) => hasAdminAccess(g));

    // EDIT path only — used when admin opens AssistantModal from the admin interface
    const handleUpdateGroupAssistant = (updatedPrompt: Prompt) => {
        handleUpdateAssistantPrompt(updatedPrompt, promptsRef.current, homeDispatch, selectedAssistant);
    };

    const handleStartConversation = (p: Prompt) => {
        if (isAssistant(p) && p.data) {
            homeDispatch({ field: 'selectedAssistant', value: p.data.assistant });
        }
        statsService.startConversationEvent(p);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, p, availableModels);
        homeDispatch({ field: 'page', value: 'chat' });
    };

    const handleStartLayeredConversation = (la: LayeredAssistant) => {
        if (!la.assistantId) return;
        const syntheticAssistant: Assistant = {
            id: la.assistantId,
            definition: {
                name: la.name,
                description: la.description,
                assistantId: la.assistantId,
                instructions: '',
                tools: [],
                tags: [],
                fileKeys: [],
                dataSources: [],
                provider: AssistantProviderID.AMPLIFY,
                data: { isLayeredAssistant: true, ...(la.model ? { model: la.model } : {}) },
            },
        };
        handleNewConversation({ assistant: syntheticAssistant });
        homeDispatch({ field: 'page', value: 'chat' });
    };

    const openAdminInterface = (group: Group, assistant?: Prompt, layeredAssistant?: LayeredAssistant) => {
        // Admins must see/manage ALL assistants (including hidden ones), so pass the
        // original unfiltered group from context, not the display-filtered copy used
        // for the list rendering (see filteredGroups below, which strips data.hidden
        // assistants for non-admin display purposes only).
        const originalGroup = groups.find((g: Group) => g.id === group.id) ?? group;
        window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', {
            detail: {
                isOpen: true,
                data: { group: originalGroup, assistant, layeredAssistant },
            },
        }));
    };

    // Mirrors Promptbar.tsx's visiblePrompts filter: hide prompts/assistants marked
    // data.hidden unless featureFlags.overrideInvisiblePrompts is set.
    const isVisible = (p: Prompt) => featureFlags.overrideInvisiblePrompts || !p.data?.hidden;

    const filteredGroups = useMemo(() => {
        return groups
            .map((group: Group) => ({
                ...group,
                assistants: (group.assistants ?? []).filter(isVisible),
            }))
            .filter((group: Group) => {
                const hasAssistants = group.assistants && group.assistants.length > 0;
                const hasLAs = group.layeredAssistants && group.layeredAssistants.length > 0;
                const isAdmin = hasAdminAccess(group);
                if (!hasAssistants && !hasLAs && !isAdmin) return false;

                if (!search.trim()) return true;
                const q = search.toLowerCase();
                return (
                    group.name.toLowerCase().includes(q) ||
                    group.assistants.some((a: Prompt) =>
                        a.name.toLowerCase().includes(q) ||
                        (a.description && a.description.toLowerCase().includes(q))
                    ) ||
                    (group.layeredAssistants?.some((la: LayeredAssistant) =>
                        la.name.toLowerCase().includes(q) ||
                        (la.description && la.description.toLowerCase().includes(q))
                    ) ?? false)
                );
            });
    }, [groups, search, userIdentifier, featureFlags]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                <SearchInput value={search} onChange={setSearch} placeholder="Search groups…" />
                {anyAdminAccess && (
                    <button
                        onClick={() => setShowGroupCreationModal(true)}
                        className="flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: 'var(--accent)' }}
                    >
                        <IconPlus size={14} />
                        New Assistant
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
                {filteredGroups.length === 0 ? (
                    <EmptyState
                        message={search ? 'No group assistants match your search' : 'No group assistants available'}
                    />
                ) : (
                    filteredGroups.map((group: Group) => {
                        const gAssistants = search.trim()
                            ? group.assistants.filter((a: Prompt) => {
                                const q = search.toLowerCase();
                                return a.name.toLowerCase().includes(q) ||
                                    (a.description && a.description.toLowerCase().includes(q));
                            })
                            : group.assistants;

                        const gLAs = search.trim()
                            ? (group.layeredAssistants || []).filter((la: LayeredAssistant) => {
                                const q = search.toLowerCase();
                                return la.name.toLowerCase().includes(q) ||
                                    (la.description && la.description.toLowerCase().includes(q));
                            })
                            : (group.layeredAssistants || []);

                        const isAdmin = hasAdminAccess(group);
                        const total = gAssistants.length + gLAs.length;

                        return (
                            <div key={group.id} className="mb-4">
                                {/* Group section header */}
                                <div
                                    className="flex items-center justify-between px-3 py-2 rounded-[8px]"
                                    style={{ backgroundColor: 'var(--bg-raised)' }}
                                >
                                    <div className="flex items-center gap-2">
                                        <IconUsers size={15} style={{ color: 'var(--text-muted)' }} />
                                        <span
                                            className="text-[13px] font-semibold"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            {group.name}
                                        </span>
                                        <span
                                            className="text-[11px] px-1.5 py-0.5 rounded-full"
                                            style={{
                                                backgroundColor: 'var(--bg-hover)',
                                                color: 'var(--text-muted)',
                                            }}
                                        >
                                            {total}
                                        </span>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => openAdminInterface(group)}
                                            className="flex items-center justify-center h-[26px] w-[26px] rounded-[6px] transition-colors"
                                            style={{ color: 'var(--text-muted)' }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-active)';
                                                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                                            }}
                                            title="Open in Assistant Admin Interface"
                                        >
                                            <IconSettings size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Assistants */}
                                <div className="pl-2 mt-1">
                                    {gAssistants.map((a: Prompt) => (
                                        <AssistantRow
                                            key={a.id}
                                            name={a.name}
                                            description={a.description}
                                            onClick={() => handleStartConversation(a)}
                                            onEdit={isAdmin ? (e) => {
                                                e.stopPropagation();
                                                openAdminInterface(group, a);
                                            } : undefined}
                                        />
                                    ))}
                                    {gLAs.map((la: LayeredAssistant) => (
                                        <AssistantRow
                                            key={la.assistantId ?? la.name}
                                            icon={<IconGitBranch size={18} style={{ color: 'var(--text-muted)' }} />}
                                            name={la.name}
                                            description={la.description}
                                            onClick={() => handleStartLayeredConversation(la)}
                                            onEdit={isAdmin ? (e) => {
                                                e.stopPropagation();
                                                openAdminInterface(group, undefined, la);
                                            } : undefined}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Unified creation modal for new group assistants */}
            {showGroupCreationModal && (
                <NewUIAssistantCreationModal
                    onClose={() => setShowGroupCreationModal(false)}
                />
            )}

            {/* AssistantModal — EDIT path (opens from admin interface) */}
            {showGroupAssistantModal && groupAssistantForEdit && (
                <AssistantModal
                    assistant={groupAssistantForEdit}
                    onCancel={() => {
                        setShowGroupAssistantModal(false);
                        setGroupAssistantForEdit(null);
                    }}
                    onSave={() => {
                        setShowGroupAssistantModal(false);
                        setGroupAssistantForEdit(null);
                    }}
                    onUpdateAssistant={handleUpdateGroupAssistant}
                    loadingMessage="Saving assistant…"
                    loc=""
                    disableEdit={false}
                />
            )}
        </div>
    );
};

// ── Tab 3 (was Tab 4): Layered Assistants ────────────────────────────────────
// NOTE: Prompt Templates tab was removed from this view (Phase N).
// It now lives in Settings → Customize → Prompt Templates (PromptTemplatesSection.tsx).

const LayeredAssistantsTab: React.FC = () => {
    const {
        state: { layeredAssistants, syncingLayeredAssistants },
        dispatch: homeDispatch,
        handleNewConversation,
        setLoadingMessage,
    } = useContext(HomeContext);

    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteLA, setConfirmDeleteLA] = useState<LayeredAssistant | null>(null);

    const filtered = useMemo(() => {
        if (!search.trim()) return layeredAssistants;
        const q = search.toLowerCase();
        return layeredAssistants.filter((la: LayeredAssistant) =>
            la.name.toLowerCase().includes(q) ||
            (la.description && la.description.toLowerCase().includes(q))
        );
    }, [layeredAssistants, search]);

    const handleSave = async (la: LayeredAssistant) => {
        setLoadingMessage('Saving layered assistant…');
        try {
            const result = await saveLayeredAssistant(la);
            if (result?.success && result.data?.assistantId) {
                const saved: LayeredAssistant = { ...la, assistantId: result.data.assistantId };
                const updated = layeredAssistants.some((x: LayeredAssistant) => x.assistantId === saved.assistantId)
                    ? layeredAssistants.map((x: LayeredAssistant) => x.assistantId === saved.assistantId ? saved : x)
                    : [...layeredAssistants, saved];
                homeDispatch({ field: 'layeredAssistants', value: updated });
            }
        } catch (e) {
            console.error('Failed to save layered assistant:', e);
        } finally {
            setLoadingMessage('');
        }
    };

    const handleSelect = (la: LayeredAssistant) => {
        if (!la.assistantId) return;
        const syntheticAssistant: Assistant = {
            id: la.assistantId,
            definition: {
                name: la.name,
                description: la.description,
                assistantId: la.assistantId,
                instructions: '',
                tools: [],
                tags: [],
                fileKeys: [],
                dataSources: [],
                provider: AssistantProviderID.AMPLIFY,
                data: { isLayeredAssistant: true, ...(la.model ? { model: la.model } : {}) },
            },
        };
        handleNewConversation({ assistant: syntheticAssistant });
        homeDispatch({ field: 'page', value: 'chat' });
    };

    const handleEdit = (la: LayeredAssistant) => {
        window.dispatchEvent(new CustomEvent('openLayeredBuilderTrigger', {
            detail: {
                isOpen: true,
                data: {
                    title: 'Layered Assistant Builder',
                    initialData: la,
                    onSave: handleSave,
                },
            },
        }));
    };

    const handleCreateNew = () => {
        const newLA = createLayeredAssistant('New Layered Assistant');
        window.dispatchEvent(new CustomEvent('openLayeredBuilderTrigger', {
            detail: {
                isOpen: true,
                data: {
                    title: 'Layered Assistant Builder',
                    initialData: newLA,
                    onSave: handleSave,
                },
            },
        }));
    };

    const handleDelete = async (la: LayeredAssistant) => {
        if (!la.assistantId) return;
        setDeletingId(la.assistantId);
        try {
            const result = await deleteLayeredAssistant(la.assistantId);
            if (result?.success) {
                homeDispatch({
                    field: 'layeredAssistants',
                    value: layeredAssistants.filter((x: LayeredAssistant) => x.assistantId !== la.assistantId),
                });
            }
        } catch (e) {
            console.error('Failed to delete layered assistant:', e);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                <SearchInput value={search} onChange={setSearch} placeholder="Search layered assistants…" />
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                >
                    <IconPlus size={14} />
                    New Layered Assistant
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
                {syncingLayeredAssistants ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <IconLoader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                            Loading layered assistants…
                        </p>
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState
                        message={search ? 'No layered assistants match your search' : 'No layered assistants yet'}
                        subMessage={!search ? 'Create one to get started' : undefined}
                        onAction={!search ? handleCreateNew : undefined}
                        actionLabel="New Layered Assistant"
                    />
                ) : (
                    filtered.map((la: LayeredAssistant) => (
                        <AssistantRow
                            key={la.assistantId ?? la.name}
                            icon={<IconGitBranch size={18} style={{ color: 'var(--text-muted)' }} />}
                            name={la.name}
                            description={la.description}
                            onClick={() => handleSelect(la)}
                            onEdit={(e) => {
                                e.stopPropagation();
                                handleEdit(la);
                            }}
                            onDelete={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteLA(la);
                            }}
                            isDeleting={deletingId === la.assistantId}
                        />
                    ))
                )}
            </div>

            {/* Delete confirmation dialog for layered assistants */}
            <ConfirmDialog
                isOpen={!!confirmDeleteLA}
                title="Delete assistant?"
                message={
                    <>
                        Are you sure you want to delete{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>
                            {confirmDeleteLA?.name ?? 'this assistant'}
                        </strong>
                        ? This cannot be undone.
                    </>
                }
                confirmLabel="Delete"
                onConfirm={() => {
                    const la = confirmDeleteLA;
                    setConfirmDeleteLA(null);
                    if (la) handleDelete(la);
                }}
                onCancel={() => setConfirmDeleteLA(null)}
            />
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

export const NewAssistantsView: React.FC = () => {
    const {
        state: { groups, syncingPrompts, syncingLayeredAssistants, layeredAssistants, activeAssistantGalleryTab },
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    // Mirror the existing persisted tab preference
    const [activeTab, setActiveTab] = useState<MainTab>(() => {
        const saved = localStorage.getItem('activeAssistantGalleryTab') as MainTab | null;
        const valid: MainTab[] = ['individual', 'shared', 'group', 'layered'];
        // 'templates' was removed — users with that stored value fall back to 'individual'
        return saved && valid.includes(saved) ? saved : 'individual';
    });

    const shouldShowGroupTab = syncingPrompts || groups.length > 0;
    const shouldShowLayeredTab = syncingLayeredAssistants || layeredAssistants.length > 0;

    // If the current tab becomes hidden, fall back to individual
    useEffect(() => {
        if (activeTab === 'group' && !shouldShowGroupTab) setActiveTab('individual');
        if (activeTab === 'layered' && !shouldShowLayeredTab) setActiveTab('individual');
    }, [shouldShowGroupTab, shouldShowLayeredTab, activeTab]);

    const changeTab = (tab: MainTab) => {
        setActiveTab(tab);
        // Keep legacy localStorage key in sync so AssistantGallery state is not lost
        localStorage.setItem('activeAssistantGalleryTab', tab);
        homeDispatch({ field: 'activeAssistantGalleryTab', value: tab });
    };

    const tabs: { id: MainTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
        {
            id: 'individual',
            label: 'My Assistants',
            icon: <IconRobot size={15} />,
            visible: true,
        },
        {
            id: 'shared',
            label: 'Shared with Me',
            icon: <IconUsers size={15} />,
            visible: true,
        },
        {
            id: 'group',
            label: syncingPrompts ? 'Loading Teams…' : 'Teams',
            icon: syncingPrompts
                ? <IconLoader2 size={15} className="animate-spin" />
                : <IconUsers size={15} />,
            visible: shouldShowGroupTab,
        },
        {
            id: 'layered',
            label: syncingLayeredAssistants ? 'Loading Layered…' : 'Layered Assistants',
            icon: syncingLayeredAssistants
                ? <IconLoader2 size={15} className="animate-spin" />
                : <IconGitBranch size={15} />,
            visible: shouldShowLayeredTab,
        },
        // 'templates' tab removed — Prompt Templates moved to Settings → Customize
    ];

    return (
        <div
            data-new-ui-assistants="true"
            className="flex flex-col h-full w-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-app)', fontFamily: 'Inter, sans-serif' }}
        >
            {/* ── Sticky tab bar ── */}
            <div
                className="flex-shrink-0 flex items-center px-4 border-b"
                style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    borderColor: 'var(--border-subtle)',
                    height: 48,
                }}
            >
                {/* Back/close button */}
                <button
                    onClick={() => homeDispatch({ field: 'page', value: 'chat' })}
                    className="flex items-center justify-center h-8 w-8 rounded-[8px] mr-3 transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    }}
                    title="Back to chat"
                >
                    <IconX size={16} />
                </button>

                {/* Tabs */}
                <div className="flex items-center h-full gap-1">
                    {tabs
                        .filter((t) => t.visible)
                        .map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => changeTab(tab.id)}
                                    className="relative flex items-center gap-1.5 h-full px-3 text-[13px] transition-colors"
                                    style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                                        }
                                    }}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                    {isActive && (
                                        <span
                                            className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                                            style={{ backgroundColor: 'var(--accent)' }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                </div>
            </div>

            {/* ── Tab content ── */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'individual' && <MyAssistantsTab />}
                {activeTab === 'shared' && <SharedWithMeTab />}
                {activeTab === 'group' && shouldShowGroupTab && <GroupAssistantsTab />}
                {activeTab === 'layered' && shouldShowLayeredTab && <LayeredAssistantsTab />}
            </div>
        </div>
    );
};

export default NewAssistantsView;
