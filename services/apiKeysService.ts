import { ApiKey } from "@/types/apikeys";


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

        if (result.success) {
            return true;
        } else {
            console.error("Error creating new apikey: ", result.message);
            return false;
        }
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
        if ('success' in res ) {
            return res;
        }
    } catch (e) {
        console.error("Error making get_api key request: ", e);
        return {success: false, message: "Unable to fetch API key at this time."};
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

export const separateOwnerDelegateApiKeys = (keys: ApiKey[]): { delegated: ApiKey[], owner: ApiKey[] } => {
    const result = keys.reduce<{ delegated: ApiKey[], owner: ApiKey[] }>((acc, key) => {
        const category = key.delegate ? 'delegated' : 'owner';
        acc[category].push(key);
        return acc;
    }, { delegated: [], owner: [] });

    // Sort owner keys where those with null systemId come first
    result.owner.sort((a, b) => {
        // Assume systemId might be null or a string/number; adjust the condition based on its actual type
        return (a.systemId === null ? -1 : 1) - (b.systemId === null ? -1 : 1);
    });

    return result;
};



export const deactivateApiKey = async (apiKeyId: string,  abortSignal = null) => {
    const op = {
        data: {apiKeyId: apiKeyId},
        op: '/deactivate_key'
    };

    const response = await fetch('/api/apikeys/op', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });

    const result = await response.json();

    try {

        if (result.success) {
            return true;
        } else {
            console.error("Error deactivating apikey: ", result.message);
            return false;
        }
    } catch (e) {
        console.error("Error deactivating api key request: ", e);
        return false;
    }
};