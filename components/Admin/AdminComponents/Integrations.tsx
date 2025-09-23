import { FC, useState } from "react";
import {  titleLabel } from "../AdminUI";
import { AdminConfigTypes} from "@/types/admin";
import { IntegrationsMap, Integration, integrationProviders, IntegrationSecretsMap, IntegrationProviders, IntegrationSecrets} from "@/types/integrations";
import { IconCheck, IconX, IconPlus } from "@tabler/icons-react";
import { capitalize } from "@/utils/app/data";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import InputsMap from "@/components/ReusableComponents/InputMap";
import { translateIntegrationIcon } from "@/components/Integrations/IntegrationsDialog";
import { registerIntegrationSecrets } from "@/services/oauthIntegrationsService";
import toast from "react-hot-toast";

interface Props {
    integrations: IntegrationsMap;
    setIntegrations: (i: IntegrationsMap) => void;

    integrationSecrets: IntegrationSecretsMap;
    setIntegrationSecrets: (s: IntegrationSecretsMap) => void;
    
    updateUnsavedConfigs: (t: AdminConfigTypes) => void; 
}

export const IntegrationsTab: FC<Props> = ({integrations, setIntegrations, integrationSecrets, setIntegrationSecrets, updateUnsavedConfigs}) => {

    const [secretsHasChanges, setSecretsHasChanges] = useState<string[]>([]);
    const [isRegisteringSecrets, setIsRegisteringSecrets] = useState<string>('');

    const handleUpdateIntegrations = (integrationsMap: IntegrationsMap) => {
        setIntegrations(integrationsMap);
        updateUnsavedConfigs(AdminConfigTypes.INTEGRATIONS);
    }

    const registerIntegrationSecret = async (name: string) => {
        setIsRegisteringSecrets(name);
        const secrets = { client_id: getClientSecret(name, "client_id"),
                          client_secret: getClientSecret(name, "client_secret"),
                          integration: name,
                          tenant_id : getClientSecret(name, "tenant_id"), 
                        }

        const result = await registerIntegrationSecrets(secrets);

        if (result.success) {
            setSecretsHasChanges(secretsHasChanges.filter((i: string) => i !== name));
            toast("Successfully registered integration secrets");
        } else {
            alert("Unable to register integrations secrets at this time. Please try again later...");
        }

        setIsRegisteringSecrets("");
    }

    const getLabel = (integration: string) => {
        return integration === integrationProviders.Microsoft ? "Office 365" :  capitalize(integration);
    }

    const toggleIntegrationAvailability = (providerKey: string, integrationId: string) => {
        if (!integrations) return;
        // Create a shallow copy of the integrations map
        const updatedIntegrations = { ...integrations };
        const provider = providerKey as IntegrationProviders;
        // Update the list for the specified provider by toggling the isAvailable property for the matching integration
        updatedIntegrations[provider] = updatedIntegrations[provider]?.map(integration =>
                                                        integration.id === integrationId
                                                            ? { ...integration, isAvailable: !integration.isAvailable }
                                                            : integration
                                                        );
        handleUpdateIntegrations(updatedIntegrations);
      };

    const getClientSecret = (name: string, key: keyof IntegrationSecrets) => {
        const secrets = integrationSecrets[name as IntegrationProviders];
        return secrets ? secrets[key] ?? "" : "";    
    }

    return <div className="admin-style-settings-card">
        <div className="admin-style-settings-card-header">
            <div className="flex flex-row items-center gap-3 mb-2">
                <h3 className="admin-style-settings-card-title">Integrations</h3>
            </div>
            <p className="admin-style-settings-card-description">Configure and manage third-party integrations</p>
        </div>

        {Object.entries(integrations).map(([name, integrationList]: [string, Integration[]]) => 
            <div key={name} className={`ml-4 flex flex-col gap-2 mr-8`}>
                <br></br>
                <ExpansionComponent
                    title={capitalize(name)} 
                    closedWidget={integrationSecrets[name as IntegrationProviders] ? undefined : <IconPlus size={18}/> }
                    content={ <div className="flex flex-col gap-6 mr-6 w-full">
                    <div>
                    {secretsHasChanges.includes(name) &&
                        <div className="h-0 ml-[100px]" style={{transform: 'translateY(-46px)'}}>
                           <button
                           title={'Register Ops'} disabled={!!isRegisteringSecrets}
                           className={`px-4 w-[200px] h-[34px] flex-shrink-0 items-center rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 ${!!isRegisteringSecrets ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
                           onClick={() => registerIntegrationSecret(name)}
                       >
                           {isRegisteringSecrets === name ? "Registering..." : "Register Integration" }
                           </button>
                        </div>
                    }
                    
                    <InputsMap
                        id = {AdminConfigTypes.INTEGRATIONS}
                        obscure={true}
                        inputs={ [ {label: 'Client ID', key: 'client_id', placeholder: `${capitalize(name)} Client ID`},
                                    {label: 'Client Secret', key: 'client_secret', placeholder: `${capitalize(name)} Client Secret`},
                                    {label: 'Tenant ID', key: 'tenant_id', placeholder: `${capitalize(name)} Tenant or Project ID`},
                                ]}
                        state = {{client_id: getClientSecret(name, "client_id"),
                                    client_secret: getClientSecret(name, "client_secret"),
                                    tenant_id:  getClientSecret(name, "tenant_id")
                                }}
                        inputChanged = {(key:string, value:string) => {
                            const updated = {...integrationSecrets[name as IntegrationProviders], [key]: value};
                            setIntegrationSecrets({...integrationSecrets, [name]: updated});
                            if (!secretsHasChanges.includes(name)) setSecretsHasChanges([...secretsHasChanges, name]);
                        }}
                    /> 
                    </div> 
                    
                    { integrationList.map((integration: Integration) =>
                        <div id={integration.id} key={integration.id} className={`ml-4 flex flex-row gap-2 `}>  {/* hover:bg-gray-200 dark:hover:bg-[#40414F] */}
                            <div className="mr-4 ">
                                <div className="flex items-center mb-2">
                                {integration.isAvailable && (<IconCheck className="w-5 h-5 mr-2 text-green-500" /> )}
                                {translateIntegrationIcon(integration.id)} 
                                <span className="ml-2 text-black dark:text-white font-semibold">{`${getLabel(name)} ${integration.name}`}</span>
                                </div> 
                                <p className="text-sm text-gray-600 dark:text-gray-300">{integration.description}</p>
                            </div>

                            { getClientSecret(name, "client_id") && getClientSecret(name, "client_secret") &&
                            <button 
                                className={`w-[160px] max-h-[40px] truncate ml-auto mr-2 mt-2 py-1 px-3 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 hover:dark:bg-gray-700 rounded transition-colors duration-100 cursor-pointer flex flex-row gap-2 items-center`}
                                onClick={() => toggleIntegrationAvailability(name, integration.id)}
                                title={`${integration.name} Integration`}
                                >
                                {integration.isAvailable ? <IconX className="text-red-500" size={18}/>
                                : <IconPlus className="text-blue-400" size={18}/> }
                                {integration.isAvailable ? 'Remove Support' : 'Support'}
                                    
                            </button>}

                        </div>

                    )}
                </div>}
                />
                <br className="mb-4"></br>
            </div>
        )}
    </div>

}