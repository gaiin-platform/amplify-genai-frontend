// Skill types for the Amplify GenAI application

export interface Skill {
    id: string;
    user: string;
    name: string;
    description: string;
    content: string;
    tags: string[];
    triggerPhrases: string[];
    priority: number;
    category: string;
    isEnabled: boolean;
    isPublic: boolean;
    isShared?: boolean;
    metadata: SkillMetadata;
}

export interface SkillMetadata {
    version: number;
    createdAt: string;
    updatedAt: string;
    usageCount: number;
    lastUsedAt: string | null;
}

export interface SkillShare {
    shareId: string;
    skillId: string;
    sharedBy: string;
    sharedWith: string;
    shareType: 'user' | 'group' | 'amplify_group';
    permissions: 'read' | 'read_write';
    createdAt: string;
    expiresAt?: string;
}

export interface SkillReference {
    skillId: string;
    isRequired: boolean;
    name?: string;
    overrideContent?: string;
}

export interface ActiveSkill {
    id: string;
    name: string;
    description: string;
}

export interface SkillsRequest {
    action: SkillsAction;
    data?: any;
}

export type SkillsAction =
    | 'create'
    | 'list'
    | 'get'
    | 'update'
    | 'delete'
    | 'share'
    | 'unshare'
    | 'autoSelect'
    | 'getPublic'
    | 'incrementUsage';

export interface SkillsResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
}

export type SkillSelectionMode = 'manual' | 'auto' | 'hybrid';

export interface CreateSkillData {
    name?: string;
    description?: string;
    content: string;
    tags?: string[];
    triggerPhrases?: string[];
    priority?: number;
    category?: string;
    isPublic?: boolean;
}

export interface UpdateSkillData {
    name?: string;
    description?: string;
    content?: string;
    tags?: string[];
    triggerPhrases?: string[];
    priority?: number;
    category?: string;
    isEnabled?: boolean;
    isPublic?: boolean;
}

export interface ShareSkillConfig {
    sharedWith: string;
    shareType: 'user' | 'group' | 'amplify_group';
    permissions?: 'read' | 'read_write';
    expiresAt?: string;
}

// Default skill template
export const DEFAULT_SKILL_TEMPLATE = `---
name: "My New Skill"
description: "A helpful skill for specific tasks"
tags: ["general"]
triggerPhrases: ["help me with", "I need to"]
priority: 5
category: "general"
---

# Skill Name

Brief description of what this skill helps with.

## Capabilities
- Capability 1
- Capability 2

## Guidelines
1. Guideline 1
2. Guideline 2

## Examples
Example usage or output format.
`;

// Skill categories for organization
export const SKILL_CATEGORIES = [
    { id: 'general', name: 'General' },
    { id: 'coding', name: 'Coding & Development' },
    { id: 'writing', name: 'Writing & Content' },
    { id: 'analysis', name: 'Analysis & Research' },
    { id: 'creative', name: 'Creative' },
    { id: 'productivity', name: 'Productivity' },
    { id: 'communication', name: 'Communication' },
    { id: 'education', name: 'Education & Learning' },
    { id: 'business', name: 'Business' },
    { id: 'other', name: 'Other' }
] as const;

export type SkillCategory = typeof SKILL_CATEGORIES[number]['id'];
