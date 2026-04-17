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


// ── Group Layered Assistants (consolidated through /groups/update/assistants) ─

/**
 * Create or update a group-scoped Layered Assistant via the consolidated
 * update_group_assistants endpoint.  The backend detects `isLayeredAssistant`
 * and routes to the layered assistant service automatically.
 *
 * Returns a normalised response matching the shape:
 *   { success, data: { assistantId, updatedAt } }
 */
export const saveGroupLayeredAssistant = async (
    groupId: string,
    la: LayeredAssistant,
): Promise<any> => {
    const updateType = la.assistantId ? "UPDATE" : "ADD";
    const result = await updateGroupAssistants({
        group_id: groupId,
        update_type: updateType,
        assistants: [
            {
                isLayeredAssistant: true,
                layeredAssistant: {
                    assistantId: la.assistantId || "",
                    name:        la.name,
                    description: la.description || "",
                    rootNode:    la.rootNode,
                    data: {
                        ...(la.data ?? {}),
                        isPublished:         la.isPublished         ?? false,
                        ...(la.model ? { model: la.model } : {}),
                        trackConversations:  la.trackConversations  ?? false,
                        supportConvAnalysis: la.supportConvAnalysis ?? false,
                        analysisCategories:  la.analysisCategories  ?? [],
                    },
                },
            },
        ],
    });

    // Normalise response so callers see { success, data: { assistantId, updatedAt } }
    if (result?.success && result.assistantData?.length > 0) {
        const entry = result.assistantData[0];
        return {
            success: true,
            data: {
                assistantId: entry.assistantId,
                updatedAt:   new Date().toISOString(),
            },
        };
    }
    return result;
};

/**
 * Delete a group-scoped Layered Assistant via the consolidated
 * update_group_assistants endpoint.  The backend detects the `astgr/` prefix
 * and routes to the layered assistant delete service automatically.
 */
export const deleteGroupLayeredAssistant = async (
    groupId: string,
    assistantId: string,
): Promise<any> => {
    return await updateGroupAssistants({
        group_id: groupId,
        update_type: "REMOVE",
        assistants: [assistantId],
    });
};


