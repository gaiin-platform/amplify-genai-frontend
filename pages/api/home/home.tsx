import {useEffect, useRef, useState, useCallback} from 'react';
import {useQuery} from 'react-query';

import {GetServerSideProps} from 'next';
import {useTranslation} from 'next-i18next';
import {serverSideTranslations} from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import {Tab, TabSidebar} from "@/components/TabSidebar/TabSidebar";
import {useCreateReducer} from '@/hooks/useCreateReducer';
import {SettingsBar} from "@/components/Settings/SettingsBar";
import useErrorService from '@/services/errorService';
import useApiService from '@/services/useApiService';

import {
    cleanConversationHistory,
    cleanSelectedConversation,
} from '@/utils/app/clean';
import {AVAILABLE_MODELS, DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE} from '@/utils/app/const';
import {
    saveConversation,
    saveConversations,
    saveConversationDirect,
    saveConversationsDirect,
    updateConversation,
} from '@/utils/app/conversation';
import {saveFolders} from '@/utils/app/folders';
import {savePrompts} from '@/utils/app/prompts';
import {getSettings} from '@/utils/app/settings';
import {getAccounts} from "@/services/accountService";

import {Conversation, Message, MessageType} from '@/types/chat';
import {KeyValuePair} from '@/types/data';
import {FolderInterface, FolderType} from '@/types/folder';
import {OpenAIModelID, OpenAIModels, fallbackModelID, OpenAIModel} from '@/types/openai';
import {Prompt} from '@/types/prompt';


import {Chat} from '@/components/Chat/Chat';
import {Chatbar} from '@/components/Chatbar/Chatbar';
import {Navbar} from '@/components/Mobile/Navbar';
import Promptbar from '@/components/Promptbar';
import {
    Icon3dCubeSphere,
    IconTournament,
    IconShare,
    IconApiApp,
    IconMessage,
    IconSettings,
    IconBook2
} from "@tabler/icons-react";
import {IconUser, IconLogout} from "@tabler/icons-react";
import HomeContext, {ClickContext, Processor} from './home.context';
import {HomeInitialState, initialState} from './home.state';
import useEventService from "@/hooks/useEventService";
import {v4 as uuidv4} from 'uuid';


import styled from "styled-components";
import {WorkflowDefinition} from "@/types/workflow";
import {saveWorkflowDefinitions} from "@/utils/app/workflows";
import {findWorkflowPattern} from "@/utils/workflow/aiflow";
import SharedItemsList from "@/components/Share/SharedItemList";
import {saveFeatures} from "@/utils/app/features";
import {findParametersInWorkflowCode} from "@/utils/workflow/workflow";
import WorkspaceList from "@/components/Workspace/WorkspaceList";
import {Market} from "@/components/Market/Market";
import {getBasePrompts} from "@/services/basePromptsService";
import {LatestExportFormat} from "@/types/export";
import {importData} from "@/utils/app/importExport";
import {useSession, signIn, signOut, getSession} from "next-auth/react"
import Loader from "@/components/Loader/Loader";
import {useHomeReducer} from "@/hooks/useHomeReducer";
import stateService from "@/services/stateService";

const LoadingIcon = styled(Icon3dCubeSphere)`
  color: lightgray;
  height: 150px;
  width: 150px;
`;

interface Props {
    serverSideApiKeyIsSet: boolean;
    serverSidePluginKeysSet: boolean;
    defaultModelId: OpenAIModelID;
    cognitoClientId: string|null;
    cognitoDomain: string|null;
    mixPanelToken: string;
    chatEndpoint: string|null;
    availableModels: string|null;
}


