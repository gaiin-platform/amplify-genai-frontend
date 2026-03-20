import { FC, useContext, useState, useRef, useEffect } from 'react';
import { IconRobot, IconUsers, IconSparkles, IconChevronDown, IconSettingsBolt, IconGitBranch } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Group, GroupAccessType } from '@/types/groups';
import { Prompt } from '@/types/prompt';
import { LayeredAssistant } from '@/types/layeredAssistant';
import { handleStartConversationWithPrompt } from '@/utils/app/prompts';
import { isAssistant } from '@/utils/app/assistants';
import { useSession } from 'next-auth/react';
import { getUserIdentifier } from '@/utils/app/data';
import Search from '@/components/Search/Search';

export interface GroupAssistantsGalleryProps {}

const softColors = [
    { bg: 'bg-purple-50 dark:bg-purple-900/10', icon: 'text-purple-500 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800/30', accent: 'bg-purple-400 dark:bg-purple-600' },
    { bg: 'bg-blue-50 dark:bg-blue-900/10', icon: 'text-blue-500 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800/30', accent: 'bg-blue-400 dark:bg-blue-600' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/10', icon: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/30', accent: 'bg-emerald-400 dark:bg-emerald-600' },
    { bg: 'bg-amber-50 dark:bg-amber-900/10', icon: 'text-amber-500 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/30', accent: 'bg-amber-400 dark:bg-amber-600' },
    { bg: 'bg-pink-50 dark:bg-pink-900/10', icon: 'text-pink-500 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800/30', accent: 'bg-pink-400 dark:bg-pink-600' },
    { bg: 'bg-cyan-50 dark:bg-cyan-900/10', icon: 'text-cyan-500 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800/30', accent: 'bg-cyan-400 dark:bg-cyan-600' },
    { bg: 'bg-indigo-50 dark:bg-indigo-900/10', icon: 'text-indigo-500 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800/30', accent: 'bg-indigo-400 dark:bg-indigo-600' },
    { bg: 'bg-rose-50 dark:bg-rose-900/10', icon: 'text-rose-500 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800/30', accent: 'bg-rose-400 dark:bg-rose-600' },
];

