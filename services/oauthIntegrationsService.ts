import { IntegrationProviders, IntegrationSecretsMap, IntegrationsMap } from "@/types/integrations";
import { doRequestOp } from "./doRequestOp";
import { createTtlCache } from "./inFlight";

const URL_PATH = '/integrations'; 
const OAUTH_PATH = '/oauth'; 
const SERVICE_NAME = "oauth";

// Reads on the hot, repeatedly-remounted paths (the + menu's connector submenu, the assistant
// editor's tools panel, op filtering) opt in with `{ cached: true }`. Management screens and the
// post-OAuth polling keep asking the backend directly. The supported list is deployment
// configuration and barely changes; the connected list is per-user and changes when the user
// connects or disconnects, so it expires quickly and is dropped on those actions.
const SUPPORTED_TTL_MS = 5 * 60 * 1000;
const CONNECTED_TTL_MS = 30 * 1000;
const supportedCache = createTtlCache<any>(SUPPORTED_TTL_MS);
const connectedCache = createTtlCache<any>(CONNECTED_TTL_MS);

export interface IntegrationReadOptions {
    /** Serve from a short-lived shared copy instead of always hitting the backend. */
    cached?: boolean;
}

// This takes the name of the integration, such as "google_sheets" which will need a corresponding
// client configured in the back-end lambda
export const getOauthRedirect = async (integration: string, providerSettings?: any) => {
    connectedCache.invalidate();
    const op = {
        method: 'POST',
        path: URL_PATH + OAUTH_PATH,
        op: "/start-auth",
        data: {
            integration,
            ...(providerSettings && { provider_settings: providerSettings })
        },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

const fetchConnectedIntegrations = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH + OAUTH_PATH,
        op: "/user/list",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getConnectedIntegrations = async (options?: IntegrationReadOptions) => {
    if (options?.cached) return connectedCache.get(fetchConnectedIntegrations);
    const result = await fetchConnectedIntegrations();
    connectedCache.set(result);
    return result;
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
    connectedCache.invalidate();
    if (!response.success) {
        console.log("Error occured with Delete User Integrations: ", response)
        alert("An error occurred. Please try again.");
    }
    return response.success;

}


export const checkActiveIntegrations = async (integrations: string[]) => {

    const integrationSecrets: IntegrationSecretsMap = {};
    const availableIntegrations: IntegrationsMap = {};
  
    // Make all API calls in parallel
    const promises = integrations.map(i => {
      const op = {
        method: 'GET',
        path: "",
        op: `/${i}/integrations`,
        service: i
      };
      return doRequestOp(op).then(response => ({ integration: i, response }));
    });

    const results = await Promise.all(promises);
    
    // Process results
    results.forEach(({ integration, response }) => {
      if (response.success && response.data) {
        const data = response.data;
        availableIntegrations[integration as IntegrationProviders] = data.integrations;
        if (data.secrets) integrationSecrets[integration as IntegrationProviders] = data.secrets;
      }
    });
  
    return { integrationLists: availableIntegrations, secrets: integrationSecrets};
};


const fetchAvailableIntegrations = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/list_supported",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getAvailableIntegrations = async (options?: IntegrationReadOptions) => {
    if (options?.cached) return supportedCache.get(fetchAvailableIntegrations);
    const result = await fetchAvailableIntegrations();
    supportedCache.set(result);
    return result;
}


export const registerIntegrationSecrets = async (integrationSecrets: any) => {
    supportedCache.invalidate();
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


