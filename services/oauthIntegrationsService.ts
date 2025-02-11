import { IntegrationProviders, IntegrationSecretsMap, IntegrationsMap } from "@/types/integrations";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = '/integrations/oauth'; 


// This takes the name of the integration, such as "google_sheets" which will need a corresponding
// client configured in the back-end lambda
export const getOauthRedirect = async (integration:string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/start-auth",
        data: { integration }
    };
    return await doRequestOp(op);
}

export const getUserIntegrations = async (integrations:string[]) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/user/list",
        data: { integrations }
    };
    return await doRequestOp(op);
}

export const deleteUserIntegration = async (integration:string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/user/delete",
        data: { integration }
    };
    const response = await doRequestOp(op);
    if (!response.success) {
        console.log("Error occured with Delete User Integrations: ", response )
        alert("An error occurred. Please try again.");
    }

}


export const checkActiveIntegrations = async (integrations: string[]) => {
    const integrationSecrets: IntegrationSecretsMap = {};
    const availableIntegrations: IntegrationsMap = {};
  
    for (const i of integrations) {
      const op = {

        method: 'GET',
        path: "",
        op: `/${i}/integrations`,
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