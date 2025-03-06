import { AssistantDefinition } from "@/types/assistant";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/groups";
const SERVICE_NAME = "groups";

export const createAstAdminGroup = async (data: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/create",
        data: data,
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success ? result.data : null;
}

export const updateGroupTypes = async (data: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/types/update",
        data: data,
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

export const updateGroupMembers = async (data: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/members/update",
        data: data,
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

export const updateGroupMembersPermissions = async (data: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/members/update_permissions",
        data: data,
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

export const updateGroupAssistants = async (data: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/assistants/update",
        data: data,
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const deleteAstAdminGroup = async (groupId: string) => {
    const op = {
        method: 'DELETE',
        path: URL_PATH,
        op: "/delete",
        queryParams: { "group_id": groupId },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

export const fetchAstAdminGroups = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/list",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const replaceAstAdminGroupKey = async (groupId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/replace_key",
        data: { groupId: groupId },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

export const createAmplifyAssistants = async (astDefs: AssistantDefinition[], admins: string[]) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/assistants/amplify",
        data: { assistants: astDefs, members: admins },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}
