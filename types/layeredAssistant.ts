// Layered Assistant Types
// A tree structure where Router nodes guide an AI agent to select the right
// leaf Assistant for a user's prompt. Routers contain routing instructions,
// while Leaf nodes reference existing assistants.

export enum LayeredNodeType {
    ROUTER = 'router',
    LEAF = 'leaf',
}

// A Router node — acts as a decision point in the tree.
// Its instructions tell the backend LLM how to choose among its children.
export interface RouterNode {
    type: LayeredNodeType.ROUTER;
    id: string;
    name: string;
    description: string;   // Short description of what this router handles
    instructions: string;  // Instructions for the LLM on how to route among children
    children: LayeredAssistantNode[];
}

// Fields the router can optionally pull in at routing time for better decisions.
// Only shown in the UI if the assistant actually has that data.
export type RouterContextField = 'dataSources' | 'tools' | 'workflow';

// A Leaf node — references an existing assistant (Prompt with isAssistant).
export interface LeafNode {
    type: LayeredNodeType.LEAF;
    id: string;
    assistantId: string;          // ID of the referenced Prompt
    name: string;                 // Display name (copied from assistant for convenience)
    description: string;          // Description for the router to understand what this assistant does
    routerContext: RouterContextField[];  // Which extra details the backend should pull in at routing time
}

export type LayeredAssistantNode = RouterNode | LeafNode;

// Public-ID prefixes assigned by the backend:
//   astr/<uuid>   — personal layered assistant (owned by a real user)
//   astgr/<uuid>  — group layered assistant (owned by a group system user)
export const LAYERED_AST_PERSONAL_PREFIX = "astr";
export const LAYERED_AST_GROUP_PREFIX    = "astgr";

// Top-level wrapper with metadata
export interface LayeredAssistant {
    id: string;
    publicId?: string;   // Stable external ID — "astr/<uuid>" or "astgr/<uuid>"
    groupId?:  string;   // Set for group-owned LAs — equals the group_id
    name: string;
    description: string;
    rootNode: RouterNode;   // The tree always starts with a router
    createdAt: string;
    updatedAt: string;
}

// Helpers
export const isGroupLayeredAssistant = (la: LayeredAssistant): boolean =>
    !!(la.groupId || la.publicId?.startsWith(`${LAYERED_AST_GROUP_PREFIX}/`));

export const isPersonalLayeredAssistant = (la: LayeredAssistant): boolean =>
    !isGroupLayeredAssistant(la);

// Helper to check node type
export const isRouterNode = (node: LayeredAssistantNode): node is RouterNode =>
    node.type === LayeredNodeType.ROUTER;

export const isLeafNode = (node: LayeredAssistantNode): node is LeafNode =>
    node.type === LayeredNodeType.LEAF;

// Factory helpers
export const createRouterNode = (name: string = 'New Router'): RouterNode => ({
    type: LayeredNodeType.ROUTER,
    id: crypto.randomUUID?.() || `router-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    description: '',
    instructions: '',
    children: [],
});

export const createLeafNode = (assistantId: string, name: string, description: string): LeafNode => ({
    type: LayeredNodeType.LEAF,
    id: crypto.randomUUID?.() || `leaf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    assistantId,
    name,
    description,
    routerContext: [],
});

export const createLayeredAssistant = (name: string = ''): LayeredAssistant => ({
    id: crypto.randomUUID?.() || `la-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    publicId: undefined,
    name,
    description: '',
    rootNode: createRouterNode('Parent 1'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});
