

export const createGroup = async (data: any,  abortSignal = null) => {
    const op = {
        data: data,
        op: '/create'
    };

    const response = await fetch('/api/groups/ops', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });

    const result = await response.json();

    try {
        return 'success' in result ? result.success : false;
        //
    } catch (e) {
        console.error("Error making post request: ", e);
        return false;
    }
};




export const updateGroupMembers = async (data: any,  abortSignal = null) => {
    const op = {
        data: data,
        op: '/members/update'
    };

    const response = await fetch('/api/groups/ops', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });

    const result = await response.json();

    try {
        return 'success' in result ? result.success : false;
        //
    } catch (e) {
        console.error("Error making post request: ", e);
        return false;
    }
};


export const updateGroupMembersPermissions = async (data: any,  abortSignal = null) => {
    const op = {
        data: data,
        op: '/members/update_permissions'
    };

    const response = await fetch('/api/groups/ops', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });

    const result = await response.json();

    try {
        return 'success' in result ? result.success : false;
        //
    } catch (e) {
        console.error("Error making post request: ", e);
        return false;
    }
};



export const updateGroupAssistants = async (data: any,  abortSignal = null) => {
    const op = {
        data: data,
        op: '/assistants/update'
    };

    const response = await fetch('/api/groups/ops', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });

    const result = await response.json();

    try {
        return 'success' in result ? result.success : false;
        //
    } catch (e) {
        console.error("Error making post request: ", e);
        return false;
    }
};


export const deleteGroup = async (groupId: string, abortSignal = null) => {
    
    const response = await fetch('/api/groups/getDeleteOps' + `?group_id=${encodeURIComponent(groupId)}&path=${encodeURIComponent("/delete")}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();
    try {
        const res = JSON.parse(result.body)
        return 'success' in res ? res : {success: false};
    } catch (e) {
        console.error("Error making delete group request: ", e);
        return {success: false};
    }
};


export const fetchGroups = async (abortSignal = null) => {
    const response = await fetch('/api/groups/getDeleteOps' + `?path=${encodeURIComponent("/list")}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();
    try {
        const res = JSON.parse(result.body)
        // return data looks like  {"success": True, "data": group_info, "incompleteGroupData": failed_to_list}
        return 'success' in res ? res : {success: false};
    } catch (e) {
        console.error("Error making delete group request: ", e);
        return {success: false};
    }
}


export const fetchGroupMembers = async (abortSignal = null) => {
    const response = await fetch('/api/groups/getDeleteOps' + `?path=${encodeURIComponent("/members/list")}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();
    try {
        const res = JSON.parse(result.body)
        // return data looks like  {"suceess": True, "groupMemberData" : groups_and_members} where groups_and_members looks like { group-names : members_list}
        return 'success' in res ? res : {success: false};
    } catch (e) {
        console.error("Error making delete group request: ", e);
        return {success: false};
    }
}
