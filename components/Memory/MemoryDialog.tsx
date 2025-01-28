import { FC, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'next-i18next';
import { useSession } from "next-auth/react";
import { Modal } from '../ReusableComponents/Modal';
import { doCreateProjectOp, doGetProjectsOp, doReadMemoryOp, doEditMemoryOp, doRemoveMemoryOp, doEditProjectOp, doRemoveProjectOp } from '../../services/memoryService';

interface Props {
    open: boolean;
    onClose: () => void;
}

interface Memory {
    MemoryItem: string;
    MemoryType: string;
    MemoryTypeID: string;
    CreatedAt: string;
    id: string;
}

interface ProjectResponse {
    user: string;
    project: string;
    id: string;
    timestamp: string;
}

interface UserMemoryResponse {
    content: string;
    user: string;
    memory_type: string;
    id: string;
    timestamp: string;
    memory_type_id: string;
}

interface AssistantContentProps {
    selectedAssistant: string | null;
    memories: Memory[];
    assistantMemories: Memory[];
}

const AssistantContent: FC<AssistantContentProps> = ({
    selectedAssistant,
    memories,
    assistantMemories
}) => {
    return (
        <div className="overflow-x-auto">
            {selectedAssistant ? (
                <>
                    <h2 className="text-xl mb-4">
                        {memories.find(a => a.id === selectedAssistant)?.MemoryItem}
                    </h2>
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr className="border-b dark:border-neutral-700">
                                <th className="px-4 py-2 text-left">Memory</th>
                                <th className="px-4 py-2 text-left">Created At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assistantMemories.length === 0 ? (
                                <tr key={`empty-assistant-${selectedAssistant}`}>
                                    <td colSpan={2} className="text-center py-4">
                                        No memories for this assistant
                                    </td>
                                </tr>
                            ) : (
                                assistantMemories.map((memory) => (
                                    <tr key={memory.id} className="border-b dark:border-neutral-700">
                                        <td className="px-4 py-2">{memory.MemoryItem}</td>
                                        <td className="px-4 py-2">
                                            {new Date(memory.CreatedAt).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </>
            ) : (
                <div className="text-center py-4">
                    Select an assistant from the sidebar to view its memories
                </div>
            )}
        </div>
    );
};

export const MemoryDialog: FC<Props> = ({ open, onClose }) => {
    const { t } = useTranslation('memory');
    const [activeTab, setActiveTab] = useState<'User' | 'Projects' | 'Assistants'>('User');
    const [memories, setMemories] = useState<Memory[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingMemory, setEditingMemory] = useState<{ id: string, content: string } | null>(null);
    const [editContent, setEditContent] = useState('');
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [projectMemories, setProjectMemories] = useState<Memory[]>([]);
    const [selectedAssistant, setSelectedAssistant] = useState<string | null>(null);
    const [assistantMemories, setAssistantMemories] = useState<Memory[]>([]);
    const [editingProject, setEditingProject] = useState<{ id: string, name: string } | null>(null);
    const [editingProjectMemory, setEditingProjectMemory] = useState<{ id: string, content: string } | null>(null);
    const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const handleEdit = (memory: Memory) => {
        setEditingMemory({
            id: memory.id,
            content: memory.MemoryItem
        });
    };

    const handleCancelEdit = () => {
        setEditingMemory(null);
    };

    const handleSaveEdit = async (memoryId: string) => {
        if (!editingMemory) return;

        try {
            const response = await doEditMemoryOp(memoryId, editingMemory.content);
            if (response.statusCode === 200) {
                // Refresh memories after successful edit
                loadMemories();
            }
        } catch (error) {
            console.error('Error editing memory:', error);
        }
        setEditingMemory(null);
    };

    const handleDelete = async (memoryId: string) => {
        if (window.confirm('Are you sure you want to delete this memory?')) {
            try {
                const response = await doRemoveMemoryOp(memoryId);
                if (response.statusCode === 200) {
                    // Refresh memories after successful deletion
                    const updatedResponse = await doReadMemoryOp();
                    if (updatedResponse.statusCode === 200) {
                        const body = JSON.parse(updatedResponse.body);
                        const userMemories = body.memories.filter(
                            (memory: UserMemoryResponse) => memory.memory_type === 'user'
                        );
                        setMemories(userMemories.map((memory: UserMemoryResponse) => ({
                            MemoryItem: memory.content,
                            MemoryType: memory.memory_type,
                            MemoryTypeID: memory.memory_type_id,
                            CreatedAt: memory.timestamp
                        })));
                    }
                }
            } catch (error) {
                console.error('Error deleting memory:', error);
            }
        }
    };

    const handleCreateProject = async () => {
        try {
            if (!newProjectName.trim()) {
                return;
            }
            const response = await doCreateProjectOp(newProjectName);
            if (response.statusCode === 200) {
                setNewProjectName('');
                setIsCreateProjectModalOpen(false);
                loadMemories(); // Reload the projects list
            }
        } catch (error) {
            console.error('Failed to create project:', error);
            alert('Failed to create project');
        }
    };

    const handleEditProject = (project: Memory) => {
        setEditingProject({
            id: project.id,
            name: project.MemoryItem
        });
    };

    const handleCancelEditProject = () => {
        setEditingProject(null);
    };

    const handleSaveEditProject = async (projectId: string) => {
        if (!editingProject) return;

        try {
            const response = await doEditProjectOp(projectId, editingProject.name);
            if (response.statusCode === 200) {
                loadMemories();
            }
        } catch (error) {
            console.error('Error editing project:', error);
        }
        setEditingProject(null);
    };

    const handleDeleteProject = async (projectId: string) => {
        if (window.confirm('Are you sure you want to delete this project?')) {
            try {
                const response = await doRemoveProjectOp(projectId);
                if (response.statusCode === 200) {
                    setSelectedProject(null);
                    loadMemories();
                }
            } catch (error) {
                console.error('Error deleting project:', error);
            }
        }
    };

    const handleEditProjectMemory = (memory: Memory) => {
        setEditingProjectMemory({
            id: memory.id,
            content: memory.MemoryItem
        });
    };

    const handleCancelEditProjectMemory = () => {
        setEditingProjectMemory(null);
    };

    const handleSaveEditProjectMemory = async (memoryId: string) => {
        if (!editingProjectMemory) return;

        try {
            const response = await doEditMemoryOp(memoryId, editingProjectMemory.content);
            if (response.statusCode === 200) {
                // Refresh memories after successful edit
                loadMemories();
            }
        } catch (error) {
            console.error('Error editing project memory:', error);
        }
        setEditingProjectMemory(null);
    };

    const handleDeleteProjectMemory = async (memoryId: string) => {
        if (window.confirm('Are you sure you want to delete this memory?')) {
            try {
                const response = await doRemoveMemoryOp(memoryId);
                if (response.statusCode === 200) {
                    // Refresh memories after successful deletion
                    loadMemories();
                }
            } catch (error) {
                console.error('Error deleting project memory:', error);
            }
        }
    };

    const projectContent = activeTab === 'Projects' && (
        <div className="flex h-full">
            <div className="w-48 border-r dark:border-neutral-700">
                {memories.map((project) => (
                    <button
                        key={project.id}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-neutral-700 
                        ${selectedProject === project.id ? 'bg-gray-200 dark:bg-neutral-600' : ''}`}
                        onClick={() => setSelectedProject(project.id)}
                    >
                        {project.MemoryItem}
                    </button>
                ))}
            </div>

            <div className="flex-1 p-4">
                {selectedProject ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="border-b dark:border-neutral-700">
                                    <th className="px-4 py-2 text-left">Memory</th>
                                    <th className="px-4 py-2 text-left">Created At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectMemories.length === 0 ? (
                                    <tr key="empty-project">
                                        <td colSpan={3} className="text-center py-4">
                                            No memories for this project
                                        </td>
                                    </tr>
                                ) : (
                                    projectMemories.map((memory) => (
                                        <tr key={memory.id} className="border-b dark:border-neutral-700">
                                            <td className="px-4 py-2">{memory.MemoryItem}</td>
                                            <td className="px-4 py-2">{new Date(memory.CreatedAt).toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-4">Select a project to view its memories</div>
                )}
            </div>
        </div>
    );

    const loadMemories = async () => {
        if (!userEmail) return;

        setIsLoading(true);
        try {
            switch (activeTab) {
                case 'Projects':
                    const projectResponse = await doGetProjectsOp(userEmail);
                    if (projectResponse.statusCode === 200) {
                        const body = JSON.parse(projectResponse.body);
                        const projects: ProjectResponse[] = body.projects;

                        setMemories(projects.map((project) => ({
                            MemoryItem: project.project,
                            MemoryType: 'Project',
                            MemoryTypeID: project.id,
                            CreatedAt: project.timestamp,
                            id: project.id
                        })));

                        // If a project is selected, load its memories
                        if (selectedProject) {
                            const memoryResponse = await doReadMemoryOp(selectedProject);
                            if (memoryResponse.statusCode === 200) {
                                const memoryBody = JSON.parse(memoryResponse.body);
                                const projectMemories = memoryBody.memories.filter(
                                    (memory: UserMemoryResponse) =>
                                        memory.memory_type === 'project' &&
                                        memory.memory_type_id === selectedProject
                                );
                                setProjectMemories(projectMemories.map((memory: UserMemoryResponse) => ({
                                    MemoryItem: memory.content,
                                    MemoryType: memory.memory_type,
                                    MemoryTypeID: memory.memory_type_id,
                                    CreatedAt: memory.timestamp,
                                    id: memory.id
                                })));
                            }
                        }
                    }
                    break;
                case 'User':
                    const userResponse = await doReadMemoryOp();
                    if (userResponse.statusCode === 200) {
                        const body = JSON.parse(userResponse.body);
                        const userMemories = body.memories.filter(
                            (memory: UserMemoryResponse) => memory.memory_type === 'user'
                        );
                        setMemories(userMemories.map((memory: UserMemoryResponse) => ({
                            MemoryItem: memory.content,
                            MemoryType: memory.memory_type,
                            MemoryTypeID: memory.memory_type_id,
                            CreatedAt: memory.timestamp,
                            id: memory.id
                        })));
                    }
                    break;
                case 'Assistants':
                    const assistantResponse = await doReadMemoryOp();
                    if (assistantResponse.statusCode === 200) {
                        const body = JSON.parse(assistantResponse.body);
                        const allAssistantMemories: UserMemoryResponse[] = body.memories.filter(
                            (memory: UserMemoryResponse) => memory.memory_type === 'assistant'
                        );

                        // Get unique assistant IDs
                        const uniqueAssistants: string[] = Array.from(new Set(
                            allAssistantMemories.map((memory: UserMemoryResponse) => memory.memory_type_id)
                        ));

                        // Set the list of assistants
                        setMemories(uniqueAssistants.map((assistantId: string) => {
                            const assistantMemory = allAssistantMemories.find(
                                (memory: UserMemoryResponse) => memory.memory_type_id === assistantId
                            );
                            return {
                                MemoryItem: `Assistant ${assistantId}`,
                                MemoryType: 'assistant',
                                MemoryTypeID: assistantId,
                                CreatedAt: assistantMemory?.timestamp || '',
                                id: assistantId
                            } as Memory;
                        }));

                        // If an assistant is selected, set its memories
                        if (selectedAssistant) {
                            const filteredAssistantMemories = allAssistantMemories.filter(
                                (memory: UserMemoryResponse) => memory.memory_type_id === selectedAssistant
                            );
                            setAssistantMemories(filteredAssistantMemories.map((memory: UserMemoryResponse) => ({
                                MemoryItem: memory.content,
                                MemoryType: memory.memory_type,
                                MemoryTypeID: memory.memory_type_id,
                                CreatedAt: memory.timestamp,
                                id: memory.id
                            })));
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Error loading memories:', error);
            setMemories([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadMemories();
    }, [activeTab, userEmail, selectedProject, selectedAssistant]);

    const tableContent = isLoading ? (
        <tr key={`loading-${activeTab}`}>
            <td colSpan={2} className="text-center py-4">Loading...</td>
        </tr>
    ) : memories.length === 0 ? (
        <tr key={`empty-${activeTab}`}>
            <td colSpan={2} className="text-center py-4">No memories found</td>
        </tr>
    ) : (
        memories.map((memory) => (
            <tr key={memory.id} className="border-b dark:border-neutral-700">
                <td className="px-4 py-2">
                    {editingMemory && editingMemory?.id === memory.id ? (
                        <input
                            type="text"
                            value={editingMemory.content}
                            onChange={(e) => setEditingMemory({
                                ...editingMemory,
                                content: e.target.value
                            })}
                            className="w-full p-1 border rounded dark:bg-neutral-700"
                        />
                    ) : (
                        memory.MemoryItem
                    )}
                </td>
                <td className="px-4 py-2">{new Date(memory.CreatedAt).toLocaleString()}</td>
                {activeTab === 'User' && (
                    <td className="px-4 py-2">
                        {editingMemory && editingMemory?.id === memory.id ? (
                            <div className="space-x-2">
                                <button
                                    onClick={() => handleSaveEdit(memory.id)}
                                    className="text-green-600 hover:text-green-700"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => handleCancelEdit()}
                                    className="text-gray-600 hover:text-gray-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="space-x-2">
                                <button
                                    onClick={() => handleEdit(memory)}
                                    className="text-blue-600 hover:text-blue-700"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(memory.id)}
                                    className="text-red-600 hover:text-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </td>
                )}
            </tr>
        ))
    );

    if (!open) return null;

    const tabs = [
        { id: 'User' as const, label: 'User' },
        { id: 'Projects' as const, label: 'Projects' },
        { id: 'Assistants' as const, label: 'Assistants' }
    ];

    return (
        <Modal
            width={() => window.innerWidth * 0.62}
            height={() => window.innerHeight * 0.88}
            title="Memory Management"
            onCancel={onClose}
            onSubmit={onClose}
            submitLabel="Close"
            content={
                <div className="flex h-full">
                    <div className="w-48 border-r dark:border-neutral-700">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-neutral-700 
                                ${activeTab === tab.id ? 'bg-gray-200 dark:bg-neutral-600' : ''}`}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setSelectedProject(null);
                                    setSelectedAssistant(null);
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}

                        {/* Show project sub-tabs when Projects tab is active */}
                        {activeTab === 'Projects' && (
                            <div className="mt-4 border-t dark:border-neutral-700">
                                <div className="py-2 px-4 flex justify-between items-center">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        Projects
                                    </span>
                                    <button
                                        onClick={() => setIsCreateProjectModalOpen(true)}
                                        className="text-sm text-blue-600 hover:text-blue-700"
                                    >
                                        + New
                                    </button>
                                </div>

                                {/* Create Project Modal */}
                                {isCreateProjectModalOpen && (
                                    <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800">
                                        <input
                                            type="text"
                                            value={newProjectName}
                                            onChange={(e) => setNewProjectName(e.target.value)}
                                            placeholder="Project name"
                                            className="w-full p-1 mb-2 border rounded dark:bg-neutral-700"
                                        />
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={handleCreateProject}
                                                className="text-green-600 hover:text-green-700 text-sm"
                                            >
                                                Create
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsCreateProjectModalOpen(false);
                                                    setNewProjectName('');
                                                }}
                                                className="text-gray-600 hover:text-gray-700 text-sm"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Existing projects list */}
                                {memories.map((project) => (
                                    <div key={project.id} className="flex flex-col">
                                        {editingProject && editingProject.id === project.id ? (
                                            <div className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={editingProject.name}
                                                    onChange={(e) => setEditingProject({
                                                        ...editingProject,
                                                        name: e.target.value
                                                    })}
                                                    className="w-full p-1 border rounded dark:bg-neutral-700 mb-2"
                                                />
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => handleSaveEditProject(project.id)}
                                                        className="text-green-600 hover:text-green-700 text-sm"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEditProject}
                                                        className="text-gray-600 hover:text-gray-700 text-sm"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-100 dark:hover:bg-neutral-700">
                                                <button
                                                    className={`text-left flex-grow ${selectedProject === project.id ? 'bg-gray-200 dark:bg-neutral-600' : ''}`}
                                                    onClick={() => setSelectedProject(project.id)}
                                                >
                                                    {project.MemoryItem}
                                                </button>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditProject(project);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-700 text-sm"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteProject(project.id);
                                                        }}
                                                        className="text-red-600 hover:text-red-700 text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Show assistant sub-tabs when Assistants tab is active */}
                        {activeTab === 'Assistants' && (
                            <div className="mt-4 border-t dark:border-neutral-700">
                                <div className="py-2 px-4 text-sm text-gray-500 dark:text-gray-400">
                                    Assistants
                                </div>
                                {memories.map((assistant) => (
                                    <button
                                        key={assistant.id}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-neutral-700 
                    ${selectedAssistant === assistant.id ? 'bg-gray-200 dark:bg-neutral-600' : ''}`}
                                        onClick={() => setSelectedAssistant(assistant.id)}
                                    >
                                        {assistant.MemoryItem}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 p-4">
                        {activeTab === 'Projects' ? (
                            // Projects tab content
                            <div className="overflow-x-auto">
                                {selectedProject ? (
                                    <>
                                        <h2 className="text-xl mb-4">
                                            {memories.find(p => p.id === selectedProject)?.MemoryItem}
                                        </h2>
                                        <table className="min-w-full border-collapse">
                                            <thead>
                                                <tr className="border-b dark:border-neutral-700">
                                                    <th className="px-4 py-2 text-left">Memory</th>
                                                    <th className="px-4 py-2 text-left">Created At</th>
                                                    <th className="px-4 py-2 text-left">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {projectMemories.length === 0 ? (
                                                    <tr key={`empty-project-${selectedProject}`}>
                                                        <td colSpan={3} className="text-center py-4">
                                                            No memories for this project
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    projectMemories.map((memory) => (
                                                        <tr key={memory.id} className="border-b dark:border-neutral-700">
                                                            <td className="px-4 py-2">
                                                                {editingProjectMemory && editingProjectMemory.id === memory.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editingProjectMemory.content}
                                                                        onChange={(e) => setEditingProjectMemory({
                                                                            ...editingProjectMemory,
                                                                            content: e.target.value
                                                                        })}
                                                                        className="w-full p-1 border rounded dark:bg-neutral-700"
                                                                    />
                                                                ) : (
                                                                    memory.MemoryItem
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                {new Date(memory.CreatedAt).toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                {editingProjectMemory && editingProjectMemory.id === memory.id ? (
                                                                    <div className="space-x-2">
                                                                        <button
                                                                            onClick={() => handleSaveEditProjectMemory(memory.id)}
                                                                            className="text-green-600 hover:text-green-700"
                                                                        >
                                                                            Save
                                                                        </button>
                                                                        <button
                                                                            onClick={handleCancelEditProjectMemory}
                                                                            className="text-gray-600 hover:text-gray-700"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-x-2">
                                                                        <button
                                                                            onClick={() => handleEditProjectMemory(memory)}
                                                                            className="text-blue-600 hover:text-blue-700"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteProjectMemory(memory.id)}
                                                                            className="text-red-600 hover:text-red-700"
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        Select a project from the sidebar to view its memories
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'Assistants' ? (
                            // Assistants tab content
                            <AssistantContent
                                selectedAssistant={selectedAssistant}
                                memories={memories}
                                assistantMemories={assistantMemories}
                            />
                        ) : (
                            // User tab content
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr className="border-b dark:border-neutral-700">
                                            <th className="px-4 py-2 text-left">Memory</th>
                                            <th className="px-4 py-2 text-left">Created At</th>
                                            {activeTab === 'User' && (
                                                <th className="px-4 py-2 text-left">Actions</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableContent}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            }
        />
    );
};