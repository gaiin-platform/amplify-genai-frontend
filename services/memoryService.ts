import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/memory";

export const doExtractFactsOp = async (userInput: string) => {
    const op = {
        url: 'http://localhost:3015/dev/memory/extract-facts',
        method: 'POST',
        path: '',
        op: "",
        // path: URL_PATH,
        // op: "/extract-facts",
        data: { user_input: userInput }
    };
    return await doRequestOp(op);
}

export const doSaveMemoryOp = async (memoryItem: string, memoryType: string, memoryTypeID: string) => {
    const op = {
        url: 'http://localhost:3015/dev/memory/save-memory',
        method: 'POST',
        path: '',
        op: "",
        // path: URL_PATH,
        // op: "/extract-facts",
        data: { MemoryItem: memoryItem, MemoryType: memoryType, MemoryTypeID: memoryTypeID }
    };
    return await doRequestOp(op);
}

export const doReadMemoryOp = async () => {
    const op = {
        url: 'http://localhost:3015/dev/memory/read-memory',
        method: 'POST',
        path: '',
        op: "",
        // path: URL_PATH,
        // op: "/extract-facts",
        data: {}
    };
    return await doRequestOp(op);
}

export const doRemoveMemoryOp = async (memoryId: string) => {
    const op = {
        url: 'http://localhost:3015/dev/memory/remove-memory',
        method: 'POST',
        path: '',
        op: "",
        data: {
            memory_id: memoryId
        }
    };
    return await doRequestOp(op);
}

export const doEditMemoryOp = async (memoryId: string, content: string) => {
    const op = {
        url: 'http://localhost:3015/dev/memory/edit-memory',
        method: 'POST',
        path: '',
        op: "",
        data: {
            memory_id: memoryId,
            content: content
        }
    };
    return await doRequestOp(op);
}

export const doCreateProjectOp = async (projectName: string) => {
    const op = {
        url: 'http://localhost:3015/dev/memory/create-project',
        method: 'POST',
        path: '',
        op: "",
        // path: URL_PATH,
        // op: "/extract-facts",
        data: { ProjectName: projectName }
    };
    return await doRequestOp(op);
}

export const doGetProjectsOp = async (email: string) => {
    const op = {
        url: 'http://localhost:3015/dev/memory/get-projects',
        method: 'POST',
        path: '',
        op: "",
        data: { Email: email }
    };
    return await doRequestOp(op);
}

export const doRemoveProjectOp = async (projectId: string) => {
    const op = {
        url: 'http://localhost:3015/dev/memory/remove-project',
        method: 'POST',
        path: '',
        op: "",
        data: {
            ProjectID: projectId
        }
    };
    return await doRequestOp(op);
}

export const doEditProjectOp = async (projectId: string, projectName: string) => {
    const op = {
        url: 'http://localhost:3015/dev/memory/edit-project',
        method: 'POST',
        path: '',
        op: "",
        data: {
            ProjectID: projectId,
            ProjectName: projectName
        }
    };
    return await doRequestOp(op);
}
