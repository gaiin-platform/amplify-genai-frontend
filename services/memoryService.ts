import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/memory";

export const doExtractFactsOp = async (userInput: string) => {
    const op = {
        // url: 'https://dev-api.vanderbilt.ai/memory/extract-facts',
        method: 'POST',
        path: URL_PATH,
        op: "/extract-facts",
        data: { user_input: userInput }
    };
    return await doRequestOp(op);
}

export const doSaveMemoryOp = async (memoryItem: string, memoryType: string, memoryTypeID: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/save-memory",
        data: { MemoryItem: memoryItem, MemoryType: memoryType, MemoryTypeID: memoryTypeID }
    };
    return await doRequestOp(op);
}

export const doReadMemoryOp = async (projectId?: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/read-memory",
        data: {
            project_id: projectId
        }
    };
    return await doRequestOp(op);
}

export const doRemoveMemoryOp = async (memoryId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/remove-memory",
        data: {
            memory_id: memoryId
        }
    };
    return await doRequestOp(op);
}

export const doEditMemoryOp = async (memoryId: string, content: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/edit-memory",
        data: {
            memory_id: memoryId,
            content: content
        }
    };
    return await doRequestOp(op);
}

export const doCreateProjectOp = async (projectName: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/create-project",
        data: { ProjectName: projectName }
    };
    return await doRequestOp(op);
}

export const doGetProjectsOp = async (email: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/get-projects",
        data: { Email: email }
    };
    return await doRequestOp(op);
};

export const doRemoveProjectOp = async (projectId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/remove-project",
        data: {
            ProjectID: projectId
        }
    };
    return await doRequestOp(op);
}

export const doEditProjectOp = async (projectId: string, projectName: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/edit-project",
        data: {
            ProjectID: projectId,
            ProjectName: projectName
        }
    };
    return await doRequestOp(op);
}
