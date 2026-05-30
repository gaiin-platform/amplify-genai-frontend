import { FC, useContext, useState, useRef, useEffect } from 'react';
import { IconTemplate, IconFileText, IconSparkles, IconBolt, IconArrowUpRight, IconLayersLinked, IconEdit } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Prompt } from '@/types/prompt';
import { handleStartConversationWithPrompt } from '@/utils/app/prompts';
import { isAssistant } from '@/utils/app/assistants';
import { Masonry } from '@/components/ReusableComponents/Masonry';
import Search from '@/components/Search/Search';
import { PromptModal } from '@/components/Promptbar/components/PromptModal';

interface PromptGroup {
    rootPrompt: Prompt;
    childPrompts: Prompt[];
}

export const PromptTemplatesGallery: FC = () => {
    const {
        state: { prompts, statsService, availableModels },
        dispatch: homeDispatch,
        handleNewConversation,
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
    const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Prompt | null>(null);

    useEffect(() => {
        promptsRef.current = prompts;
    }, [prompts]);

    // Filter to only show regular prompts (not assistants)
    const promptTemplates = prompts.filter((p: Prompt) => !isAssistant(p));

    // Organize prompts into categories
    const groupedPrompts: { quickActions: Prompt[], customInstructions: Prompt[], yourTemplates: Prompt[] } = promptTemplates.reduce(
        (acc, prompt) => {
            // Quick Actions: All prompts in amplify_helpers folder
            if (prompt.folderId === 'amplify_helpers') {
                acc.quickActions.push(prompt);
            }
            // Custom Instructions: Root prompts NOT in amplify_helpers
            else if (prompt.type === 'root_prompt' && prompt.folderId !== 'amplify_helpers') {
                acc.customInstructions.push(prompt);
            }
            // Your Templates: Everything else
            else {
                acc.yourTemplates.push(prompt);
            }
            return acc;
        },
        { quickActions: [] as Prompt[], customInstructions: [] as Prompt[], yourTemplates: [] as Prompt[] }
    );

    // Sort alphabetically
    groupedPrompts.quickActions.sort((a, b) => a.name.localeCompare(b.name));
    groupedPrompts.customInstructions.sort((a, b) => a.name.localeCompare(b.name));
    groupedPrompts.yourTemplates.sort((a, b) => a.name.localeCompare(b.name));

    // Apply search filter
    const filteredQuickActions = searchTerm
        ? groupedPrompts.quickActions.filter(template => {
            const searchLower = searchTerm.toLowerCase();
            return template.name.toLowerCase().includes(searchLower) ||
                (template.description && template.description.toLowerCase().includes(searchLower));
        })
        : groupedPrompts.quickActions;

    const filteredCustomInstructions = searchTerm
        ? groupedPrompts.customInstructions.filter(template => {
            const searchLower = searchTerm.toLowerCase();
            return template.name.toLowerCase().includes(searchLower) ||
                (template.description && template.description.toLowerCase().includes(searchLower));
        })
        : groupedPrompts.customInstructions;

    const filteredYourTemplates = searchTerm
        ? groupedPrompts.yourTemplates.filter(template => {
            const searchLower = searchTerm.toLowerCase();
            return template.name.toLowerCase().includes(searchLower) ||
                (template.description && template.description.toLowerCase().includes(searchLower));
        })
        : groupedPrompts.yourTemplates;

    const hasResults = filteredQuickActions.length > 0 || filteredCustomInstructions.length > 0 || filteredYourTemplates.length > 0;

    const toggleDescription = (id: string) => {
        setExpandedDescriptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleStartConversation = (startPrompt: Prompt) => {
        statsService.startConversationEvent(startPrompt);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, startPrompt, availableModels);
    };

    const handleOpenModal = (e: React.MouseEvent, template: Prompt) => {
        e.stopPropagation(); // Prevent triggering the card's onClick
        setSelectedTemplate(template);
        setShowModal(true);
    };

    const handleUpdatePrompt = (updatedPrompt: Prompt) => {
        homeDispatch({
            field: 'prompts',
            value: prompts.map((p: Prompt) => p.id === updatedPrompt.id ? updatedPrompt : p)
        });
    };

    return (
        <div className="relative flex-1 h-full overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/30 dark:from-gray-900 dark:via-indigo-950/20 dark:to-violet-950/20">
            {/* Animated gradient orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-indigo-200/30 to-violet-200/30 dark:from-indigo-500/10 dark:to-violet-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-teal-200/30 to-cyan-200/30 dark:from-teal-500/10 dark:to-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative h-full overflow-y-auto">
                {/* Header with glassmorphism */}
                <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm">
                    <div className="flex items-center justify-between px-8 py-4">
                        <div className="flex items-center gap-4">
                            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 dark:shadow-indigo-500/20">
                                <IconTemplate size={22} className="text-white" />
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/20 to-transparent" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    Prompt Templates
                                    <IconSparkles size={18} className="text-indigo-500 dark:text-indigo-400" />
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {filteredQuickActions.length + filteredCustomInstructions.length + filteredYourTemplates.length} templates
                                </p>
                            </div>
                        </div>
                        <div className="w-64">
                            <Search
                                placeholder="Search templates..."
                                searchTerm={searchTerm}
                                onSearch={setSearchTerm}
                                paddingY="py-2"
                            />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    {!hasResults ? (
                        <div className="flex flex-col items-center justify-center py-24">
                            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/20 dark:to-violet-900/20 mb-4 shadow-lg">
                                <IconFileText size={36} className="text-indigo-500 dark:text-indigo-400" />
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-white/40 to-transparent" />
                            </div>
                            <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                                {searchTerm ? 'No templates found' : 'No templates available'}
                            </p>
                            {searchTerm && (
                                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                    Try a different search term
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto space-y-8">
                            {/* Quick Actions - FIRST */}
                            {filteredQuickActions.length > 0 && (
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
                                        Quick Actions
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {filteredQuickActions.map((template, idx) => (
                                            <button
                                                key={template.id}
                                                onClick={() => handleStartConversation(template)}
                                                onMouseEnter={() => setHoveredTemplateId(template.id)}
                                                onMouseLeave={() => setHoveredTemplateId(null)}
                                                className="group/child relative flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm p-3 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-lg transition-all duration-200 text-left overflow-hidden opacity-0 animate-slideInRight"
                                                style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'forwards' }}
                                            >
                                                {/* Hover gradient */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-violet-500/5 dark:from-indigo-500/10 dark:to-violet-500/10 opacity-0 group-hover/child:opacity-100 transition-opacity duration-200" />

                                                <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md group-hover/child:scale-105 transition-transform duration-200">
                                                    <IconBolt size={18} className="text-white" />
                                                </div>

                                                <div className="relative flex-1 min-w-0">
                                                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5">
                                                        {template.name}
                                                    </h4>
                                                    {template.description && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                                            {template.description}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Edit Icon Button */}
                                                <div
                                                    onClick={(e) => handleOpenModal(e, template)}
                                                    className={`relative p-2 rounded-lg bg-white dark:bg-gray-700 border-2 border-indigo-500 dark:border-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 z-20 cursor-pointer ${hoveredTemplateId === template.id ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                                        }`}
                                                    title="Edit Template"
                                                >
                                                    <IconEdit size={16} className="text-indigo-500 dark:text-indigo-400" />
                                                </div>

                                                <div className={`relative flex-shrink-0 transition-opacity duration-200 ${hoveredTemplateId === template.id ? 'opacity-0' : 'opacity-0 group-hover/child:opacity-100'}`}>
                                                    <IconArrowUpRight size={16} className="text-indigo-500 dark:text-indigo-400" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Custom Instructions - SECOND */}
                            {filteredCustomInstructions.length > 0 && (
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
                                        Custom Instructions
                                    </h2>
                                    <Masonry cardWidth={280} gap={20}>
                                        {filteredCustomInstructions.map((template, idx) => (
                                            <button
                                                key={template.id}
                                                onClick={() => handleStartConversation(template)}
                                                onMouseEnter={() => setHoveredTemplateId(template.id)}
                                                onMouseLeave={() => setHoveredTemplateId(null)}
                                                className="group/card relative rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5 shadow-lg hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-300 overflow-hidden text-left w-full opacity-0 animate-fadeInScale"
                                                style={{ animationDelay: `${(filteredQuickActions.length * 40 + 200) + idx * 50}ms`, animationFillMode: 'forwards' }}
                                            >
                                                {/* Accent gradient */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 dark:from-purple-500/10 dark:to-blue-500/10 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

                                                <div className="relative flex items-start gap-3">
                                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 shadow-sm group-hover/card:scale-110 transition-transform duration-200">
                                                        <IconLayersLinked size={20} className="text-purple-600 dark:text-purple-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                                                            {template.name}
                                                        </h3>
                                                        {template.description && (
                                                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                                <p className={expandedDescriptions.has(template.id) ? '' : 'line-clamp-2'}>
                                                                    {template.description}
                                                                </p>
                                                                {template.description.length > 100 && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleDescription(template.id);
                                                                        }}
                                                                        className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium mt-1 inline-block"
                                                                    >
                                                                        {expandedDescriptions.has(template.id) ? 'Show less' : 'Read more'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-xs font-medium text-purple-600 dark:text-purple-400">
                                                                <IconSparkles size={11} />
                                                                Root Template
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Edit Icon Button - Bottom Right */}
                                                <div
                                                    onClick={(e) => handleOpenModal(e, template)}
                                                    className={`absolute bottom-3 right-3 p-2 rounded-lg bg-white dark:bg-gray-700 border-2 border-purple-500 dark:border-purple-400 hover:bg-purple-200 dark:hover:bg-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 z-20 cursor-pointer ${hoveredTemplateId === template.id ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                                        }`}
                                                    title="Edit Template"
                                                >
                                                    <IconEdit size={16} className="text-purple-500 dark:text-purple-400" />
                                                </div>

                                                {/* Arrow indicator on hover */}
                                                <div className={`absolute top-4 right-4 transition-all duration-200 ${hoveredTemplateId === template.id ? 'opacity-0' : 'opacity-0 group-hover/card:opacity-100 group-hover/card:translate-x-0 translate-x-2'}`}>
                                                    <IconArrowUpRight size={18} className="text-purple-500 dark:text-purple-400" />
                                                </div>
                                            </button>
                                        ))}
                                    </Masonry>
                                </div>
                            )}

                            {/* Your Templates - THIRD */}
                            {filteredYourTemplates.length > 0 && (
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
                                        Your Templates
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {filteredYourTemplates.map((template, idx) => (
                                            <button
                                                key={template.id}
                                                onClick={() => handleStartConversation(template)}
                                                onMouseEnter={() => setHoveredTemplateId(template.id)}
                                                onMouseLeave={() => setHoveredTemplateId(null)}
                                                className="group/standalone relative flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-4 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-lg transition-all duration-200 text-left overflow-hidden opacity-0 animate-fadeInScale"
                                                style={{ animationDelay: `${(filteredQuickActions.length * 40 + 200) + (filteredCustomInstructions.length * 50) + 200 + idx * 50}ms`, animationFillMode: 'forwards' }}
                                            >
                                                {/* Hover gradient */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-violet-500/5 dark:from-indigo-500/10 dark:to-violet-500/10 opacity-0 group-hover/standalone:opacity-100 transition-opacity duration-200" />

                                                <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 group-hover/standalone:scale-110 transition-transform duration-200">
                                                    <IconFileText size={20} className="text-gray-700 dark:text-gray-300" />
                                                </div>

                                                <div className="relative flex-1 min-w-0">
                                                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                                                        {template.name}
                                                    </h4>
                                                    {template.description && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                                                            {template.description}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Edit Icon Button */}
                                                <div
                                                    onClick={(e) => handleOpenModal(e, template)}
                                                    className={`relative p-2 rounded-lg bg-white dark:bg-gray-700 border-2 border-indigo-500 dark:border-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 z-20 cursor-pointer ${hoveredTemplateId === template.id ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                                        }`}
                                                    title="Edit Template"
                                                >
                                                    <IconEdit size={16} className="text-indigo-500 dark:text-indigo-400" />
                                                </div>

                                                <div className={`relative flex-shrink-0 transition-all duration-200 ${hoveredTemplateId === template.id ? 'opacity-0' : 'opacity-0 group-hover/standalone:opacity-100 group-hover/standalone:translate-x-0 -translate-x-2'}`}>
                                                    <IconArrowUpRight size={18} className="text-indigo-500 dark:text-indigo-400" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Prompt Modal */}
            {showModal && selectedTemplate && (
                <PromptModal
                    prompt={selectedTemplate}
                    onCancel={() => setShowModal(false)}
                    onSave={() => setShowModal(false)}
                    onUpdatePrompt={handleUpdatePrompt}
                />
            )}
        </div>
    );
};
