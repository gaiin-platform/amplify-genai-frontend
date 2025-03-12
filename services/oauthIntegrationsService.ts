import { IntegrationProviders, IntegrationSecretsMap, IntegrationsMap } from "@/types/integrations";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = '/integrations'; 
const OAUTH_PATH = '/oauth'; 
const SERVICE_NAME = "oauth";

// This takes the name of the integration, such as "google_sheets" which will need a corresponding
// client configured in the back-end lambda
export const getOauthRedirect = async (integration: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH + OAUTH_PATH,
        op: "/start-auth",
        data: { integration },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getConnectedIntegrations = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH + OAUTH_PATH,
        op: "/user/list",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const deleteUserIntegration = async (integration: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH + OAUTH_PATH,
        op: "/user/delete",
        data: { integration },
        service: SERVICE_NAME
    };
    const response = await doRequestOp(op);
    if (!response.success) {
        console.log("Error occured with Delete User Integrations: ", response)
        alert("An error occurred. Please try again.");
    }
    return response.success;

}


export const checkActiveIntegrations = async (integrations: string[]) => {

    const integrationSecrets: IntegrationSecretsMap = {};
    const availableIntegrations: IntegrationsMap = {};
  
    for (const i of integrations) {
      const op = {
        method: 'GET',
        path: "",
        op: `/${i}/integrations`,
        service: SERVICE_NAME
      };
      const response = await doRequestOp(op);
      if (response.success && response.data) {
        const data = response.data;
        availableIntegrations[i as IntegrationProviders] = data.integrations;
        if (data.secrets) integrationSecrets[i as IntegrationProviders] = data.secrets;
      }
    }
  
    return { integrationLists: availableIntegrations, secrets: integrationSecrets};
};


export const getAvailableIntegrations = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/list_supported",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}


export const registerIntegrationSecrets = async (integrationSecrets: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH  + OAUTH_PATH,
        op: "/register_secret",
        data: integrationSecrets,
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}



export const listIntegrationFiles = async (data: any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/user/files",
        data: data,
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}



export const downloadIntegrationFile = async (data:any) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/user/files/download",
        data: data,
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}


