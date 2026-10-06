import { doRequestOp } from "./doRequestOp";
import { CreateProjectRequest, Project, ProjectFile, ProjectFileStatus, ProjectMemory, UpdateProjectRequest } from "@/types/project";

const URL_PATH = "/project";
// `service` is used only by the Next.js local routing proxy. In deployed
// environments every request still uses API_BASE_URL. Giving Projects its own
// local name avoids redirecting unrelated assistant endpoints to the local
// Projects-only development server.
const SERVICE_NAME = "projects";

export type ProjectOperationResult<T = any> = {
    success: boolean;
    message: string;
    data?: T;
};

export const createProject = async (
    request: CreateProjectRequest,
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult<Project>> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/create",
        data: request,
        service: SERVICE_NAME,
    };
    return await doRequestOp(op, abortSignal);
};

export const listProjects = async (
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult<Project[]>> => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/list",
        service: SERVICE_NAME,
    };
    return await doRequestOp(op, abortSignal);
};

export const getProject = async (
    id: string,
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult<Project>> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/get",
        data: { id },
        service: SERVICE_NAME,
    };
    return await doRequestOp(op, abortSignal);
};

export const updateProject = async (
    request: UpdateProjectRequest,
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult<Project>> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/update",
        data: request,
        service: SERVICE_NAME,
    };
    return await doRequestOp(op, abortSignal);
};

export const deleteProject = async (
    id: string,
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/delete",
        data: { id },
        service: SERVICE_NAME,
    };
    return await doRequestOp(op, abortSignal);
};

// ── Project-scoped memory ────────────────────────────────────────────────────
// A separate store from the pre-existing global "user" memory feature
// (services/memoryService.ts) — see the implementation notes in
// service/project_memory.py on the backend for why this isn't built as an
// extension of that one.

export const listProjectMemories = async (
    projectId: string,
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult<ProjectMemory[]>> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/memory/list",
        data: { projectId },
        service: SERVICE_NAME,
    };
    return await doRequestOp(op, abortSignal);
};

export const addProjectMemory = async (
    request: {
        projectId: string;
        content: string;
        sourceConversationId?: string;
        status?: 'pending';
        // Existing memory ids this one corrects/replaces. Nothing is deleted at
        // suggestion time -- the backend only retires them if and when this new
        // memory itself gets approved (service/project_memory.py: edit_project_memory).
        supersedesIds?: string[];
    },
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult<ProjectMemory>> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/memory/add",
        data: request,
        service: SERVICE_NAME,
    };
    return await doRequestOp(op, abortSignal);
};

export const editProjectMemory = async (
    id: string,
    content: string,
    status?: 'pending' | 'approved',
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult<ProjectMemory>> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/memory/edit",
        data: { id, content, ...(status ? { status } : {}) },
        service: SERVICE_NAME,
    };
    return await doRequestOp(op, abortSignal);
};

export const deleteProjectMemory = async (
    id: string,
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/memory/delete",
        data: { id },
        service: SERVICE_NAME,
    };
    return await doRequestOp(op, abortSignal);
};

// ── Project file manifest ────────────────────────────────────────────────────
// The files themselves are uploaded/processed/deleted through fileService; these
// calls only record which files belong to a project (and their status), which is
// also what the backend uses to attach them to every project chat.

export const listProjectFiles = async (
    projectId: string,
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult<ProjectFile[]>> => {
    return await doRequestOp({ method: 'POST', path: URL_PATH, op: "/files/list", data: { projectId }, service: SERVICE_NAME }, abortSignal);
};

export const addProjectFile = async (
    request: { projectId: string; fileId: string; name: string; type: string },
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult<ProjectFile>> => {
    return await doRequestOp({ method: 'POST', path: URL_PATH, op: "/files/add", data: request, service: SERVICE_NAME }, abortSignal);
};

export const updateProjectFile = async (
    request: { projectId: string; fileId: string; status?: ProjectFileStatus; totalTokens?: number },
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult<ProjectFile>> => {
    return await doRequestOp({ method: 'POST', path: URL_PATH, op: "/files/update", data: request, service: SERVICE_NAME }, abortSignal);
};

export const removeProjectFile = async (
    projectId: string,
    fileId: string,
    abortSignal: AbortSignal | null = null
): Promise<ProjectOperationResult> => {
    return await doRequestOp({ method: 'POST', path: URL_PATH, op: "/files/remove", data: { projectId, fileId }, service: SERVICE_NAME }, abortSignal);
};
