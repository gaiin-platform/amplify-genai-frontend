import { FC, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import {
    IconPlus, IconTrash, IconChevronRight,
    IconRobot, IconGitBranch, IconX,
    IconWand, IconLoader2,
    IconRoute, IconArrowRight, IconLayoutGrid, IconAlertCircle, IconEye
} from '@tabler/icons-react';
import { AssistantModal } from '@/components/Promptbar/components/AssistantModal';
import Search from '@/components/Search/Search';
import toast from 'react-hot-toast';
import { Message } from '@/types/chat';
import HomeContext from '@/pages/api/home/home.context';
import { Prompt } from '@/types/prompt';
import { isAssistant, getAssistant } from '@/utils/app/assistants';
import { promptForData } from '@/utils/app/llm';
import { DefaultModels } from '@/types/model';
import { InfoBox } from '@/components/ReusableComponents/InfoBox';
import {
    LayeredAssistant, LayeredAssistantNode, RouterNode, LeafNode,
    RouterContextField,
    isRouterNode, isLeafNode,
    createRouterNode, createLeafNode, createLayeredAssistant
} from '@/types/layeredAssistant';

// ─── Color palette
// Uses the app's actual dark mode tokens:
//   panels:  dark:bg-[#343541]   inputs: dark:bg-[#40414F]
//   text:    dark:text-neutral-100 / dark:text-neutral-300
const depthColors = [
    {
        ring: 'ring-purple-500 dark:ring-purple-400',
        text: 'text-purple-700 dark:text-white',
        bg: 'bg-purple-100 dark:bg-purple-600',
        bgAdded: 'bg-purple-50 dark:bg-purple-500/20',
        iconBg: 'bg-purple-200 dark:bg-purple-600',
        accent: 'bg-purple-500',
        svgFill: '#a855f7',
        border: 'border-purple-300 dark:border-purple-500',
        hoverBorder: 'hover:border-purple-300 dark:hover:border-purple-500',
        badgeText: 'text-purple-700 dark:text-purple-300',
    },
    {
        ring: 'ring-blue-500 dark:ring-blue-400',
        text: 'text-blue-700 dark:text-white',
        bg: 'bg-blue-100 dark:bg-blue-700',
        bgAdded: 'bg-blue-50 dark:bg-blue-500/20',
        iconBg: 'bg-blue-200 dark:bg-blue-600',
        accent: 'bg-blue-500',
        svgFill: '#3b82f6',
        border: 'border-blue-300 dark:border-blue-500',
        hoverBorder: 'hover:border-blue-300 dark:hover:border-blue-500',
        badgeText: 'text-blue-700 dark:text-blue-300',
    },
    {
        ring: 'ring-emerald-500 dark:ring-emerald-400',
        text: 'text-emerald-700 dark:text-white',
        bg: 'bg-emerald-100 dark:bg-emerald-700',
        bgAdded: 'bg-emerald-50 dark:bg-emerald-500/20',
        iconBg: 'bg-emerald-200 dark:bg-emerald-600',
        accent: 'bg-emerald-500',
        svgFill: '#10b981',
        border: 'border-emerald-300 dark:border-emerald-500',
        hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-500',
        badgeText: 'text-emerald-700 dark:text-emerald-300',
    },
    {
        ring: 'ring-rose-500 dark:ring-rose-400',
        text: 'text-rose-700 dark:text-white',
        bg: 'bg-rose-100 dark:bg-rose-700',
        bgAdded: 'bg-rose-50 dark:bg-rose-500/20',
        iconBg: 'bg-rose-200 dark:bg-rose-600',
        accent: 'bg-rose-500',
        svgFill: '#f43f5e',
        border: 'border-rose-300 dark:border-rose-500',
        hoverBorder: 'hover:border-rose-300 dark:hover:border-rose-500',
        badgeText: 'text-rose-700 dark:text-rose-300',
    },
];
const getDepthColor = (depth: number) => depthColors[((depth % depthColors.length) + depthColors.length) % depthColors.length];


// ─── Mini Tree Map ────────────────────────────────────────────────────
interface MiniNodePos { id: string; x: number; y: number; isParent: boolean; depth: number; }
interface MiniEdge { x1: number; y1: number; x2: number; y2: number; }

function buildMiniLayout(
    node: LayeredAssistantNode,
    x: number, y: number, halfWidth: number, depth: number,
    positions: MiniNodePos[], edges: MiniEdge[]
) {
    positions.push({ id: node.id, x, y, isParent: isRouterNode(node), depth });
    if (!isRouterNode(node)) return;
    const children = (node as RouterNode).children;
    if (children.length === 0) return;
    const step = (halfWidth * 2) / children.length;
    const startX = x - halfWidth + step / 2;
    children.forEach((child, i) => {
        const cx = startX + step * i;
        const cy = y + 34;
        edges.push({ x1: x, y1: y, x2: cx, y2: cy });
        buildMiniLayout(child, cx, cy, Math.max(step / 2, 7), depth + 1, positions, edges);
    });
}

interface MiniTreeMapProps {
    rootNode: RouterNode;
    selectedNodeId: string | null;
    onSelect: (id: string) => void;
}

const MiniTreeMap: FC<MiniTreeMapProps> = ({ rootNode, selectedNodeId, onSelect }) => {
    const positions: MiniNodePos[] = [];
    const edges: MiniEdge[] = [];
    buildMiniLayout(rootNode, 100, 16, 82, 0, positions, edges);
    const maxY = positions.reduce((m, p) => Math.max(m, p.y), 0);
    const viewH = Math.max(54, maxY + 20);

    return (
        <div className="px-2 pt-2 pb-2">
            <div className="rounded-xl border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-[#2b2c36] overflow-hidden">
                <svg
                    viewBox={`0 0 200 ${viewH}`}
                    className="w-full"
                    style={{ height: `${Math.min(viewH * 1.5, 140)}px` }}
                >
                    <defs>
                        <filter id="glow-gold" x="-60%" y="-60%" width="220%" height="220%">
                            <feGaussianBlur stdDeviation="3.5" result="blur" />
                            <feFlood floodColor="#f59e0b" floodOpacity="0.9" result="color" />
                            <feComposite in="color" in2="blur" operator="in" result="glow" />
                            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                        <filter id="glow-soft" x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>

                    {/* Edges */}
                    {edges.map((e, i) => (
                        <line key={`e-${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                            stroke="#64748b" strokeWidth="1.2" opacity="0.5" />
                    ))}

                    {/* Nodes */}
                    {positions.map((p) => {
                        const isSelected = p.id === selectedNodeId;
                        const color = getDepthColor(p.depth);
                        const r = p.isParent ? 7 : 5;
                        return (
                            <g key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: 'pointer' }}>
                                {/* Outer glow ring for selected */}
                                {isSelected && (
                                    <>
                                        <circle cx={p.x} cy={p.y} r={r + 8} fill="none"
                                            stroke="#fbbf24" strokeWidth="1.5" opacity="0.3" />
                                        <circle cx={p.x} cy={p.y} r={r + 4} fill="none"
                                            stroke="#f59e0b" strokeWidth="2" opacity="0.6" />
                                    </>
                                )}
                                {/* Main node circle */}
                                <circle
                                    cx={p.x} cy={p.y} r={r}
                                    fill={isSelected ? '#f59e0b' : color.svgFill}
                                    stroke={isSelected ? '#92400e' : 'rgba(255,255,255,0.2)'}
                                    strokeWidth={isSelected ? 1.5 : 0.8}
                                    opacity={isSelected ? 1 : 0.85}
                                    filter={isSelected ? 'url(#glow-gold)' : undefined}
                                />
                                {/* Inner dot for leaf */}
                                {!p.isParent && (
                                    <circle cx={p.x} cy={p.y} r={2.2} fill="white" opacity="0.9" />
                                )}
                                {/* Center mark for parent */}
                                {p.isParent && !isSelected && (
                                    <circle cx={p.x} cy={p.y} r={2.5} fill="white" opacity="0.4" />
                                )}
                            </g>
                        );
                    })}
                </svg>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 px-3 py-1.5 border-t border-gray-200 dark:border-neutral-600">
                    <div className="flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 14 14">
                            <circle cx="7" cy="7" r="5.5" fill="#a855f7" opacity="0.9" />
                        </svg>
                        <span className="text-[9px] text-gray-500 dark:text-neutral-400">Parent</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 14 14">
                            <circle cx="7" cy="7" r="4" fill="#3b82f6" opacity="0.9" />
                            <circle cx="7" cy="7" r="1.5" fill="white" opacity="0.9" />
                        </svg>
                        <span className="text-[9px] text-gray-500 dark:text-neutral-400">Assistant</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 14 14">
                            <circle cx="7" cy="7" r="5.5" fill="#f59e0b" />
                        </svg>
                        <span className="text-[9px] text-gray-500 dark:text-neutral-400">Selected</span>
                    </div>
                </div>
            </div>
        </div>
    );
};


// ─── Tree Node Component ──────────────────────────────────────────────
interface TreeNodeProps {
    node: LayeredAssistantNode;
    depth: number;
    selectedNodeId: string | null;
    onSelect: (id: string) => void;
}

const TreeNode: FC<TreeNodeProps> = ({ node, depth, selectedNodeId, onSelect }) => {
    const isSelected = selectedNodeId === node.id;
    const isParent = isRouterNode(node);
    const color = getDepthColor(depth);

    return (
        <div>
            <button
                onClick={() => onSelect(node.id)}
                className={`group w-full flex items-center gap-2 py-1.5 rounded-lg text-left transition-all duration-150
                    ${isSelected
                        ? `${color.bg} ring-2 ${color.ring} shadow-sm`
                        : 'hover:bg-gray-100 dark:hover:bg-[#40414F]'
                    }`}
                style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '8px' }}
            >
                {/* Static chevron — visual only, no collapse */}
                {isParent ? (
                    <span className={`flex-shrink-0 ${color.text} opacity-60`}>
                        <IconChevronRight size={13} />
                    </span>
                ) : (
                    <span className="w-[13px] flex-shrink-0" />
                )}

                <span className={`flex-shrink-0 p-1 rounded-md ${color.iconBg}`}>
                    {isParent
                        ? <IconRoute size={15} className={color.text} />
                        : <IconRobot size={15} className={color.text} />
                    }
                </span>

                <span className={`truncate font-medium text-xs ${isSelected ? color.text : 'text-gray-700 dark:text-neutral-100'}`}>
                    {node.name || (isParent ? 'Unnamed Parent' : 'Unnamed Assistant')}
                </span>

                {isParent && (node as RouterNode).children.length > 0 && (
                    <span className="ml-auto flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-[#40414F] text-gray-600 dark:text-neutral-300">
                        {(node as RouterNode).children.length}
                    </span>
                )}
            </button>

            {/* Always expanded */}
            {isParent && (node as RouterNode).children.length > 0 && (
                <div className="relative">
                    <div
                        className={`absolute left-0 top-0 bottom-0 w-px ${color.accent} opacity-30`}
                        style={{ marginLeft: `${depth * 16 + 19}px` }}
                    />
                    {(node as RouterNode).children.map((child) => (
                        <TreeNode key={child.id} node={child} depth={depth + 1}
                            selectedNodeId={selectedNodeId} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
};


// ─── AI Generate Button ───────────────────────────────────────────────
interface AIGenerateButtonProps {
    onGenerate: () => void;
    isGenerating: boolean;
}
const AIGenerateButton: FC<AIGenerateButtonProps> = ({ onGenerate, isGenerating }) => (
    <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md
                   bg-gradient-to-r from-purple-600 to-blue-600 text-white
                   hover:from-purple-700 hover:to-blue-700
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all duration-200 shadow-sm hover:shadow-md font-semibold"
    >
        {isGenerating ? <IconLoader2 size={13} className="animate-spin" /> : <IconWand size={13} />}
        AI Generate
    </button>
);


// ─── Assistant Picker Item ────────────────────────────────────────────
interface AssistantPickerItemProps {
    prompt: Prompt;
    onAdd: (prompt: Prompt) => void;
    onPreview: (prompt: Prompt) => void;
    isAlreadyAdded: boolean;
    disabled: boolean;
    colors: typeof depthColors[number];
}
const AssistantPickerItem: FC<AssistantPickerItemProps> = ({ prompt, onAdd, onPreview, isAlreadyAdded, disabled, colors }) => (
    <div
        className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all duration-150
            ${isAlreadyAdded
                ? `border-gray-200 dark:border-neutral-600 bg-white dark:bg-[#343541] opacity-50 cursor-not-allowed`
                : disabled
                    ? 'border-gray-200 dark:border-gray-600 opacity-35 cursor-not-allowed'
                    : `border-gray-200 dark:border-gray-600 cursor-pointer ${colors.hoverBorder}`
            }`}
        onClick={() => !isAlreadyAdded && !disabled && onAdd(prompt)}
    >
        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors
            ${isAlreadyAdded ? colors.iconBg : 'bg-gray-100 dark:bg-[#40414F]'}`}>
            <IconRobot size={15} className={isAlreadyAdded ? colors.text : 'text-gray-600 dark:text-neutral-200'} />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{prompt.name}</p>
            {prompt.description && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{prompt.description}</p>
            )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
            <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onPreview(prompt); }}
                title="Preview assistant"
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-600 text-gray-400 dark:text-neutral-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all"
            >
                <IconEye size={14} />
            </span>
            {isAlreadyAdded
                ? <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">Added</span>
                : <IconPlus size={15} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-neutral-200 transition-colors" />
            }
        </div>
    </div>
);


// ─── Rule Violation Banner ────────────────────────────────────────────
const RuleBanner: FC<{ message: string }> = ({ message }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600/60">
        <IconAlertCircle size={15} className="text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-300">{message}</p>
    </div>
);


// ─── Main Builder ─────────────────────────────────────────────────────
interface LayeredAssistantBuilderProps {
    onClose: () => void;
    onSave?: (layeredAssistant: LayeredAssistant) => void;
    initialData?: LayeredAssistant;
    onRegisterSave?: (saveFn: () => void) => void; // modal parent registers this to trigger save
    assistants?: Prompt[];  // optional override — if omitted, uses personal assistants from context
}

export const LayeredAssistantBuilder: FC<LayeredAssistantBuilderProps> = ({ onClose, onSave, initialData, onRegisterSave, assistants: propAssistants }) => {
    const {
        state: { prompts, chatEndpoint, defaultAccount },
        getDefaultModel,
    } = useContext(HomeContext);

    const [layeredAssistant, setLayeredAssistant] = useState<LayeredAssistant>(
        initialData || createLayeredAssistant()
    );
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(layeredAssistant.rootNode.id);
    const [assistantSearch, setAssistantSearch] = useState('');
    const [generatingField, setGeneratingField] = useState<string | null>(null);
    const [ruleViolation, setRuleViolation] = useState<string | null>(null);
    const [saveWarnings, setSaveWarnings] = useState<string[]>([]);
    const [showSaveWarnings, setShowSaveWarnings] = useState(false);
    const [previewAssistant, setPreviewAssistant] = useState<Prompt | null>(null);

    const flashRule = (msg: string) => {
        setRuleViolation(msg);
        setTimeout(() => setRuleViolation(null), 3500);
    };

    // ── Assistants ───────────────────────────────────────────────────
    // Use the prop list when provided (caller controls scope), otherwise fall back
    // to personal assistants only (no group assistants — groupId is set on group prompts).
    // Always filter to only editable assistants (canEdit).
    const assistants = useMemo(
        () => (propAssistants ?? prompts.filter((p: Prompt) => isAssistant(p) && !p.groupId))
            .filter((p: Prompt) => !p.data || !p.data.noEdit),
        [propAssistants, prompts],
    );
    const filteredAssistants = useMemo(() => {
        if (!assistantSearch) return assistants;
        const s = assistantSearch.toLowerCase();
        return assistants.filter((a: Prompt) =>
            a.name.toLowerCase().includes(s) || (a.description && a.description.toLowerCase().includes(s))
        );
    }, [assistants, assistantSearch]);

    // ── Tree helpers ─────────────────────────────────────────────────
    const findNode = useCallback((
        nodeId: string,
        current: LayeredAssistantNode = layeredAssistant.rootNode,
        parent: RouterNode | null = null
    ): { node: LayeredAssistantNode; parent: RouterNode | null } | null => {
        if (current.id === nodeId) return { node: current, parent };
        if (isRouterNode(current)) {
            for (const child of current.children) {
                const found = findNode(nodeId, child, current);
                if (found) return found;
            }
        }
        return null;
    }, [layeredAssistant]);

    const selectedResult = selectedNodeId ? findNode(selectedNodeId) : null;
    const selectedNode = selectedResult?.node || null;

    // Map of assistantId → leaf node, built from the ENTIRE tree.
    // Completely independent of selection — never changes just from clicking around.
    const allLeafMap = useMemo(() => {
        const map = new Map<string, LeafNode>();
        const walk = (node: LayeredAssistantNode) => {
            if (isLeafNode(node)) { map.set(node.assistantId, node); }
            else if (isRouterNode(node)) { node.children.forEach(walk); }
        };
        walk(layeredAssistant.rootNode);
        return map;
    }, [layeredAssistant]);

    const updateNodeInTree = useCallback((
        nodeId: string,
        updater: (n: LayeredAssistantNode) => LayeredAssistantNode,
        current: LayeredAssistantNode = layeredAssistant.rootNode
    ): LayeredAssistantNode => {
        if (current.id === nodeId) return updater(current);
        if (isRouterNode(current)) return { ...current, children: current.children.map(c => updateNodeInTree(nodeId, updater, c)) };
        return current;
    }, [layeredAssistant]);

    const applyTreeUpdate = useCallback((nodeId: string, updater: (n: LayeredAssistantNode) => LayeredAssistantNode) => {
        setLayeredAssistant(prev => ({
            ...prev,
            updatedAt: new Date().toISOString(),
            rootNode: updateNodeInTree(nodeId, updater, prev.rootNode) as RouterNode,
        }));
    }, [updateNodeInTree]);

    // ── Auto-number parents ──────────────────────────────────────────
    const countParents = (node: LayeredAssistantNode): number => {
        if (isLeafNode(node)) return 0;
        return 1 + (node as RouterNode).children.reduce((s, c) => s + countParents(c), 0);
    };
    const nextParentName = () => `Parent ${countParents(layeredAssistant.rootNode) + 1}`;

    // ── Node actions ─────────────────────────────────────────────────

    // ✅ RULE: Must have at least one leaf child before adding a sub-parent
    const handleAddSubParent = () => {
        if (!selectedNodeId) return;
        const target = findNode(selectedNodeId);
        if (!target || !isRouterNode(target.node)) return;

        const hasLeafChild = (target.node as RouterNode).children.some(c => isLeafNode(c));
        if (!hasLeafChild) {
            flashRule('Add at least one assistant first before adding a Sub-Parent — a parent needs assistants, not just more parents.');
            return;
        }

        const newParent = createRouterNode(nextParentName());
        applyTreeUpdate(selectedNodeId, (node) => ({
            ...node, children: [...(node as RouterNode).children, newParent],
        }));
        setSelectedNodeId(newParent.id);
    };

    const handleAddLeaf = (prompt: Prompt) => {
        if (!selectedNodeId) return;
        const target = findNode(selectedNodeId);
        if (!target || !isRouterNode(target.node)) return;
        const astId = prompt.data?.assistant?.definition?.assistantId || prompt.id;
        // Pull the full definition description for the leaf
        const definition = getAssistant(prompt);
        const description = definition?.description || prompt.description || '';
        const newLeaf = createLeafNode(astId, prompt.name, description);
        applyTreeUpdate(selectedNodeId, (node) => ({
            ...node, children: [...(node as RouterNode).children, newLeaf],
        }));
    };

    const handleDeleteNode = (nodeId: string) => {
        if (nodeId === layeredAssistant.rootNode.id) return;
        const result = findNode(nodeId);
        if (!result || !result.parent) return;
        applyTreeUpdate(result.parent.id, (p) => ({
            ...p, children: (p as RouterNode).children.filter(c => c.id !== nodeId),
        }));
        if (selectedNodeId === nodeId) setSelectedNodeId(result.parent.id);
    };

    const handleUpdateNodeField = (nodeId: string, field: string, value: string | RouterContextField[]) =>
        applyTreeUpdate(nodeId, (node) => ({ ...node, [field]: value }));

    const handleToggleRouterContext = (nodeId: string, field: RouterContextField, checked: boolean) => {
        applyTreeUpdate(nodeId, (node) => {
            const leaf = node as LeafNode;
            const current = leaf.routerContext || [];
            const next = checked
                ? [...current, field]
                : current.filter(f => f !== field);
            return { ...leaf, routerContext: next };
        });
    };

    // ── AI Generation ─────────────────────────────────────────────────
    const buildAssistantSummary = (prompt: Prompt): string => {
        const def = getAssistant(prompt);
        if (!def) return `- Name: ${prompt.name}`;
        const lines: string[] = [`- Name: ${def.name || prompt.name}`];
        if (def.description) lines.push(`  Description: ${def.description}`);
        if (def.instructions) lines.push(`  Instructions (summary): ${def.instructions.slice(0, 300)}${def.instructions.length > 300 ? '...' : ''}`);
        if (def.tags?.length) lines.push(`  Tags: ${def.tags.join(', ')}`);
        if (def.dataSources?.length) lines.push(`  Data Sources: ${def.dataSources.map((d: any) => d.name || d.id).join(', ')}`);
        const ops = def.data?.operations;
        const builtIn = def.data?.builtInOperations;
        if (ops?.length || builtIn?.length) {
            const toolList = [
                ...(ops?.map((o: any) => o.name || o.operationId || '?') || []),
                ...(builtIn || []),
            ].slice(0, 10);
            lines.push(`  Tools: ${toolList.join(', ')}${toolList.length === 10 ? '...' : ''}`);
        }
        if (def.data?.workflowTemplateId) lines.push(`  Workflow: ${def.data.workflowTemplateId}`);
        return lines.join('\n');
    };

    const handleAIGenerate = async (field: 'description' | 'instructions', nodeId: string) => {
        if (!chatEndpoint) return;
        const result = findNode(nodeId);
        if (!result) return;
        const node = result.node;
        setGeneratingField(`${nodeId}-${field}`);
        try {
            const model = getDefaultModel(DefaultModels.CHEAPEST);
            let systemPrompt = '';
            let userMessage = '';

            if (isRouterNode(node)) {
                // Build rich child summaries including full definitions for leaf children
                const childSummaries = node.children.map(c => {
                    if (isLeafNode(c)) {
                        const linkedPrompt = getLinkedAssistant(c.assistantId);
                        const summary = linkedPrompt ? buildAssistantSummary(linkedPrompt) : `- Name: ${c.name}`;
                        return summary;
                    }
                    // Sub-router: include its description + child count
                    const rc = c as RouterNode;
                    return `- Name: ${rc.name} (sub-router with ${rc.children.length} children)${rc.description ? `\n  Description: ${rc.description}` : ''}`;
                }).join('\n\n');

                if (field === 'description') {
                    systemPrompt = 'You write short, plain-English descriptions for AI routing systems. Respond with ONLY the description text, no preamble, no quotes.';
                    userMessage = `Write a 1-2 sentence description for a parent assistant router named "${node.name}".${node.description ? `\n\nCurrent draft (improve or refine it):\n${node.description}` : ''}\n\nIt routes between these assistants:\n\n${childSummaries || '(no children yet)'}\n\nExplain what kinds of questions or tasks this router handles in plain terms.`;
                } else {
                    systemPrompt = 'You write clear, concise decision guides for AI routing systems. Respond with ONLY the guide text — bullet points or short paragraphs. No preamble, no quotes.';
                    userMessage = `Write a decision guide for a parent assistant router named "${node.name}".${node.description ? `\n  Description: ${node.description}` : ''}${(node as RouterNode).instructions ? `\n\nCurrent draft (improve or refine it):\n${(node as RouterNode).instructions}` : ''}\n\nIt chooses between:\n\n${childSummaries || '(no children yet)'}\n\nWrite clear guidance on when to pick each option. Be specific about signals in the user's message that indicate which assistant to route to.`;
                }
            } else {
                const leaf = node as LeafNode;
                const linkedPrompt = getLinkedAssistant(leaf.assistantId);
                const defSummary = linkedPrompt ? buildAssistantSummary(linkedPrompt) : '';
                if (field === 'description') {
                    systemPrompt = 'You write short, plain-English descriptions that help AI routers understand when to pick an assistant. Respond with ONLY the description text, no preamble, no quotes.';
                    userMessage = `Write a 1-2 sentence description for an assistant that will help a router decide when to use it.${leaf.description ? `\n\nCurrent draft (improve or refine it):\n${leaf.description}` : ''}\n\nAssistant details:\n${defSummary || `Name: ${leaf.name}`}\n\nFocus on what kinds of questions or tasks this assistant is best at, and what distinguishes it from other assistants.`;
                }
            }

            if (!userMessage) { setGeneratingField(null); return; }
            const messages: Message[] = [{ role: 'user', content: userMessage, type: 'chat', id: '1', data: undefined }];
            const response = await promptForData(chatEndpoint, messages, model, systemPrompt, defaultAccount);
            if (response) handleUpdateNodeField(nodeId, field, response.trim());
        } catch (e) { console.error('AI generation failed:', e); }
        finally { setGeneratingField(null); }
    };

    // ── Derived ───────────────────────────────────────────────────────
    const canAddMembers = selectedNode && isRouterNode(selectedNode);
    const getNodeDepthLocal = (id: string) => getNodeDepth(id, layeredAssistant.rootNode);
    const getLinkedAssistant = (astId: string) =>
        assistants.find((a: Prompt) => a.data?.assistant?.definition?.assistantId === astId || a.id === astId);

    // ── Save validation ───────────────────────────────────────────────
    const collectWarnings = (node: LayeredAssistantNode, warnings: string[]) => {
        if (!node.name.trim()) {
            warnings.push(`A ${isRouterNode(node) ? 'parent' : 'assistant'} node has no name.`);
        }
        if (isRouterNode(node)) {
            const router = node as RouterNode;
            if (router.children.length === 0) {
                warnings.push(`Parent "${router.name || 'Unnamed'}" has no members — add at least 2 assistants.`);
            } else if (router.children.length === 1) {
                warnings.push(`Parent "${router.name || 'Unnamed'}" has only 1 member — routing needs at least 2 options.`);
            }
            if (!router.instructions.trim() && router.children.length > 1) {
                warnings.push(`Parent "${router.name || 'Unnamed'}" has no Decision Guide — the AI won't know how to route.`);
            }
            if (router.children.every(c => isRouterNode(c))) {
                warnings.push(`Parent "${router.name || 'Unnamed'}" only contains sub-parents with no direct assistants.`);
            }
            router.children.forEach(c => collectWarnings(c, warnings));
        }
    };

    const handleSave = useCallback(() => {
        if (!layeredAssistant.name.trim()) {
            flashRule('Give your layered assistant a name before saving.');
            return;
        }
        const warnings: string[] = [];
        collectWarnings(layeredAssistant.rootNode, warnings);
        if (warnings.length > 0) {
            setSaveWarnings(warnings);
            setShowSaveWarnings(true);
            return;
        }
        commitSave();
    }, [layeredAssistant, onSave, onClose]);

    // Register save fn with parent modal whenever it changes
    useEffect(() => {
        if (onRegisterSave) onRegisterSave(handleSave);
    }, [handleSave, onRegisterSave]);

    const commitSave = () => {
        if (onSave) onSave({ ...layeredAssistant, updatedAt: new Date().toISOString() });
        // toast.success(`"${layeredAssistant.name}" saved successfully!`, { duration: 3000 });
        onClose();
    };

    // ── Render ────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col overflow-hidden" style={{ height: 'calc(85vh)' }}>

            {/* Assistant preview modal */}
            {previewAssistant && (
                <AssistantModal
                    assistant={previewAssistant}
                    onSave={() => setPreviewAssistant(null)}
                    onCancel={() => setPreviewAssistant(null)}
                    onUpdateAssistant={() => {}}
                    loadingMessage=""
                    loc="builder_preview"
                    disableEdit={true}
                    title={previewAssistant.name}
                />
            )}


            {/* Header: name only */}
            <div className="flex items-center gap-3 mb-3 px-1 flex-shrink-0">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-200 to-blue-200 dark:from-purple-700/60 dark:to-blue-700/60 shadow-sm">
                    <IconGitBranch size={18} className="text-purple-600 dark:text-purple-700" />
                </div>
                <div className="flex-1 min-w-0">
                    <input
                        type="text"
                        value={layeredAssistant.name}
                        onChange={(e) => setLayeredAssistant(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full text-base font-bold bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-150
                            ${!layeredAssistant.name.trim()
                                ? 'border border-red-400 dark:border-red-500 rounded-lg px-2 py-0.5 outline-none ring-1 ring-red-300 dark:ring-red-600'
                                : 'border-none outline-none px-2 py-0.5'
                            }`}
                        placeholder="Layered Assistant Name"
                    />
                </div>
                {/* Info box */}
               
                    <div className="mx-1 mb-3 relative flex-shrink-0 h-8 mr-4">
                        <InfoBox
                            content={
                                <div className="text-xs leading-relaxed pr-6">
                                    <span className="font-semibold">Layered Assistants</span> let you build a smart decision tree.&nbsp;
                                    <span className="font-semibold text-purple-600 dark:text-purple-500">Parent Assistant Routers</span> decide which assistant handles a request,
                                    and <span className="font-semibold text-blue-600 dark:text-blue-500">child assistants</span> do the actual work.
                                    Build your tree, add your assistants, and let AI write the decision logic for you.
                                </div>
                            }
                            rounded={true} padding="p-0"
                        />
                        
                    </div>

            </div>

            {/* Rule violation banner */}
            {ruleViolation && (
                <div className="mx-1 mb-2 flex-shrink-0">
                    <RuleBanner message={ruleViolation} />
                </div>
            )}

            {/* Save warnings modal */}
            {showSaveWarnings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-[580px] rounded-2xl border border-amber-300 dark:border-amber-600/60
                                    bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-600/40">
                            <IconAlertCircle size={22} className="text-amber-500 flex-shrink-0" />
                            <span className="text-base font-bold text-amber-700 dark:text-amber-300">Review before saving</span>
                        </div>
                        <div className="px-6 py-5 space-y-3">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                A few things could be improved. You can save anyway or go back and fix them.
                            </p>
                            {saveWarnings.map((w, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-800/50
                                                    flex items-center justify-center text-[10px] font-bold text-amber-600 dark:text-amber-300">
                                        {i + 1}
                                    </span>
                                    <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{w}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setShowSaveWarnings(false)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300
                                           bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                Go back
                            </button>
                            <button
                                onClick={() => { setShowSaveWarnings(false); commitSave(); }}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-white
                                           bg-amber-500 hover:bg-amber-600 transition-colors"
                            >
                                Save anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3-Panel layout */}
            <div className="flex-1 flex gap-3 min-h-0 px-1 overflow-hidden">

                {/* ─── LEFT: Tree + Mini Map ──────────────────────── */}
                <div className="w-[260px] flex-shrink-0 flex flex-col rounded-xl border border-gray-200 dark:border-neutral-600 bg-white dark:bg-[#343541] overflow-hidden">
                    {/* Tree header with Add Sub-Parent button */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-[#2b2c36] flex-shrink-0">
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-300 uppercase tracking-wider">Structure</span>
                        <button
                            onClick={handleAddSubParent}
                            disabled={!canAddChildren(selectedNode)}
                            title={canAddChildren(selectedNode) ? 'Add Sub-Parent to selected' : 'Select a parent to add a Sub-Parent'}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold
                                       bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200
                                       hover:bg-purple-200 dark:hover:bg-purple-700 transition-colors
                                       disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <IconPlus size={11} />
                            Sub-Parent
                        </button>
                    </div>

                    {/* Tree */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
                        <TreeNode
                            node={layeredAssistant.rootNode}
                            depth={0}
                            selectedNodeId={selectedNodeId}
                            onSelect={setSelectedNodeId}
                        />
                    </div>

                    {/* Stats bar */}
                    <div className="px-3 py-1.5 border-t border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-[#2b2c36] flex-shrink-0">
                        <div className="flex items-center justify-center gap-3 text-[9px] text-gray-500 dark:text-neutral-300">
                            <span className="flex items-center gap-1">
                                <IconRoute size={9} className="text-purple-600 dark:text-purple-400" />
                                {countNodes(layeredAssistant.rootNode, 'router')} parents
                            </span>
                            <span className="opacity-30">·</span>
                            <span className="flex items-center gap-1">
                                <IconRobot size={9} className="text-blue-600 dark:text-blue-400" />
                                {countNodes(layeredAssistant.rootNode, 'leaf')} assistants
                            </span>
                        </div>
                    </div>

                    {/* Mini map */}
                    <div className="flex-shrink-0 border-t border-gray-200 dark:border-neutral-600">
                        <MiniTreeMap
                            rootNode={layeredAssistant.rootNode}
                            selectedNodeId={selectedNodeId}
                            onSelect={setSelectedNodeId}
                        />
                    </div>
                </div>

                {/* ─── CENTER: Node Editor ────────────────────────── */}
                <div className="flex-1 flex flex-col rounded-xl border border-gray-200 dark:border-neutral-600 bg-white dark:bg-[#343541] overflow-hidden min-w-0">
                    {selectedNode ? (
                        <>
                            {/* Editor header */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-[#2b2c36] flex-shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <span className={`p-1.5 rounded-lg ${getDepthColor(getNodeDepthLocal(selectedNode.id)).iconBg}`}>
                                        {isRouterNode(selectedNode)
                                            ? <IconRoute size={18} className={getDepthColor(getNodeDepthLocal(selectedNode.id)).text} />
                                            : <IconRobot size={18} className={getDepthColor(getNodeDepthLocal(selectedNode.id)).text} />
                                        }
                                    </span>
                                    <div>
                                        <span className="text-sm font-semibold text-gray-800 dark:text-neutral-100">
                                            {isRouterNode(selectedNode) ? 'Parent' : 'Assistant'} Settings
                                        </span>
                                        {selectedNode.name && (
                                            <span className="ml-2 text-xs text-gray-400 dark:text-neutral-400">— {selectedNode.name}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {isLeafNode(selectedNode) && (() => {
                                        const linked = getLinkedAssistant((selectedNode as LeafNode).assistantId);
                                        if (!linked) return null;
                                        return (
                                            <button
                                                onClick={() => setPreviewAssistant(linked)}
                                                className="p-1.5 rounded-md text-gray-400 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 transition-colors"
                                                title="Preview linked assistant"
                                            >
                                                <IconEye size={16} />
                                            </button>
                                        );
                                    })()}
                                    {selectedNode.id !== layeredAssistant.rootNode.id && (
                                        <button
                                            onClick={() => handleDeleteNode(selectedNode.id)}
                                            className="p-1.5 rounded-md text-gray-400 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors"
                                            title="Remove this item"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Editor body */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">

                                {/* Leaf — Linked Assistant at TOP */}
                                {isLeafNode(selectedNode) && (() => {
                                    const linked = getLinkedAssistant((selectedNode as LeafNode).assistantId);
                                    return (
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-neutral-400 mb-2 uppercase tracking-wider">
                                                Linked Assistant
                                            </label>
                                            <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl
                                                bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/50 dark:to-purple-900/40
                                                border-2 border-blue-300 dark:border-blue-600 shadow-sm">
                                                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-800">
                                                    <IconRobot size={22} className="text-blue-600 dark:text-blue-300" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-neutral-100 truncate">
                                                        {linked?.name || 'Unknown Assistant'}
                                                    </p>
                                                    {linked?.description && (
                                                        <p className="text-[11px] text-gray-500 dark:text-neutral-400 truncate mt-0.5">
                                                            {linked.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Name — editable for parents, read-only for leaf assistants */}
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Name</label>
                                    {isRouterNode(selectedNode) ? (
                                        <input
                                            type="text"
                                            value={selectedNode.name}
                                            onChange={(e) => handleUpdateNodeField(selectedNode.id, 'name', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-neutral-500
                                                       dark:border-neutral-600 dark:border-opacity-50
                                                       bg-white dark:bg-[#40414F] text-sm text-gray-900 dark:text-neutral-100
                                                       focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-shadow
                                                       placeholder-gray-400 dark:placeholder-neutral-500"
                                            placeholder="Give this parent a name..."
                                        />
                                    ) : (
                                        <div className="w-full px-3 py-2 rounded-lg border border-neutral-500
                                                        dark:border-neutral-700 dark:border-opacity-50
                                                        bg-gray-50 dark:bg-[#40414F]/50 text-sm text-gray-500 dark:text-neutral-400
                                                        cursor-not-allowed select-none">
                                            {selectedNode.name}
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[11px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Description</label>
                                        <AIGenerateButton
                                            onGenerate={() => handleAIGenerate('description', selectedNode.id)}
                                            isGenerating={generatingField === `${selectedNode.id}-description`}
                                        />
                                    </div>
                                    <textarea
                                        value={selectedNode.description}
                                        onChange={(e) => handleUpdateNodeField(selectedNode.id, 'description', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-neutral-500
                                                   dark:border-neutral-600 dark:border-opacity-50
                                                   bg-white dark:bg-[#40414F] text-sm text-gray-900 dark:text-neutral-100
                                                   focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-shadow
                                                   placeholder-gray-400 dark:placeholder-neutral-500"
                                        rows={3}
                                        placeholder={
                                            isRouterNode(selectedNode)
                                                ? 'What kinds of questions does this parent handle?'
                                                : 'When should this assistant be chosen over others?'
                                        }
                                    />
                                </div>

                                {/* Router Context — leaf nodes only, conditional on what the assistant has */}
                                {isLeafNode(selectedNode) && (() => {
                                    const linked = getLinkedAssistant((selectedNode as LeafNode).assistantId);
                                    const def = linked ? getAssistant(linked) : null;
                                    if (!def) return null;

                                    const hasDataSources = (def.dataSources?.length ?? 0) > 0
                                        || !!def.data?.integrationDriveData;
                                    const hasTools = (def.data?.operations?.length ?? 0) > 0
                                        || (def.data?.builtInOperations?.length ?? 0) > 0;
                                    const hasWorkflow = !!def.data?.workflowTemplateId;

                                    if (!hasDataSources && !hasTools && !hasWorkflow) return null;

                                    const currentContext = (selectedNode as LeafNode).routerContext || [];

                                    const contextOptions: { field: RouterContextField; label: string; applies: boolean }[] = [
                                        { field: 'dataSources', label: 'Data Source Names', applies: hasDataSources },
                                        { field: 'tools',       label: 'Available Tools',   applies: hasTools },
                                        { field: 'workflow',    label: 'Workflow Template Steps', applies: hasWorkflow },
                                    ];

                                    return (
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                                                Router Context
                                            </label>
                                            <p className="text-[10px] text-gray-400 dark:text-neutral-500 mb-2 leading-relaxed">
                                                Include extra details so the parent router can make better routing decisions.
                                                Only check what&apos;s actually needed.
                                            </p>
                                            <div className="space-y-2">
                                                {contextOptions.filter(o => o.applies).map(({ field, label }) => {
                                                    const checked = currentContext.includes(field);
                                                    return (
                                                        <label
                                                            key={field}
                                                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-150
                                                                border-gray-200 dark:border-neutral-600
                                                                hover:border-purple-400 dark:hover:border-purple-500
                                                                bg-white dark:bg-[#40414F]"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={(e) => handleToggleRouterContext(selectedNode.id, field, e.target.checked)}
                                                                className="w-3.5 h-3.5 rounded accent-purple-500 flex-shrink-0 cursor-pointer"
                                                            />
                                                            <span className="text-xs text-gray-700 dark:text-neutral-200 select-none">
                                                                {label}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Decision Guide — parents only */}
                                {isRouterNode(selectedNode) && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[11px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Decision Guide</label>
                                            <AIGenerateButton
                                                onGenerate={() => handleAIGenerate('instructions', selectedNode.id)}
                                                isGenerating={generatingField === `${selectedNode.id}-instructions`}
                                            />
                                        </div>
                                        <textarea
                                            value={(selectedNode as RouterNode).instructions}
                                            onChange={(e) => handleUpdateNodeField(selectedNode.id, 'instructions', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-neutral-500
                                                       dark:border-neutral-600 dark:border-opacity-50
                                                       bg-white dark:bg-[#40414F] text-sm text-gray-900 dark:text-neutral-100
                                                       focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-shadow
                                                       placeholder-gray-400 dark:placeholder-neutral-500"
                                            rows={5}
                                            
                                            placeholder={"How should the AI decide which option to pick?\n\nExample:\n• If the user is asking about code → Code Helper\n• If the user needs writing help → Writing Assistant\n• When unsure, ask the user to clarify"}
                                        />
                                    </div>
                                )}

                                {/* Members grid — parents only */}
                                {isRouterNode(selectedNode) && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[11px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                                                Children ({(selectedNode as RouterNode).children.length})
                                            </label>
                                        </div>

                                        {(selectedNode as RouterNode).children.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600/70">
                                                <IconLayoutGrid size={24} className="text-gray-300 dark:text-gray-500 mb-2" />
                                                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                                                    No children yet.<br />
                                                    Add assistants from the right panel first.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                                {(selectedNode as RouterNode).children.map((child) => {
                                                    const cd = getNodeDepthLocal(child.id);
                                                    const cc = getDepthColor(cd);
                                                    return (
                                                        <button
                                                            key={child.id}
                                                            onClick={() => setSelectedNodeId(child.id)}
                                                            className={`group relative text-left px-3 py-3 rounded-xl border transition-all duration-150
                                                                ${child.id === selectedNodeId
                                                                    ? `${cc.bg} ring-2 ${cc.ring}`
                                                                    : 'border-gray-200 dark:border-neutral-600 hover:border-purple-500 dark:hover:border-purple-400 hover:shadow-md bg-white dark:bg-[#40414F]'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className={`p-1.5 rounded-lg ${cc.iconBg}`}>
                                                                    {isRouterNode(child)
                                                                        ? <IconRoute size={16} className={cc.text} />
                                                                        : <IconRobot size={16} className={cc.text} />
                                                                    }
                                                                </span>
                                                                <p className="ml-4 mr-auto text-xs font-semibold text-gray-800 dark:text-white truncate mb-0.5">
                                                                    {child.name || (isRouterNode(child) ? 'Unnamed Parent' : 'Unnamed Assistant')}
                                                                </p>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteNode(child.id); }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                                                                    title="Remove"
                                                                >
                                                                    <IconTrash size={13} />
                                                                </button>
                                                            </div>
                                                        
                                                            <div className="flex items-center justify-between">
                                                                <span className={`text-[9px] font-semibold ${cc.text}`}>
                                                                    {isRouterNode(child) ? 'Parent' : 'Assistant'}
                                                                </span>
                                                                <span className="text-[9px] text-gray-400 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-500 flex items-center gap-0.5 transition-colors">
                                                                    Configure <IconArrowRight size={8} />
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-400">
                            <IconRoute size={30} className="mb-2 opacity-40" />
                            <p className="text-sm">Select something from the tree to edit it</p>
                        </div>
                    )}
                </div>

                {/* ─── RIGHT: Assistant Picker ────────────────────── */}
                <div className="w-[260px] flex-shrink-0 flex flex-col rounded-xl border border-gray-200 dark:border-neutral-600 bg-white dark:bg-[#343541] overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-[#2b2c36] flex-shrink-0">
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-300 uppercase tracking-wider">
                            Add Assistants
                        </span>
                        <div className="mt-1.5">
                            <Search
                                placeholder="Search assistants..."
                                searchTerm={assistantSearch}
                                onSearch={setAssistantSearch}
                                paddingY="py-1.5"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
                        {filteredAssistants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-400">
                                <IconRobot size={24} className="mb-2 opacity-40" />
                                <p className="text-xs text-center">
                                    {assistantSearch ? 'No match' : 'No assistants available'}
                                </p>
                            </div>
                        ) : (
                            filteredAssistants.map((prompt: Prompt) => {
                                const astId = prompt.data?.assistant?.definition?.assistantId || prompt.id;
                                const addedLeaf = allLeafMap.get(astId);
                                const isAdded = !!addedLeaf;
                                // Added: use the leaf's actual depth in the tree — never changes on click.
                                // Not added: neutral until hovered (selectedDepth + 1 for hover tint only).
                                const itemDepth = addedLeaf
                                    ? getNodeDepthLocal(addedLeaf.id)
                                    : (selectedNode ? getNodeDepthLocal(selectedNode.id) + 1 : 1);
                                return (
                                    <AssistantPickerItem
                                        key={prompt.id}
                                        prompt={prompt}
                                        onAdd={handleAddLeaf}
                                        onPreview={setPreviewAssistant}
                                        isAlreadyAdded={isAdded}
                                        disabled={!canAddChildren(selectedNode)}
                                        colors={getDepthColor(itemDepth)}
                                    />
                                );
                            })
                        )}
                    </div>

                    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/70 flex-shrink-0">
                        <p className="text-[9px] text-gray-400 dark:text-gray-500 text-center">
                            {assistants.length} assistant{assistants.length !== 1 ? 's' : ''} available
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
};


// ─── Pure helper (no hooks) ───────────────────────────────────────────
function canAddChildren(node: LayeredAssistantNode | null): boolean {
    return node !== null && isRouterNode(node);
}

function countNodes(node: LayeredAssistantNode, type: 'router' | 'leaf'): number {
    let count = ((type === 'router' && isRouterNode(node)) || (type === 'leaf' && isLeafNode(node))) ? 1 : 0;
    if (isRouterNode(node)) node.children.forEach(c => { count += countNodes(c, type); });
    return count;
}

function getNodeDepth(nodeId: string, root: LayeredAssistantNode, d: number = 0): number {
    if (root.id === nodeId) return d;
    if (isRouterNode(root)) {
        for (const child of root.children) {
            const depth = getNodeDepth(nodeId, child, d + 1);
            if (depth >= 0) return depth;
        }
    }
    return -1;
}

export default LayeredAssistantBuilder;
