



export const getArtifact = async (artifactKey: string, abortSignal = null) => {
    
    const response = await fetch('/api/artifacts/getDeleteOps' + `?artifactKey=${encodeURIComponent(artifactKey)}&path=${encodeURIComponent("/get")}`, {
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
        console.error("Error making get artifact request: ", e);
        return {success: false};
    }
};


export const getAllArtifacts = async (abortSignal = null) => {
    
    const response = await fetch('/api/artifacts/getDeleteOps' + `?path=${encodeURIComponent("/get_all")}`, {
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
            console.error("Error getting all artifacts: ", result.message);
            return {success: false};
        }
    } catch (e) {
        console.error("Error during get all artifacts request: ", e);
        return {success: false};
    }
};



export const deleteArtifact = async (artifactKey: string, abortSignal = null) => {
    
    const response = await fetch('/api/artifacts/getDeleteOps' + `?artifactKey=${encodeURIComponent(artifactKey)}&path=${encodeURIComponent("/delete")}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();
    try {
        if (result.success) {
            return true;
        } else {
            console.error("Error deleting artifact: ", result.message);
            return false;
        }
    } catch (e) {
        console.error("Error during delete artifacts request: ", e);
        return false;
    }
};




export const saveArtifact = async (artifactData: any,  abortSignal = null) => {
    const op = {
        data: {
            artifact: artifactData
        },
        op: '/save'
    };

    const response = await fetch('/api/artifacts/ops', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });
    try {
        const result = await response.json();
        console.log(result);
        return 'success' in result ? result : {"success":false, "message" : "Unkown Internal Error"};
    } catch (e) {
        console.error("Error making post request: ", e);
        return {"success": false, "message": "Unkown Internal Error"};
    }
};


export const shareArtifact = async (artifactData: any,  emailList: string[], abortSignal = null) => {
    const op = {
        data: {
            artifact: artifactData,
            shareWith: emailList
        },
        op: '/share'
    };

    const response = await fetch('/api/artifacts/ops', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });

    const result = await response.json();

    try {
        return 'success' in result ? result : {"success":false, "message" : "Unkown Internal Error"};
    } catch (e) {
        console.error("Error making post request: ", e);
        return {"success": false, "message": "Unkown Internal Error"};
    }
};

