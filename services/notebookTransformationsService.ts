import { doRequestOp } from "./doRequestOp";

const SERVICE_NAME = "notebook";

export interface Transformation {
    id: string;
    name: string;
    title: string;
    description: string;
    prompt: string;
    apply_default: boolean;
    created: string;
    updated: string;
}

export interface CreateTransformationRequest {
    name: string;
    title: string;
    description: string;
    prompt: string;
    apply_default?: boolean;
}

export interface UpdateTransformationRequest {
    name?: string;
    title?: string;
    description?: string;
    prompt?: string;
    apply_default?: boolean;
}

export interface ExecuteTransformationRequest {
    transformation_id: string;
    input_text: string;
    model_id: string;
}

export interface ExecuteTransformationResponse {
    output: string;
    transformation_id: string;
    model_id: string;
}

export interface DefaultPrompt {
    transformation_instructions: string;
}

export const listTransformations = async (): Promise<Transformation[]> => {
    const op = {
        method: 'GET',
        path: '/api/transformations',
        op: '',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    return Array.isArray(result) ? (result as Transformation[]) : [];
};

export const getTransformation = async (id: string): Promise<Transformation | null> => {
    const op = {
        method: 'GET',
        path: '/api/transformations',
        op: `/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as Transformation;
};

export const createTransformation = async (
    data: CreateTransformationRequest,
): Promise<Transformation | null> => {
    const op = {
        method: 'POST',
        path: '/api/transformations',
        op: '',
        service: SERVICE_NAME,
        data,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as Transformation;
};

export const updateTransformation = async (
    id: string,
    data: UpdateTransformationRequest,
): Promise<Transformation | null> => {
    const op = {
        method: 'PUT',
        path: '/api/transformations',
        op: `/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
        data,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as Transformation;
};

export const deleteTransformation = async (id: string): Promise<boolean> => {
    const op = {
        method: 'DELETE',
        path: '/api/transformations',
        op: `/${encodeURIComponent(id)}`,
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result) return false;
    if ((result as any).success === false) return false;
    return true;
};

export const executeTransformation = async (
    payload: ExecuteTransformationRequest,
): Promise<ExecuteTransformationResponse | null> => {
    const op = {
        method: 'POST',
        path: '/api/transformations',
        op: '/execute',
        service: SERVICE_NAME,
        data: payload,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as ExecuteTransformationResponse;
};

export const getDefaultPrompt = async (): Promise<DefaultPrompt | null> => {
    const op = {
        method: 'GET',
        path: '/api/transformations',
        op: '/default-prompt',
        service: SERVICE_NAME,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as DefaultPrompt;
};

export const updateDefaultPrompt = async (
    prompt: DefaultPrompt,
): Promise<DefaultPrompt | null> => {
    const op = {
        method: 'PUT',
        path: '/api/transformations',
        op: '/default-prompt',
        service: SERVICE_NAME,
        data: prompt,
    };
    const result = await doRequestOp(op);
    if (!result || (result as any).success === false) return null;
    return result as DefaultPrompt;
};
