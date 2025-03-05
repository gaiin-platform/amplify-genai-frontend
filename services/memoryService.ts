import { doRequestOp } from "./doRequestOp";
import {
    Memory,
    MemoryType,
    MemoryBatchItem,
    MemoryOperationResponse,
    ExtractFactsResponse
} from '@/types/memory';

const URL_PATH = "/memory";
const SERVICE_NAME = "memory";

export const doExtractFactsOp = async (userInput: string): Promise<ExtractFactsResponse> => {
    const op = {
        // url: 'http://localhost:3015/dev/memory/extract-facts',
        method: 'POST',
        path: URL_PATH,
        op: "/extract-facts",
        data: { user_input: userInput },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const doSaveMemoryBatchOp = async (memories: MemoryBatchItem[]): Promise<MemoryOperationResponse> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/save-memory-batch",
        data: { memories },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const doReadMemoryByTaxonomyOp = async (params: {
    category?: string;
    subcategory?: string;
    memory_type?: MemoryType;
    memory_type_id?: string;
    conversation_id?: string;
}): Promise<MemoryOperationResponse> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/read-memory-by-taxonomy",
        data: params,
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const doRemoveMemoryOp = async (memoryId: string): Promise<MemoryOperationResponse> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/remove-memory",
        data: { memory_id: memoryId },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const doEditMemoryOp = async (
    memoryId: string,
    content: string
): Promise<MemoryOperationResponse> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/edit-memory",
        data: { memory_id: memoryId, content },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}
