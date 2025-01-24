import {
    IconArrowDown,
    IconPlayerStop,
    IconAt,
    IconFiles,
    IconSend,
} from '@tabler/icons-react';
import {
    KeyboardEvent,
    MutableRefObject,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import { useTranslation } from 'next-i18next';
import { Conversation, Message, MessageType, newMessage } from '@/types/chat';
import { Plugin, PluginID } from '@/types/plugin';
import { AttachedDocument, AttachedDocumentMetadata } from "@/types/attacheddocument";
import HomeContext from '@/pages/api/home/home.context';
import { DefaultModels, Model } from "@/types/model";
import { Assistant, DEFAULT_ASSISTANT } from "@/types/assistant";
import { useChatService } from "@/hooks/useChatService";
import { getSettings } from '@/utils/app/settings';
import { useSession } from 'next-auth/react';
import { doSaveMemoryOp, doCreateProjectOp, doGetProjectsOp } from '@/services/memoryService';

interface Props {
    onSend: (message: Message, documents: AttachedDocument[]) => void;
    onRegenerate: () => void;
    handleUpdateModel: (model: Model) => void;
    onScrollDownClick: () => void;
    stopConversationRef: MutableRefObject<boolean>;
    textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
    showScrollDownButton: boolean;
    plugins: Plugin[];
    setPlugins: (p: Plugin[]) => void;
}

export const MemoryPresenter = () => {
    const { t } = useTranslation('chat');

    const { killRequest } = useChatService();

    const {
        state: { selectedConversation, selectedAssistant, messageIsStreaming, artifactIsStreaming, prompts, featureFlags, currentRequestId, chatEndpoint, statsService, availableModels, extractedFacts },
        getDefaultModel,
        dispatch: homeDispatch
    } = useContext(HomeContext);

    const [factTypes, setFactTypes] = useState<{ [key: string]: string }>({});
    const [selectedProjects, setSelectedProjects] = useState<{ [key: string]: string }>({});
    const [isFactsVisible, setIsFactsVisible] = useState(false);

    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const handleTypeChange = (index: number, value: string) => {
        setFactTypes(prev => ({ ...prev, [index]: value }));
    };

    const handleSaveFact = async (index: number) => {
        const fact = extractedFacts[index];
        const type = factTypes[index] || 'user';

        let typeID: string;
        switch (type) {
            case 'user':
                if (!userEmail) {
                    throw new Error('User email not available');
                }
                typeID = userEmail;
                break;
            case 'assistant':
                typeID = selectedAssistant?.definition?.assistantId || 'default-assistant-id';
                break;
            case 'project':
                const projectId = selectedProjects[index];
                if (!projectId) {
                    throw new Error('No project selected');
                }
                typeID = projectId;
                break;
            default:
                typeID = type;
        }

        try {
            await doSaveMemoryOp(fact, type, typeID);

            // Remove the saved fact from the list
            const updatedFacts = extractedFacts.filter((_, i) => i !== index);
            homeDispatch({ field: 'extractedFacts', value: updatedFacts });

            // Clean up the fact type and selected project
            const updatedFactTypes = { ...factTypes };
            delete updatedFactTypes[index];
            setFactTypes(updatedFactTypes);

            const updatedSelectedProjects = { ...selectedProjects };
            delete updatedSelectedProjects[index];
            setSelectedProjects(updatedSelectedProjects);
        } catch (error) {
            console.error('Failed to save memory:', error);
            alert('Failed to save memory item');
        }
    };

    const handleDeleteFact = (index: number) => {
        // Remove the fact without saving
        const updatedFacts = extractedFacts.filter((_, i) => i !== index);
        homeDispatch({ field: 'extractedFacts', value: updatedFacts });

        // Clean up the fact type
        const updatedFactTypes = { ...factTypes };
        delete updatedFactTypes[index];
        setFactTypes(updatedFactTypes);
    };

    const getUserProjects = async () => {
        try {
            if (userEmail) {
                const response = await doGetProjectsOp(userEmail);
                // console.log("RESPONSE!!!", response);
                if (response && response.body) {
                    // Parse the JSON string in the body
                    const parsedBody = JSON.parse(response.body);
                    return parsedBody;  // This will now have the projects array
                }
            }
            return { projects: [] };
        } catch (error) {
            console.error('Failed to fetch projects:', error);
            return { projects: [] };
        }
    };

    const ProjectSelector = ({
        index,
        selectedProject,
        onProjectSelect
    }: {
        index: number;
        selectedProject: string;
        onProjectSelect: (projectId: string) => void;
    }) => {
        const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
        const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
        const [newProjectName, setNewProjectName] = useState('');

        useEffect(() => {
            loadProjects();
        }, []);

        interface ProjectFromBackend {
            id: string;
            project: string;
            user: string;
            timestamp: string;
        }

        const loadProjects = async () => {
            const response = await getUserProjects();
            if (!response) {
                setProjects([]);
                return;
            }
            const formattedProjects = (response.projects as ProjectFromBackend[])?.map(project => ({
                id: project.id,
                name: project.project
            })) || [];
            setProjects(formattedProjects);
        };

        const handleCreateProject = async () => {
            try {
                await doCreateProjectOp(newProjectName);
                setNewProjectName('');
                setIsCreateModalOpen(false);
                // Reload projects after creating new one
                await loadProjects();
            } catch (error) {
                console.error('Failed to create project:', error);
                alert('Failed to create project');
            }
        };

        return (
            <>
                <select
                    value={selectedProject || ''}
                    onChange={(e) => {
                        if (e.target.value === 'create-new') {
                            setIsCreateModalOpen(true);
                        } else {
                            onProjectSelect(e.target.value);
                        }
                    }}
                    style={{
                        backgroundColor: 'transparent',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '4px 24px 4px 8px',
                        color: 'inherit',
                        fontSize: 'inherit',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'><path fill='%23666' d='M0 2l4 4 4-4z'/></svg>")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 8px center'
                    }}
                    className="dark:bg-[#343541] dark:text-white dark:border-gray-600"
                >
                    <option value="">Select a project...</option>
                    {projects.map(project => (
                        <option key={project.id} value={project.id}>
                            {project.name}
                        </option>
                    ))}
                    <option value="create-new">Create New Project...</option>
                </select>

                {isCreateModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-[#343541] p-6 rounded-lg shadow-xl">
                            <h3 className="mb-4">Create New Project</h3>
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="Project name"
                                className="border p-2 mb-4 w-full dark:bg-[#40414F] dark:border-gray-600 dark:text-white rounded"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 border rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateProject}
                                    className="px-4 py-2 bg-blue-500 text-white rounded"
                                    disabled={!newProjectName.trim()}
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    };

    return (
        <>
            <div className="flex flex-col justify-center items-center stretch mx-2 mt-4 flex flex-row gap-3 last:mb-2 md:mx-4 md:mt-[52px] md:last:mb-6 lg:mx-auto lg:max-w-3xl">
                {featureFlags.memory && getSettings(featureFlags).featureOptions.includeMemory && selectedConversation && selectedConversation.messages?.length > 0 && extractedFacts.length > 0 && (
                    <div>
                        {!isFactsVisible ? (
                            <button
                                onClick={() => setIsFactsVisible(true)}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                {extractedFacts.length} facts detected - Click to view
                            </button>
                        ) : (
                            <div className="extracted-facts">
                                <button
                                    onClick={() => setIsFactsVisible(false)}
                                    className="mb-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                                >
                                    Hide facts
                                </button>
                                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Fact</th>
                                            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Fact Type</th>
                                            {extractedFacts.some((_, index) => factTypes[index] === 'project') && (
                                                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Project</th>
                                            )}
                                            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Save to memory?</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {extractedFacts.map((fact, index) => (
                                            <tr key={index}>
                                                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{fact}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                                                    <select
                                                        value={factTypes[index] || ''}
                                                        onChange={(e) => handleTypeChange(index, e.target.value)}
                                                        style={{
                                                            backgroundColor: 'transparent',
                                                            border: '1px solid #ddd',
                                                            borderRadius: '4px',
                                                            padding: '4px 24px 4px 8px', // extra padding on right for arrow
                                                            color: 'inherit',
                                                            fontSize: 'inherit',
                                                            fontFamily: 'inherit',
                                                            cursor: 'pointer',
                                                            WebkitAppearance: 'none',
                                                            MozAppearance: 'none',
                                                            appearance: 'none',
                                                            backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'><path fill='%23666' d='M0 2l4 4 4-4z'/></svg>")`,
                                                            backgroundRepeat: 'no-repeat',
                                                            backgroundPosition: 'right 8px center'
                                                        }}
                                                        className="dark:bg-[#343541] dark:text-white dark:border-gray-600"

                                                    >
                                                        {selectedAssistant && selectedAssistant !== DEFAULT_ASSISTANT && (
                                                            <option value="assistant">Assistant</option>
                                                        )}
                                                        <option value="user">User</option>
                                                        <option value="project">Project</option>
                                                    </select>
                                                </td>
                                                {extractedFacts.some((_, i) => factTypes[i] === 'project') && (
                                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                                                        {factTypes[index] === 'project' ? (
                                                            <ProjectSelector
                                                                index={index}
                                                                selectedProject={selectedProjects[index]}
                                                                onProjectSelect={(projectId) => {
                                                                    setSelectedProjects(prev => ({
                                                                        ...prev,
                                                                        [index]: projectId
                                                                    }));
                                                                }}
                                                            />
                                                        ) : null}
                                                    </td>
                                                )}
                                                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                                                    <div className="flex justify-center gap-4">
                                                        <button
                                                            onClick={() => handleSaveFact(index)}
                                                            disabled={factTypes[index] === 'project' && !selectedProjects[index]}
                                                            className="hover:opacity-75 transition-opacity"
                                                        >✅</button>
                                                        <button
                                                            onClick={() => handleDeleteFact(index)}
                                                            className="hover:opacity-75 transition-opacity"
                                                        >❌</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
};