
export const createApiKey = async (data: any,  abortSignal = null) => {
    const op = {
        data: data,
        op: '/create_keys'
    };

    const response = await fetch('/api/apikeys/op', {
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
    } catch (e) {
        console.error("Error making post request: ", e);
        return false;
    }
};


export const fetchApiKey = async (apiKeyId: string, abortSignal = null) => {
    
    const response = await fetch('/api/apikeys/opget' + `?apiKeyId=${encodeURIComponent(apiKeyId)}&path=${encodeURIComponent("/get_key")}`, {
        method: 'GET',
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
        console.error("Error making get_api key request: ", e);
        return {success: false};
    }
};


export const fetchAllApiKeys = async (abortSignal = null) => {
    
    const response = await fetch('/api/apikeys/opget' + `?path=${encodeURIComponent("/get_keys")}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();
    try {
        if (result.success) {
            return result;
        } else {
            console.error("Error getting all apikeys: ", result.message);
            return {success: false};
        }
    } catch (e) {
        console.error("Error during api keys request: ", e);
        return {success: false};
    }
};



export const fetchAllSystemIds = async (abortSignal = null) => {
    const response = await fetch('/api/apikeys/opget' + `?path=${encodeURIComponent("/get_system_ids")}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();
    try {
        return result.success ? result.data : [];
    } catch (e) {
        console.error("Error during api key system id request: ", e);
        return [];
    }
};

export const deactivateApiKey = async (apiKeyId: string,  abortSignal = null) => {
    const op = {
        data: {'apiKeyId': apiKeyId},
        op: '/deactivate_key'
    };

    const response = await fetch('/api/apikeys/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });

    try {
        const result = await response.json();
        return 'success' in result ? result.success : false;

    } catch (e) {
        console.error("Error deactivating api key request: ", e);
        return false;
    }
};



export const updateApiKeys = async (data: any,  abortSignal = null) => {
    const op = {
        data: data,
        op: "/update_keys"
    };

    const response = await fetch('/api/apikeys/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });

    const res = await response.json();
    console.log(res)
    try {
        return 'success' in res ? res : {success: false};
    } catch (e) {
        console.error("Error making post request: ", e);
        return {success: false};
;
    }
};



export const fetchApiDoc = async (abortSignal = null) => {
    
    const response = await fetch('/api/apikeys/opget' + `?path=${encodeURIComponent("/api_documentation")}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();
    try {
        return 'success' in result ? result : {success: false};
    } catch (e) {
        console.error("Error making get api doc request: ", e);
        return {success: false};
    }
};