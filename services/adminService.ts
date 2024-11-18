

export const updateAdminConfigs = async (configs: any[], abortSignal = null) => {
    const op = {
        op: '/configs/update',
        data: {
            configurations: configs
        },
        method: 'POST'
    };

    const response = await fetch('/api/admin/adminOps', {
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




export const getAdminConfigs = async (abortSignal = null) => {
    const op = {
        op: '/configs/get',
        method: 'GET'
    };

    const response = await fetch('/api/admin/adminOps', {
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


export const getFeatureFlags = async (abortSignal = null) => {
    const op = {
        op: '/feature_flags/get',
        method: 'GET'
    };

    const response = await fetch('/api/admin/adminOps', {
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






export const terminateEmbedding = async (key: any,  abortSignal = null) => {
    const op = {
        data: {object_key: key},
        op: '/terminate',
        method: 'POST'
    };

    const response = await fetch('/api/admin/embeddingOps', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });

    const result = await response.json();

    try {
        return result;
    } catch (e) {
        console.error("Error making post request: ", e);
        return false;
    }
};




export const getInFlightEmbeddings = async (abortSignal = null) => {
    const op = {
        op: '/sqs/get',
        method: 'GET'
    };

    const response = await fetch('/api/admin/embeddingOps', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(op),
        signal: abortSignal,
    });

    const result = await response.json();

    try {
        const resultBody = result ? JSON.parse(result.body || '{}') : {"success": false};
        if (resultBody.success) {
            return resultBody.messages;
        } else {
            return null;
        }
    } catch (e) {
        console.error("Error making post request: ", e);
        return null;
    }
};


export const testEndpoint = async (url: string, key: string, model:string) => {
    try {
      const response = await fetch('/api/admin/testEndpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, key, model }),
      });
  
      const result = await response.json();
      console.log("TEST: ", result )
      return result.success;
    } catch (e) {
      console.error('Error testing endpoint: ', e);
      return false;
    }
  };
  