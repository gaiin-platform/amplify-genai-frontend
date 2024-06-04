import { useEffect, useRef, useState, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { Tab, TabSidebar } from "@/components/TabSidebar/TabSidebar";
import { SettingsBar } from "@/components/Settings/SettingsBar";
import useErrorService from '@/services/errorService';
import useApiService from '@/services/useApiService';
import { checkDataDisclosureDecision, getLatestDataDisclosure, saveDataDisclosureDecision } from "@/services/dataDisclosureService";
import { getIsLocalStorageSelection, isLocalConversation, isRemoteConversation, syncCloudConversation, updateWithRemoteConversations } from '@/utils/app/conversationStorage';
import cloneDeep from 'lodash/cloneDeep';
import {styled} from "styled-components";
import {LoadingDialog} from "@/components/Loader/LoadingDialog";


import {
    cleanConversationHistory,
    cleanSelectedConversation,
} from '@/utils/app/clean';
import { AVAILABLE_MODELS, DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import {
    saveConversations,
    saveConversationDirect,
    saveConversationsDirect,
    updateConversation,
    compressAllConversationMessages,
    conversationWithUncompressedMessages,
} from '@/utils/app/conversation';
import { getFolders, saveFolders } from '@/utils/app/folders';
import { getPrompts, savePrompts } from '@/utils/app/prompts';
import { getSettings } from '@/utils/app/settings';
import { getAccounts } from "@/services/accountService";

import { Conversation, Message, MessageType, newMessage } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { FolderInterface, FolderType } from '@/types/folder';
import { OpenAIModelID, OpenAIModels, fallbackModelID, OpenAIModel } from '@/types/openai';
import { Prompt } from '@/types/prompt';


import { Chat } from '@/components/Chat/Chat';
import { Chatbar } from '@/components/Chatbar/Chatbar';
import { Navbar } from '@/components/Mobile/Navbar';
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
import { IconUser, IconLogout } from "@tabler/icons-react";
import HomeContext, { ClickContext, Processor } from './home.context';
import { HomeInitialState, initialState } from './home.state';
import useEventService from "@/hooks/useEventService";
import { v4 as uuidv4 } from 'uuid';


import { WorkflowDefinition } from "@/types/workflow";
import { saveWorkflowDefinitions } from "@/utils/app/workflows";
import SharedItemsList from "@/components/Share/SharedItemList";
import { saveFeatures } from "@/utils/app/features";
import WorkspaceList from "@/components/Workspace/WorkspaceList";
import { Market } from "@/components/Market/Market";
import { getBasePrompts } from "@/services/basePromptsService";
import { LatestExportFormat } from "@/types/export";
import { importData } from "@/utils/app/importExport";
import { useSession, signIn, signOut, getSession } from "next-auth/react"
import Loader from "@/components/Loader/Loader";
import { useHomeReducer } from "@/hooks/useHomeReducer";
import { MyHome } from "@/components/My/MyHome";
import { DEFAULT_ASSISTANT } from '@/types/assistant';
import { listAssistants } from '@/services/assistantService';
import { syncAssistants } from '@/utils/app/assistants';
import { deleteRemoteConversation, fetchRemoteConversation, uploadConversation } from '@/services/remoteConversationService';
import {killRequest as killReq} from "@/services/chatService";

const LoadingIcon = styled(Icon3dCubeSphere)`
  color: lightgray;
  height: 150px;
  width: 150px;
`;


interface Props {
    defaultModelId: OpenAIModelID;
    
  ClientId: string | null;
    cognitoDomain: string | null;
    cognitoClientId: string | null;
    mixPanelToken: string;
    chatEndpoint: string | null;
    availableModels: string | null;
}


const Home = ({
    defaultModelId,
    cognitoClientId,
    cognitoDomain,
    mixPanelToken,
    chatEndpoint,
    availableModels
}: Props) => {
    const { t } = useTranslation('chat');
    const { getModels } = useApiService();
    const { getModelsError } = useErrorService();
    const [initialRender, setInitialRender] = useState<boolean>(true);
    const [loadedAssistants, setloadedAssistants] = useState<boolean>(false);
    const [loadedBasePrompts, setloadedBasePrompts] = useState<boolean>(false);
    const [loadedAccounts, setloadedAccounts] = useState<boolean>(false);
    const [initialRemoteCall, setInitialRemoteCall] = useState<boolean>(true);
    const [loadingSelectedConv, setLoadingSelectedConv] = useState<boolean>(false);
    const [loadingAmplify, setLoadingAmplify] = useState<boolean>(true);
    const { data: session, status } = useSession();
    //const {user, error: userError, isLoading} = useUser();
    const user = session?.user;
    const email = user?.email;
    const isLoading = status === "loading";
    const userError = null;

    const contextValue = useHomeReducer({
        initialState: {
            ...initialState,
            statsService: useEventService(mixPanelToken) },
    });


    const {
        state: {
            conversationStateId,
            messageIsStreaming,
            currentRequestId,
            lightMode,
            folders,
            workflows,
            conversations,
            selectedConversation,
            prompts,
            temperature,
            page,
            statsService,
            latestDataDisclosureUrlPDF,
            latestDataDisclosureHTML,
            inputEmail,
            hasAcceptedDataDisclosure,
            hasScrolledToBottom,
            featureFlags,
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
            const syncConversations = async () => {
                setInitialRemoteCall(false);
                await updateWithRemoteConversations(dispatch);
                setLoadingAmplify(false);
            }

            const fetchAccounts = async () => {
                const response = await getAccounts();
                if (response.success) {
                    const defaultAccount = response.data.find((account: any) => account.isDefault);
                    if (defaultAccount) {
                        dispatch({ field: 'defaultAccount', value: defaultAccount });
                    }
                    setloadedAccounts(true);  
                    if (featureFlags.storeCloudConversations && initialRemoteCall) syncConversations(); 
                }
            };

            if (!loadedAccounts && session?.user) {
                fetchAccounts();
            }
        }

    }, [session]);

    useEffect(() => {
        const fetchPrompts = async () => {
            try {
                const basePrompts = await getBasePrompts();
                if (basePrompts.success) {
                    const { history, folders, prompts }: LatestExportFormat = importData(basePrompts.data);

                    dispatch({ field: 'conversations', value: history });
                    dispatch({ field: 'folders', value: folders });
                    setloadedBasePrompts(true);

                    if (!loadedAssistants) await fetchAssistants(folders, prompts);

                } else {
                    console.log("Failed to import base prompts.");
                    await fetchAssistants(getFolders(), getPrompts());
                    // so when baseprompts do load, we can sync them up 
                    setloadedAssistants(false);

                }
            } catch (e) {
                console.log("Failed to import base prompts.", e);
            }

        }

        const fetchAssistants = async (folders: FolderInterface[], prompts: Prompt[]) => {
            if (session?.user?.email) {
                let assistants = await listAssistants(session?.user?.email);

                if (assistants) {
                    syncAssistants(assistants, folders, prompts, dispatch);
                    setloadedAssistants(true);
                    setLoadingAmplify(false);
                }
            }
        }

        if (session?.user) {
            if (!loadedBasePrompts) fetchPrompts();
        }
    }, [session]);


    // This is where tabs will be sync'd
    useEffect(() => {
        const handleStorageChange = (event: any) => {
            if (event.key === "conversationHistory") {
                const conversations = JSON.parse(event.newValue);
                dispatch({ field: 'conversations', value: conversations });
            } else if (event.key === "folders") {
                const folders = JSON.parse(event.newValue);
                dispatch({ field: 'folders', value: folders });
            } else if (event.key === "prompts") {
                const prompts = JSON.parse(event.newValue);
                dispatch({ field: 'prompts', value: prompts });
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
                            description: OpenAIModels[value].description
                        });
                    }
                }
                return result;
            }, []);

            dispatch({ field: 'models', value: models });
        }
    }, [availableModels, dispatch]);

    useEffect(() => {
        if (chatEndpoint) dispatch({ field: 'chatEndpoint', value: chatEndpoint });
    }, [chatEndpoint]);

    const handleSelectConversation = async (conversation: Conversation) => {
        // if we click on the conversation we are already on, then dont do anything
        if (selectedConversation && (conversation.id === selectedConversation.id)) return;
        //loading 
        //old conversations that do not have IsLocal are automatically local
        if (!('isLocal' in conversation)) {
            conversation.isLocal = true;
        }

        setLoadingSelectedConv(true);
        let newSelectedConv = null;
        // check if it isLocal? if not get the conversation from s3
        if (isRemoteConversation(conversation)) { 
            const remoteConversation = await fetchRemoteConversation(conversation.id, conversations, dispatch);
            if (remoteConversation) {
                newSelectedConv = remoteConversation;
            }
        } else {
            newSelectedConv = conversationWithUncompressedMessages(cloneDeep(conversation));
        }
        setLoadingSelectedConv(false);

        // not in use
        // // Before changing the selected conversation, we must sync the conversation with teh cloud conversation
        // // selectedConversation should always have isLocal attribute
        // if (selectedConversation && !selectedConversation.isLocal) syncCloudConversation(selectedConversation, conversations, dispatch);

        if (newSelectedConv) {
        //add last used assistant if there was one used else should be removed
        const prompts: Prompt[] = localStorage ? getPrompts() : [];
        if (newSelectedConv.messages && newSelectedConv.messages.length > 0) {
            const lastMessage: Message = newSelectedConv.messages[newSelectedConv.messages.length - 1];
            if (lastMessage.data && lastMessage.data.state && lastMessage.data.state.currentAssistant) {
                const astName = lastMessage.data.state.currentAssistant;
                const assistantPrompt = prompts.find(prompt => prompt.name === astName);
                const assistant = assistantPrompt?.data?.assistant ? assistantPrompt.data.assistant : DEFAULT_ASSISTANT;
                dispatch({ field: 'selectedAssistant', value: assistant });
            }
        } else {
            dispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT });
        }

        dispatch({ field: 'page', value: 'chat' })

        dispatch({  field: 'selectedConversation',
                    value: newSelectedConv
                });
        }
    };




    // Feature OPERATIONS  --------------------------------------------

    const handleToggleFeature = (name: string) => {
        const features = { ...contextValue.state.featureFlags };
        features[name] = !features[name];

        dispatch({ field: 'featureFlags', value: features });
        saveFeatures(features);

        return features;
    };

    // FOLDER OPERATIONS  --------------------------------------------

    const killRequest = async (requestId:string) => {
        const session = await getSession();

        // @ts-ignore
        if(!session || !session.accessToken || !chatEndpoint){
            return false;
        }

        // @ts-ignore
        const result = await killReq(chatEndpoint, session.accessToken, requestId);

        return result;
    }

    const shouldStopConversation = () => {
        return stopConversationRef.current;
    }

    const handleStopConversation = async () => {
        stopConversationRef.current = true;

        if (currentRequestId) {
            try{
                await killRequest(currentRequestId);
            } catch(e) {
                console.error("Error killing request", e);
            }
        }

        setTimeout(() => {
            stopConversationRef.current = false;

            dispatch({field: 'loading', value: false});
            dispatch({field: 'messageIsStreaming', value: false});
            dispatch({field: 'status', value: []});
        }, 1000);
    };

    const handleCreateFolder = (name: string, type: FolderType) => {
        //console.log("handleCreateFolder", name, type);

        const newFolder: FolderInterface = {
            id: uuidv4(),
            date: new Date().toISOString().slice(0, 10),
            name,
            type,
        };

        const folders: FolderInterface[] = getFolders();
        const updatedFolders = [...folders, newFolder];

        dispatch({ field: 'folders', value: updatedFolders });
        saveFolders(updatedFolders);

        return newFolder;
    };

    const handleDeleteFolder = (folderId: string) => {
        const folders: FolderInterface[] = getFolders();

        const updatedFolders = folders.filter((f) => (f.id !== folderId));
        dispatch({ field: 'folders', value: updatedFolders });
        saveFolders(updatedFolders);

        const updatedConversations = conversations.reduce<Conversation[]>((acc, c) => {
            if (c.folderId === folderId) {
                statsService.deleteConversationEvent(c);
                if (isRemoteConversation(c)) deleteRemoteConversation(c.id);
            } else {
                acc.push(c);
            }
            return acc;
        }, []);

        dispatch({ field: 'conversations', value: updatedConversations });
        localStorage.setItem('conversationHistory', JSON.stringify(updatedConversations));

        if (updatedConversations.length > 0) {
            const selectedNotDeleted = selectedConversation ?
                updatedConversations.some(conversation =>
                    conversation.id === selectedConversation.id) : false;
            if (!selectedNotDeleted) { // was deleted
                const newSelectedConversation = updatedConversations[updatedConversations.length - 1];
                dispatch({
                    field: 'selectedConversation',
                    value: newSelectedConversation,
                });
                localStorage.setItem('selectedConversation', JSON.stringify(newSelectedConversation));
            }

        } else {
            defaultModelId &&
                dispatch({
                    field: 'selectedConversation',
                    value: {
                        id: uuidv4(),
                        name: t('New Conversation'),
                        messages: [],
                        model: OpenAIModels[defaultModelId],
                        prompt: DEFAULT_SYSTEM_PROMPT,
                        temperature: DEFAULT_TEMPERATURE,
                        folderId: null,
                        isLocal: getIsLocalStorageSelection()

                    },
                });

            localStorage.removeItem('selectedConversation');
        }

        const updatedPrompts: Prompt[] = prompts.map((p) => {
            if (p.folderId === folderId) {
                return {
                    ...p,
                    folderId: null,
                };
            }

            return p;
        });

        dispatch({ field: 'prompts', value: updatedPrompts });
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

        dispatch({ field: 'workflows', value: updatedWorkflows });
        saveWorkflowDefinitions(updatedWorkflows);
    };

    const handleUpdateFolder = (folderId: string, name: string) => {
        const folders: FolderInterface[] = getFolders();
        const updatedFolders = folders.map((f) => {
            if (f.id === folderId) {
                return {
                    ...f,
                    name,
                };
            }

            return f;
        });

        dispatch({ field: 'folders', value: updatedFolders });

        saveFolders(updatedFolders);
    };

    // CONVERSATION OPERATIONS  --------------------------------------------

    const handleNewConversation = async (params = {}) => {
        dispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT });
        dispatch({ field: 'page', value: 'chat' })

        const conversations = JSON.parse(localStorage.getItem("conversationHistory") || '[]')

        const lastConversation = conversations ? conversations[conversations.length - 1] : null;

        // Create a string for the current date like Oct-18-2021
        const date = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        const folders: FolderInterface[] = getFolders();

        // See if there is a folder with the same name as the date
        let folder = folders.find((f) => f.name === date);

        console.log("handleNewConversation", { date, folder });

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
            isLocal: getIsLocalStorageSelection(),
            ...params
        };
        if (isRemoteConversation(newConversation)) await uploadConversation(newConversation);

        statsService.newConversationEvent();

        const updatedConversations = [...conversations, newConversation];

        dispatch({ field: 'selectedConversation', value: newConversation });
        dispatch({ field: 'conversations', value: updatedConversations });

        saveConversations(updatedConversations);

        dispatch({ field: 'loading', value: false });
    };

    const handleCustomLinkClick = (conversation: Conversation, href: string, context: ClickContext) => {

        try {

            if (href.startsWith("#")) {

                let [category, action_path] = href.slice(1).split(":");
                let [action, path] = action_path.split("/");

                console.log(`handleCustomLinkClick ${category}:${action}/${path}`);

            }
        } catch (e) {
            console.log("Error handling custom link", e);
        }
    }

    const handleUpdateConversation = (
        conversation: Conversation,
        data: KeyValuePair,
    ) => {
        const updatedConversation = {
            ...conversation,
            [data.key]: data.value,
        };

        const { single, all } = updateConversation(
            updatedConversation,
            conversations, //
        );

        if ((selectedConversation && selectedConversation.id) === updatedConversation.id) {
            dispatch({field: 'selectedConversation', value: conversationWithUncompressedMessages(single)});
        }

        if (isRemoteConversation(updatedConversation)) uploadConversation(conversationWithUncompressedMessages(single));
       
        dispatch({ field: 'conversations', value: all });
    };

    const clearWorkspace = async () => {
        await dispatch({ field: 'conversations', value: [] });
        await dispatch({ field: 'prompts', value: [] });
        await dispatch({ field: 'folders', value: [] });

        saveConversations([]);
        saveFolders([]);
        savePrompts([]);

        await dispatch({ field: 'selectedConversation', value: null });
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

    // useEffect(() => {
    //     const getOps = async () => {
    //         try {
    //             const ops = await getOpsForUser();
    //
    //             const opMap:{[key:string]:any} = {};
    //             ops.data.forEach((op:any) => {
    //                 opMap[op.id] = op;
    //             })
    //
    //             console.log("Ops", opMap)
    //             dispatch({field: 'ops', value: opMap});
    //         } catch (e) {
    //             console.error('Error getting ops', e);
    //         }
    //     }
    //     if(session?.user) {
    //        getOps();
    //     }
    // }, [session]);

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


    };

    // EFFECTS  --------------------------------------------

    useEffect(() => {
        if (window.innerWidth < 640) {
            dispatch({ field: 'showChatbar', value: false });
            dispatch({ field: 'showPromptbar', value: false });
        }
    }, [selectedConversation]);

    useEffect(() => {
        defaultModelId &&
            dispatch({ field: 'defaultModelId', value: defaultModelId });
        
    }, [defaultModelId]);

    // ON LOAD --------------------------------------------

    useEffect(() => {
        const settings = getSettings();
        if (settings.theme) {
            dispatch({
                field: 'lightMode',
                value: settings.theme,
            });
        }


        const workspaceMetadataStr = localStorage.getItem('workspaceMetadata');
        if (workspaceMetadataStr) {
            dispatch({ field: 'workspaceMetadata', value: JSON.parse(workspaceMetadataStr) });
        }

        if (window.innerWidth < 640) {
            dispatch({ field: 'showChatbar', value: false });
            dispatch({ field: 'showPromptbar', value: false });
        }

        const showChatbar = localStorage.getItem('showChatbar');
        if (showChatbar) {
            dispatch({ field: 'showChatbar', value: showChatbar === 'true' });
        }

        const showPromptbar = localStorage.getItem('showPromptbar');
        if (showPromptbar) {
            dispatch({ field: 'showPromptbar', value: showPromptbar === 'true' });
        }

        const storageSelection = localStorage.getItem('storageSelection');
        if (storageSelection) {
            dispatch({field: 'storageSelection', value: storageSelection});
        }

        const prompts = localStorage.getItem('prompts');
        if (prompts) {
            dispatch({ field: 'prompts', value: JSON.parse(prompts) });
        }

        const workflows = localStorage.getItem('workflows');
        if (workflows) {
            dispatch({ field: 'workflows', value: JSON.parse(workflows) });
        }

        const folders = localStorage.getItem('folders');
        const foldersParsed = JSON.parse(folders ? folders : '[]')
        if (folders) {
            dispatch({ field: 'folders', value: foldersParsed });
        }


        // Create a string for the current date like Oct-18-2021
        const dateName = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        const conversationHistory = localStorage.getItem('conversationHistory');
        let conversations: Conversation[] = JSON.parse(conversationHistory ? conversationHistory : '[]');
        //ensure all conversation messagea are compressed 
        conversations = compressAllConversationMessages(conversations);

        // call fetach all conversations 
        const lastConversation: Conversation | null = (conversations.length > 0) ? conversations[conversations.length - 1] : null;
        const lastConversationFolder: FolderInterface | null = lastConversation && foldersParsed ? foldersParsed.find((f: FolderInterface) => f.id === lastConversation.folderId) : null;

        let selectedConversation: Conversation | null = lastConversation ? { ...lastConversation } : null;

        if (!lastConversation || lastConversation.name !== 'New Conversation' ||
            (lastConversationFolder && lastConversationFolder.name !== dateName)) {

            // See if there is a folder with the same name as the date
            let folder = foldersParsed.find((f: FolderInterface) => f.name === dateName);
            if (!folder) {
                const newFolder: FolderInterface = {
                    id: uuidv4(),
                    date: new Date().toISOString().slice(0, 10),
                    name: dateName,
                    type: "chat"
                };

                folder = newFolder;
                const updatedFolders = [...foldersParsed, newFolder];

                dispatch({ field: 'folders', value: updatedFolders });
                saveFolders(updatedFolders);
            }

            //new conversation on load 
            const newConversation: Conversation = {
                id: uuidv4(),
                name: t('New Conversation'),
                messages: [],
                model: OpenAIModels[defaultModelId],
                prompt: DEFAULT_SYSTEM_PROMPT,
                temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
                folderId: folder.id,
                promptTemplate: null,
                isLocal: getIsLocalStorageSelection()
            };

            const upload  = async (c: Conversation) => await uploadConversation(c);
            upload(newConversation);
            // Ensure the new conversation is added to the list of conversationHistory
            conversations.push(newConversation);

            selectedConversation = { ...newConversation };

        }

        dispatch({ field: 'selectedConversation', value: selectedConversation });
        localStorage.setItem('selectedConversation', JSON.stringify(selectedConversation));

        if (conversationHistory) {
            const cleanedConversationHistory = cleanConversationHistory(conversations);

            dispatch({ field: 'conversations', value: cleanedConversationHistory });
            localStorage.setItem('conversationHistory', JSON.stringify(cleanedConversationHistory))
        }

        dispatch({
            field: 'conversationStateId',
            value: 'post-init',
        });
    }, [
        defaultModelId,
        dispatch,
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

    const handleScroll = (event: any) => {
        const scrollableElement = event.currentTarget;
        const hasScrollableContent = scrollableElement.scrollHeight > scrollableElement.clientHeight;
        const isAtBottom = scrollableElement.scrollHeight - scrollableElement.scrollTop === scrollableElement.clientHeight;
        if (hasScrollableContent && isAtBottom) {
            dispatch({ field: 'hasScrolledToBottom', value: true });
        } else if (!hasScrollableContent) {
            dispatch({ field: 'hasScrolledToBottom', value: true });
        }
    };

    const checkScrollableContent = () => {
        const scrollableElement = document.querySelector('.data-disclosure');
        if (scrollableElement) {
            const hasScrollableContent = scrollableElement.scrollHeight > scrollableElement.clientHeight;
            dispatch({ field: 'hasScrolledToBottom', value: !hasScrollableContent });
        }
    };

    useEffect(() => {
        if (featureFlags.dataDisclosure && window.location.hostname !== 'localhost') {
            const fetchDataDisclosureDecision = async () => {
                const { hasAcceptedDataDisclosure } = contextValue.state;
                if (email && (!hasAcceptedDataDisclosure)) {
                    try {
                        const decision = await checkDataDisclosureDecision(email);
                        const decisionBodyObject = JSON.parse(decision.item.body);
                        const decisionValue = decisionBodyObject.acceptedDataDisclosure;
                        // console.log("Decision: ", decisionValue);
                        dispatch({ field: 'hasAcceptedDataDisclosure', value: decisionValue });
                        if (!decisionValue) { // Fetch the latest data disclosure only if the user has not accepted it
                            const latestDisclosure = await getLatestDataDisclosure();
                            const latestDisclosureBodyObject = JSON.parse(latestDisclosure.item.body);
                            const latestDisclosureUrlPDF = latestDisclosureBodyObject.pdf_pre_signed_url;
                            const latestDisclosureHTML = latestDisclosureBodyObject.html_content;
                            dispatch({ field: 'latestDataDisclosureUrlPDF', value: latestDisclosureUrlPDF });
                            dispatch({ field: 'latestDataDisclosureHTML', value: latestDisclosureHTML });

                            checkScrollableContent();
                        }
                    } catch (error) {
                        console.error('Failed to check data disclosure decision:', error);
                        dispatch({ field: 'hasAcceptedDataDisclosure', value: false });
                    }
                }
            };

            fetchDataDisclosureDecision();
        }
    }, [email,
        dispatch,
        hasAcceptedDataDisclosure,
        featureFlags.dataDisclosure]);

    if (session) {
        if (featureFlags.dataDisclosure && window.location.hostname !== 'localhost') {
            if (hasAcceptedDataDisclosure === null) { // Decision is still being checked, render a loading indicator
                return (
                    <main
                        className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
                    >
                        <div
                            className="flex flex-col items-center justify-center min-h-screen text-center text-white dark:text-white">
                            <Loader />
                            <h1 className="mb-4 text-2xl font-bold">
                                Loading...
                            </h1>
                        </div>
                    </main>);
            } else if (!hasAcceptedDataDisclosure) { // User has not accepted the data disclosure agreement, do not render page content
                return (
                    <main
                        className={`flex h-screen w-screen flex-col text-sm ${lightMode}`}
                    >
                        <div
                            className="flex flex-col items-center justify-center min-h-screen text-center dark:bg-[#444654] bg-white dark:text-white text-black">
                            <h1 className="text-2xl font-bold dark:text-white">
                                Amplify Data Disclosure Agreement
                            </h1>
                            <a href={latestDataDisclosureUrlPDF} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', marginBottom: '10px' }}>Download the data disclosure agreement</a>
                            <div
                                className="data-disclosure dark:bg-[#343541] bg-gray-50 dark:text-white text-black text-left"
                                style={{
                                    overflowY: 'scroll',
                                    border: '1px solid #ccc',
                                    padding: '20px',
                                    marginBottom: '10px',
                                    height: '500px',
                                    width: '30%',
                                }}
                                onScroll={handleScroll}
                                dangerouslySetInnerHTML={{ __html: latestDataDisclosureHTML || '' }}
                            />
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={inputEmail}
                                onChange={(e) => dispatch({ field: 'inputEmail', value: e.target.value })}
                                style={{
                                    marginBottom: '10px',
                                    padding: '4px 10px',
                                    borderRadius: '5px',
                                    border: '1px solid #ccc',
                                    color: 'black',
                                    backgroundColor: 'white',
                                    width: '300px',
                                    boxSizing: 'border-box',
                                }}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        // Duplicated logic from the button's onClick handler
                                        if (session && session.user && session.user.email) {
                                            if (inputEmail.toLowerCase() === session.user.email.toLowerCase()) {
                                                if (hasScrolledToBottom) {
                                                    saveDataDisclosureDecision(session.user.email, true);
                                                    dispatch({ field: 'hasAcceptedDataDisclosure', value: true });
                                                } else {
                                                    alert('You must scroll to the bottom of the disclosure before accepting.');
                                                }
                                            } else {
                                                alert('The entered email does not match your account email.');
                                            }
                                        } else {
                                            console.error('Session or user is undefined.');
                                        }
                                    }
                                }}
                            />
                            <button
                                onClick={() => {
                                    if (session && session.user && session.user.email) {
                                        if (inputEmail.toLowerCase() === session.user.email.toLowerCase()) {
                                            if (hasScrolledToBottom) {
                                                saveDataDisclosureDecision(session.user.email, true);
                                                dispatch({ field: 'hasAcceptedDataDisclosure', value: true });
                                            }
                                            else {
                                                alert('You must scroll to the bottom of the disclosure before accepting.');
                                            }
                                        } else {
                                            alert('The entered email does not match your account email.');
                                        }
                                    } else {
                                        console.error('Session or user is undefined.');
                                    }
                                }}
                                style={{
                                    backgroundColor: 'white',
                                    color: 'black',
                                    fontWeight: 'bold',
                                    padding: '4px 20px',
                                    borderRadius: '5px',
                                    border: '1px solid #ccc',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.3s ease-in-out',
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#48bb78'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                                Accept
                            </button>
                        </div>
                    </main>
                );
            }
        }

        // @ts-ignore
        return (
            <HomeContext.Provider
                value={{
                    ...contextValue,
                    handleNewConversation,
                    handleStopConversation,
                    shouldStopConversation,
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
                    <meta name="description" content="ChatGPT but better." />
                    <meta
                        name="viewport"
                        content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
                    />
                    <link rel="icon" href="/favicon.ico" />
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
                                                <IconLogout className="m-2" />
                                                <span>{isLoading ? 'Loading...' : getName(user?.email) ?? 'Unnamed user'}</span>
                                            </div>

                                        </button>

                                    </div>
                                }
                            >
                                <Tab icon={<IconMessage />} title="Chats"><Chatbar /></Tab>
                                <Tab icon={<IconShare />} title="Share"><SharedItemsList /></Tab>
                                <Tab icon={<IconTournament />} title="Workspaces"><WorkspaceList /></Tab>
                                <Tab icon={<IconSettings />} title="Settings"><SettingsBar /></Tab>
                            </TabSidebar>

                            <div className="flex flex-1">
                                {page === 'chat' && (
                                    <Chat stopConversationRef={stopConversationRef} />
                                )}
                                {page === 'market' && (
                                    <Market items={[
                                        // {id: "1", name: "Item 1"},
                                    ]} />
                                )}
                                {page === 'home' && (
                                    <MyHome />
                                )}
                            </div>


                            <TabSidebar
                                side={"right"}
                            >
                                <Tab icon={<Icon3dCubeSphere />}><Promptbar /></Tab>
                                {/*<Tab icon={<IconBook2/>}><WorkflowDefinitionBar/></Tab>*/}
                            </TabSidebar>

                        </div>

                        <LoadingDialog open={loadingSelectedConv} message={"Loading Conversation..."}/>
                        <LoadingDialog open={loadingAmplify} message={"Setting Up Amplify..."}/>
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
                    <Loader />
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
                        <LoadingIcon />
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

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
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



    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleCSEId = process.env.GOOGLE_CSE_ID;

    // if (googleApiKey && googleCSEId) {
    //     serverSidePluginKeysSet = true;
    // }

    return {
        props: {
            availableModels,
            chatEndpoint,
            defaultModelId,
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
