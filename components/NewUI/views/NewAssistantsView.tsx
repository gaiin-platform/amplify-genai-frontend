/**
 * NewAssistantsView — New UI replacement for AssistantGallery.
 * Four tabs: My Assistants | Group Assistants | Prompt Templates | Layered Assistants
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
    IconTemplate,
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
import { handleStartConversationWithPrompt, createEmptyPrompt, savePrompts } from '@/utils/app/prompts';
import { isAssistant, getAssistants, handleUpdateAssistantPrompt } from '@/utils/app/assistants';
import { deleteLayeredAssistant, saveLayeredAssistant } from '@/services/assistantService';
import { AssistantModal } from '@/components/Promptbar/components/AssistantModal';
import { PromptModal } from '@/components/Promptbar/components/PromptModal';
import { useSession } from 'next-auth/react';
import { getUserIdentifier } from '@/utils/app/data';

// ── Types ─────────────────────────────────────────────────────────────────────

type MainTab = 'individual' | 'group' | 'templates' | 'layered';

// ── Shared row component ──────────────────────────────────────────────────────

interface RowProps {
    icon?: React.ReactNode;
    name: string;
    description?: string;
    onClick: () => void;
    onEdit?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
    isDeleting?: boolean;
}

const AssistantRow: React.FC<RowProps> = ({
    icon,
    name,
    description,
    onClick,
    onEdit,
    onDelete,
    isDeleting,
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
                <p
                    className="text-[14px] font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                >
                    {name}
                </p>
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
        state: { prompts, statsService, availableModels, selectedAssistant },
        dispatch: homeDispatch,
        handleNewConversation,
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);
    useEffect(() => { promptsRef.current = prompts; }, [prompts]);

    const [search, setSearch] = useState('');
    const [activeSubTab, setActiveSubTab] = useState<'your' | 'shared'>('your');
    const [showAssistantModal, setShowAssistantModal] = useState(false);
    const [selectedForEdit, setSelectedForEdit] = useState<Prompt | null>(null);

    const canEdit = (p: Prompt) => !p.data?.noEdit;

    const allAssistants = useMemo(() =>
        prompts
            .filter((p: Prompt) => isAssistant(p) && !p.groupId)
            .sort((a: Prompt, b: Prompt) => a.name.localeCompare(b.name)),
        [prompts]
    );

    const filtered = useMemo(() => {
        if (!search.trim()) return allAssistants;
        const q = search.toLowerCase();
        return allAssistants.filter((p: Prompt) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
    }, [allAssistants, search]);

    const yourAssistants = filtered.filter((p: Prompt) => canEdit(p));
    const sharedAssistants = filtered.filter((p: Prompt) => !canEdit(p));
    const activeList = activeSubTab === 'your' ? yourAssistants : sharedAssistants;

    const handleStartConversation = (p: Prompt) => {
        if (isAssistant(p) && p.data) {
            homeDispatch({ field: 'selectedAssistant', value: p.data.assistant });
        }
        statsService.startConversationEvent(p);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, p, availableModels);
        homeDispatch({ field: 'page', value: 'chat' });
    };

    const handleCreateAssistant = () => {
        const promptName = `Assistant ${getAssistants(promptsRef.current).length + 1}`;
        const newPrompt = createEmptyPrompt(promptName, null);
        newPrompt.folderId = 'assistants';

        const assistantDef: AssistantDefinition = {
            name: newPrompt.name,
            description: '',
            instructions: '',
            tools: [],
            tags: [],
            dataSources: [],
            version: 1,
            fileKeys: [],
            provider: AssistantProviderID.AMPLIFY,
        };

        if (!newPrompt.data) newPrompt.data = {};
        if (!newPrompt.data.assistant) newPrompt.data.assistant = {};
        newPrompt.data.assistant.definition = assistantDef;

        setSelectedForEdit(newPrompt);
        setShowAssistantModal(true);
    };

    const handleEditAssistant = (e: React.MouseEvent, p: Prompt) => {
        e.stopPropagation();
        setSelectedForEdit(p);
        setShowAssistantModal(true);
    };

    const handleUpdateAssistant = (updatedPrompt: Prompt) => {
        handleUpdateAssistantPrompt(updatedPrompt, promptsRef.current, homeDispatch, selectedAssistant);
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
                    onClick={handleCreateAssistant}
                    className="flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                >
                    <IconPlus size={14} />
                    New Assistant
                </button>
            </div>

            {/* Sub-tabs */}
            <div
                className="flex items-center gap-0 px-6 flex-shrink-0 border-b"
                style={{ borderColor: 'var(--border-subtle)', height: 40 }}
            >
                {(['your', 'shared'] as const).map((tab) => {
                    const count = tab === 'your' ? yourAssistants.length : sharedAssistants.length;
                    const label = tab === 'your' ? 'Your Assistants' : 'Shared Assistants';
                    const isActive = activeSubTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveSubTab(tab)}
                            className="relative flex items-center gap-1.5 h-full px-4 text-[13px] transition-colors"
                            style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}
                        >
                            {label}
                            <span
                                className="text-[11px] px-1.5 py-0.5 rounded-full"
                                style={{
                                    backgroundColor: isActive ? 'var(--bg-raised)' : 'transparent',
                                    color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)',
                                }}
                            >
                                {count}
                            </span>
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

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
                {activeList.length === 0 ? (
                    activeSubTab === 'your' && !search ? (
                        <EmptyState
                            message="No assistants yet"
                            subMessage="Create your first assistant to get started"
                            onAction={handleCreateAssistant}
                            actionLabel="Create your first assistant"
                        />
                    ) : (
                        <EmptyState
                            message={search ? 'No assistants match your search' : 'No shared assistants available'}
                        />
                    )
                ) : (
                    activeList.map((p: Prompt) => (
                        <AssistantRow
                            key={p.id}
                            name={p.name}
                            description={p.description}
                            onClick={() => handleStartConversation(p)}
                            onEdit={canEdit(p) ? (e) => handleEditAssistant(e, p) : undefined}
                        />
                    ))
                )}
            </div>

            {/* Assistant Modal */}
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
                    disableEdit={selectedForEdit ? !canEdit(selectedForEdit) : false}
                />
            )}
        </div>
    );
};

