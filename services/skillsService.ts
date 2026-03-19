// Skills service for managing user skills
import { getSession } from "next-auth/react";
import {
    Skill,
    SkillsRequest,
    SkillsResponse,
    CreateSkillData,
    UpdateSkillData,
    ShareSkillConfig,
    SkillShare
} from "@/types/skill";

/**
 * Send a skills request to the backend through the chat endpoint
 */
const sendSkillsRequest = async <T = any>(
    chatEndpoint: string,
    action: string,
    data: any = {}
): Promise<SkillsResponse<T>> => {
    try {
        const session = await getSession();

        // @ts-ignore
        if (!session || !session.accessToken) {
            throw new Error("No session available");
        }

        if (!chatEndpoint) {
            throw new Error("Chat endpoint not configured");
        }

        const requestBody: { skillsRequest: SkillsRequest } = {
            skillsRequest: {
                action: action as any,
                data
            }
        };

        const response = await fetch(chatEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // @ts-ignore
                'Authorization': `Bearer ${session.accessToken}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Skills request failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Handle nested response format from backend
        if (result.body && typeof result.body === 'string') {
            return JSON.parse(result.body);
        }

        return result;
    } catch (error) {
        console.error(`Skills ${action} request failed:`, error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Skills operation failed'
        };
    }
};

/**
 * Create a new skill
 */
export const createSkill = async (chatEndpoint: string, skillData: CreateSkillData): Promise<SkillsResponse<Skill>> => {
    return sendSkillsRequest<Skill>(chatEndpoint, 'create', skillData);
};

/**
 * Get all skills for the current user
 * @param includeShared Whether to include skills shared with the user
 */
export const getUserSkills = async (chatEndpoint: string, includeShared: boolean = true): Promise<SkillsResponse<Skill[]>> => {
    return sendSkillsRequest<Skill[]>(chatEndpoint, 'list', { includeShared });
};

/**
 * Get a single skill by ID
 */
export const getSkill = async (chatEndpoint: string, skillId: string): Promise<SkillsResponse<Skill>> => {
    return sendSkillsRequest<Skill>(chatEndpoint, 'get', { skillId });
};

/**
 * Update an existing skill
 */
export const updateSkill = async (
    chatEndpoint: string,
    skillId: string,
    updates: UpdateSkillData
): Promise<SkillsResponse<Skill>> => {
    return sendSkillsRequest<Skill>(chatEndpoint, 'update', { skillId, updates });
};

/**
 * Delete a skill
 */
export const deleteSkill = async (chatEndpoint: string, skillId: string): Promise<SkillsResponse<{ success: boolean }>> => {
    return sendSkillsRequest<{ success: boolean }>(chatEndpoint, 'delete', { skillId });
};

/**
 * Share a skill with another user or group
 */
export const shareSkill = async (
    chatEndpoint: string,
    skillId: string,
    shareConfig: ShareSkillConfig
): Promise<SkillsResponse<SkillShare>> => {
    return sendSkillsRequest<SkillShare>(chatEndpoint, 'share', { skillId, shareConfig });
};

/**
 * Remove a skill share
 */
export const unshareSkill = async (chatEndpoint: string, shareId: string): Promise<SkillsResponse<void>> => {
    return sendSkillsRequest<void>(chatEndpoint, 'unshare', { shareId });
};

/**
 * Auto-select skills based on a message and context
 */
export const autoSelectSkills = async (
    chatEndpoint: string,
    message: string,
    context: {
        tags?: string[];
        assistantTags?: string[];
        category?: string;
    } = {}
): Promise<SkillsResponse<Skill[]>> => {
    return sendSkillsRequest<Skill[]>(chatEndpoint, 'autoSelect', { message, context });
};

/**
 * Get public skills for discovery
 */
export const getPublicSkills = async (
    chatEndpoint: string,
    limit: number = 50,
    tags?: string[]
): Promise<SkillsResponse<Skill[]>> => {
    return sendSkillsRequest<Skill[]>(chatEndpoint, 'getPublic', { limit, tags });
};

/**
 * Increment usage count for a skill
 */
export const incrementSkillUsage = async (chatEndpoint: string, skillId: string): Promise<SkillsResponse<void>> => {
    return sendSkillsRequest<void>(chatEndpoint, 'incrementUsage', { skillId });
};

/**
 * Parse skill frontmatter from markdown content
 * Client-side utility for preview/editing
 */
export const parseSkillFrontmatter = (content: string): Partial<Skill> => {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) return {};

    const yaml = match[1];
    const result: Partial<Skill> = {};

    try {
        // Parse name
        const nameMatch = yaml.match(/name:\s*["']?([^"'\n]+)["']?/);
        if (nameMatch) result.name = nameMatch[1].trim();

        // Parse description
        const descMatch = yaml.match(/description:\s*["']?([^"'\n]+)["']?/);
        if (descMatch) result.description = descMatch[1].trim();

        // Parse tags array
        const tagsMatch = yaml.match(/tags:\s*\[([^\]]*)\]/);
        if (tagsMatch) {
            result.tags = tagsMatch[1]
                .split(',')
                .map(t => t.trim().replace(/["']/g, ''))
                .filter(Boolean);
        }

        // Parse triggerPhrases array
        const triggerMatch = yaml.match(/triggerPhrases:\s*\[([^\]]*)\]/);
        if (triggerMatch) {
            result.triggerPhrases = triggerMatch[1]
                .split(',')
                .map(t => t.trim().replace(/["']/g, ''))
                .filter(Boolean);
        }

        // Parse priority
        const priorityMatch = yaml.match(/priority:\s*(\d+)/);
        if (priorityMatch) result.priority = parseInt(priorityMatch[1]);

        // Parse category
        const categoryMatch = yaml.match(/category:\s*["']?([^"'\n]+)["']?/);
        if (categoryMatch) result.category = categoryMatch[1].trim();
    } catch (e) {
        console.error('Error parsing skill frontmatter:', e);
    }

    return result;
};

/**
 * Build skill content from fields (for creating/updating)
 */
export const buildSkillContent = (
    name: string,
    description: string,
    tags: string[],
    triggerPhrases: string[],
    priority: number,
    category: string,
    body: string
): string => {
    const frontmatter = `---
name: "${name}"
description: "${description}"
tags: [${tags.map(t => `"${t}"`).join(', ')}]
triggerPhrases: [${triggerPhrases.map(t => `"${t}"`).join(', ')}]
priority: ${priority}
category: "${category}"
---

`;
    return frontmatter + body;
};