const Home = ({
                  serverSideApiKeyIsSet,
                  serverSidePluginKeysSet,
                  defaultModelId,
                  cognitoClientId,
                  cognitoDomain,
                  mixPanelToken,
                  chatEndpoint,
                  availableModels
              }: Props) => {
    const {t} = useTranslation('chat');
    const {getModels} = useApiService();
    const {getModelsError} = useErrorService();
    const [initialRender, setInitialRender] = useState<boolean>(true);

    const {data: session, status} = useSession();
    //const {user, error: userError, isLoading} = useUser();
    const user = session?.user;
    const isLoading = status === "loading";
    const userError = null;

    const contextValue = useHomeReducer({
        initialState:{...initialState, statsService: useEventService(mixPanelToken)},
    });

    const {
        state: {
            apiKey,
            conversationStateId,
            messageIsStreaming,
            lightMode,
            folders,
            workflows,
            conversations,
            selectedConversation,
            prompts,
            temperature,
            page,
            statsService
        },
        dispatch,
    } = contextValue;


    const stopConversationRef = useRef<boolean>(false);



    useEffect(() => {
        // @ts-ignore
        if (session?.error === "RefreshAccessTokenError") {
            signOut();
        }
        else {
            const fetchAccounts = async () => {
                const response = await getAccounts();
                if(response.success){
                    const defaultAccount = response.data.find((account:any) => account.isDefault);
                    if(defaultAccount){
                        dispatch({field: 'defaultAccount', value: defaultAccount});
                    }
                }
            };
            fetchAccounts();
        }
    }, [session]);

    useEffect(() => {
        const fetchPrompts = async () => {
            const basePrompts = await getBasePrompts();
            if (basePrompts.success) {
                const {history, folders, prompts}: LatestExportFormat = importData(basePrompts.data);

                dispatch({field: 'conversations', value: history});
                dispatch({field: 'folders', value: folders});
                dispatch({field: 'prompts', value: prompts});

            } else {
                console.log("Failed to import base prompts.");
            }
        }

        if(session?.user) {
            fetchPrompts();
        }
    }, [session]);

    // This is where tabs will be sync'd
    useEffect(() => {
        const handleStorageChange = (event: any) => {
            if (event.key === "conversationHistory") {
                const conversations = JSON.parse(event.newValue);
                dispatch({field: 'conversations', value: conversations});
            } else if (event.key === "folders") {
                const folders = JSON.parse(event.newValue);
                dispatch({field: 'folders', value: folders});
            } else if (event.key === "prompts") {
                const prompts = JSON.parse(event.newValue);
                dispatch({field: 'prompts', value: prompts});
            }
        };

        window.addEventListener('storage', handleStorageChange);

        // Remove the event listener on cleanup
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);


    useEffect(() => {
        if (availableModels) {
            const modelList = availableModels.split(",");

            const models: OpenAIModel[] = modelList.reduce((result: OpenAIModel[], model: string) => {
                const model_name = model;

                for (const [key, value] of Object.entries(OpenAIModelID)) {
                    if (value === model_name && modelList.includes(model_name)) {
                        result.push({
                            id: model_name,
                            name: OpenAIModels[value].name,
                            maxLength: OpenAIModels[value].maxLength,
                            tokenLimit: OpenAIModels[value].tokenLimit,
                            actualTokenLimit: OpenAIModels[value].actualTokenLimit,
                            inputCost: OpenAIModels[value].inputCost,
                            outputCost: OpenAIModels[value].outputCost,
                        });
                    }
                }
                return result;
            }, []);

            dispatch({field: 'models', value: models});
        }
    }, [availableModels, dispatch]);

    useEffect(() => {
        if(chatEndpoint) dispatch({field: 'chatEndpoint', value: chatEndpoint});
    }, [chatEndpoint]);

    const handleSelectConversation = (conversation: Conversation) => {
        dispatch({field: 'page', value: 'chat'})

        dispatch({
            field: 'selectedConversation',
            value: conversation,
        });

        saveConversation(conversation);
    };

    // Feature OPERATIONS  --------------------------------------------

    const handleToggleFeature = (name: string) => {
        const features = {...contextValue.state.featureFlags};
        features[name] = !features[name];

        dispatch({field: 'featureFlags', value: features});
        saveFeatures(features);

        return features;
    };

    // FOLDER OPERATIONS  --------------------------------------------

    const handleCreateFolder = (name: string, type: FolderType) => {
        //console.log("handleCreateFolder", name, type);

        const newFolder: FolderInterface = {
            id: uuidv4(),
            name,
            type,
        };

        const updatedFolders = [...folders, newFolder];

        dispatch({field: 'folders', value: updatedFolders});
        saveFolders(updatedFolders);

        return newFolder;
    };

    const handleDeleteFolder = (folderId: string) => {
        const updatedFolders = folders.filter((f) => f.id !== folderId);
        dispatch({field: 'folders', value: updatedFolders});
        saveFolders(updatedFolders);

        const updatedConversations: Conversation[] = conversations.map((c) => {
            if (c.folderId === folderId) {
                return {
                    ...c,
                    folderId: null,
                };
            }

            return c;
        });

        dispatch({field: 'conversations', value: updatedConversations});
        saveConversations(updatedConversations);

        const updatedPrompts: Prompt[] = prompts.map((p) => {
            if (p.folderId === folderId) {
                return {
                    ...p,
                    folderId: null,
                };
            }

            return p;
        });

        dispatch({field: 'prompts', value: updatedPrompts});
        savePrompts(updatedPrompts);

        const updatedWorkflows: WorkflowDefinition[] = workflows.map((p) => {
            if (p.folderId === folderId) {
                return {
                    ...p,
                    folderId: null,
                };
            }

            return p;
        });

        dispatch({field: 'workflows', value: updatedWorkflows});
        saveWorkflowDefinitions(updatedWorkflows);
    };

    const handleUpdateFolder = (folderId: string, name: string) => {
        const updatedFolders = folders.map((f) => {
            if (f.id === folderId) {
                return {
                    ...f,
                    name,
                };
            }

            return f;
        });

        dispatch({field: 'folders', value: updatedFolders});

        saveFolders(updatedFolders);
    };

    // CONVERSATION OPERATIONS  --------------------------------------------

    const handleNewConversation = (params = {}) => {
        dispatch({field: 'page', value: 'chat'})

        const lastConversation = conversations[conversations.length - 1];

        // Create a string for the current date like Oct-18-2021
        const date = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        // See if there is a folder with the same name as the date
        let folder = folders.find((f) => f.name === date);

        console.log("handleNewConversation", {date, folder});

        if (!folder) {
            folder = handleCreateFolder(date, "chat");
        }

        const newConversation: Conversation = {
            id: uuidv4(),
            name: t('New Conversation'),
            messages: [],
            model: lastConversation?.model || {
                id: OpenAIModels[defaultModelId].id,
                name: OpenAIModels[defaultModelId].name,
                maxLength: OpenAIModels[defaultModelId].maxLength,
                tokenLimit: OpenAIModels[defaultModelId].tokenLimit,
            },
            prompt: DEFAULT_SYSTEM_PROMPT,
            temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
            folderId: folder.id,
            promptTemplate: null,
            ...params
        };

        statsService.newConversationEvent();

        const updatedConversations = [...conversations, newConversation];

        dispatch({field: 'selectedConversation', value: newConversation});
        dispatch({field: 'conversations', value: updatedConversations});


        saveConversation(newConversation);
        saveConversations(updatedConversations);

        dispatch({field: 'loading', value: false});
    };

    const handleCustomLinkClick = (conversation: Conversation, href: string, context: ClickContext) => {

        try {

            if (href.startsWith("#")) {

                let [category, action_path] = href.slice(1).split(":");
                let [action, path] = action_path.split("/");

                console.log(`handleCustomLinkClick ${category}:${action}/${path}`);


                if (category === "workflow" && action === "save-workflow" && path && path.trim().length > 0) {

                    const workflowId = path;
                    console.log(`Saving workflow ${workflowId}...`);

                    const workflowFilter = (workflowId: string, msgType: string) => {
                        return (m: Message) => {
                            return m.data
                                && m.data.workflow
                                && m.data.type
                                && m.data.workflow === workflowId
                                && m.data.type === msgType;
                        }
                    };

                    //let code = conversation.messages.filter(workflowFilter(workflowId, "workflow:code")).pop();
                    let prompt = conversation.messages.filter(workflowFilter(workflowId, "workflow:prompt")).pop();
                    let result = conversation.messages.filter(workflowFilter(workflowId, "workflow:result")).pop();

                    console.log("Workflow Result", result);
                    console.log("Workflow", {
                        code: result?.data.workflowCode,
                        prompt: prompt,
                        inputs: result?.data.inputs
                    });

                    if (prompt && result && result?.data.workflowCode) {
                        let workflowDefinition: WorkflowDefinition = {
                            id: uuidv4(),
                            formatVersion: "v1.0",
                            version: "1",
                            folderId: null,
                            description: prompt.content,
                            generatingPrompt: prompt.content,
                            name: prompt.content,
                            code: result?.data.workflowCode,
                            tags: [],
                            inputs: result?.data.inputs || [],
                            outputs: [],
                        }

                        const documentStrings = workflowDefinition.inputs.documents.map((doc) => `{{${doc.name}:file}}`).join('\n');
                        const parameterStrings = Object.keys(workflowDefinition.inputs.parameters).map((key) => `{{${key}}}`).join('\n');
                        const formattedString =
                            `${documentStrings}${parameterStrings}${prompt.content}`;

                        let promptTemplate: Prompt = {
                            content: formattedString,
                            data: {
                                code: result?.data.workflowCode
                            },
                            description: prompt.content,
                            folderId: null,
                            id: uuidv4(),
                            name: prompt.content,
                            type: MessageType.AUTOMATION
                        }

                        const updatedPrompts = [...prompts, promptTemplate];

                        dispatch({field: 'prompts', value: updatedPrompts});

                        savePrompts(updatedPrompts);

                        // const updatedWorkflowDefinitions = [
                        //     ...workflows,
                        //     workflowDefinition
                        // ]

                        // dispatch({field: 'workflows', value: updatedWorkflowDefinitions});

                        // saveWorkflowDefinitions(updatedWorkflowDefinitions);
                        alert("Workflow saved.");
                    } else {
                        console.log("Workflow not saved, missing code or prompt.");
                    }
                } else if (category === "workflow" && action === "save-workflow" && context.message && context.conversation) {

                    let code = findWorkflowPattern(context.message.content);
                    let codeMessageIndex = context.conversation.messages.indexOf(context.message);

                    console.log("Workflow Code", code);
                    console.log("Workflow Message Index", codeMessageIndex);

                    if (codeMessageIndex > 0) {
                        let msgBefore = context.conversation.messages[codeMessageIndex - 1];
                        let prompt = msgBefore.content;

                        console.log("Workflow Prompt", prompt);

                        if (code && prompt) {
                            let workflowDefinition: WorkflowDefinition = {
                                id: uuidv4(),
                                formatVersion: "v1.0",
                                version: "1",
                                folderId: null,
                                description: prompt,
                                generatingPrompt: prompt,
                                name: prompt,
                                code: code,
                                tags: [],
                                inputs: {parameters: {}, documents: []},
                                outputs: [],
                            }

                            const documentStrings = workflowDefinition.inputs.documents.map((doc) => `{{${doc.name}:file}}`).join('\n');
                            let parameterStrings = Object.keys(workflowDefinition.inputs.parameters).map((key) => `{{${key}}}`).join('\n');
                            parameterStrings += findParametersInWorkflowCode(code);

                            const formattedString =
                                `${documentStrings}${parameterStrings}${prompt}`;


                            const extractGetDocuments = (code: string): boolean => {
                                const regex = /fnlibs.getDocuments\(\)/;
                                return regex.test(code);
                            };

                            const extractGetDocumentArguments = (code: string): string[] => {
                                const regex = /fnlibs.getDocument\(\s*"([^"]+)"\s*\)/g;
                                const matches = code.match(regex);
                                if (!matches) return [];
                                return matches.map((match) => match.replace('fnlibs.getDocument("', "").replace('")', ""));
                            };

                            const promptDocumentVariables = "" +
                                (extractGetDocuments(code) ? "{{Documents:files}}" : "") +
                                extractGetDocumentArguments(code).map((arg) => `{{${arg}:file}}`).join('\n');


                            let promptTemplate: Prompt = {
                                content: promptDocumentVariables + formattedString,
                                data: {
                                    code: code
                                },
                                description: prompt,
                                folderId: null,
                                id: uuidv4(),
                                name: prompt,
                                type: MessageType.AUTOMATION
                            }

                            const updatedPrompts = [...prompts, promptTemplate];

                            dispatch({field: 'prompts', value: updatedPrompts});

                            savePrompts(updatedPrompts);

                            alert("Workflow saved.");
                        } else {
                            console.log("Workflow not saved, missing code or prompt.");
                        }
                    }
                }
            }
        } catch (e) {
            console.log("Error handling custom link", e);
        }

        //let msgs = conversation.messages.filter(workflowFilter())

        //console.log("Workflow msgs:", msgs);
    }

    const handleUpdateConversation = (
        conversation: Conversation,
        data: KeyValuePair,
    ) => {
        const updatedConversation = {
            ...conversation,
            [data.key]: data.value,
        };

        const {single, all} = updateConversation(
            updatedConversation,
            conversations,
        );

        dispatch({field: 'selectedConversation', value: single});
        dispatch({field: 'conversations', value: all});
    };

    const clearWorkspace = async () => {
        await dispatch({field: 'conversations', value: []});
        await dispatch({field: 'prompts', value: []});
        await dispatch({field: 'folders', value: []});

        saveConversation({
            id: uuidv4(),
            name: t('New Conversation'),
            messages: [],
            model: OpenAIModels[defaultModelId],
            prompt: DEFAULT_SYSTEM_PROMPT,
            temperature: DEFAULT_TEMPERATURE,
            folderId: null,
            promptTemplate: null
        });
        saveConversations([]);
        saveFolders([]);
        savePrompts([]);

        await dispatch({field: 'selectedConversation', value: null});
    }

    useEffect(() => {
        if (!messageIsStreaming &&
            conversationStateId !== "init" &&
            conversationStateId !== "post-init"
        ) {

            if (selectedConversation) {
                saveConversationDirect(selectedConversation);
            }
            saveConversationsDirect(conversations);
        }
    }, [conversationStateId]);

    const handleAddMessages = async (selectedConversation: Conversation | undefined, messages: any) => {
        if (selectedConversation) {
            dispatch(
                {
                    type: 'conversation',
                    action: {
                        type: 'addMessages',
                        conversationId: selectedConversation.id,
                        messages: messages
                    }
                }
            )
        }
        // if (selectedConversation) {
        //
        //     const updatedMessages = [
        //         ...selectedConversation.messages,
        //         ...messages
        //     ];
        //
        //     let updatedConversation = {
        //         ...selectedConversation,
        //         messages: updatedMessages,
        //     };
        //
        //     await dispatch({
        //         field: 'selectedConversation',
        //         value: updatedConversation
        //     });
        //
        //     saveConversation(updatedConversation);
        //     const updatedConversations = conversations.map(
        //         (conversation) => {
        //             if (conversation.id === selectedConversation.id) {
        //                 return updatedConversation;
        //             }
        //             return conversation;
        //         },
        //     );
        //     if (updatedConversations.length === 0) {
        //         updatedConversations.push(updatedConversation);
        //     }
        //     await dispatch({field: 'conversations', value: updatedConversations});
        // }

    };

    // EFFECTS  --------------------------------------------

    useEffect(() => {
        if (window.innerWidth < 640) {
            dispatch({field: 'showChatbar', value: false});
            dispatch({field: 'showPromptbar', value: false});
        }
    }, [selectedConversation]);

    useEffect(() => {
        defaultModelId &&
        dispatch({field: 'defaultModelId', value: defaultModelId});
        serverSideApiKeyIsSet &&
        dispatch({
            field: 'serverSideApiKeyIsSet',
            value: serverSideApiKeyIsSet,
        });
        serverSidePluginKeysSet &&
        dispatch({
            field: 'serverSidePluginKeysSet',
            value: serverSidePluginKeysSet,
        });
    }, [defaultModelId, serverSideApiKeyIsSet, serverSidePluginKeysSet]);

    // ON LOAD --------------------------------------------

    useEffect(() => {
        const settings = getSettings();
        if (settings.theme) {
            dispatch({
                field: 'lightMode',
                value: settings.theme,
            });
        }

        const apiKey = localStorage.getItem('apiKey');

        const workspaceMetadataStr = localStorage.getItem('workspaceMetadata');
        if (workspaceMetadataStr) {
            dispatch({field: 'workspaceMetadata', value: JSON.parse(workspaceMetadataStr)});
        }

        if (serverSideApiKeyIsSet) {
            dispatch({field: 'apiKey', value: ''});

            localStorage.removeItem('apiKey');
        } else if (apiKey) {
            dispatch({field: 'apiKey', value: apiKey});
        }

        const pluginKeys = localStorage.getItem('pluginKeys');
        if (serverSidePluginKeysSet) {
            dispatch({field: 'pluginKeys', value: []});
            localStorage.removeItem('pluginKeys');
        } else if (pluginKeys) {
            dispatch({field: 'pluginKeys', value: pluginKeys});
        }

        if (window.innerWidth < 640) {
            dispatch({field: 'showChatbar', value: false});
            dispatch({field: 'showPromptbar', value: false});
        }

        const showChatbar = localStorage.getItem('showChatbar');
        if (showChatbar) {
            dispatch({field: 'showChatbar', value: showChatbar === 'true'});
        }

        const showPromptbar = localStorage.getItem('showPromptbar');
        if (showPromptbar) {
            dispatch({field: 'showPromptbar', value: showPromptbar === 'true'});
        }

        const folders = localStorage.getItem('folders');
        if (folders) {
            dispatch({field: 'folders', value: JSON.parse(folders)});
        }

        const prompts = localStorage.getItem('prompts');
        if (prompts) {
            dispatch({field: 'prompts', value: JSON.parse(prompts)});
        }

        const workflows = localStorage.getItem('workflows');
        if (workflows) {
            dispatch({field: 'workflows', value: JSON.parse(workflows)});
        }

        const conversationHistory = localStorage.getItem('conversationHistory');
        if (conversationHistory) {
            const parsedConversationHistory: Conversation[] =
                JSON.parse(conversationHistory);
            const cleanedConversationHistory = cleanConversationHistory(
                parsedConversationHistory,
            );

            dispatch({field: 'conversations', value: cleanedConversationHistory});
        }

        const selectedConversation = localStorage.getItem('selectedConversation');
        if (selectedConversation) {
            const parsedSelectedConversation: Conversation =
                JSON.parse(selectedConversation);
            const cleanedSelectedConversation = cleanSelectedConversation(
                parsedSelectedConversation,
            );

            dispatch({
                field: 'selectedConversation',
                value: cleanedSelectedConversation,
            });
        } else {
            const lastConversation = conversations[conversations.length - 1];
            dispatch({
                field: 'selectedConversation',
                value: {
                    id: uuidv4(),
                    name: t('New Conversation'),
                    messages: [],
                    model: OpenAIModels[defaultModelId],
                    prompt: DEFAULT_SYSTEM_PROMPT,
                    temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
                    folderId: null,
                },
            });
        }

        dispatch({
            field: 'conversationStateId',
            value: 'post-init',
        });
    }, [
        defaultModelId,
        dispatch,
        serverSideApiKeyIsSet,
        serverSidePluginKeysSet,
    ]);

    const [preProcessingCallbacks, setPreProcessingCallbacks] = useState([]);
    const [postProcessingCallbacks, setPostProcessingCallbacks] = useState([]);

    const federatedSignOut = async () => {

        await signOut();
        // signOut only signs out of Auth.js's session
        // We need to log out of Cognito as well
        // Federated signout is currently not supported.
        // Therefore, we use a workaround: https://github.com/nextauthjs/next-auth/issues/836#issuecomment-1007630849
        const signoutRedirectUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;

        window.location.replace(
            //`https://cognito-idp.us-east-1.amazonaws.com/us-east-1_aeCY16Uey/logout?client_id=${cognitoClientId}&redirect_uri=${encodeURIComponent(signoutRedirectUrl)}`
            `${cognitoDomain}/logout?client_id=${cognitoClientId}&logout_uri=${encodeURIComponent(signoutRedirectUrl)}`
            //`https://cognito-idp.us-east-1.amazonaws.com/us-east-1_aeCY16Uey/logout?client_id=${cognitoClientId}&logout_uri=http%3A%2F%2Flocalhost%3A3000`
        );
    };

    const getName = (email?: string | null) => {
        if (!email) return "Anonymous";

        const name = email.split("@")[0];

        // Split by dots and capitalize each word
        const nameParts = name.split(".");
        const capitalizedParts = nameParts.map((part) => {
            return part.charAt(0).toUpperCase() + part.slice(1);
        });

        return capitalizedParts.join(" ").slice(0, 28);
    }

    const addPreProcessingCallback = useCallback((callback: Processor) => {
        console.log("Proc added");
        //setPreProcessingCallbacks(prev => [...prev, callback]);
    }, []);

    const removePreProcessingCallback = useCallback((callback: Processor) => {
        setPreProcessingCallbacks(prev => prev.filter(c => c !== callback));
    }, []);

    const addPostProcessingCallback = useCallback((callback: Processor) => {
        //setPostProcessingCallbacks(prev => [...prev, callback]);
    }, []);

    const removePostProcessingCallback = useCallback((callback: Processor) => {
        setPostProcessingCallbacks(prev => prev.filter(c => c !== callback));
    }, []);

    if (session) {
        // @ts-ignore
        return (
            <HomeContext.Provider
                value={{
                    ...contextValue,
                    handleNewConversation,
                    handleCreateFolder,
                    handleDeleteFolder,
                    handleUpdateFolder,
                    handleSelectConversation,
                    handleUpdateConversation,
                    handleCustomLinkClick,
                    preProcessingCallbacks,
                    postProcessingCallbacks,
                    addPreProcessingCallback,
                    removePreProcessingCallback,
                    addPostProcessingCallback,
                    removePostProcessingCallback,
                    clearWorkspace,
                    handleAddMessages,
                }}
            >
                <Head>
                    <title>Amplify</title>
                    <meta name="description" content="ChatGPT but better."/>
                    <meta
                        name="viewport"
                        content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
                    />
                    <link rel="icon" href="/favicon.ico"/>
                </Head>
                {selectedConversation && (
                    <main
                        className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
                    >
                        <div className="fixed top-0 w-full sm:hidden">
                            <Navbar
                                selectedConversation={selectedConversation}
                                onNewConversation={handleNewConversation}
                            />
                        </div>

                        <div className="flex h-full w-full pt-[48px] sm:pt-0">

                            <TabSidebar
                                side={"left"}
                                footerComponent={
                                    <div className="m-0 p-0 border-t dark:border-white/20 pt-1 text-sm">
                                        <button className="dark:text-white" title="Sign Out" onClick={() => {
                                            const goLogout = async () => {
                                                await federatedSignOut();
                                            };
                                            goLogout();
                                        }}>

                                            <div className="flex items-center">
                                                <IconLogout className="m-2"/>
                                                <span>{isLoading ? 'Loading...' : getName(user?.email) ?? 'Unnamed user'}</span>
                                            </div>

                                        </button>

                                    </div>
                                }
                            >
                                <Tab icon={<IconMessage/>} title="Chats"><Chatbar/></Tab>
                                <Tab icon={<IconShare/>} title="Share"><SharedItemsList/></Tab>
                                <Tab icon={<IconTournament/>} title="Workspaces"><WorkspaceList/></Tab>
                                <Tab icon={<IconSettings/>} title="Settings"><SettingsBar/></Tab>
                            </TabSidebar>

                            <div className="flex flex-1">
                                {page === 'chat' && (
                                    <Chat stopConversationRef={stopConversationRef}/>
                                )}
                                {page === 'market' && (
                                    <Market items={[
                                        // {id: "1", name: "Item 1"},
                                    ]}/>
                                )}
                            </div>


                            <TabSidebar
                                side={"right"}
                            >
                                <Tab icon={<Icon3dCubeSphere/>}><Promptbar/></Tab>
                                {/*<Tab icon={<IconBook2/>}><WorkflowDefinitionBar/></Tab>*/}
                            </TabSidebar>

                        </div>
                    </main>
                )}

            </HomeContext.Provider>
        );
    } else if (isLoading) {
        return (
            <main
                className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
            >
                <div
                    className="flex flex-col items-center justify-center min-h-screen text-center text-white dark:text-white">
                    <Loader/>
                    <h1 className="mb-4 text-2xl font-bold">
                        Loading...
                    </h1>

                    {/*<progress className="w-64"/>*/}
                </div>
            </main>);
    } else {
        return (
            <main
                className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
            >
                <div
                    className="flex flex-col items-center justify-center min-h-screen text-center text-white dark:text-white">
                    <h1 className="mb-4 text-2xl font-bold">
                        <LoadingIcon/>
                    </h1>
                    <button
                        onClick={() => signIn('cognito')}
                        style={{
                            backgroundColor: 'white',
                            color: 'black',
                            fontWeight: 'bold',
                            padding: '10px 20px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            transition: 'background-color 0.3s ease-in-out',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#48bb78'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        Login
                    </button>
                </div>
            </main>
        );
    }
};
export default Home;

export const getServerSideProps: GetServerSideProps = async ({locale}) => {
    const defaultModelId =
        (process.env.DEFAULT_MODEL &&
            Object.values(OpenAIModelID).includes(
                process.env.DEFAULT_MODEL as OpenAIModelID,
            ) &&
            process.env.DEFAULT_MODEL) ||
        fallbackModelID;

    const chatEndpoint = process.env.CHAT_ENDPOINT;
    const mixPanelToken = process.env.MIXPANEL_TOKEN;
    const cognitoClientId = process.env.COGNITO_CLIENT_ID;
    const cognitoDomain = process.env.COGNITO_DOMAIN;
    const defaultFunctionCallModel = process.env.DEFAULT_FUNCTION_CALL_MODEL;
    const availableModels = process.env.AVAILABLE_MODELS;

    //console.log("Default Model Id:", defaultModelId);

    let serverSidePluginKeysSet = false;

    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleCSEId = process.env.GOOGLE_CSE_ID;

    if (googleApiKey && googleCSEId) {
        serverSidePluginKeysSet = true;
    }

    return {
        props: {
            availableModels,
            chatEndpoint,
            serverSideApiKeyIsSet: !!process.env.OPENAI_API_KEY,
            defaultModelId,
            serverSidePluginKeysSet,
            mixPanelToken,
            cognitoClientId,
            cognitoDomain,
            defaultFunctionCallModel,
            ...(await serverSideTranslations(locale ?? 'en', [
                'common',
                'chat',
                'sidebar',
                'markdown',
                'promptbar',
                'settings',
            ])),
        },
    };
};