// ── Tab 2: Group Assistants ───────────────────────────────────────────────────

const GroupAssistantsTab: React.FC = () => {
    const {
        state: { groups, prompts, statsService, featureFlags, availableModels },
        dispatch: homeDispatch,
        handleNewConversation,
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);
    useEffect(() => { promptsRef.current = prompts; }, [prompts]);

    const { data: session } = useSession();
    const userIdentifier = getUserIdentifier(session?.user);

    const [search, setSearch] = useState('');

    const hasAdminAccess = (group: Group) => {
        if (!userIdentifier || !featureFlags.assistantAdminInterface) return false;
        const access = group.members?.[userIdentifier];
        return access === GroupAccessType.ADMIN || access === GroupAccessType.WRITE;
    };

    const anyAdminAccess = groups.some((g: Group) => hasAdminAccess(g));

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
        window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', {
            detail: {
                isOpen: true,
                data: { group, assistant, layeredAssistant },
            },
        }));
    };

    const filteredGroups = useMemo(() => {
        return groups.filter((group: Group) => {
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
                        onClick={() =>
                            window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', {
                                detail: { isOpen: true, data: {} },
                            }))
                        }
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
        </div>
    );
};

// ── Tab 3: Prompt Templates ───────────────────────────────────────────────────

const PromptTemplatesTab: React.FC = () => {
    const {
        state: { prompts, statsService, availableModels },
        dispatch: homeDispatch,
        handleNewConversation,
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);
    useEffect(() => { promptsRef.current = prompts; }, [prompts]);

    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Prompt | null>(null);

    const allTemplates = useMemo(
        () => prompts.filter((p: Prompt) => !isAssistant(p)),
        [prompts]
    );

    const grouped = useMemo(() => {
        const q = search.trim().toLowerCase();
        const match = (p: Prompt) =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q));

        const quickActions = allTemplates
            .filter((p: Prompt) => p.folderId === 'amplify_helpers' && match(p))
            .sort((a: Prompt, b: Prompt) => a.name.localeCompare(b.name));

        const systemInstructions = allTemplates
            .filter(
                (p: Prompt) =>
                    p.type === 'root_prompt' &&
                    p.folderId !== 'amplify_helpers' &&
                    match(p)
            )
            .sort((a: Prompt, b: Prompt) => a.name.localeCompare(b.name));

        const yourTemplates = allTemplates
            .filter(
                (p: Prompt) =>
                    p.folderId !== 'amplify_helpers' &&
                    p.type !== 'root_prompt' &&
                    match(p)
            )
            .sort((a: Prompt, b: Prompt) => a.name.localeCompare(b.name));

        return { quickActions, systemInstructions, yourTemplates };
    }, [allTemplates, search]);

    const hasResults =
        grouped.quickActions.length > 0 ||
        grouped.systemInstructions.length > 0 ||
        grouped.yourTemplates.length > 0;

    const handleStartConversation = (p: Prompt) => {
        statsService.startConversationEvent(p);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, p, availableModels);
        homeDispatch({ field: 'page', value: 'chat' });
    };

    const handleCreateTemplate = () => {
        const newPrompt = createEmptyPrompt(`Template ${promptsRef.current.filter((p: Prompt) => !isAssistant(p)).length + 1}`, null);
        const updatedPrompts = [...promptsRef.current, newPrompt];
        homeDispatch({ field: 'prompts', value: updatedPrompts });
        savePrompts(updatedPrompts);
        setSelectedTemplate(newPrompt);
        setShowModal(true);
    };

    const handleEditTemplate = (e: React.MouseEvent, p: Prompt) => {
        e.stopPropagation();
        setSelectedTemplate(p);
        setShowModal(true);
    };

    const handleUpdatePrompt = (updated: Prompt) => {
        homeDispatch({
            field: 'prompts',
            value: prompts.map((p: Prompt) => p.id === updated.id ? updated : p),
        });
    };

    const handleCancelModal = () => {
        // Remove if it was a brand-new template
        if (selectedTemplate) {
            const wasNew = !prompts.find((p: Prompt) => p.id === selectedTemplate.id)
                || promptsRef.current.find((p: Prompt) => p.id === selectedTemplate.id)?.name.startsWith('Template ');
            // Only remove if it was just created (no description or content)
            const existing = promptsRef.current.find((p: Prompt) => p.id === selectedTemplate.id);
            if (existing && !existing.description && !existing.content) {
                const updatedPrompts = promptsRef.current.filter((p: Prompt) => p.id !== selectedTemplate.id);
                homeDispatch({ field: 'prompts', value: updatedPrompts });
                savePrompts(updatedPrompts);
            }
        }
        setShowModal(false);
        setSelectedTemplate(null);
    };

    const canEditTemplate = (p: Prompt) => !p.data?.noEdit;

    const renderSection = (label: string, items: Prompt[]) => {
        if (items.length === 0) return null;
        return (
            <div key={label}>
                <SectionHeading label={label} count={items.length} />
                {items.map((p: Prompt) => (
                    <AssistantRow
                        key={p.id}
                        icon={<IconTemplate size={18} style={{ color: 'var(--text-muted)' }} />}
                        name={p.name}
                        description={p.description}
                        onClick={() => handleStartConversation(p)}
                        onEdit={canEditTemplate(p) ? (e) => handleEditTemplate(e, p) : undefined}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" />
                <button
                    onClick={handleCreateTemplate}
                    className="flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                >
                    <IconPlus size={14} />
                    New Template
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
                {!hasResults ? (
                    <EmptyState
                        message={search ? 'No templates match your search' : 'No templates available'}
                        onAction={!search ? handleCreateTemplate : undefined}
                        actionLabel="Create your first template"
                    />
                ) : (
                    <>
                        {renderSection('Quick Actions', grouped.quickActions)}
                        {renderSection('System Instructions', grouped.systemInstructions)}
                        {renderSection('Your Templates', grouped.yourTemplates)}
                    </>
                )}
            </div>

            {/* Prompt Modal */}
            {showModal && selectedTemplate && (
                <PromptModal
                    prompt={selectedTemplate}
                    onCancel={handleCancelModal}
                    onSave={() => {
                        setShowModal(false);
                        setSelectedTemplate(null);
                    }}
                    onUpdatePrompt={handleUpdatePrompt}
                />
            )}
        </div>
    );
};

// ── Tab 4: Layered Assistants ─────────────────────────────────────────────────

const LayeredAssistantsTab: React.FC = () => {
    const {
        state: { layeredAssistants, syncingLayeredAssistants },
        dispatch: homeDispatch,
        handleNewConversation,
        setLoadingMessage,
    } = useContext(HomeContext);

    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

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
                                handleDelete(la);
                            }}
                            isDeleting={deletingId === la.assistantId}
                        />
                    ))
                )}
            </div>
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
        const valid: MainTab[] = ['individual', 'group', 'templates', 'layered'];
        return saved && valid.includes(saved) ? saved : 'individual';
    });

    const shouldShowGroupTab = syncingPrompts || groups.length > 0;
    const shouldShowLayeredTab = syncingLayeredAssistants || layeredAssistants.length > 0;

    // If the current tab becomes hidden, fall back to individual
    useEffect(() => {
        if (activeTab === 'group' && !shouldShowGroupTab) setActiveTab('individual');
        if (activeTab === 'layered' && !shouldShowLayeredTab) setActiveTab('individual');
    }, [shouldShowGroupTab, shouldShowLayeredTab]);

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
            id: 'group',
            label: syncingPrompts ? 'Loading Groups…' : 'Group Assistants',
            icon: syncingPrompts
                ? <IconLoader2 size={15} className="animate-spin" />
                : <IconUsers size={15} />,
            visible: shouldShowGroupTab,
        },
        {
            id: 'templates',
            label: 'Prompt Templates',
            icon: <IconTemplate size={15} />,
            visible: true,
        },
        {
            id: 'layered',
            label: syncingLayeredAssistants ? 'Loading Layered…' : 'Layered Assistants',
            icon: syncingLayeredAssistants
                ? <IconLoader2 size={15} className="animate-spin" />
                : <IconGitBranch size={15} />,
            visible: shouldShowLayeredTab,
        },
    ];

    return (
        <div
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
                {activeTab === 'group' && shouldShowGroupTab && <GroupAssistantsTab />}
                {activeTab === 'templates' && <PromptTemplatesTab />}
                {activeTab === 'layered' && shouldShowLayeredTab && <LayeredAssistantsTab />}
            </div>
        </div>
    );
};

export default NewAssistantsView;
