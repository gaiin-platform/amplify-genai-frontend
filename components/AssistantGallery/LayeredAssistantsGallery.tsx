import { FC, useContext, useState } from 'react';
import { IconGitBranch, IconEdit, IconTrash, IconLoader2, IconRobot, IconSearch } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import {
    LayeredAssistant,
    LayeredAssistantNode,
    isRouterNode,
    isLeafNode,
} from '@/types/layeredAssistant';
import { Assistant, AssistantProviderID } from '@/types/assistant';
import { deleteLayeredAssistant, saveLayeredAssistant } from '@/services/assistantService';

// ── Tree stats helpers ───────────────────────────────────────────────────────

interface TreeStats {
    routers: number;
    leaves: number;
    depth: number;
}

const walkTree = (node: LayeredAssistantNode, currentDepth = 0): TreeStats => {
    if (isLeafNode(node)) return { routers: 0, leaves: 1, depth: currentDepth };
    // router
    const childStats = node.children.map(c => walkTree(c, currentDepth + 1));
    return {
        routers: 1 + childStats.reduce((sum, s) => sum + s.routers, 0),
        leaves:  childStats.reduce((sum, s) => sum + s.leaves,  0),
        depth:   Math.max(currentDepth, ...childStats.map(s => s.depth)),
    };
};

// ── Depth dot indicator ──────────────────────────────────────────────────────

const DEPTH_COLORS = [
    'bg-purple-400 dark:bg-purple-500',
    'bg-blue-400 dark:bg-blue-500',
    'bg-emerald-400 dark:bg-emerald-500',
    'bg-rose-400 dark:bg-rose-500',
];

const DepthDots: FC<{ depth: number }> = ({ depth }) => (
    <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(depth + 1, 4) }).map((_, i) => (
            <div
                key={i}
                className={`rounded-full transition-all ${DEPTH_COLORS[i % DEPTH_COLORS.length]} ${
                    i === depth ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5 opacity-60'
                }`}
            />
        ))}
    </div>
);

// ── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
    la: LayeredAssistant;
    onSelect: (la: LayeredAssistant) => void;
    onEdit: (la: LayeredAssistant) => void;
    onDelete: (la: LayeredAssistant) => void;
    isDeleting: boolean;
}

const LayeredAssistantCard: FC<CardProps> = ({ la, onSelect, onEdit, onDelete, isDeleting }) => {
    const [hovered, setHovered] = useState(false);
    const stats = walkTree(la.rootNode);
    const updatedDate = la.updatedAt
        ? new Date(la.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    return (
        <div
            className="relative flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => onSelect(la)}
        >
            {/* Gradient header */}
            <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40 border-b border-purple-200/60 dark:border-purple-700/40">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-300 to-blue-300 dark:from-purple-600/70 dark:to-blue-600/70 shadow-sm">
                    <IconGitBranch size={20} className="text-purple-700 dark:text-purple-700" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{la.name || 'Untitled'}</p>
                    {updatedDate && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Updated {updatedDate}</p>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex items-center gap-4 px-4 py-3">
                {/* Routers badge */}
                <div className="flex items-center gap-1.5">
                    <IconGitBranch size={13} className="text-purple-500 dark:text-purple-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                        {stats.routers} {stats.routers === 1 ? 'router' : 'routers'}
                    </span>
                </div>

                {/* Leaves badge */}
                <div className="flex items-center gap-1.5">
                    <IconRobot size={13} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                        {stats.leaves} {stats.leaves === 1 ? 'assistant' : 'assistants'}
                    </span>
                </div>

                {/* Depth dots */}
                <div className="ml-auto">
                    <DepthDots depth={stats.depth} />
                </div>
            </div>

            {/* Hover action buttons - top right corner */}
            <div
                className={`absolute top-3 right-3 flex items-center justify-end gap-1.5 transition-opacity duration-150 ${
                    hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={() => onEdit(la)}
                    className="flex items-center justify-center h-7 w-7 rounded-lg bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-gray-600 shadow-sm hover:shadow-md transition-all"
                    title="Edit layered assistant"
                >
                    <IconEdit size={16} />
                </button>
                <button
                    onClick={() => onDelete(la)}
                    disabled={isDeleting}
                    className="flex items-center justify-center h-7 w-7 rounded-lg bg-white dark:bg-gray-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-600 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                    title="Delete layered assistant"
                >
                    {isDeleting
                        ? <IconLoader2 size={16} className="animate-spin" />
                        : <IconTrash size={16} />
                    }
                </button>
            </div>
        </div>
    );
};

// ── Gallery ───────────────────────────────────────────────────────────────────

export const LayeredAssistantsGallery: FC = () => {
    const {
        state: { layeredAssistants, syncingLayeredAssistants },
        dispatch: homeDispatch,
        handleNewConversation,
        setLoadingMessage,
    } = useContext(HomeContext);

    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Personal layered assistants only — group LAs are shown in the Group Assistants tab
    const filtered = layeredAssistants.filter(la =>
        !search || la.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSave = async (la: LayeredAssistant) => {
        setLoadingMessage('Saving layered assistant…');
        try {
            const result = await saveLayeredAssistant(la);
            if (result?.success && result.data?.assistantId) {
                const saved: LayeredAssistant = { ...la, assistantId: result.data.assistantId };
                const updated = layeredAssistants.some(x => x.assistantId === saved.assistantId)
                    ? layeredAssistants.map(x => x.assistantId === saved.assistantId ? saved : x)
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

    const handleDelete = async (la: LayeredAssistant) => {
        if (!la.assistantId) return;
        setDeletingId(la.assistantId);
        try {
            const result = await deleteLayeredAssistant(la.assistantId);
            if (result?.success) {
                homeDispatch({
                    field: 'layeredAssistants',
                    value: layeredAssistants.filter(x => x.assistantId !== la.assistantId),
                });
            }
        } catch (e) {
            console.error('Failed to delete layered assistant:', e);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="relative flex-1 h-full flex flex-col overflow-hidden bg-gradient-to-br from-purple-50 via-blue-50/30 to-pink-50/30 dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/20">
            {/* Animated gradient orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-purple-200/30 to-pink-200/30 dark:from-purple-500/10 dark:to-pink-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-blue-200/30 to-purple-200/30 dark:from-blue-500/10 dark:to-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative flex-1 flex flex-col overflow-hidden">
            {/* Search bar */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md">
                <div className="relative max-w-md">
                    <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search layered assistants…"
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-600 transition"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                {syncingLayeredAssistants ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 dark:text-gray-500">
                        <IconLoader2 size={30} className="animate-spin text-purple-400" />
                        <p className="text-sm">Loading layered assistants…</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 dark:text-gray-500">
                        <IconGitBranch size={36} className="opacity-30" />
                        <p className="text-sm">
                            {search ? 'No results match your search.' : 'No layered assistants yet. Create one from the sidebar!'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filtered.map(la => (
                            <LayeredAssistantCard
                                key={la.assistantId ?? la.name}
                                la={la}
                                onSelect={handleSelect}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                isDeleting={deletingId === la.assistantId}
                            />
                        ))}
                    </div>
                )}
            </div>
            </div>

        </div>
    );
};
