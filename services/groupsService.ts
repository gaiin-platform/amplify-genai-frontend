import { AssistantDefinition } from "@/types/assistant";
import { LayeredAssistant } from "@/types/layeredAssistant";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/groups";
const UPDATE_URL_PATH =  URL_PATH + "/update";
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
        path: UPDATE_URL_PATH,
        op: "/types",
        data: data,
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

export const updateGroupMembers = async (data: any) => {
    const op = {
        method: 'POST',
        path: UPDATE_URL_PATH,
        op: "/members",
        data: data,
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

export const updateGroupMembersPermissions = async (data: any) => {
    const op = {
        method: 'POST',
        path: UPDATE_URL_PATH,
        op: "/members/permissions",
        data: data,
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

export const updateGroupAssistants = async (data: any) => {
    const op = {
        method: 'POST',
        path: UPDATE_URL_PATH,
        op: "/assistants",
        data: data,
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const updateGroupAmplifyGroups = async (data: any) => {
    const op = {
        method: 'POST',
        path: UPDATE_URL_PATH,
        op: "/amplify_groups",
        data: data,
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const updateGroupSystemUsers = async (data: any) => {
    const op = {
        method: 'POST',
        path: UPDATE_URL_PATH,
        op: "/system_users",
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


export const isMemberOfAstAdminGroup = async (groupId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/verify_ast_group_member",
        data: { groupId },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}


// ── Group Layered Assistants ──────────────────────────────────────────────────
// All three operations are routed through /groups/layered_assistants so the
// backend calls the LA service as the group system user (astgr/ prefix).

/**
 * Create or update a group-scoped Layered Assistant.
 * Pass la.publicId to update an existing one; leave it empty to create new.
 */
export const saveGroupLayeredAssistant = async (
    groupId: string,
    la: LayeredAssistant,
): Promise<any> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/layered_assistants",
        data: {
            group_id:         groupId,
            action:           "create_or_update",
            layeredAssistant: {
                publicId:    la.publicId || "",
                name:        la.name,
                description: la.description,
                rootNode:    la.rootNode,
            },
        },
        service: SERVICE_NAME,
    };
    return await doRequestOp(op);
};

/**
 * List all Layered Assistants belonging to a group.
 * Any group member (read or write) may call this.
 */
export const listGroupLayeredAssistants = async (groupId: string): Promise<any> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/layered_assistants",
        data: {
            group_id: groupId,
            action:   "list",
        },
        service: SERVICE_NAME,
    };
    return await doRequestOp(op);
};

/**
 * Permanently delete a group-scoped Layered Assistant by its publicId.
 * Requires write or admin access to the group.
 */
export const deleteGroupLayeredAssistant = async (
    groupId: string,
    publicId: string,
): Promise<any> => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/layered_assistants",
        data: {
            group_id: groupId,
            action:   "delete",
            publicId: publicId,
        },
        service: SERVICE_NAME,
    };
    return await doRequestOp(op);
};