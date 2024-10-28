export const fetchUserSettings = async (abortSignal = null) => {
    
    const response = await fetch('/api/settings/op' + `?path=${encodeURIComponent("/get")}`, {
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
            console.error("Error getting all settings: ", result);
            return {success: false};
        }
    } catch (e) {
        console.error("Error during settings request: ", e);
        return {success: false};
    }
};



export const saveUserSettings = async (settings: any, abortSignal = null) => {
    const data = {data: {settings: settings}}
    // console.log();

    const response = await fetch('/api/settings/op' + `?path=${encodeURIComponent("/save")}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: abortSignal,
    });

    try {
        const result = await response.json();
        return (result.success) ? result.success : false;
    } catch (e) {
        console.error("Error during settings request: ", e);
        return false;
    }
};
