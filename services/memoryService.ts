import { doRequestOp } from "./doRequestOp";
import {
    MemoryType,
    MemoryItem,
    MemoryOperationResponse,
} from '@/types/memory';

const URL_PATH = "/memory";
const SERVICE_NAME = "memory";

export const doSaveMemoryOp = async (memories: MemoryItem[]): Promise<MemoryOperationResponse> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/save-memory",
        data: { memories },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const doReadMemoryOp = async (params: {
    category?: string;
    subcategory?: string;
    memory_type?: MemoryType;
    memory_type_id?: string;
    conversation_id?: string;
}): Promise<MemoryOperationResponse> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/read-memory",
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
