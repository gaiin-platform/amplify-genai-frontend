

const doOp = async (op:string, data:any) => {
    try {
        const response = await fetch('/api/integrations/op', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: null,
            body: JSON.stringify({ data, op }),
        });

        if (response.ok) {
            try {
                const result = await response.json();
                return result;
            } catch (e) {
                return { success: false, message: "Error parsing response from oauth integration op." };
            }
        } else {
            return { success: false, message: `Error calling oauth integration op: ${response.statusText}.` }
        }
    } catch (error) {
        return { success: false, message: `Network error in oauth integration op: ${error}` };
    }
}

// This takes the name of the integration, such as "google_sheets" which will need a corresponding
// client configured in the back-end lambda
export const getOauthRedirect = async (integration:string) => {
    return await doOp('start-auth', { integration });
}

export const getUserIntegrations = async (integrations:string[]) => {
    return await doOp('user/list', { integrations });
}

export const deleteUserIntegration = async (integration:string) => {
    try{
        return await doOp('user/delete', { integration });
    } catch (e) {
        console.error("Error deleting user integration: ", e);
        alert("An error occurred. Please try again.");
    }

}