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