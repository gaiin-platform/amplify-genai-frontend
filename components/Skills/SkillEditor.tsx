import React, { useState, useEffect, FC } from 'react';
import {
    IconCode,
    IconTags,
    IconBolt,
    IconEye,
    IconEyeOff,
    IconX,
    IconDeviceFloppy
} from '@tabler/icons-react';
import {
    Skill,
    CreateSkillData,
    UpdateSkillData,
    DEFAULT_SKILL_TEMPLATE,
    SKILL_CATEGORIES
} from '@/types/skill';
import { parseSkillFrontmatter } from '@/services/skillsService';

interface SkillEditorProps {
    skill?: Skill;
    onSave: (skillData: CreateSkillData | UpdateSkillData) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export const SkillEditor: FC<SkillEditorProps> = ({
    skill,
    onSave,
    onCancel,
    isLoading = false
}) => {
    const [content, setContent] = useState(skill?.content || DEFAULT_SKILL_TEMPLATE);
    const [name, setName] = useState(skill?.name || '');
    const [description, setDescription] = useState(skill?.description || '');
    const [tags, setTags] = useState<string[]>(skill?.tags || []);
    const [triggerPhrases, setTriggerPhrases] = useState<string[]>(skill?.triggerPhrases || []);
    const [priority, setPriority] = useState(skill?.priority || 5);
    const [category, setCategory] = useState(skill?.category || 'general');
    const [isPublic, setIsPublic] = useState(skill?.isPublic || false);
    const [showPreview, setShowPreview] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [triggerInput, setTriggerInput] = useState('');

    // Parse frontmatter when content changes
    useEffect(() => {
        const parsed = parseSkillFrontmatter(content);
        if (parsed.name && !name) setName(parsed.name);
        if (parsed.description && !description) setDescription(parsed.description);
        if (parsed.tags?.length && !tags.length) setTags(parsed.tags);
        if (parsed.triggerPhrases?.length && !triggerPhrases.length) setTriggerPhrases(parsed.triggerPhrases);
        if (parsed.priority) setPriority(parsed.priority);
        if (parsed.category) setCategory(parsed.category);
    }, [content, description, name, tags.length, triggerPhrases.length]);

    const handleSave = () => {
        const skillData: CreateSkillData | UpdateSkillData = {
            content,
            name: name || 'Untitled Skill',
            description,
            tags,
            triggerPhrases,
            priority,
            category,
            isPublic
        };
        onSave(skillData);
    };

    const addTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const addTrigger = () => {
        if (triggerInput.trim() && !triggerPhrases.includes(triggerInput.trim())) {
            setTriggerPhrases([...triggerPhrases, triggerInput.trim()]);
            setTriggerInput('');
        }
    };

    const removeTrigger = (triggerToRemove: string) => {
        setTriggerPhrases(triggerPhrases.filter(t => t !== triggerToRemove));
    };

    return (
        <div className="flex flex-col h-full max-h-full bg-white dark:bg-[#343541] rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-600">
                <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
                    {skill ? 'Edit Skill' : 'Create New Skill'}
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-400"
                        title={showPreview ? "Hide Preview" : "Show Preview"}
                    >
                        {showPreview ? <IconEyeOff size={20} /> : <IconEye size={20} />}
                    </button>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-400"
                        title="Close"
                    >
                        <IconX size={20} />
                    </button>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {/* Metadata Section */}
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-600 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Skill name"
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                    Priority (1-10)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={priority}
                                    onChange={(e) => setPriority(Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))}
                                    className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                    Category
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {SKILL_CATEGORIES.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                            Description
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Brief description of what this skill does"
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                            <IconTags size={16} className="inline mr-1" />
                            Tags
                        </label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                className="flex-1 p-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Add a tag and press Enter"
                            />
                            <button
                                onClick={addTag}
                                className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                Add
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {tags.map(tag => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm"
                                >
                                    {tag}
                                    <button
                                        onClick={() => removeTag(tag)}
                                        className="hover:text-blue-900 dark:hover:text-blue-100"
                                    >
                                        <IconX size={14} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Trigger Phrases */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                            <IconBolt size={16} className="inline mr-1" />
                            Trigger Phrases
                        </label>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                            When these phrases appear in a message, this skill may be auto-selected
                        </p>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={triggerInput}
                                onChange={(e) => setTriggerInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTrigger())}
                                className="flex-1 p-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., 'review my code' or 'write a blog post'"
                            />
                            <button
                                onClick={addTrigger}
                                className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                            >
                                Add
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {triggerPhrases.map(phrase => (
                                <span
                                    key={phrase}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-sm"
                                >
                                    &quot;{phrase}&quot;
                                    <button
                                        onClick={() => removeTrigger(phrase)}
                                        className="hover:text-purple-900 dark:hover:text-purple-100"
                                    >
                                        <IconX size={14} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isPublic"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                            className="rounded border-neutral-300 dark:border-neutral-600 text-blue-500 focus:ring-blue-500"
                        />
                        <label htmlFor="isPublic" className="text-sm text-neutral-700 dark:text-neutral-300">
                            Make this skill publicly discoverable
                        </label>
                    </div>
                </div>

                {/* Editor Section */}
                <div className={`flex ${showPreview ? 'flex-row' : 'flex-col'} flex-1 min-h-[300px]`}>
                    <div className={`${showPreview ? 'w-1/2' : 'w-full'} p-4`}>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                            <IconCode size={16} className="inline mr-1" />
                            Skill Content (Markdown)
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-[400px] p-3 font-mono text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-[#40414f] text-neutral-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter your skill markdown content..."
                        />
                    </div>

                    {showPreview && (
                        <div className="w-1/2 p-4 border-l border-neutral-200 dark:border-neutral-600 overflow-auto bg-neutral-50 dark:bg-[#2a2b32]">
                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                Preview
                            </label>
                            <div className="prose dark:prose-invert max-w-none text-sm">
                                <pre className="whitespace-pre-wrap bg-white dark:bg-[#40414f] p-3 rounded overflow-auto">
                                    {content}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex justify-end gap-3 p-4 border-t border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-[#2a2b32]">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                    disabled={isLoading}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isLoading || !name.trim()}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <IconDeviceFloppy size={18} />
                    {isLoading ? 'Saving...' : (skill ? 'Save Changes' : 'Create Skill')}
                </button>
            </div>
        </div>
    );
};

export default SkillEditor;
