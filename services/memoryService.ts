import { doRequestOp } from "./doRequestOp";
import {
    Memory,
    MemoryType,
    MemoryBatchItem,
    MemoryOperationResponse,
    ExtractFactsResponse
} from '@/types/memory';

const URL_PATH = "/memory";

export const doExtractFactsOp = async (userInput: string): Promise<ExtractFactsResponse> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/extract-facts",
        data: { user_input: userInput }
    };
    return await doRequestOp(op);
}

export const doSaveMemoryBatchOp = async (memories: MemoryBatchItem[]): Promise<MemoryOperationResponse> => {
    const op = {
        // url: 'http://localhost:3015/dev/memory/save-memory-batch',
        method: 'POST',
        path: URL_PATH,
        op: "/save-memory-batch",
        data: { memories }
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
        // url: 'http://localhost:3015/dev/memory/read-memory-by-taxonomy',
        method: 'POST',
        path: URL_PATH,
        op: "/read-memory-by-taxonomy",
        data: params
    };
    return await doRequestOp(op);
}

export const doRemoveMemoryOp = async (memoryId: string): Promise<MemoryOperationResponse> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/remove-memory",
        data: { memory_id: memoryId }
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
        data: { memory_id: memoryId, content }
    };
    return await doRequestOp(op);
}

// export const doSaveMemoryOp = async (
//     memoryItem: string,
//     memoryType: MemoryType,
//     memoryTypeID: string
// ): Promise<MemoryOperationResponse> => {
//     const op = {
//         method: 'POST',
//         path: URL_PATH,
//         op: "/save-memory",
//         data: { MemoryItem: memoryItem, MemoryType: memoryType, MemoryTypeID: memoryTypeID }
//     };
//     return await doRequestOp(op);
// }

// export const doReadMemoryOp = async (projectId?: string): Promise<MemoryOperationResponse> => {
//     const op = {
//         method: 'POST',
//         path: URL_PATH,
//         op: "/read-memory",
//         data: { project_id: projectId }
//     };
//     return await doRequestOp(op);
// }

// export const doCreateProjectOp = async (projectName: string): Promise<MemoryOperationResponse> => {
//     const op = {
//         method: 'POST',
//         path: URL_PATH,
//         op: "/create-project",
//         data: { ProjectName: projectName }
//     };
//     return await doRequestOp(op);
// }

// export const doGetProjectsOp = async (email: string): Promise<MemoryOperationResponse> => {
//     const op = {
//         method: 'POST',
//         path: URL_PATH,
//         op: "/get-projects",
//         data: { Email: email }
//     };
//     return await doRequestOp(op);
// };

// export const doRemoveProjectOp = async (projectId: string): Promise<MemoryOperationResponse> => {
//     const op = {
//         method: 'POST',
//         path: URL_PATH,
//         op: "/remove-project",
//         data: { ProjectID: projectId }
//     };
//     return await doRequestOp(op);
// }

// export const doEditProjectOp = async (
//     projectId: string,
//     projectName: string
// ): Promise<MemoryOperationResponse> => {
//     const op = {
//         method: 'POST',
//         path: URL_PATH,
//         op: "/edit-project",
//         data: { ProjectID: projectId, ProjectName: projectName }
//     };
//     return await doRequestOp(op);
// }
