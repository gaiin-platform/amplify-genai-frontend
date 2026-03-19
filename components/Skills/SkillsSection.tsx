import React, { useState, useEffect, FC } from 'react';
import {
    IconBrain,
    IconPlus,
    IconX,
    IconCheck,
    IconSearch,
    IconChevronDown,
    IconChevronUp
} from '@tabler/icons-react';
import { Skill, SkillReference, SkillSelectionMode, SKILL_CATEGORIES } from '@/types/skill';
import { getUserSkills } from '@/services/skillsService';
import { SkillEditor } from './SkillEditor';
import { createSkill } from '@/services/skillsService';
import { CreateSkillData } from '@/types/skill';

interface SkillsSectionProps {
    selectedSkills: SkillReference[];
    onSkillsChange: (skills: SkillReference[]) => void;
    skillSelectionMode: SkillSelectionMode;
    onModeChange: (mode: SkillSelectionMode) => void;
}

export const SkillsSection: FC<SkillsSectionProps> = ({
    selectedSkills,
    onSkillsChange,
    skillSelectionMode,
    onModeChange
}) => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showEditor, setShowEditor] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSkills();
    }, []);

    const loadSkills = async () => {
        setLoading(true);
        try {
            const response = await getUserSkills(true);
            if (response.success && response.data) {
                setSkills(response.data);
            }
        } catch (err) {
            console.error('Failed to load skills:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredSkills = skills.filter(skill => {
        const matchesSearch = !searchQuery ||
            skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            skill.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch && skill.isEnabled;
    });

    const toggleSkill = (skillId: string) => {
        const existing = selectedSkills.find(s => s.skillId === skillId);
        if (existing) {
            onSkillsChange(selectedSkills.filter(s => s.skillId !== skillId));
        } else {
            onSkillsChange([...selectedSkills, { skillId, isRequired: true }]);
        }
    };

    const toggleRequired = (skillId: string) => {
        onSkillsChange(selectedSkills.map(s =>
            s.skillId === skillId ? { ...s, isRequired: !s.isRequired } : s
        ));
    };

    const handleCreateNew = async (skillData: CreateSkillData) => {
        setSaving(true);
        try {
            const response = await createSkill(skillData);
            if (response.success && response.data) {
                await loadSkills();
                // Automatically select the newly created skill
                onSkillsChange([...selectedSkills, { skillId: response.data.id, isRequired: true }]);
                setShowEditor(false);
            } else {
                alert(response.message || 'Failed to create skill');
            }
        } catch (err) {
            console.error('Failed to create skill:', err);
            alert('Failed to create skill');
        } finally {
            setSaving(false);
        }
    };

    const getSkillById = (skillId: string) => skills.find(s => s.id === skillId);

    return (
        <div className="border border-neutral-200 dark:border-neutral-600 rounded-lg overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 bg-neutral-50 dark:bg-[#2a2b32] hover:bg-neutral-100 dark:hover:bg-[#343541] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <IconBrain size={24} className="text-purple-500" />
                    <div className="text-left">
                        <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">
                            Skills
                        </h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Attach skills to give your assistant specialized capabilities
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {selectedSkills.length > 0 && (
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-sm">
                            {selectedSkills.length} selected
                        </span>
                    )}
                    {expanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                </div>
            </button>

            {/* Content */}
            {expanded && (
                <div className="p-4 space-y-4">
                    {/* Selection mode */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                            Skill Selection Mode
                        </label>
                        <div className="flex gap-2">
                            {(['auto', 'manual', 'hybrid'] as SkillSelectionMode[]).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => onModeChange(mode)}
                                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                                        skillSelectionMode === mode
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                                    }`}
                                >
                                    {mode === 'auto' && 'Auto-select'}
                                    {mode === 'manual' && 'Manual only'}
                                    {mode === 'hybrid' && 'Required + Auto'}
                                </button>
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {skillSelectionMode === 'auto' && 'Skills will be automatically selected based on conversation context'}
                            {skillSelectionMode === 'manual' && 'Only manually selected skills will be used'}
                            {skillSelectionMode === 'hybrid' && 'Required skills are always used, plus auto-selection from others'}
                        </p>
                    </div>

                    {/* Search and add */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search skills..."
                                className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={() => setShowEditor(true)}
                            className="flex items-center gap-1 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
                        >
                            <IconPlus size={16} />
                            New
                        </button>
                    </div>

                    {/* Selected skills */}
                    {selectedSkills.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                Selected Skills
                            </label>
                            <div className="space-y-2">
                                {selectedSkills.map(skillRef => {
                                    const skill = getSkillById(skillRef.skillId);
                                    if (!skill) return null;

                                    return (
                                        <div
                                            key={skillRef.skillId}
                                            className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg"
                                        >
                                            <div className="flex items-center gap-2">
                                                <IconBrain size={18} className="text-purple-500" />
                                                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                                    {skill.name}
                                                </span>
                                                {skill.isShared && (
                                                    <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                                                        shared
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400">
                                                    <input
                                                        type="checkbox"
                                                        checked={skillRef.isRequired}
                                                        onChange={() => toggleRequired(skillRef.skillId)}
                                                        className="rounded border-neutral-300 dark:border-neutral-600 text-purple-500 focus:ring-purple-500"
                                                    />
                                                    Always include
                                                </label>
                                                <button
                                                    onClick={() => toggleSkill(skillRef.skillId)}
                                                    className="p-1 text-neutral-400 hover:text-red-500"
                                                >
                                                    <IconX size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Available skills */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                            Available Skills
                        </label>
                        {loading ? (
                            <div className="p-4 text-center text-neutral-500 dark:text-neutral-400 text-sm">
                                Loading skills...
                            </div>
                        ) : filteredSkills.length === 0 ? (
                            <div className="p-4 text-center text-neutral-500 dark:text-neutral-400 text-sm">
                                {skills.length === 0 ? (
                                    <div>
                                        <p>No skills available.</p>
                                        <button
                                            onClick={() => setShowEditor(true)}
                                            className="mt-2 text-purple-500 hover:text-purple-600"
                                        >
                                            Create your first skill
                                        </button>
                                    </div>
                                ) : (
                                    "No matching skills found."
                                )}
                            </div>
                        ) : (
                            <div className="max-h-60 overflow-y-auto border border-neutral-200 dark:border-neutral-600 rounded-lg divide-y divide-neutral-100 dark:divide-neutral-700">
                                {filteredSkills.map(skill => {
                                    const isSelected = selectedSkills.some(s => s.skillId === skill.id);

                                    return (
                                        <div
                                            key={skill.id}
                                            onClick={() => toggleSkill(skill.id)}
                                            className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-[#40414f] transition-colors ${
                                                isSelected ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                                            }`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
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
                                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                                                        {skill.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Editor modal */}
            {showEditor && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#343541] rounded-lg shadow-2xl overflow-hidden">
                        <SkillEditor
                            onSave={handleCreateNew}
                            onCancel={() => setShowEditor(false)}
                            isLoading={saving}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SkillsSection;
