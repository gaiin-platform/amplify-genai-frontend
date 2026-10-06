/**
 * Project — a first-class workspace: name, description, custom instructions
 * applied to every chat inside it, a scoped knowledge base (files), and
 * (once wired up) scoped memory. Modeled on Claude/ChatGPT Projects.
 *
 * Mirrors the shape returned by amplify-assistants' service/projects.py.
 */

export type ProjectStatus = 'active' | 'archived';

export interface Project {
    id: string;
    createdBy: string;
    name: string;
    description: string;
    instructions: string;
    /**
     * Doubles as the `knowledgeBase` value passed to the existing files
     * service (fileService.ts's addFile/queryUserFiles) — a project's own
     * id scopes its knowledge base with no files-service changes needed.
     */
    knowledgeBase: string;
    memoryEnabled: boolean;
    /** Default assistant for new chats in this project ('' when none). */
    assistantId?: string;
    assistantName?: string;
    status: ProjectStatus;
    createdAt: string;
    updatedAt: string;
}

export interface CreateProjectRequest {
    name: string;
    description?: string;
    instructions?: string;
    memoryEnabled?: boolean;
    assistantId?: string;
    assistantName?: string;
}

export interface UpdateProjectRequest {
    id: string;
    name?: string;
    description?: string;
    instructions?: string;
    memoryEnabled?: boolean;
    assistantId?: string;
    assistantName?: string;
    status?: ProjectStatus;
}

export interface ProjectMemory {
    id: string;
    projectId: string;
    content: string;
    sourceConversationId?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    status?: 'pending' | 'approved';
    // Ids of other memories this one corrects/replaces. Set at suggestion time;
    // the backend only retires those records once THIS memory is approved.
    supersedesIds?: string[];
}

/** Where a project file is in its life: registered and being processed, usable, or failed. */
export type ProjectFileStatus = 'processing' | 'ready' | 'failed';

/**
 * One entry in a project's file manifest (see amplify-assistants
 * service/project_files.py). The file itself lives in the files service; `fileId`
 * is its key there.
 */
export interface ProjectFile {
    projectId: string;
    fileId: string;
    name: string;
    type: string;
    status: ProjectFileStatus;
    totalTokens: number;
    addedBy: string;
    addedAt: string;
    updatedAt: string;
}
