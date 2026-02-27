import { FC, useContext, useState, useRef, useEffect } from 'react';
import { IconRobot, IconSparkles, IconArrowUpRight, IconBolt, IconMailFast, IconApi, IconTemplate, IconWorld, IconFiles, IconBrandGoogleDrive, IconClock, IconEdit, IconEye } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Prompt } from '@/types/prompt';
import { handleStartConversationWithPrompt } from '@/utils/app/prompts';
import { isAssistant, getAssistant } from '@/utils/app/assistants';
import Search from '@/components/Search/Search';
import { AssistantModal } from '@/components/Promptbar/components/AssistantModal';

// Helper to check if data source is website/sitemap
const isWebsiteDs = (document: any) => {
    return document.type && ['website/url', 'website/sitemap'].includes(document.type);
};

// Generate gradient and badges based on assistant attributes
const getAssistantStyle = (assistant: Prompt, index: number) => {
    const definition = getAssistant(assistant);
    const opsLanguageVersion = definition.data?.opsLanguageVersion || 'v1';
    const hasWorkflow = !!definition.data?.baseWorkflowTemplateId;
    const hasEmailEvents = !!definition.data?.emailEvents;
    const hasApis = (definition.data?.operations && definition.data.operations.length > 0) ||
                    (definition.data?.builtInOperations && definition.data.builtInOperations.length > 0);

    // Separate regular data sources from website data sources
    const regularDataSources = definition.dataSources ? definition.dataSources.filter(ds => !isWebsiteDs(ds)) : [];
    const websiteDataSources = definition.dataSources ? definition.dataSources.filter(ds => isWebsiteDs(ds)) : [];
    const hasRegularDataSources = regularDataSources.length > 0;
    const hasWebsiteDataSources = websiteDataSources.length > 0;

    const hasScheduledTasks = definition.data?.scheduledTaskIds && Object.keys(definition.data.scheduledTaskIds).length > 0;

    // Calculate Drive folder and file counts
    let driveFolderCount = 0;
    let driveFileCount = 0;
    if (definition.data?.integrationDriveData) {
        Object.values(definition.data.integrationDriveData).forEach((providerData: any) => {
            if (providerData?.folders) {
                driveFolderCount += Object.keys(providerData.folders).length;
            }
            if (providerData?.files) {
                driveFileCount += Object.keys(providerData.files).length;
            }
        });
    }
    const hasDriveData = driveFolderCount > 0 || driveFileCount > 0;

    // Dynamic badges - using icons where it makes sense, text otherwise
    const badges: Array<{ icon?: any; label?: string; color: string; tooltip: string }> = [];

    if (opsLanguageVersion === 'v4') {
        badges.push({
            label: 'Agent',
            color: 'bg-purple-100 text-purple-700 dark:bg-purple-600 dark:text-white',
            tooltip: 'Agent Type Assistant'
        });
    }
    if (hasEmailEvents) {
        badges.push({
            icon: IconMailFast,
            color: 'bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white',
            tooltip: 'Email Enabled'
        });
    }
    if (hasApis) {
        badges.push({
            icon: IconApi,
            color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-600 dark:text-white',
            tooltip: 'API Integration'
        });
    }
    if (hasScheduledTasks) {
        badges.push({
            icon: IconClock,
            color: 'bg-amber-100 text-amber-700 dark:bg-yellow-600 dark:text-white',
            tooltip: 'Scheduled Tasks'
        });
    }
    if (hasWebsiteDataSources) {
        badges.push({
            icon: IconWorld,
            label: `${websiteDataSources.length}`,
            color: 'bg-sky-100 text-sky-700 dark:bg-cyan-600 dark:text-white',
            tooltip: `${websiteDataSources.length} Website/Sitemap`
        });
    }
    if (hasDriveData) {
        const driveLabel = driveFolderCount > 0 && driveFileCount > 0
            ? `${driveFolderCount}/${driveFileCount}`
            : driveFolderCount > 0
                ? `${driveFolderCount}`
                : `${driveFileCount}`;

        const folderText = driveFolderCount === 1 ? 'Folder' : 'Folders';
        const fileText = driveFileCount === 1 ? 'File' : 'Files';

        const driveTooltip = driveFolderCount > 0 && driveFileCount > 0
            ? `${driveFolderCount} ${folderText}, ${driveFileCount} ${fileText}`
            : driveFolderCount > 0
                ? `${driveFolderCount} ${folderText}`
                : `${driveFileCount} ${fileText}`;

        badges.push({
            icon: IconBrandGoogleDrive,
            label: driveLabel,
            color: 'bg-green-100 text-green-700 dark:bg-green-100 dark:text-gray-200',
            tooltip: driveTooltip
        });
    }
    if (hasWorkflow) {
        badges.push({
            label: 'Workflow',
            color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-600 dark:text-white',
            tooltip: 'Workflow Template'
        });
    }
    if (hasRegularDataSources) {
        badges.push({
            icon: IconFiles,
            label: `${regularDataSources.length}`,
            color: 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-white',
            tooltip: `${regularDataSources.length} Files`
        });
    }

    // Better gradient backgrounds for dark mode
    const gradients = [
        'from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-750',
        'from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40',
        'from-violet-50 to-purple-50 dark:from-violet-900/40 dark:to-purple-900/40',
        'from-emerald-50 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40',
        'from-amber-50 to-orange-50 dark:from-amber-900/40 dark:to-orange-900/40',
        'from-rose-50 to-pink-50 dark:from-rose-900/40 dark:to-pink-900/40',
    ];

    return {
        gradient: gradients[index % gradients.length],
        badges,
    };
};

