import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { useSession } from "next-auth/react";
import { Modal } from '../ReusableComponents/Modal';
import { doGetProjectsOp, doReadMemoryOp } from '../../services/memoryService';

interface Props {
    open: boolean;
    onClose: () => void;
}

interface Memory {
    MemoryItem: string;
    MemoryType: string;
    MemoryTypeID: string;
    CreatedAt: string;
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

export const MemoryDialog: FC<Props> = ({ open, onClose }) => {
    const { t } = useTranslation('memory');
    const [activeTab, setActiveTab] = useState<'User' | 'Projects' | 'Assistants'>('User');
    const [memories, setMemories] = useState<Memory[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    useEffect(() => {
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
                                CreatedAt: project.timestamp
                            })));
                        }
                        break;
                    case 'User':
                        const userResponse = await doReadMemoryOp();
                        if (userResponse.statusCode === 200) {
                            const body = JSON.parse(userResponse.body);
                            const userMemories: UserMemoryResponse[] = body.memories.filter(
                                (memory: UserMemoryResponse) => memory.memory_type === 'user'
                            );

                            setMemories(userMemories.map((memory) => ({
                                MemoryItem: memory.content,
                                MemoryType: memory.memory_type,
                                MemoryTypeID: memory.memory_type_id,
                                CreatedAt: memory.timestamp
                            })));
                        }
                        break;
                    case 'Assistants':
                        const assistantResponse = await doReadMemoryOp();
                        if (assistantResponse.statusCode === 200) {
                            const body = JSON.parse(assistantResponse.body);
                            const assistantMemories: UserMemoryResponse[] = body.memories.filter(
                                (memory: UserMemoryResponse) => memory.memory_type === 'assistant'
                            );

                            setMemories(assistantMemories.map((memory) => ({
                                MemoryItem: memory.content,
                                MemoryType: memory.memory_type,
                                MemoryTypeID: memory.memory_type_id,
                                CreatedAt: memory.timestamp
                            })));
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

        loadMemories();
    }, [activeTab, userEmail]);

    const tableContent = isLoading ? (
        <tr>
            <td colSpan={3} className="text-center py-4">Loading...</td>
        </tr>
    ) : memories.length === 0 ? (
        <tr>
            <td colSpan={3} className="text-center py-4">No memories found</td>
        </tr>
    ) : (
        memories.map((memory, index) => (
            <tr key={index} className="border-b dark:border-neutral-700">
                <td className="px-4 py-2">{memory.MemoryItem}</td>
                <td className="px-4 py-2">{memory.MemoryTypeID}</td>
                <td className="px-4 py-2">{new Date(memory.CreatedAt).toLocaleString()}</td>
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
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 p-4">
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse">
                                <thead>
                                    <tr className="border-b dark:border-neutral-700">
                                        <th className="px-4 py-2 text-left">Memory</th>
                                        <th className="px-4 py-2 text-left">Type ID</th>
                                        <th className="px-4 py-2 text-left">Created At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableContent}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            }
        />
    );
};