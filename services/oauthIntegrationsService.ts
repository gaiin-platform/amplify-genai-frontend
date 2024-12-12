

export const getUserIntegrations = async (integrations: string[]) => {
    return [
        "google_sheets"
    ];
}

// This takes the name of the integration, such as "google_sheets" which will need a corresponding
// client configured in the back-end lambda
export const getOauthRedirect = async (integration:string) => {
    try {
        const response = await fetch('/api/integrations/op', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: null,
            body: JSON.stringify({ data: { integration } }),
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
