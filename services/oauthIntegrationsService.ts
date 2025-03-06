
import { doRequestOp } from "./doRequestOp";

const URL_PATH = '/integrations/oauth';
const SERVICE_NAME = "oauth";

// This takes the name of the integration, such as "google_sheets" which will need a corresponding
// client configured in the back-end lambda
export const getOauthRedirect = async (integration: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/start-auth",
        data: { integration },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getUserIntegrations = async (integrations: string[]) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/user/list",
        data: { integrations },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const deleteUserIntegration = async (integration: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/user/delete",
        data: { integration },
        service: SERVICE_NAME
    };
    const response = await doRequestOp(op);
    if (!response.success) {
        console.log("Error occured with Delete User Integrations: ", response)
        alert("An error occurred. Please try again.");
    }

}
