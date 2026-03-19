import React, { useState, useEffect, FC, useCallback } from 'react';
import {
    IconBrain,
    IconPlus,
    IconCheck,
    IconSearch,
    IconRefresh,
    IconChevronDown,
    IconChevronUp
} from '@tabler/icons-react';
import { Skill, SKILL_CATEGORIES } from '@/types/skill';
import { getUserSkills } from '@/services/skillsService';

interface SkillSelectorProps {
    selectedSkillIds: string[];
    onSelectionChange: (skillIds: string[]) => void;
    onCreateNew?: () => void;
    mode?: 'toggle' | 'select'; // toggle for conversation, select for assistant
    compact?: boolean;
    maxSelections?: number;
}

export const SkillSelector: FC<SkillSelectorProps> = ({
    selectedSkillIds,
    onSelectionChange,
    onCreateNew,
    mode = 'toggle',
    compact = false,
    maxSelections = 5
}) => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(!compact);

    const loadSkills = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await getUserSkills(true);
            if (response.success && response.data) {
                setSkills(response.data);
            } else {
                setError(response.message || 'Failed to load skills');
            }
        } catch (err) {
            console.error('Failed to load skills:', err);
            setError('Failed to load skills');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSkills();
    }, [loadSkills]);

    const allCategories = [...new Set(skills.map(s => s.category).filter(Boolean))];

    const filteredSkills = skills.filter(skill => {
        const matchesSearch = !searchQuery ||
            skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            skill.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            skill.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = !filterCategory || skill.category === filterCategory;
        return matchesSearch && matchesCategory && skill.isEnabled;
    });

    const toggleSkill = (skillId: string) => {
        if (selectedSkillIds.includes(skillId)) {
            onSelectionChange(selectedSkillIds.filter(id => id !== skillId));
        } else {
            if (selectedSkillIds.length >= maxSelections) {
                // Remove the oldest selection when max is reached
                onSelectionChange([...selectedSkillIds.slice(1), skillId]);
            } else {
                onSelectionChange([...selectedSkillIds, skillId]);
            }
        }
    };

    const getCategoryName = (categoryId: string) => {
        return SKILL_CATEGORIES.find(c => c.id === categoryId)?.name || categoryId;
    };

    if (compact && !expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg text-sm text-neutral-700 dark:text-neutral-300"
            >
                <IconBrain size={18} className="text-purple-500" />
                <span>Skills</span>
                {selectedSkillIds.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-purple-500 text-white rounded-full text-xs">
                        {selectedSkillIds.length}
                    </span>
                )}
                <IconChevronDown size={16} />
            </button>
        );
    }

    return (
        <div className="bg-white dark:bg-[#343541] rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-600 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-600">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <IconBrain size={20} className="text-purple-500" />
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">Skills</span>
                        {selectedSkillIds.length > 0 && (
                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-xs">
                                {selectedSkillIds.length} selected
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={loadSkills}
                            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 dark:text-neutral-400"
                            title="Refresh skills"
                            disabled={loading}
                        >
                            <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        {onCreateNew && (
                            <button
                                onClick={onCreateNew}
                                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 dark:text-neutral-400"
                                title="Create new skill"
                            >
                                <IconPlus size={16} />
                            </button>
                        )}
                        {compact && (
                            <button
                                onClick={() => setExpanded(false)}
                                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-500 dark:text-neutral-400"
                                title="Collapse"
                            >
                                <IconChevronUp size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-2">
                    <IconSearch size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search skills..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                {/* Category filters */}
                {allCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        <button
                            onClick={() => setFilterCategory(null)}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                !filterCategory
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                            }`}
                        >
                            All
                        </button>
                        {allCategories.slice(0, 5).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat === filterCategory ? null : cat)}
                                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                    filterCategory === cat
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                                }`}
                            >
                                {getCategoryName(cat)}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Skills list */}
            <div className="max-h-64 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-neutral-500 dark:text-neutral-400 text-sm">
                        Loading skills...
                    </div>
                ) : error ? (
                    <div className="p-4 text-center text-red-500 text-sm">
                        {error}
                        <button
                            onClick={loadSkills}
                            className="ml-2 text-blue-500 hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                ) : filteredSkills.length === 0 ? (
                    <div className="p-4 text-center text-neutral-500 dark:text-neutral-400 text-sm">
                        {skills.length === 0 ? (
                            <div>
                                <p>No skills yet.</p>
                                {onCreateNew && (
                                    <button
                                        onClick={onCreateNew}
                                        className="mt-2 text-purple-500 hover:text-purple-600 flex items-center justify-center gap-1 mx-auto"
                                    >
                                        <IconPlus size={16} />
                                        Create your first skill
                                    </button>
                                )}
                            </div>
                        ) : (
                            "No matching skills found."
                        )}
                    </div>
                ) : (
                    filteredSkills.map(skill => {
                        const isSelected = selectedSkillIds.includes(skill.id);
                        return (
                            <div
                                key={skill.id}
                                onClick={() => toggleSkill(skill.id)}
                                className={`flex items-start gap-3 p-3 cursor-pointer border-b border-neutral-100 dark:border-neutral-700 last:border-0 hover:bg-neutral-50 dark:hover:bg-[#40414f] transition-colors ${
                                    isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                                }`}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                                    isSelected
                                        ? 'bg-purple-500 border-purple-500 text-white'
                                        : 'border-neutral-300 dark:border-neutral-600'
                                }`}>
                                    {isSelected && <IconCheck size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                                            {skill.name}
                                        </span>
                                        {skill.isShared && (
                                            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                                                shared
                                            </span>
                                        )}
                                        <span className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 rounded text-xs">
                                            P{skill.priority}
                                        </span>
                                    </div>
                                    {skill.description && (
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                            {skill.description}
                                        </p>
                                    )}
                                    {skill.tags && skill.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {skill.tags.slice(0, 3).map(tag => (
                                                <span
                                                    key={tag}
                                                    className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded text-xs"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                            {skill.tags.length > 3 && (
                                                <span className="text-xs text-neutral-400">
                                                    +{skill.tags.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer with selection info */}
            {selectedSkillIds.length > 0 && (
                <div className="p-2 border-t border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-[#2a2b32]">
                    <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                        <span>{selectedSkillIds.length} of {maxSelections} max selected</span>
                        <button
                            onClick={() => onSelectionChange([])}
                            className="text-red-500 hover:text-red-600"
                        >
                            Clear all
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SkillSelector;
