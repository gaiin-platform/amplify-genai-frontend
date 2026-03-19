import React, { useState, useEffect, FC, useCallback } from 'react';
import {
    IconBrain,
    IconPlus,
    IconSearch,
    IconRefresh,
    IconEdit,
    IconTrash,
    IconShare,
    IconToggleLeft,
    IconToggleRight,
    IconGlobe,
    IconLock,
    IconDotsVertical,
    IconCopy
} from '@tabler/icons-react';
import { Skill, CreateSkillData, UpdateSkillData, SKILL_CATEGORIES } from '@/types/skill';
import {
    getUserSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    getPublicSkills
} from '@/services/skillsService';
import { SkillEditor } from './SkillEditor';

interface SkillsLibraryProps {
    chatEndpoint: string;
    onClose?: () => void;
}

type ViewMode = 'my-skills' | 'public';

export const SkillsLibrary: FC<SkillsLibraryProps> = ({ chatEndpoint, onClose }) => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [publicSkills, setPublicSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('my-skills');

    // Editor state
    const [showEditor, setShowEditor] = useState(false);
    const [editingSkill, setEditingSkill] = useState<Skill | undefined>();
    const [saving, setSaving] = useState(false);

    // Dropdown menu state
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const loadSkills = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const [userResponse, publicResponse] = await Promise.all([
                getUserSkills(chatEndpoint, true),
                getPublicSkills(chatEndpoint, 50)
            ]);

            if (userResponse.success && userResponse.data) {
                setSkills(userResponse.data);
            }

            if (publicResponse.success && publicResponse.data) {
                setPublicSkills(publicResponse.data);
            }
        } catch (err) {
            console.error('Failed to load skills:', err);
            setError('Failed to load skills');
        } finally {
            setLoading(false);
        }
    }, [chatEndpoint]);

    useEffect(() => {
        loadSkills();
    }, [loadSkills]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const displayedSkills = viewMode === 'my-skills' ? skills : publicSkills;

    const allCategories = [...new Set(displayedSkills.map(s => s.category).filter(Boolean))];

    const filteredSkills = displayedSkills.filter(skill => {
        const matchesSearch = !searchQuery ||
            skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            skill.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            skill.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = !filterCategory || skill.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const getCategoryName = (categoryId: string) => {
        return SKILL_CATEGORIES.find(c => c.id === categoryId)?.name || categoryId;
    };

    const handleCreateNew = () => {
        setEditingSkill(undefined);
        setShowEditor(true);
    };

    const handleEdit = (skill: Skill) => {
        setEditingSkill(skill);
        setShowEditor(true);
        setOpenMenuId(null);
    };

    const handleSaveSkill = async (skillData: CreateSkillData | UpdateSkillData) => {
        setSaving(true);
        try {
            if (editingSkill) {
                const response = await updateSkill(chatEndpoint, editingSkill.id, skillData);
                if (response.success) {
                    await loadSkills();
                    setShowEditor(false);
                    setEditingSkill(undefined);
                } else {
                    alert(response.message || 'Failed to update skill');
                }
            } else {
                const response = await createSkill(chatEndpoint, skillData as CreateSkillData);
                if (response.success) {
                    await loadSkills();
                    setShowEditor(false);
                } else {
                    alert(response.message || 'Failed to create skill');
                }
            }
        } catch (err) {
            console.error('Failed to save skill:', err);
            alert('Failed to save skill');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (skill: Skill) => {
        if (!confirm(`Are you sure you want to delete "${skill.name}"? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await deleteSkill(chatEndpoint, skill.id);
            if (response.success) {
                await loadSkills();
            } else {
                alert(response.message || 'Failed to delete skill');
            }
        } catch (err) {
            console.error('Failed to delete skill:', err);
            alert('Failed to delete skill');
        }
        setOpenMenuId(null);
    };

    const handleToggleEnabled = async (skill: Skill) => {
        try {
            const response = await updateSkill(chatEndpoint, skill.id, { isEnabled: !skill.isEnabled });
            if (response.success) {
                await loadSkills();
            }
        } catch (err) {
            console.error('Failed to toggle skill:', err);
        }
        setOpenMenuId(null);
    };

    const handleDuplicatePublicSkill = async (skill: Skill) => {
        setSaving(true);
        try {
            const newSkillData: CreateSkillData = {
                name: `${skill.name} (Copy)`,
                description: skill.description,
                content: skill.content,
                tags: skill.tags,
                triggerPhrases: skill.triggerPhrases,
                priority: skill.priority,
                category: skill.category,
                isPublic: false
            };

            const response = await createSkill(chatEndpoint, newSkillData);
            if (response.success) {
                await loadSkills();
                setViewMode('my-skills');
                alert('Skill copied to your library!');
            } else {
                alert(response.message || 'Failed to copy skill');
            }
        } catch (err) {
            console.error('Failed to copy skill:', err);
            alert('Failed to copy skill');
        } finally {
            setSaving(false);
        }
        setOpenMenuId(null);
    };

    if (showEditor) {
        return (
            <div className="h-full max-h-full overflow-hidden">
                <SkillEditor
                    skill={editingSkill}
                    onSave={handleSaveSkill}
                    onCancel={() => {
                        setShowEditor(false);
                        setEditingSkill(undefined);
                    }}
                    isLoading={saving}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#343541]">
            {/* Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-600">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <IconBrain size={28} className="text-purple-500" />
                        <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">
                            Skills Library
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadSkills}
                            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-400"
                            title="Refresh"
                            disabled={loading}
                        >
                            <IconRefresh size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={handleCreateNew}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                        >
                            <IconPlus size={18} />
                            New Skill
                        </button>
                    </div>
                </div>

                {/* View mode tabs */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setViewMode('my-skills')}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                            viewMode === 'my-skills'
                                ? 'bg-purple-500 text-white'
                                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                        }`}
                    >
                        My Skills ({skills.length})
                    </button>
                    <button
                        onClick={() => setViewMode('public')}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                            viewMode === 'public'
                                ? 'bg-purple-500 text-white'
                                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                        }`}
                    >
                        <IconGlobe size={16} className="inline mr-1" />
                        Discover ({publicSkills.length})
                    </button>
                </div>

                {/* Search and filters */}
                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search skills..."
                            className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>
                    <select
                        value={filterCategory || ''}
                        onChange={(e) => setFilterCategory(e.target.value || null)}
                        className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="">All Categories</option>
                        {SKILL_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Skills grid */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <IconRefresh size={32} className="animate-spin mx-auto mb-2 text-purple-500" />
                            <p className="text-neutral-500 dark:text-neutral-400">Loading skills...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <p className="text-red-500 mb-2">{error}</p>
                            <button
                                onClick={loadSkills}
                                className="text-purple-500 hover:text-purple-600"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                ) : filteredSkills.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <IconBrain size={48} className="mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
                            <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                                {skills.length === 0 && viewMode === 'my-skills'
                                    ? "You haven't created any skills yet."
                                    : "No matching skills found."}
                            </p>
                            {skills.length === 0 && viewMode === 'my-skills' && (
                                <button
                                    onClick={handleCreateNew}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 mx-auto"
                                >
                                    <IconPlus size={18} />
                                    Create your first skill
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSkills.map(skill => (
                            <div
                                key={skill.id}
                                className={`bg-neutral-50 dark:bg-[#40414f] rounded-lg border border-neutral-200 dark:border-neutral-600 p-4 hover:shadow-md transition-shadow ${
                                    !skill.isEnabled && viewMode === 'my-skills' ? 'opacity-60' : ''
                                }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                                            {skill.name}
                                        </h3>
                                        {skill.isPublic && (
                                            <IconGlobe size={14} className="text-green-500" title="Public" />
                                        )}
                                        {skill.isShared && (
                                            <IconShare size={14} className="text-blue-500" title="Shared with you" />
                                        )}
                                    </div>
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === skill.id ? null : skill.id);
                                            }}
                                            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded"
                                        >
                                            <IconDotsVertical size={16} className="text-neutral-500" />
                                        </button>

                                        {/* Dropdown menu */}
                                        {openMenuId === skill.id && (
                                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#343541] rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-600 z-10">
                                                {viewMode === 'my-skills' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleEdit(skill)}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                                                        >
                                                            <IconEdit size={16} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleEnabled(skill)}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                                                        >
                                                            {skill.isEnabled ? (
                                                                <>
                                                                    <IconToggleLeft size={16} />
                                                                    Disable
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <IconToggleRight size={16} />
                                                                    Enable
                                                                </>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(skill)}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                                                        >
                                                            <IconTrash size={16} />
                                                            Delete
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleDuplicatePublicSkill(skill)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                                                    >
                                                        <IconCopy size={16} />
                                                        Copy to My Skills
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 line-clamp-2">
                                    {skill.description || 'No description'}
                                </p>

                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                                            P{skill.priority}
                                        </span>
                                        {skill.category && (
                                            <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-400 rounded">
                                                {getCategoryName(skill.category)}
                                            </span>
                                        )}
                                    </div>
                                    {skill.metadata?.usageCount > 0 && (
                                        <span className="text-neutral-400">
                                            Used {skill.metadata.usageCount}x
                                        </span>
                                    )}
                                </div>

                                {skill.tags && skill.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {skill.tags.slice(0, 4).map(tag => (
                                            <span
                                                key={tag}
                                                className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-400 rounded text-xs"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                        {skill.tags.length > 4 && (
                                            <span className="text-xs text-neutral-400">
                                                +{skill.tags.length - 4}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SkillsLibrary;
