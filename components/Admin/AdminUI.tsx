import { useSession } from "next-auth/react";
import { FC, RefObject, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../ReusableComponents/Modal";
import HomeContext from "@/pages/api/home/home.context";
import FlagsMap from "../ReusableComponents/FlagsMap";
import InputsMap from "../ReusableComponents/InputMap";
import { getAdminConfigs, getInFlightEmbeddings, terminateEmbedding, testEndpoint, updateAdminConfigs } from "@/services/adminService";
import { AdminConfigTypes, Embedding, EmbeddingsConfig, Endpoint, FeatureFlagConfig, OpenAIModelsConfig } from "@/types/admin";
import ExpansionComponent from "../Chat/ExpansionComponent";
import { IconCheck, IconPlus, IconRefresh, IconReload, IconTrash, IconX } from "@tabler/icons-react";
import { EmailsAutoComplete } from "../Emails/EmailsAutoComplete";
import { fetchEmailSuggestions } from '@/services/emailAutocompleteService';
import { LoadingIcon } from "../Loader/LoadingIcon";
import Checkbox from "../ReusableComponents/CheckBox";
import { userFriendlyDate } from "@/utils/app/date";
import toast from "react-hot-toast";
import { ModelID, Models } from "@/types/model";
import React from "react";
import { InfoBox } from "../ReusableComponents/InfoBox";
import { ActiveTabs } from "../ReusableComponents/ActiveTabs";

interface Props {
    open: boolean;
    onClose: () => void;
}

export const AdminUI: FC<Props> = ({ open, onClose }) => {
    const { state: { featureFlags, statsService, syncingPrompts}, dispatch: homeDispatch, setLoadingMessage } = useContext(HomeContext);
    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const [loadData, setLoadData] = useState<boolean>(true);  
    const [isLoading, setIsLoading] = useState<boolean>(true);  

    const [admins, setAdmins] = useState<string[]>([]);  
    const [allEmails, setAllEmails] = useState<Array<string> | null>(null);

    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [deleteUsersList, setDeleteUsersList] = useState<string[]>([]);
    const [hoveredUser, setHoveredUser] = useState<string | null>(null);

    const [features, setFeatures] = useState<FeatureFlagConfig>({}); 
    const [hoveredException, setHoveredException] = useState<{ feature: string; username: string } | null>(null);
    const [addingExceptionTo, setAddingExceptionTo] = useState<string | null>(null);

    const [appVars, setAppVars] = useState<{ [key: string]: string }>({});    
    const [appSecrets, setAppSecrets] = useState<{ [key: string]: string }>({});  
    const [refreshingTypes, setRefreshingTypes] = useState< AdminConfigTypes[]>([]);
    const [reloadingTypes, setReloadingTypes] = useState< AdminConfigTypes[]>([]);

    const  AVAILABLE_MODELS = 'AVAILABLE_MODELS';

    const [openAiEndpoints, setOpenAiEndpoints] = useState<OpenAIModelsConfig>({models: []}); 
    const [isDeletingEndpoint, setIsDeletingEndpoint] = useState<string | null>(null);
    const [deleteEndpointsList, setDeleteEndpointsList] = useState<number[]>([]);
    const [hoveredEndpoint, setHoveredEndpoint] = useState<{ model: string; index: number } | null>(null);
    // const [testEndpoints, setTestEndpoints] = useState<{ url: string; key: string, model:string}[]>([
    //     {url: "https://vu-ai-gpt-east.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-02-15-preview",key: "25aad0c8e1604dca8a78fa28180cb57a",model: "gpt-4o-mini"}
    // ]);

    const [testEndpoints, setTestEndpoints] = useState<{ url: string; key: string, model:string}[]>([]);

    const [embeddings, setEmbeddings] = useState<EmbeddingsConfig>({embeddings: []});  
    const [hasRetrievedEmbeddings, setHasRetrievedEmbeddings] = useState<boolean>(false);
    const [loadingEmbeddings, setLoadingEmbeddings] = useState<boolean>(false);
    const [terminatingEmbeddings, setTerminatingEmbeddings] = useState<string[]>([]);



    const [unsavedConfigs, setUnsavedConfigs] = useState<Set<AdminConfigTypes>>(new Set());

    useEffect(() => {
       
        const getConfigs = async () => {
            setLoadData(false);
                //   statsService.openSettingsEvent(); 
            setLoadingMessage("Loading Admin Interface...");
            const result = await getAdminConfigs();
            console.log(result)
            if (result.success) {
                const data = result.data;
                console.log(result.data);
                setAdmins(data[AdminConfigTypes.ADMINS] || []);
                setFeatures(data[AdminConfigTypes.FEATURE_FLAGS] || {});
                setAppVars(data[AdminConfigTypes.APP_VARS] || {});
                setAppSecrets(data[AdminConfigTypes.APP_SECRETS] || {});
                setOpenAiEndpoints(data[AdminConfigTypes.OPENAI_ENDPONTS] || { models: [] });

            } else {
                alert("Unable to fetch admin configurations at this time. Please try again.");
                onClose();
            }
        
            setLoadingMessage("");
            setIsLoading(false);
        }
        if (open && loadData) getConfigs();

        const fetchEmails = async () => {
            const emailSuggestions =  await fetchEmailSuggestions("*");
            setAllEmails(emailSuggestions.emails ? [...emailSuggestions.emails] : []);
        };
        if (!allEmails) fetchEmails();
      
      }, [open])
  
//

    function camelToTitleCase(str: string) {
        return str
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lowercase and uppercase letters
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // Keep consecutive uppercase letters together
            .replace(/^./, char => char.toUpperCase()); // Capitalize the first letter
    }
    
    const handleGetEmbeddings = async () => {
        setLoadingEmbeddings(true);
        const resultData = await getInFlightEmbeddings();
        if (resultData) {
            setHasRetrievedEmbeddings(true);
            setEmbeddings({ embeddings:
                resultData as Embedding[]});
        } else {
            alert("Unable to retrieve message currently in the sqs. Please try again later...");
        }
        // setTimeout(() => {
        //     setEmbeddings({ embeddings: [{
        //         "messageId": "1b657cb5-d3c7-446e-bbc3-411ae23ba421",
        //         "eventTime": "2024-11-04T16:49:13.332Z",
        //         "object": {
        //             "key": "global/fed53a723104fb82a77c92b3dd1641b7f5a190d666df98a2e521cb724d01f6ee.content.json-1.chunks.json",
        //             "size": 813,
        //             "user" : "Karely.rodriguez@vanderbilt.edu"
        //         }
        //     }, 
        //     {
        //         "messageId": "1b657cb5-d3c7-23ba421",
        //         "eventTime": "2024-11-04T16:49:13.332Z",
        //         "object": {
        //             "key": "global/fed53a723104fb82a77c92b663dd1641b7f5a190d666df98a2e521cb724d01f6ee.content.json-1.chunks.json",
        //             "size": 813,
        //             "user" : "Allen.Karns@vanderbilt.edu"

        //         },
        //         terminated: true
        //     }
        //     ] as Embedding[]} );
        //     setHasRetrievedEmbeddings(true);
        //     setLoadingEmbeddings(false); 
        //     setRefreshingTypes(refreshingTypes.filter(t => t !== AdminConfigTypes.EMBEDDINGS));
        // }, 1500)

        setLoadingEmbeddings(false);
        setRefreshingTypes(refreshingTypes.filter(t => t !== AdminConfigTypes.EMBEDDINGS));
    }

    const handleTerminateEmbedding = async (key: string) => {
        if (!terminatingEmbeddings.includes(key)) setTerminatingEmbeddings([...terminatingEmbeddings, key]);

        const result = await terminateEmbedding(key);
        if (result) {
            setEmbeddings((prevState) => ({
                embeddings: prevState.embeddings.map((embedding) =>
                    embedding.object.key === key
                        ? { ...embedding, terminated: true } // Set terminate flag to true
                        : embedding
                ),
            }));
        } else {
            alert("Unable to terminate embedding at this time.");
        }
        setTerminatingEmbeddings(terminatingEmbeddings.filter((k:string) => k !== key));
    }
    
    const getConfigTypeData = (type: AdminConfigTypes) => {
        switch (type) {
            case AdminConfigTypes.ADMINS:
                return admins;
            case AdminConfigTypes.APP_SECRETS:
                return appSecrets;
            case AdminConfigTypes.APP_VARS:
                return appVars;
            case AdminConfigTypes.FEATURE_FLAGS:
                return features;
            case AdminConfigTypes.OPENAI_ENDPONTS:
                const toTest:{key: string, url: string, model:string}[] = [];
                const cleanedOpenAiEndpoints: OpenAIModelsConfig = {
                    models: openAiEndpoints.models.map(model => {
                        const newModel: Record<string, { endpoints: Endpoint[] }>= {};
                        Object.keys(model).forEach(modelName => {
                            const endpoints = model[modelName].endpoints.map(endpoint => {
                                // Destructure to exclude 'isNew' from the endpoint
                                const { isNew, ...rest } = endpoint;
                                if (isNew) toTest.push({...rest, model: modelName});
                                return rest; 
                            });
                            newModel[modelName] = { endpoints };
                        });
                        return newModel;
                    })
                };
                if (toTest.length > 0) setTestEndpoints(toTest);
                return cleanedOpenAiEndpoints;
        }   
    }


    const callTestEndpoints = async () => {
        for (const endpoint of testEndpoints) {
          const label = `Url: ${endpoint.url}\nKey: ${endpoint.key}`;
          setLoadingMessage(`Testing Endpoint:\n${label}`);
          const result = await testEndpoint(endpoint.url, endpoint.key, endpoint.model);
          if (!result) {
            alert(`Failed to make contact with the new endpoint:\n${label}\n\nPlease check the endpoint data and try saving changes again.`);
            setLoadingMessage(``);
            return false;
          }
        }
        return true;
      };
      

    const handleSave = async () => {
        const collectUpdateData =  Array.from(unsavedConfigs).map((type: AdminConfigTypes) => ({type: type, data: getConfigTypeData(type)}));
        console.log("Saving... ", collectUpdateData);

        if (testEndpoints.length > 0) {
            setLoadingMessage('Testing New Endpoints...');
            const success = await callTestEndpoints();
            if (!success) {
                setLoadingMessage('');
                return;
            }
        }
        
        setLoadingMessage('Saving Configurations');
        const result = await updateAdminConfigs(collectUpdateData);
        console.log(result)
        if (result.success) {
            if (unsavedConfigs.has(AdminConfigTypes.FEATURE_FLAGS)) homeDispatch({ field: 'featureFlags', value: features });
            if (unsavedConfigs.has(AdminConfigTypes.APP_VARS)) homeDispatch({ field: 'models', value: appVars[AVAILABLE_MODELS] })
            toast("Configurations successfully saved");
            setUnsavedConfigs(new Set());
            setTestEndpoints([]);
            onClose();
        } else {
            if (result.data && Object.keys(result.data).length !== unsavedConfigs.size) {
                const unsucessful: AdminConfigTypes[] = [];
                Array.from(unsavedConfigs).forEach(key => {
                    if ((!(key in result.data)) || (!result.data[key].success)) unsucessful.push(key);
                });
                // should always be true
                if (unsucessful.length > 0) alert(`The following configurations were unable to be saved: \n${unsucessful}`);
            } else {
                alert("We are unable to save the configurations at this time. Please try again later...");
            }
        }

        setLoadingMessage('');
    }

    // not be in use
    const handleContainerVarReload = (type: AdminConfigTypes, vars: { [key: string]: string }) => {
        // 
        setReloadingTypes(refreshingTypes.filter(t => t !== type));
    }

    const handleUpdateAdmins = (updatedAdmins: string[]) => {
        setAdmins(updatedAdmins);
        setUnsavedConfigs(prevChanges => new Set(prevChanges).add(AdminConfigTypes.ADMINS));
    }

    const handleUpdateEndpoints = (updatedModels: OpenAIModelsConfig) => {
        setOpenAiEndpoints(updatedModels);
        setUnsavedConfigs(prevChanges => new Set(prevChanges).add(AdminConfigTypes.OPENAI_ENDPONTS));
    }
    
    const handleUpdateFeatureFlags = (featureName:string, updatedData: {enabled: boolean, userExceptions?: string[]}) => {
        setFeatures({
            ...features,
            [featureName]: updatedData,
        });
        setUnsavedConfigs(prevChanges => new Set(prevChanges).add(AdminConfigTypes.FEATURE_FLAGS));
    }

    const titleLabel = (title: string, textSize: string = "lg") => 
        <div className={`mt-4 text-${textSize} font-bold text-black dark:text-neutral-200`}>
            {title}
        </div>;

    const refresh = (type: AdminConfigTypes, click: () => void, loading: boolean, title:string = 'Refresh Variables', top: string = 'mt-1') => 
        <button
            title={title}
            disabled={refreshingTypes.includes(type)} 
            className={`${top} flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 dark:text-white transition-colors duration-200 ${refreshingTypes.includes(type) ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
            onClick={() => {
                setRefreshingTypes([...refreshingTypes, type]);
                click();
            }}
        >
            {refreshingTypes.includes(type) ?  <LoadingIcon style={{ width: "16px", height: "16px" }}/> : <IconRefresh size={16}/>}
        </button>
    
    const reloadVars = (type: AdminConfigTypes, vars: { [key: string]: string }) => 
        <button
            title={'Update Variables in the Container'}
            className={`mt-1 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 dark:text-white transition-colors duration-200 ${reloadingTypes.includes(type) ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
            onClick={() => {
                setReloadingTypes([...refreshingTypes, type]);
                toast("Updating Variables in the Container...");
                // call function to reload vars 
                handleContainerVarReload(type, vars);
            }}
        >
            {reloadingTypes.includes(type) ?  <LoadingIcon style={{ width: "16px", height: "16px" }}/> : <IconReload size={16}/>}
        </button>
    
    const hangleChangeAvailableModels = (isChecked: boolean, id: string) => {
        let updatedModels = appVars[AVAILABLE_MODELS].split(',');
        if (isChecked) {
            if (!updatedModels.includes(id)) updatedModels.push(id);
        } else {
            updatedModels = updatedModels.filter((m: string) => m !== id);
        }
        setAppVars({...appVars, [AVAILABLE_MODELS]: updatedModels.join(',')});
        setUnsavedConfigs(prevChanges => new Set(prevChanges).add(AdminConfigTypes.APP_VARS));
    }
        
    if (!open || isLoading) return <></>;

    return <Modal 
    width={() => window.innerWidth - 100}
    height={() => window.innerHeight * 0.95}
    title={`Admin Interface${unsavedConfigs.size > 0 ? " * " : ""}`}
    onCancel={() => {
        if (unsavedConfigs.size === 0 || confirm("You have unsaved changes!\n\nYou will lose any unsaved data, would you still like to close the Admin Interface?"))  onClose();
       
    }} 
    onSubmit={() => handleSave()
    }
    submitLabel={"Save Changes"}
    content={
      <div className="text-black dark:text-white overflow-x-hidden">
         <ActiveTabs
            tabs={[
                {label: `Configurations${unsavedConfigs.size > 0 ? " * " : ""}`, 
                 title: unsavedConfigs.size > 0 ? " Contains Unsaved Changes  " : "",
                 content:
                // Configurations Tab
                    <> 
                    {titleLabel('Admins')}
                    <div className="ml-10 flex flex-col gap-6 mt-2">
                            <div className="relative z-10 flex flex-row gap-2.5 h-0" style={{ transform: `translateX(160px)` }}>
                                {admins.length > 0 &&
                                <button onClick={ () => setIsDeleting(true)} style={{ display: 'flex', cursor: 'pointer' }}
                                    className="flex flex-shrink-0"
                                    title={"Remove Admins"}
                                    >
                                    <IconTrash className="mt-0.5" size={15}/>
                                    <span style={{marginLeft: '10px'}}>{"Remove Admins"}</span>
                                </button>}

                                {isDeleting && 
                                <>
                                    <UserAction
                                        label={"Remove Admins"}
                                        onConfirm={() => {
                                            if (deleteUsersList.length > 0) {
                                                const updatedAdmins = admins.filter(admin => !deleteUsersList.includes(admin));
                                                handleUpdateAdmins(updatedAdmins);
                                            }
                                        }}
                                        onCancel={() => {
                                            setIsDeleting(false);
                                            setDeleteUsersList([]);
                                        }}
                                        top="mt-[2px]"
                                    />
                                    <div className="mt-[-2px]">
                                        <Checkbox
                                            id={`selectAll${AdminConfigTypes.ADMINS}`}
                                            label=""
                                            checked={deleteUsersList.length === admins.length}
                                            onChange={(isChecked: boolean) => {
                                                if (isChecked) {
                                                    // If checked, add all user names to the list
                                                    setDeleteUsersList(admins.map((a:string) => a));
                                                } else {
                                                    setDeleteUsersList([]);
                                                }
                                            }}
                                        />
                                    </div>
                                </>
                                }
                            </div>
                            <div className='w-full pr-20 relative min-w-[300px]'
                                style={{ transform: `translateY(-24px)` }}>

                                <ExpansionComponent 
                                    title={'Add Admins'} 
                                    content={ 
                                        <AddEmailWithAutoComplete
                                        key={AdminConfigTypes.ADMINS}
                                        emails={admins}
                                        allEmails={allEmails ?? []}
                                        handleUpdateEmails={(updatedAdmins: Array<string>) => handleUpdateAdmins(updatedAdmins)}
                                        />
                                    }
                                    closedWidget= { <IconPlus size={18} />}
                                />

                            </div>

                    </div>
                        
                    <div className="ml-10 pr-5 ">
                    
                        {admins.length === 0 ? (
                                <div className="ml-4">No admins to display</div>
                            ) : (
                                <div className="flex flex-wrap ">
                                {admins
                                    .map((user, index) => (
                                    <div key={index} className="border border-neutral-500 flex items-center">
                                        <div
                                        className="flex items-center"
                                        onMouseEnter={() => setHoveredUser(user)}
                                        onMouseLeave={() => setHoveredUser(null)}
                                        >
                                        <div className="min-w-[28px] flex items-center ml-2">
                                        {hoveredUser === user && !isDeleting && (
                                            <button
                                            type="button"
                                            className="p-0.5 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                            onClick={() => handleUpdateAdmins(admins.filter((u: string) => u !== user))}
                                            >
                                            <IconTrash size={16} />
                                            </button>
                                        )}
                                            {isDeleting && (
                                            <div className="ml-0.5">
                                                <Checkbox
                                                    id={`${index}${AdminConfigTypes.ADMINS}`}
                                                    label=""
                                                    checked={deleteUsersList.includes(user)}
                                                    onChange={(isChecked: boolean) => {
                                                        if (isChecked) {
                                                            setDeleteUsersList((prevList) => [...prevList, user]);
                                                } else {
                                                    setDeleteUsersList((prevList) =>
                                                    prevList.filter((name) => name !== user)
                                                    );
                                                }
                                                    }}
                                                />
                                            </div>
                                            )}
                                        </div>
                                        <span className="truncate pr-8 py-2 mr-1">{user}</span>
                                    
                                        </div>
                                    </div>
                                    ))}
                            </div>)}

                    </div>

                    {titleLabel('Feature Flags')}
                    <div className="ml-4 mt-2">
                        <ExpansionComponent 
                            title={'Manage Features'} 
                            content={ 
                                <div className="mr-5 pr-4">
                                <InfoBox 
                                content={
                                    <span className="text-xs w-full text-center"> 
                                        When the feature is Enabled, it is active for everyone except the users listed under User Exceptions; when Disabled, the feature is inactive for everyone except those users, who will still have access.
                                    </span>
                                }
                                />
                                <table className="mt-4 border-collapse w-full" style={{ tableLayout: 'fixed' }}>
                                    <thead>
                                    <tr className="bg-gray-200 dark:bg-[#373844] ">
                                        {['Feature', 'Status', 'User Exceptions'].map((title, index) => (
                                        <th key={index}
                                            className="text-center p-0.5 border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                            style={{
                                            width:
                                                index === 0
                                                ? '22%' // Feature column takes as much space as needed
                                                : index === 1
                                                ? '150px' // Fixed width for the Status button column
                                                : 'auto', // User Exceptions column takes remaining space
                                            }}
                                        >
                                            {title}
                                        </th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {Object.entries(features).map(([featureName, featureData]) => (
                                        <tr key={featureName}>
                                            {/* Feature Name Column */}
                                            <td className="border border-neutral-500 px-4 py-2">
                                                <span className="text-[0.95rem]">{camelToTitleCase(featureName)}</span>
                                            </td>

                                            {/* Status Button Column */}
                                            <td className="border border-neutral-500 px-8 py-2 text-center">
                                                <button
                                                className={`px-2 py-1 rounded ${
                                                    featureData.enabled
                                                    ? 'text-green-500 hover:text-green-600'
                                                    : 'text-red-600 hover:text-red-700'
                                                }`}
                                                title={featureData.enabled ? 'Disable' : 'Enable'}
                                                onClick={() => {
                                                    // Toggle feature enabled state
                                                    handleUpdateFeatureFlags(featureName, {
                                                    ...featureData,
                                                    enabled: !featureData.enabled,
                                                    });
                                                }}
                                                >
                                                {featureData.enabled ? 'Enabled' : 'Disabled'}
                                                </button>
                                            </td>

                                            {/* User Exceptions Column */}
                                            <td className="border border-neutral-500 pl-1 pr-2">
                                                <div className={`flex items-center ${addingExceptionTo === featureName ? "flex-col":'flex-row'}`}>
                                                {/* User Exceptions List */}
                                                <div
                                                    className={`flex items-center ${addingExceptionTo === featureName ? "flex-wrap w-full": "overflow-x-auto"}`}
                                                    style={{ maxWidth: '100%' }}
                                                >
                                                    {featureData.userExceptions?.map((user, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 mr-1"
                                                        onMouseEnter={() => setHoveredException({ feature: featureName, username: user })}
                                                        onMouseLeave={() => setHoveredException(null)}>
                                                        
                                                        <span className="flex flex-row gap-1 py-2 mr-4"> {idx > 0 && <label className="opacity-60">|</label>}
                                                            <button
                                                            className={`text-red-500 hover:text-red-800
                                                                        ${hoveredException?.feature === featureName && 
                                                                        hoveredException?.username === user ? "opacity-100" : "opacity-0"}`}
                                                            onClick={() => {
                                                                // Remove user from exceptions
                                                                const updatedExceptions = featureData.userExceptions?.filter(
                                                                (u) => u !== user
                                                                );
                                                                handleUpdateFeatureFlags(featureName, {
                                                                ...featureData,
                                                                userExceptions: updatedExceptions,
                                                                });
                                                            }}
                                                            >
                                                            <IconTrash size={16} />
                                                            </button>

                                                            {user} 
                                                        </span>
                                                    </div>
                                                    ))}
                                                </div>

                                                {/* Add Exception Input or Button */}
                                                {addingExceptionTo === featureName ? (
                                                    <div className="px-3 ml-2 mt-2" style={{ width: '100%' }}>
                                                        
                                                    <AddEmailWithAutoComplete
                                                        key={AdminConfigTypes.FEATURE_FLAGS}
                                                        emails={featureData.userExceptions ?? []}
                                                        allEmails={allEmails ?? []}
                                                        handleUpdateEmails={(updatedExceptions: Array<string>) => {
                                                        handleUpdateFeatureFlags(featureName, {
                                                            ...featureData,
                                                            userExceptions: updatedExceptions,
                                                        });
                                                        // setAddingExceptionTo(null);
                                                        }}
                                                    />
                                                    </div>
                                                ) : (
                                                    <button
                                                    className="ml-auto flex items-center px-2 text-blue-500 hover:text-blue-600 flex-shrink-0"
                                                    onClick={() => {
                                                        setAddingExceptionTo(featureName);
                                                    }}
                                                    >
                                                    <IconPlus size={18} />
                                                    {!(featureData.userExceptions && featureData.userExceptions.length > 0) && (
                                                        <span>Add Exceptions</span>
                                                    )}
                                                    </button>
                                                )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                </div>
                            
                            }
                            isOpened={true}
                        />
                    </div>

                    
                    <div className="flex flex-row gap-4">
                        {titleLabel('Embeddings Circuit Breaker')}
                        {refresh(AdminConfigTypes.EMBEDDINGS, () => {
                            setHasRetrievedEmbeddings(false);
                            handleGetEmbeddings()}, false, "Retrieve Embeddings", "mt-2")} 
                    </div>

                    {hasRetrievedEmbeddings ? 
                        <div className="mx-10 max-w-full mt-4 ">
                            {embeddings.embeddings.length > 0 ? 
                            <table className="border-collapse w-full" style={{ tableLayout: 'fixed' }}>
                                <thead>
                                    <tr className="bg-gray-200 dark:bg-[#373844] text-center">
                                        {["Message ID", "Event Time", "User", "Key", "Size", "Terminate"].map((i, index) => (
                                            <th
                                                key={i}
                                                className="p-0.5 border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                                style={{width:
                                                        i === "Message ID" ? "18%"
                                                            : i === "Event Time" ? "12%"
                                                            : i === "User" ? "25%"
                                                            : i === "Key" ? "28%"
                                                            : i === "Size" ? "8%"
                                                            : "10%", // terminated
                                                }}>
                                                {i}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {embeddings.embeddings.map((embedding: Embedding) => (
                                        <tr key={embedding.messageId}>
                                            <td className="border border-neutral-500 px-4 py-2 break-words">
                                                {embedding.messageId}
                                            </td>
                                            <td className="border border-neutral-500 px-4 py-2 text-center break-words">
                                                {userFriendlyDate(embedding.eventTime)}
                                            </td>
                                            <td className="border border-neutral-500 px-4 py-2 text-center">
                                                {embedding.object.user}
                                            </td>
                                            <td className="border border-neutral-500 px-4" style={{ overflow: 'hidden' }}>
                                                <div className="overflow-x-auto py-4" style={{ whiteSpace: 'nowrap' }}>
                                                    {embedding.object.key}
                                                </div>
                                            </td>
                                            <td className="border border-neutral-500 px-2 py-2 text-center">
                                                {embedding.object.size}
                                            </td>
                                            <td className="border border-neutral-500 py-2 text-center">
                                                <button
                                                    className={` ${
                                                        embedding.terminated || terminatingEmbeddings.includes(embedding.object.key) 
                                                                            ? 'text-red-600' : 'hover:text-red-800'
                                                    }`}
                                                    disabled={embedding.terminated || terminatingEmbeddings.includes(embedding.object.key)}
                                                    title={embedding.terminated ? '' : 'Terminate'}
                                                    onClick={() => {
                                                        handleTerminateEmbedding(embedding.object.key);
                                                    }}
                                                >
                                                    {embedding.terminated ? 'Terminated' 
                                                                        : terminatingEmbeddings.includes(embedding.object.key) 
                                                                        ? 'Terminating...' :'Terminate'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table> : <>No Embeddings Currently Found in the SQS.</>}
                        </div>
                        : 
                        ( loadingEmbeddings?
                            <label className="flex flex-row items-center ml-6  mt-2 py-1 px-2"> 
                                    <LoadingIcon style={{ width: "16px", height: "16px" }}/>
                                    <span className="ml-2 text-white">{'Loading Embeddings...'}</span>
                                
                            </label>
                        :
                        <button 
                            className="ml-8 mt-2 py-1 px-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 hover:dark:bg-gray-700 mr-[-16px] rounded transition-colors duration-100 cursor-pointer" 
                            onClick={() => {
                                handleGetEmbeddings();
                                }}
                            title="Retrieve in-flight embeddings"
                            >
                            {"Retrieve SQS Embeddings"}
                                
                        </button>)
                    }


                    {titleLabel('Secrets Manager')}


                    <div className="ml-8 pr-10">
                        <div className="flex flex-row gap-3">
                            {titleLabel('Application Secrets', "[1.05rem]")}
                            {refresh(AdminConfigTypes.APP_SECRETS, () => {}, false)}
                            {/* {reloadVars(AdminConfigTypes.APP_SECRETS, appSecrets)} */}
                        </div>
                        <div className="mx-10">
                            <InputsMap
                            id = {AdminConfigTypes.APP_SECRETS}
                            inputs={Object.keys(appSecrets).sort((a, b) => b.length - a.length)
                                        .map((secret: string) => {return {label: secret, key: secret, defaultValue:  appSecrets[secret]}})}
                            state = {appSecrets}
                            inputChanged = {(key:string, value:string) => {
                                setAppSecrets({...appSecrets, [key]: value});
                                setUnsavedConfigs(prevChanges => new Set(prevChanges).add(AdminConfigTypes.APP_SECRETS));
                            }}

                            />    
                        </div>     

                        <div className="flex flex-row gap-3 mt-4">
                            {titleLabel('Application Environment Variables', "[1.05rem]")}
                            {refresh(AdminConfigTypes.APP_VARS, () => {}, false)}
                            {/* {reloadVars(AdminConfigTypes.APP_VARS, appVars)} */}
                        </div> 

                        <div className="mx-10">
                            <InputsMap
                            id = {AdminConfigTypes.APP_VARS}
                            inputs={Object.keys(appVars).filter((k: string) => k !== AVAILABLE_MODELS)
                                        .sort((a, b) => b.length - a.length)
                                        .map((secret: string) => {return {label: secret, key: secret, defaultValue:  appVars[secret]}})}
                            state = {appVars}
                            inputChanged = {(key:string, value:string) => {
                                setAppVars({...appVars, [key]: value});
                                setUnsavedConfigs(prevChanges => new Set(prevChanges).add(AdminConfigTypes.APP_VARS));
                            }}

                            />      
                        </div>  
                        
                        <div className="mx-10"> 
                            
                            {Object.keys(appVars).includes(AVAILABLE_MODELS) && 
                                <div className="flex flex-row">
                                    <label className="flex-shrink-0 border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] text-center"
                                        style={{width: "263px"}}>
                                        {AVAILABLE_MODELS}
                                    </label> 
                                    <div  className="flex flex-row gap-2 flex-wrap rounded-r border border-neutral-500 px-4 py-1 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100">
                                        { Object.entries(Models).map(([id, model]) => 
                                            <div key={id} className="flex flex-row items-center">
                                                <input type="checkbox" checked={appVars[AVAILABLE_MODELS].split(',').includes(id)} 
                                                    onChange={(e) => {
                                                            hangleChangeAvailableModels(e.target.checked, id);
                                                        }}
                                                />
                                                <label className="text-sm mt-1 ml-2 mr-3 whitespace-nowrap cursor-pointer"
                                                        title={model.id}
                                                        onClick={() => {
                                                            hangleChangeAvailableModels(!appVars[AVAILABLE_MODELS].split(',').includes(id), id);
                                                        }}>
                                                    {model.name}
                                                </label>

                                            </div>
                                        )}
                                    </div>
                                            
                                </div>
                            }
                        </div>


                        <div className="flex flex-row gap-3 mt-4">
                            {titleLabel('OpenAi Endpoints', "[1.05rem]")}
                            {refresh(AdminConfigTypes.OPENAI_ENDPONTS, () => {}, false)}
                        </div> 

                        {openAiEndpoints.models.map((modelData: any, modelIndex: number) => {
                            return Object.keys(modelData).map((modelName: string) => {
                                return (
                                    <div key={modelName} className={`ml-10 flex flex-col gap-2 ${modelIndex > 0 ? 'mt-6': 'mt-2'}`}>
                                        <div className="flex flex-row gap-2">
                                            <label className="py-2 text-[0.95rem]">{modelName}</label>
                                            <button
                                                title='Add Endpoint'
                                                className={`ml-2 mt-1 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10`}
                                                onClick={async () => {
                                                    const newEndpoint = { url: '', key: '', isNew: true};
                                                    const updatedModels = [...openAiEndpoints.models];
                                                    const model = updatedModels[modelIndex];
                                                    model[modelName].endpoints.push(newEndpoint);
                                                    setOpenAiEndpoints({ models: updatedModels });
                                                    setUnsavedConfigs(prevChanges => new Set(prevChanges).add(AdminConfigTypes.OPENAI_ENDPONTS));
                                                }
                                                }
                                            >
                                                <IconPlus size={16}/>
                                            </button>

                                            { modelData[modelName].endpoints.length > 0 &&
                                            <button
                                                title="Delete Endpoints"
                                                disabled={isDeletingEndpoint === modelName}
                                                className={`mt-1 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 dark:text-neutral-100 transition-colors duration-200 ${isDeletingEndpoint !== modelName ? "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" : ""}`}
                                                onClick={() => {
                                                    setIsDeletingEndpoint(modelName);
                                                    setDeleteEndpointsList([]);
                                                }}
                                            >
                                                <IconTrash size={16} />
                                            </button>}
                                        
                                            {isDeletingEndpoint === modelName && (
                                                <>
                                                <UserAction
                                                    label={"Remove Endpoints"}
                                                    onConfirm={() => {
                                                        const testEndpointIdsToRemove: string[] = [];
                                                        const updatedModels = [...openAiEndpoints.models];
                                                        const model = updatedModels[modelIndex];
                                                        model[modelName].endpoints = model[modelName].endpoints.filter(
                                                            (_, idx) => !deleteEndpointsList.includes(idx)
                                                        );
                                                        handleUpdateEndpoints({ models: updatedModels });

                                                    }}
                                                    onCancel={() => {
                                                        setIsDeletingEndpoint(null);
                                                        setDeleteEndpointsList([]);
                                                    }}
                                                />
                                                <div className="mt-1.5">
                                                    <Checkbox
                                                        id={`selectAll${modelName}${AdminConfigTypes.OPENAI_ENDPONTS}`}
                                                        label=""
                                                        checked={deleteEndpointsList.length === modelData[modelName].endpoints.length}
                                                        onChange={(isChecked: boolean) => {
                                                            if (isChecked) {
                                                                setDeleteEndpointsList(Array.from({ length: modelData[modelName].endpoints.length }, (_, i) => i));
                                                            } else {
                                                                setDeleteEndpointsList([]);
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                </>
                                            )}
                                            
                                        </div> 

                                        {modelData[modelName].endpoints.map((endpoint: Endpoint, index:number) => 
                                            <div className="flex flex-row mr-10 mt-2" key={index}
                                                onMouseEnter={() => setHoveredEndpoint({ model: modelName, index })}
                                                onMouseLeave={() => setHoveredEndpoint(null)}
                                            >
                                                <div className="min-w-[30px] flex items-center"> 
                                                    {isDeletingEndpoint === modelName ? (
                                                            <Checkbox
                                                                id={`${modelName}${index}${AdminConfigTypes.OPENAI_ENDPONTS}`}
                                                                label=""
                                                                checked={deleteEndpointsList.includes(index)}
                                                                onChange={(isChecked: boolean) => {
                                                                    if (isChecked) {
                                                                        setDeleteEndpointsList((prev) => [...prev, index]);
                                                                    } else {
                                                                    setDeleteEndpointsList((prev) => prev.filter((i) => i !== index));
                                                                    }
                                                                }}
                                                            />
                                                    ) : 
                                                    <>
                                                    {hoveredEndpoint &&
                                                    hoveredEndpoint.model === modelName &&
                                                    hoveredEndpoint.index === index && (
                                                        <button
                                                            type="button"
                                                            className="p-0.5 ml-[-4px] text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                            onClick={() => {
                                                                const updatedModels = [...openAiEndpoints.models];
                                                                const model = updatedModels[modelIndex];
                                                                model[modelName].endpoints.splice(index, 1);
                                                                handleUpdateEndpoints({ models: updatedModels });
                                                            }}
                                                        >
                                                            <IconTrash size={20} />
                                                        </button>
                                                    )}
                                                    </>}
                                                </div>

                                                <div className="w-full">
                                                    <div className="flex flex-row gap-2"> 
                                                        <label className="py-1 text-[0.9rem] ml-1">Url</label>

                                                        <input
                                                            id={`${modelName}-${index}-url`}
                                                            className="w-full rounded-lg border border-neutral-500 px-4 py-1 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100"
                                                            value={endpoint.url}
                                                            onChange={(e) => {
                                                                // Update the endpoint url
                                                                const updatedModels = [...openAiEndpoints.models];
                                                                const model = updatedModels[modelIndex];
                                                                model[modelName].endpoints[index].url = e.target.value;
                                                                handleUpdateEndpoints({ models: updatedModels });
                                                            }}
                                                        />
                                                    </div>  
                                                    <div className="flex flex-row gap-2"> 
                                                        <label className="py-1 text-[0.9rem]">Key</label>

                                                        <input
                                                            id={`${modelName}-${index}-key`}
                                                            className="w-full rounded-lg border border-neutral-500 px-4 py-1 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100"
                                                            value={endpoint.key}
                                                            onChange={(e) => {
                                                                // Update the endpoint key
                                                                const updatedModels = [...openAiEndpoints.models];
                                                                const model = updatedModels[modelIndex];
                                                                model[modelName].endpoints[index].key = e.target.value;
                                                                handleUpdateEndpoints({ models: updatedModels });
                                                            }}
                                                        />
                                
                                                    </div>
                                                </div>
                                            </div>

                                        )}
                        
                                    </div>)
                                    
                                })
                            })
                            
                        }

                    </div> 
                    </>
            },


            // Load Data Tab
                    
            {label: 'Upload Data',
             content:
                <>
                {titleLabel('OPs')}
        
                {titleLabel('API Documentation')}
                
                </>
            },
        ]
        }
        />
    </div>

    }
  />
    
}



interface actionProps {
    label: string;
    onConfirm: () => void;
    onCancel: () => void;
    top?: string;
}

export const UserAction: FC<actionProps> = ({ label, onConfirm, onCancel, top}) => {
    
    return ( 
        <div className={`my-2.5 flex flex-row gap-1.5 transparent ${top}`}>
        <button 
                className="text-green-500 hover:text-green-700 cursor-pointer" 
                onClick={(e) => {
                    e.stopPropagation();
                    onConfirm();
                    onCancel(); // clears
                }}
                
                title={label} 
            >
                <IconCheck size={16} />
        </button>
        
        <button
            className="text-red-500 hover:text-red-700 cursor-pointer"
            onClick={(e) => {
            e.stopPropagation();
                onCancel();

            }}
            title={"Cancel"}
        >
            <IconX size={16} />
        </button>
    </div>
    )
}



interface addEmailsProps {
    key: AdminConfigTypes;
    emails: string[];
    allEmails: string[]
    handleUpdateEmails: (e: Array<string>) => void;
}

export const AddEmailWithAutoComplete: FC<addEmailsProps> = ({ key, emails, allEmails, handleUpdateEmails}) => {
    const [input, setInput] = useState<string>('');

    const handleAddEmails = () => {
        const entries = input.split(',').map(email => email.trim()).filter(email => email);

        const newEmails = entries.filter(email => /^\S+@\S+\.\S+$/.test(email) && !emails.includes(email));
        if (newEmails.length > 0) handleUpdateEmails([...emails, ...newEmails]);
        setInput('');
    };

    return ( 
    <div className='flex flex-row gap-2' key={key}>
        <div className='w-full relative'>
            <EmailsAutoComplete
                input = {input}
                setInput =  {setInput}
                allEmails = {allEmails.filter((e:string) => !emails.includes(e))}
                alreadyAddedEmails = {emails}
            /> 
        </div>
        <div className="flex-shrink-0 ml-[-6px]">
            <button
                type="button"
                title='Add User'
                className="ml-2 mt-0.5 px-2 py-2 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10 "
                 
                onClick={handleAddEmails}
            >
                <IconPlus size={18} />
            </button>
        </div>
    
    </div>
    )
}





