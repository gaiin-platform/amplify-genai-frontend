import { doRequestOp } from "./doRequestOp";

const SERVICE_NAME = "notebook";
const SESSIONS_PATH = "/api/chat/sessions";
const EXECUTE_PATH = "/api/chat/execute";
const CONTEXT_PATH = "/api/chat/context";

export type ChatMessageType = "human" | "ai" | string;

export interface ChatMessage {
    id: string;
    type: ChatMessageType;
    content: string;
    timestamp?: string | null;
}

export interface ChatSession {
    id: string;
    title: string;
    notebook_id?: string | null;
    created: string;
    updated: string;
    message_count?: number | null;
    model_override?: string | null;
}

export interface ChatSessionWithMessages extends ChatSession {
    messages: ChatMessage[];
}

export type SourceContextMode = "off" | "insights" | "full";
export type NoteContextMode = "off" | "full";

export interface ContextSelections {
    sources: Record<string, SourceContextMode>;
    notes: Record<string, NoteContextMode>;
}

interface ContextConfig {
    sources: Record<string, string>;
    notes: Record<string, string>;
}

export interface BuildContextResponse {
    context: { sources: any[]; notes: any[] };
    token_count: number;
    char_count: number;
}

export const listChatSessions = async (notebookId: string): Promise<ChatSession[]> => {
    const op = {
        method: 'GET',
        path: SESSIONS_PATH,
        op: '',
        service: SERVICE_NAME,
        queryParams: { notebook_id: notebookId },
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? result : [];
};

export const createChatSession = async (
    notebookId: string,
    title?: string,
    modelOverride?: string,
): Promise<ChatSession | null> => {
    const op = {
        method: 'POST',
        path: SESSIONS_PATH,
        op: '',
        service: SERVICE_NAME,
        data: {
            notebook_id: notebookId,
            title,
            model_override: modelOverride,
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as ChatSession;
};

export const getChatSession = async (sessionId: string): Promise<ChatSessionWithMessages | null> => {
    const op = {
        method: 'GET',
        path: SESSIONS_PATH,
        op: `/${encodeURIComponent(sessionId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as ChatSessionWithMessages;
};

export const deleteChatSession = async (sessionId: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: SESSIONS_PATH,
        op: `/${encodeURIComponent(sessionId)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};

export const buildContextConfig = (selections: ContextSelections): ContextConfig => {
    const cfg: ContextConfig = { sources: {}, notes: {} };
    for (const [id, mode] of Object.entries(selections.sources)) {
        if (mode === 'insights') cfg.sources[id] = 'insights';
        else if (mode === 'full') cfg.sources[id] = 'full content';
        else cfg.sources[id] = 'not in';
    }
    for (const [id, mode] of Object.entries(selections.notes)) {
        if (mode === 'full') cfg.notes[id] = 'full content';
        else cfg.notes[id] = 'not in';
    }
    return cfg;
};

export const buildChatContext = async (
    notebookId: string,
    selections: ContextSelections,
): Promise<BuildContextResponse | null> => {
    const op = {
        method: 'POST',
        path: CONTEXT_PATH,
        op: '',
        service: SERVICE_NAME,
        data: {
            notebook_id: notebookId,
            context_config: buildContextConfig(selections),
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as BuildContextResponse;
};

export const sendChatMessage = async (
    sessionId: string,
    message: string,
    context: BuildContextResponse['context'],
    modelOverride?: string,
): Promise<{ session_id: string; messages: ChatMessage[] } | null> => {
    const op = {
        method: 'POST',
        path: EXECUTE_PATH,
        op: '',
        service: SERVICE_NAME,
        data: {
            session_id: sessionId,
            message,
            context,
            model_override: modelOverride,
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as { session_id: string; messages: ChatMessage[] };
};
