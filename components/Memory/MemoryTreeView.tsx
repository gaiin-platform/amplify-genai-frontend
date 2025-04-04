import React, { useState, useEffect } from 'react';
import { IconPencil, IconTrash, IconEye } from '@tabler/icons-react';
import {
    Memory,
    MemoryTreeNode,
    MemoryTreeViewProps
} from '@/types/memory';

const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
    <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {expanded ? (
            <polyline points="6 9 12 15 18 9" />
        ) : (
            <polyline points="9 18 15 12 9 6" />
        )}
    </svg>
);

const MemoryTreeView: React.FC<MemoryTreeViewProps> = ({
    memories,
    onEditMemory,
    onDeleteMemory,
    onViewConversation,
    processingMemoryId
}) => {
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [treeData, setTreeData] = useState<MemoryTreeNode | null>(null);

    const buildMemoryTree = () => {
        const tree: { [key: string]: MemoryTreeNode } = {
            root: { name: 'Memory', type: 'category', children: [] }
        };

        memories.forEach(memory => {
            if (!memory.taxonomy_path) return;

            const [category, subcategory] = memory.taxonomy_path.split('/');

            if (!tree[category]) {
                tree[category] = {
                    name: category,
                    type: 'category',
                    children: []
                };
                tree.root.children?.push(tree[category]);
            }

            const subcategoryKey = `${category}/${subcategory}`;
            if (!tree[subcategoryKey]) {
                tree[subcategoryKey] = {
                    name: subcategory,
                    type: 'subcategory',
                    children: []
                };
                tree[category].children?.push(tree[subcategoryKey]);
            }

            tree[subcategoryKey].children?.push({
                name: memory.content,
                type: 'memory',
                content: memory.content,
                id: memory.id,
                timestamp: memory.timestamp,
                conversation_id: memory.conversation_id
            });
        });

        return tree.root;
    };

    const collectAllPaths = (node: MemoryTreeNode, currentPath: string = 'memory'): string[] => {
        const paths = [currentPath];

        if (node.children) {
            node.children.forEach((child, index) => {
                const childPath = `${currentPath}/${child.name}-${index}`;
                paths.push(...collectAllPaths(child, childPath));
            });
        }

        return paths;
    };

    useEffect(() => {
        const newTreeData = buildMemoryTree();
        setTreeData(newTreeData);
        const allPaths = collectAllPaths(newTreeData);
        setExpandedNodes(new Set(allPaths));
    }, [memories]);

    const toggleNode = (path: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    const handleExpandAll = () => {
        if (treeData) {
            const allPaths = collectAllPaths(treeData);
            setExpandedNodes(new Set(allPaths));
        }
    };

    const handleCollapseAll = () => {
        setExpandedNodes(new Set(['memory']));
    };

    const renderTreeNode = (node: MemoryTreeNode, path: string = 'memory') => {
        const isExpanded = expandedNodes.has(path);
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={path} className="ml-4">
                <div className="flex items-center py-1">
                    {hasChildren ? (
                        <button
                            onClick={() => toggleNode(path)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
                        >
                            <ChevronIcon expanded={isExpanded} />
                        </button>
                    ) : (
                        <div className="w-6" />
                    )}

                    <span className={`ml-1 ${node.type === 'memory' ? 'text-sm' : 'font-semibold'}`}>
                        {node.name}
                    </span>

                    {node.type === 'memory' && (
                        <div className="ml-auto flex items-center space-x-2">
                            {onEditMemory && onDeleteMemory && onViewConversation && (
                                <div className="flex space-x-1">
                                    {node.conversation_id && (
                                        <button
                                            onClick={() => onViewConversation(node.conversation_id!)}
                                            className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                                            disabled={!!processingMemoryId}
                                            title="View conversation"
                                        >
                                            <IconEye size={16} stroke={1.5} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onEditMemory({
                                            id: node.id!,
                                            content: node.content!,
                                            timestamp: node.timestamp!,
                                            user: '',
                                            memory_type: 'user',
                                            memory_type_id: '',
                                            taxonomy_path: path.split('/')
                                                .slice(1, 3)
                                                .map(p => p.split('-')[0])
                                                .join('/'),
                                            conversation_id: node.conversation_id
                                        })}
                                        className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                                        disabled={!!processingMemoryId}
                                        title="Edit memory"
                                    >
                                        <IconPencil size={16} stroke={1.5} />
                                    </button>
                                    <button
                                        onClick={() => onDeleteMemory(node.id!)}
                                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                                        disabled={!!processingMemoryId}
                                        title="Delete memory"
                                    >
                                        <IconTrash size={16} stroke={1.5} />
                                    </button>
                                </div>
                            )}
                            {node.timestamp && (
                                <span className="text-xs text-gray-500">
                                    {new Date(node.timestamp).toLocaleString()}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {isExpanded && hasChildren && (
                    <div className="border-l dark:border-neutral-700">
                        {node.children!.map((child, index) =>
                            renderTreeNode(child, `${path}/${child.name}-${index}`)
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4">
            <div className="mb-4 flex space-x-2">
                <button
                    onClick={handleExpandAll}
                    className="px-3 py-1 text-sm bg-gray-50 hover:bg-blue-100 text-gray-600 rounded border border-gray-200"
                >
                    Expand All
                </button>
                <button
                    onClick={handleCollapseAll}
                    className="px-3 py-1 text-sm bg-gray-50 hover:bg-blue-100 text-gray-600 rounded border border-gray-200"
                >
                    Collapse All
                </button>
            </div>
            {treeData && renderTreeNode(treeData)}
        </div>
    );
};

export default MemoryTreeView;