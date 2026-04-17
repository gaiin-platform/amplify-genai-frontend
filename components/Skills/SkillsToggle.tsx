import React, { useState, useRef, useEffect, FC, useCallback } from 'react';
import { IconBrain, IconX } from '@tabler/icons-react';
import { Skill } from '@/types/skill';
import { SkillSelector } from './SkillSelector';
import { SkillEditor } from './SkillEditor';
import { createSkill, getUserSkills } from '@/services/skillsService';
import { CreateSkillData } from '@/types/skill';

interface SkillsToggleProps {
    chatEndpoint: string;
    selectedSkillIds: string[];
    onSelectionChange: (skillIds: string[]) => void;
    disabled?: boolean;
}

export const SkillsToggle: FC<SkillsToggleProps> = ({
    chatEndpoint,
    selectedSkillIds,
    onSelectionChange,
    disabled = false
}) => {
    const [showSelector, setShowSelector] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [saving, setSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close selector when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSelector(false);
            }
        };

        if (showSelector) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSelector]);

    const handleCreateNew = () => {
        setShowSelector(false);
        setShowEditor(true);
    };

    const handleSaveNewSkill = async (skillData: CreateSkillData) => {
        setSaving(true);
        try {
            const response = await createSkill(chatEndpoint, skillData);
            if (response.success && response.data) {
                // Automatically select the newly created skill
                onSelectionChange([...selectedSkillIds, response.data.id]);
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

    const isActive = selectedSkillIds.length > 0;

    return (
        <div ref={containerRef} className="relative inline-block">
            {/* Toggle button */}
            <button
                onClick={() => !disabled && setShowSelector(!showSelector)}
                disabled={disabled}
                className={`relative p-2 rounded-lg transition-all ${
                    isActive
                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/60'
                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={`Skills${isActive ? ` (${selectedSkillIds.length} active)` : ''}`}
            >
                <IconBrain size={20} />
                {isActive && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {selectedSkillIds.length}
                    </span>
                )}
            </button>

            {/* Selector dropdown */}
            {showSelector && !showEditor && (
                <div className="absolute bottom-full mb-2 right-0 w-80 z-50 shadow-xl">
                    <SkillSelector
                        chatEndpoint={chatEndpoint}
                        selectedSkillIds={selectedSkillIds}
                        onSelectionChange={onSelectionChange}
                        onCreateNew={handleCreateNew}
                        compact={false}
                        maxSelections={3}
                    />
                </div>
            )}

            {/* Editor modal */}
            {showEditor && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#343541] rounded-lg shadow-2xl flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto">
                            <SkillEditor
                                onSave={handleSaveNewSkill}
                                onCancel={() => setShowEditor(false)}
                                isLoading={saving}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Active Skills Display - Shows currently selected skills in the chat area
 */
interface ActiveSkillsDisplayProps {
    chatEndpoint: string;
    skillIds: string[];
    onRemove: (skillId: string) => void;
}

export const ActiveSkillsDisplay: FC<ActiveSkillsDisplayProps> = ({
    chatEndpoint,
    skillIds,
    onRemove
}) => {
    const [skills, setSkills] = useState<Skill[]>([]);

    useEffect(() => {
        const loadSkillNames = async () => {
            if (skillIds.length === 0 || !chatEndpoint) {
                setSkills([]);
                return;
            }

            try {
                const response = await getUserSkills(chatEndpoint, true);
                if (response.success && response.data) {
                    const selectedSkills = response.data.filter(s => skillIds.includes(s.id));
                    setSkills(selectedSkills);
                }
            } catch (err) {
                console.error('Failed to load skill names:', err);
            }
        };

        loadSkillNames();
    }, [skillIds, chatEndpoint]);

    if (skillIds.length === 0) return null;

    return (
        <div className="flex items-center gap-1 flex-wrap">
            <IconBrain size={14} className="text-purple-500" />
            {skills.map(skill => (
                <span
                    key={skill.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs"
                >
                    {skill.name}
                    <button
                        onClick={() => onRemove(skill.id)}
                        className="hover:text-purple-900 dark:hover:text-purple-100"
                    >
                        <IconX size={12} />
                    </button>
                </span>
            ))}
        </div>
    );
};

export default SkillsToggle;