export const IndividualAssistantsGallery: FC = () => {
    const {
        state: { prompts, statsService },
        dispatch: homeDispatch,
        handleNewConversation,
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);
    const [searchTerm, setSearchTerm] = useState('');
    const [hoveredAssistantId, setHoveredAssistantId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedAssistant, setSelectedAssistant] = useState<Prompt | null>(null);
    const [activeTab, setActiveTab] = useState<'your' | 'shared'>('your');

    useEffect(() => {
        promptsRef.current = prompts;
    }, [prompts]);

    // Helper function to check if assistant can be edited
    const canEdit = (assistant: Prompt) => {
        return !assistant.data || !assistant.data.noEdit;
    };

    // Filter to only show assistants (not regular prompts or group assistants) and sort alphabetically
    const assistants = prompts
        .filter((p: Prompt) => isAssistant(p) && !p.groupId)
        .sort((a, b) => a.name.localeCompare(b.name));

    const filteredAssistants = assistants.filter((assistant: Prompt) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return assistant.name.toLowerCase().includes(searchLower) ||
               (assistant.description && assistant.description.toLowerCase().includes(searchLower));
    });

    // Separate your assistants from shared assistants
    const yourAssistants = filteredAssistants.filter((assistant: Prompt) => canEdit(assistant));
    const sharedAssistants = filteredAssistants.filter((assistant: Prompt) => !canEdit(assistant));

    const handleStartConversation = (startPrompt: Prompt) => {
        if (isAssistant(startPrompt) && startPrompt.data) {
            homeDispatch({ field: 'selectedAssistant', value: startPrompt.data.assistant });
        }

        statsService.startConversationEvent(startPrompt);
        handleStartConversationWithPrompt(handleNewConversation, promptsRef.current, startPrompt);
    };

    const handleOpenModal = (e: React.MouseEvent, assistant: Prompt) => {
        e.stopPropagation(); // Prevent triggering the card's onClick
        setSelectedAssistant(assistant);
        setShowModal(true);
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
                                <IconRobot size={22} className="text-white" />
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/20 to-transparent" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    Assistants
                                    <IconSparkles size={18} className="text-indigo-500 dark:text-indigo-400" />
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {filteredAssistants.length} specialized AI assistants
                                </p>
                            </div>
                        </div>
                        <div className="w-64">
                            <Search
                                placeholder="Search assistants..."
                                searchTerm={searchTerm}
                                onSearch={setSearchTerm}
                                paddingY="py-2"
                            />
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-gray-200 dark:border-gray-700">
                        <div className="flex gap-1 px-8">
                            <button
                                onClick={() => setActiveTab('your')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                                    activeTab === 'your'
                                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                Your Assistants
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                    activeTab === 'your'
                                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}>
                                    {yourAssistants.length}
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab('shared')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                                    activeTab === 'shared'
                                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                Shared Assistants
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                    activeTab === 'shared'
                                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}>
                                    {sharedAssistants.length}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    {(() => {
                        const assistantsToShow = activeTab === 'your' ? yourAssistants : sharedAssistants;

                        if (assistantsToShow.length === 0) {
                            return (
                                <div className="flex flex-col items-center justify-center py-24">
                                    <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/20 dark:to-violet-900/20 mb-4 shadow-lg">
                                        <IconRobot size={36} className="text-indigo-500 dark:text-indigo-400" />
                                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-white/40 to-transparent" />
                                    </div>
                                    <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                                        {searchTerm ? 'No assistants found' : `No ${activeTab === 'your' ? 'your' : 'shared'} assistants available`}
                                    </p>
                                    {searchTerm && (
                                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                            Try a different search term
                                        </p>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div className="max-w-full mx-auto px-4">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                                    {assistantsToShow.map((assistant: Prompt, idx: number) => {
                                        const hasDescription = assistant.description && assistant.description.trim().length > 0;
                                        const { gradient, badges } = getAssistantStyle(assistant, idx);
                                        const isEditable = canEdit(assistant);

                                        return (
                                            <button
                                                key={assistant.id}
                                                onClick={() => handleStartConversation(assistant)}
                                                onMouseEnter={() => setHoveredAssistantId(assistant.id)}
                                                onMouseLeave={() => setHoveredAssistantId(null)}
                                                className="group relative rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300 text-left opacity-0 animate-fadeInUp"
                                                style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'forwards' }}
                                            >
                                                {/* Gradient header */}
                                                <div className={`bg-gradient-to-br ${gradient} p-4`}>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/90 dark:bg-gray-800/90 shadow-sm">
                                                                <IconRobot size={16} className="text-gray-700 dark:text-gray-300" />
                                                            </div>
                                                            <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight line-clamp-2">
                                                                {assistant.name}
                                                            </h3>
                                                        </div>
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                                                            <IconArrowUpRight size={16} className="text-gray-600 dark:text-gray-400" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* White body section */}
                                                <div className="bg-white dark:bg-gray-800 p-4 pt-3 relative">
                                                    {hasDescription && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 mb-3">
                                                            {assistant.description}
                                                        </p>
                                                    )}

                                                    {/* Capability badges */}
                                                    {badges.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {badges.map((badge, i) => {
                                                                const BadgeIcon = badge.icon;
                                                                return (
                                                                    <span
                                                                        key={i}
                                                                        title={badge.tooltip}
                                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${badge.color}`}
                                                                    >
                                                                        {BadgeIcon && <BadgeIcon size={16} className="flex-shrink-0" />}
                                                                        {badge.label && <span className="whitespace-nowrap">{badge.label}</span>}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Edit/View Icon Button - Bottom Right */}
                                                    <button
                                                        onClick={(e) => handleOpenModal(e, assistant)}
                                                        className={`absolute bottom-3 right-3 p-2 rounded-lg bg-white dark:bg-gray-700 border-2 border-indigo-500 dark:border-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 z-20 ${
                                                            hoveredAssistantId === assistant.id ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                                        }`}
                                                        title={isEditable ? "Edit Assistant" : "View Assistant"}
                                                    >
                                                        {isEditable ? (
                                                            <IconEdit size={16} className="text-indigo-500 dark:text-indigo-400" />
                                                        ) : (
                                                            <IconEye size={16} className="text-indigo-500 dark:text-indigo-400" />
                                                        )}
                                                    </button>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Assistant Modal */}
            {showModal && selectedAssistant && (
                <AssistantModal
                    assistant={selectedAssistant}
                    onCancel={() => setShowModal(false)}
                    onSave={() => setShowModal(false)}
                    onUpdateAssistant={() => { } } loadingMessage={''} loc={''}                />
            )}
        </div>
    );
};
