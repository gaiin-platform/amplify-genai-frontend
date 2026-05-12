import { doRequestOp } from "./doRequestOp";

const SERVICE_NAME = "notebook";

export type SearchType = 'text' | 'vector';

export interface SearchRequest {
    query: string;
    type: SearchType;
    limit?: number;
    search_sources?: boolean;
    search_notes?: boolean;
    minimum_score?: number;
}

export interface SearchMatch {
    text?: string;
    [key: string]: any;
}

export interface SearchResult {
    id: string;
    title: string;
    parent_id: string | null;
    relevance?: number;
    similarity?: number;
    score?: number;
    matches?: string[] | SearchMatch[];
    [key: string]: any;
}

export interface SearchResponse {
    results: SearchResult[];
    total_count: number;
    search_type: SearchType;
}

export interface AskRequest {
    question: string;
    strategy_model: string;
    answer_model: string;
    final_answer_model: string;
}

export interface AskResponse {
    answer: string;
    question: string;
}

export const searchKnowledgeBase = async (
    params: SearchRequest
): Promise<SearchResponse | null> => {
    const op = {
        method: 'POST',
        path: '/api/search',
        op: '',
        service: SERVICE_NAME,
        data: {
            query: params.query,
            type: params.type,
            limit: params.limit ?? 100,
            search_sources: params.search_sources ?? true,
            search_notes: params.search_notes ?? true,
            minimum_score: params.minimum_score ?? 0.2,
        },
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as SearchResponse;
};

export const askKnowledgeBaseSimple = async (
    params: AskRequest
): Promise<AskResponse | null> => {
    const op = {
        method: 'POST',
        path: '/api/search/ask/simple',
        op: '',
        service: SERVICE_NAME,
        data: params,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as AskResponse;
};