export const GroupAssistantsGallery: FC<GroupAssistantsGalleryProps> = () => {
    const {
        state: { groups, prompts, lightMode, statsService, featureFlags },
        dispatch: homeDispatch,
        handleNewConversation,
    } = useContext(HomeContext);

    const { data: session } = useSession();
    const user = getUserIdentifier(session?.user);

    const promptsRef = useRef(prompts);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
    const hasAnimatedRef = useRef(false); // Track if we've done initial animation
    const cardColumnMap = useRef<Map<number, number>>(new Map()); // Lock each card to its column (index -> column)
    const [expandedAssistants, setExpandedAssistants] = useState<Set<string>>(new Set()); // Track which assistant descriptions are expanded (multiple allowed!)
    const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null); // Track which group card is hovered

    useEffect(() => {
        promptsRef.current = prompts;
    }, [prompts]);

    // Check if user has admin or write access to a group
    const hasAccessToGroupAdminInterface = (group: Group) => {
        if (!user || !featureFlags.assistantAdminInterface) return false;
        const accessType = group.members[user];
        return [GroupAccessType.ADMIN, GroupAccessType.WRITE].includes(accessType);
    };

    // Filter groups: show if they have assistants/layered assistants OR if user is admin/write member
    const filteredGroups = groups.filter((group: Group) => {
        // Show group if it has assistants, layered assistants, OR user has admin/write access
        const hasAssistants = group.assistants && group.assistants.length > 0;
        const hasLayeredAssistants = group.layeredAssistants && group.layeredAssistants.length > 0;
        const hasAdminAccess = hasAccessToGroupAdminInterface(group);

        if (!hasAssistants && !hasLayeredAssistants && !hasAdminAccess) return false;

        // Apply search filter
        if (!searchTerm) return true;

        const searchLower = searchTerm.toLowerCase();
        const groupNameMatch = group.name.toLowerCase().includes(searchLower);
        const assistantMatch = group.assistants.some((ast: Prompt) =>
            ast.name.toLowerCase().includes(searchLower) ||
            (ast.description && ast.description.toLowerCase().includes(searchLower))
        );
        const layeredAssistantMatch = group.layeredAssistants?.some((la: LayeredAssistant) =>
            la.name.toLowerCase().includes(searchLower) ||
            (la.description && la.description.toLowerCase().includes(searchLower))
        ) || false;

        return groupNameMatch || assistantMatch || layeredAssistantMatch;
    });

    const getFilteredAssistants = (group: Group) => {
        if (!searchTerm) return group.assistants;

        const searchLower = searchTerm.toLowerCase();
        return group.assistants.filter((ast: Prompt) =>
            ast.name.toLowerCase().includes(searchLower) ||
            (ast.description && ast.description.toLowerCase().includes(searchLower))
        );
    };

    const getFilteredLayeredAssistants = (group: Group) => {
        if (!searchTerm || !group.layeredAssistants) return group.layeredAssistants || [];

        const searchLower = searchTerm.toLowerCase();
        return group.layeredAssistants.filter((la: LayeredAssistant) =>
            la.name.toLowerCase().includes(searchLower) ||
            (la.description && la.description.toLowerCase().includes(searchLower))
        );
    };

    // 🧮 THE MATH MAGIC - Calculate masonry positions with transforms!
    useEffect(() => {
        const calculateMasonryPositions = () => {
            if (!containerRef.current || cardsRef.current.length === 0) return;

            const cards = cardsRef.current.filter(card => card !== null) as HTMLDivElement[];
            if (cards.length === 0) return;

            // Get container width to calculate columns
            const containerWidth = containerRef.current.offsetWidth;
            const cardWidth = 230; // Base card width
            const gap = 24; // 1.5rem = 24px

            // Calculate how many columns we can fit
            const columns = Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));
            // Track the bottom position of each column
            const columnBottoms = new Array(columns).fill(0);
            const columnLefts = Array.from({ length: columns }, (_, i) => i * (cardWidth + gap));

            // For each card, place it in its LOCKED column (or assign one on first run)
            cards.forEach((card, index) => {
                // Get locked column, or assign to shortest column on first run
                let assignedColumn = cardColumnMap.current.get(index);
                if (assignedColumn === undefined) {
                    // First time seeing this card - assign to shortest column
                    assignedColumn = columnBottoms.indexOf(Math.min(...columnBottoms));
                    cardColumnMap.current.set(index, assignedColumn);
                }

                // Calculate position using the LOCKED column
                const targetLeft = columnLefts[assignedColumn];
                const targetTop = columnBottoms[assignedColumn];

                // Apply absolute positioning
                card.style.position = 'absolute';
                card.style.top = `${targetTop}px`;
                card.style.width = `${cardWidth}px`;

                // Only animate on FIRST load, not on modal open/close
                if (!hasAnimatedRef.current) {
                    // Start off-screen to the LEFT, then swoop in
                    card.style.left = `${targetLeft - 100}px`;
                    card.style.opacity = '0';

                    // Trigger animation with slight delay for stagger effect
                    setTimeout(() => {
                        card.style.left = `${targetLeft}px`;
                        card.style.opacity = '1';
                    }, index * 50); // Stagger by 50ms per card
                } else {
                    // Already animated, just position immediately
                    card.style.left = `${targetLeft}px`;
                    card.style.opacity = '1';
                }


                // Update this column's bottom position
                columnBottoms[assignedColumn] = targetTop + card.offsetHeight + gap;
            });

            // Set container height to tallest column
            const maxHeight = Math.max(...columnBottoms);
            containerRef.current.style.height = `${maxHeight}px`;

            // Mark that we've done the initial animation
            hasAnimatedRef.current = true;
        };

        // Run after layout
        const timer = setTimeout(calculateMasonryPositions, 100);

        // Recalculate on window resize - clear column locks so cards can reorganize
        const handleResize = () => {
            cardColumnMap.current.clear(); // Reset column assignments
            calculateMasonryPositions();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, [filteredGroups, searchTerm, expandedAssistants]);

    const handleStartConversation = (startPrompt: Prompt) => {
        if (isAssistant(startPrompt) && startPrompt.data) {
            homeDispatch({ field: 'selectedAssistant', value: startPrompt.data.assistant });
        }

        statsService.startConversationEvent(startPrompt);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, startPrompt);
    };

    return (
        <div className="relative flex-1 h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
            {/* Very subtle ambient light effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-100/5 to-blue-100/5 dark:from-purple-500/5 dark:to-blue-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-br from-blue-100/5 to-purple-100/5 dark:from-blue-500/5 dark:to-purple-500/5 rounded-full blur-3xl" />
            </div>

            <div className="relative flex-1 overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between px-6 py-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20">
                                <IconSparkles size={18} className="text-purple-500 dark:text-purple-400" />
                            </div>
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Group Assistants
                            </h1>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                {groups.reduce((sum: number, g: Group) => sum + g.assistants.length + (g.layeredAssistants?.length || 0), 0)} total
                            </span>
                        </div>
                        <div className="w-56">
                            <Search
                                placeholder="Search..."
                                searchTerm={searchTerm}
                                onSearch={setSearchTerm}
                                paddingY="py-1.5"
                            />
                        </div>
                    </div>
                </div>

                {/* Masonry Grid - Groups Flow Naturally */}
                <div className="p-6">
                    {filteredGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-900/10 mb-3">
                                <IconUsers size={32} className="text-purple-400 dark:text-purple-400" />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {searchTerm ? 'No assistants found' : 'No group assistants available'}
                            </p>
                        </div>
                    ) : (
                        <div ref={containerRef} className="masonry-container">
                            {filteredGroups.map((group: Group, groupIdx: number) => {
                                const filteredAssistants = getFilteredAssistants(group);
                                const filteredLayeredAssistants = getFilteredLayeredAssistants(group);
                                const color = softColors[groupIdx % softColors.length];
                                const hasAdminAccess = hasAccessToGroupAdminInterface(group);

                                // Skip if no assistants/layered assistants and no admin access (shouldn't happen due to filter, but safety check)
                                if (filteredAssistants.length === 0 && filteredLayeredAssistants.length === 0 && !hasAdminAccess) return null;

                                return (
                                    <div
                                        key={`${group.id}_${groupIdx}`}
                                        ref={(el) => cardsRef.current[groupIdx] = el}
                                        className="masonry-item"
                                        onMouseEnter={() => setHoveredGroupId(group.id)}
                                        onMouseLeave={() => setHoveredGroupId(null)}
                                    >
                                        {/* Entire Group Card with Border and Background */}
                                        <div className={`rounded-xl border-2 ${color.border} p-4 ${groupIdx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/70'} shadow-sm hover:scale-[1.02] transition-transform duration-300`}>
                                            {/* Group Header */}
                                            <div className="mb-4 rounded-lg p-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141a2e] relative">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.bg} flex-shrink-0`}>
                                                        <IconUsers size={20} className={color.icon} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white break-words">
                                                            {group.name}
                                                        </h2>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {filteredAssistants.length + filteredLayeredAssistants.length} {filteredAssistants.length + filteredLayeredAssistants.length === 1 ? 'item' : 'items'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Settings gear icon - positioned absolutely, shows on hover if user has admin access */}
                                                {hasAdminAccess && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', {
                                                                detail: {
                                                                    isOpen: true,
                                                                    data: { group }
                                                                }
                                                            }));
                                                        }}
                                                        className={`absolute top-2 right-2 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-purple-100 dark:hover:bg-purple-900/20 shadow-sm transition-all duration-200 ${
                                                            hoveredGroupId === group.id ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                                        }`}
                                                        title="Open in Assistant Admin Interface"
                                                    >
                                                        <IconSettingsBolt size={18} className="text-purple-500" />
                                                    </button>
                                                )}

                                                {/* Color accent line at bottom */}
                                                <div className={`mt-3 h-1 rounded-full ${color.accent}`} />
                                            </div>

                                            {/* Assistants Stack Vertically */}
                                            <div className="space-y-3">
                                                {filteredAssistants.map((assistant: Prompt) => {

                                                    return (
                                                    <div
                                                        key={assistant.id}
                                                        className={`group relative w-full rounded-xl border ${color.border} bg-white dark:bg-[#191d2b] p-4 hover:shadow-xl transition-all duration-300 overflow-hidden`}
                                                    >
                                                        {/* Soft color accent bar on left */}
                                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${color.accent}`} />

                                                        {/* Main clickable area to start chat */}
                                                        <button
                                                            onClick={() => handleStartConversation(assistant)}
                                                            title={`Chat with ${assistant.name}`}
                                                            className="w-full text-left hover:scale-[1.01] transition-transform"
                                                        >
                                                            {/* Icon & Content */}
                                                            <div className="flex items-start gap-3">
                                                                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${color.bg} transition-transform duration-300 group-hover:scale-110`}>
                                                                    <IconRobot size={22} className={color.icon} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white leading-snug mb-1">
                                                                        {assistant.name}
                                                                    </h3>
                                                                    {assistant.description && (
                                                                        <p className={`text-[11px] text-gray-600 dark:text-gray-400 leading-snug ${expandedAssistants.has(assistant.id) ? '' : 'line-clamp-5'}`}>
                                                                            {assistant.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </button>

                                                        {/* Expand/Collapse Description Button - Only show if description is long enough to truncate */}
                                                        {assistant.description && assistant.description.length > 80 && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newExpanded = new Set(expandedAssistants);
                                                                    if (newExpanded.has(assistant.id)) {
                                                                        newExpanded.delete(assistant.id);
                                                                    } else {
                                                                        newExpanded.add(assistant.id);
                                                                    }
                                                                    setExpandedAssistants(newExpanded);
                                                                }}
                                                                className={`absolute bottom-3 left-6 p-1.5 rounded-md border transition-all duration-200 ${
                                                                    expandedAssistants.has(assistant.id)
                                                                        ? 'text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/30'
                                                                        : 'text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:text-purple-500 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-700'
                                                                }`}
                                                                title={expandedAssistants.has(assistant.id) ? "Show less" : "Show more"}
                                                            >
                                                                <IconChevronDown
                                                                    size={14}
                                                                    className={`transition-transform duration-200 ${expandedAssistants.has(assistant.id) ? 'rotate-180' : ''}`}
                                                                />
                                                            </button>
                                                        )}

                                                        {/* Subtle hover indicator (arrow) */}
                                                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${color.bg} shadow-sm`}>
                                                                <svg
                                                                    className={`h-3 w-3 ${color.icon}`}
                                                                    fill="none"
                                                                    viewBox="0 0 24 24"
                                                                    stroke="currentColor"
                                                                >
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        strokeWidth={2.5}
                                                                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                                                                    />
                                                                </svg>
                                                            </div>
                                                        </div>

                                                        {/* Soft glow on hover */}
                                                        <div className={`absolute inset-0 ${color.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl`} />
                                                    </div>
                                                );
                                                })}
                                                {/* Layered Assistants Section */}
                                                {filteredLayeredAssistants.length > 0 && (
                                                    <>
                                                        {filteredLayeredAssistants.map((la: LayeredAssistant) => (
                                                            <div
                                                                key={la.publicId || la.id}
                                                                className={`group relative w-full rounded-xl border ${color.border} bg-white dark:bg-[#191d2b] p-4 hover:shadow-xl transition-all duration-300 overflow-hidden`}
                                                            >
                                                                {/* Soft color accent bar on left */}
                                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${color.accent}`} />

                                                                {/* Main clickable area - opens admin interface */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        window.dispatchEvent(new CustomEvent('openAstAdminInterfaceTrigger', {
                                                                            detail: {
                                                                                isOpen: true,
                                                                                data: { group, tabToOpen: 'layered' }
                                                                            }
                                                                        }));
                                                                    }}
                                                                    title={`Edit ${la.name}`}
                                                                    className="w-full text-left hover:scale-[1.01] transition-transform"
                                                                >
                                                                    {/* Icon & Content */}
                                                                    <div className="flex items-start gap-3">
                                                                        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${color.bg} transition-transform duration-300 group-hover:scale-110`}>
                                                                            <IconGitBranch size={22} className={color.icon} />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <h3 className="font-semibold text-sm text-gray-900 dark:text-white leading-snug mb-1">
                                                                                {la.name}
                                                                            </h3>
                                                                            {la.description && (
                                                                                <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug line-clamp-5">
                                                                                    {la.description}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </button>

                                                                {/* Subtle hover indicator (arrow) */}
                                                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${color.bg} shadow-sm`}>
                                                                        <svg
                                                                            className={`h-3 w-3 ${color.icon}`}
                                                                            fill="none"
                                                                            viewBox="0 0 24 24"
                                                                            stroke="currentColor"
                                                                        >
                                                                            <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth={2.5}
                                                                                d="M13 7l5 5m0 0l-5 5m5-5H6"
                                                                            />
                                                                        </svg>
                                                                    </div>
                                                                </div>

                                                                {/* Soft glow on hover */}
                                                                <div className={`absolute inset-0 ${color.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl`} />
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in {
                    animation: fade-in 0.5s ease-out forwards;
                }

                .masonry-container {
                    position: relative;
                    width: 100%;
                    /* Height set dynamically by JS */
                }

                .masonry-item {
                    /* Start hidden, JS will fade in after positioning */
                    opacity: 0;
                    /* FASTER transitions for position - more responsive! */
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease-out;
                }
            `}</style>
        </div>
    );
};
