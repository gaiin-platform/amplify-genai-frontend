import { useEffect, useRef, useState, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { Tab, TabSidebar } from "@/components/TabSidebar/TabSidebar";
import { SettingsBar } from "@/components/Settings/SettingsBar";
import { checkDataDisclosureDecision, getLatestDataDisclosure, saveDataDisclosureDecision } from "@/services/dataDisclosureService";
import { getIsLocalStorageSelection, saveStorageSettings, updateWithRemoteConversations } from '@/utils/app/conversationStorage';
import cloneDeep from 'lodash/cloneDeep';
import {styled} from "styled-components";
import {LoadingDialog} from "@/components/Loader/LoadingDialog";
import { MemoryDialog } from '@/components/Memory/MemoryDialog';


import {
    cleanConversationHistory,
} from '@/utils/app/clean';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import {
    saveConversations,
    saveConversationDirect,
    saveConversationsDirect,
    updateConversation,
    compressAllConversationMessages,
    conversationWithUncompressedMessages,
    isRemoteConversation,
    deleteConversationCleanUp,
} from '@/utils/app/conversation';
import { getArchiveNumOfDays, getHiddenGroupFolders, saveFolders } from '@/utils/app/folders';
import { savePrompts } from '@/utils/app/prompts';
import { getSettings, saveSettings } from '@/utils/app/settings';
import { storageGet, storageSet } from '@/utils/app/storage';
import { getAccounts } from "@/services/accountService";

import { Conversation, Message, newMessage } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { FolderInterface, FolderType } from '@/types/folder';
import { Prompt } from '@/types/prompt';


import { Chat } from '@/components/Chat/Chat';
import { Chatbar } from '@/components/Chatbar/Chatbar';
import { Navbar } from '@/components/Mobile/Navbar';
import Promptbar from '@/components/Promptbar';
import {
    Icon3dCubeSphere,
    IconTournament,
    IconShare,
    IconMessage,
    IconSettings,
    IconDeviceSdCard,
    IconLogout,
    IconSparkles,
    IconHammer,
} from "@tabler/icons-react";

import { initialState } from './home.state';
import useEventService from "@/hooks/useEventService";
import { v4 as uuidv4 } from 'uuid';


import { WorkflowDefinition } from "@/types/workflow";
import { saveWorkflowDefinitions } from "@/utils/app/workflows";
import SharedItemsList from "@/components/Share/SharedItemList";
// import { Market } from "@/components/Market/Market";
import { useSession, signIn, signOut, getSession } from "next-auth/react"
import Loader from "@/components/Loader/Loader";
import { ConversationAction, useHomeReducer } from "@/hooks/useHomeReducer";
import { MyHome } from "@/components/My/MyHome";
import { DEFAULT_ASSISTANT } from '@/types/assistant';
import { deleteAssistant, listAssistants } from '@/services/assistantService';
import { filterAstsByFeatureFlags, getAssistant, isAssistant, syncAssistants } from '@/utils/app/assistants';
import { fetchAllRemoteConversations, fetchRemoteConversation, uploadConversation } from '@/services/remoteConversationService';
import {killRequest as killReq} from "@/services/chatService";
import { DefaultUser } from 'next-auth';
import { addDateAttribute, getFullTimestamp, getDateName } from '@/utils/app/date';
import HomeContext, {  ClickContext, Processor } from './home.context';
import { ReservedTags } from '@/types/tags';
import { noCoaAccount } from '@/types/accounts';
import { noRateLimit } from '@/types/rateLimit';
import { fetchAstAdminGroups } from '@/services/groupsService';
import { contructGroupData } from '@/utils/app/groups';
import { getAllArtifacts } from '@/services/artifactsService';
import { baseAssistantFolder, basePrompts, isBaseFolder, isOutDatedBaseFolder } from '@/utils/app/basePrompts';
import { fetchUserSettings } from '@/services/settingsService';
import { Settings } from '@/types/settings';
import { getAvailableModels, getFeatureFlags, getPowerPoints, getUserAppConfigs } from '@/services/adminService';
import { DefaultModels, Model } from '@/types/model';
import { ErrorMessage } from '@/types/error';
import { fetchEmailSuggestions } from '@/services/emailAutocompleteService';
import { getSharedItems } from '@/services/shareService';
import { lowestCostModel } from '@/utils/app/models';
import { useRouter } from 'next/router';
import { AdminConfigTypes } from '@/types/admin';
import { ConversationStorage } from '@/types/conversationStorage';
import UserMenu from '@/components/Layout/UserMenu';
import { Logo } from '@/components/Logo/Logo';
import { ThemeService } from '@/utils/whiteLabel/themeService';

const LoadingIcon = styled(Icon3dCubeSphere)`
  color: lightgray;
  height: 150px;
  width: 150px;
`;


interface Props {
    ClientId: string | null;
    cognitoDomain: string | null;
    cognitoClientId: string | null;
    mixPanelToken: string;
    chatEndpoint: string | null;
}


const Home = ({
    cognitoClientId,
    cognitoDomain,
    mixPanelToken,
    chatEndpoint,
}: Props) => {
    const { t } = useTranslation('chat');
    const [initialRender, setInitialRender] = useState<boolean>(true);
    // const [loadingSelectedConv, setLoadingSelectedConv] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');

    const [loadingAmplify, setLoadingAmplify] = useState<boolean>(true);

    const [dataDisclosure, setDataDisclosure] = useState<{url: string, html: string | null}|null>(null);
    const [hasAcceptedDataDisclosure, sethasAcceptedDataDisclosure] = useState<boolean | null> (null);

    const { data: session, status } = useSession();
    const [user, setUser] = useState<DefaultUser | null>(null);

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
            selectedAssistant,
            page,
            statsService,
            inputEmail,
            hasScrolledToBottom,
            featureFlags,
            storageSelection,
            groups,
            defaultModelId,
            availableModels,
            advancedModelId,
            cheapestModelId,
            workspaces
        },
        dispatch,
    } = contextValue;


    const promptsRef = useRef(prompts);


    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);


    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);


    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    const stopConversationRef = useRef<boolean>(false);

    const featureFlagsRef = useRef(featureFlags);

    useEffect(() => {
        featureFlagsRef.current = featureFlags;
        window.dispatchEvent(new Event('updateFeatureSettings'));
    }, [featureFlags]);

    // Initialize theme from ThemeService on mount
    useEffect(() => {
        const initialTheme = ThemeService.getInitialTheme();
        if (initialTheme !== lightMode) {
            dispatch({ field: 'lightMode', value: initialTheme });
        }
    }, []); // Run once on mount

    const [settings, setSettings] = useState<Settings>();

    useEffect(() => {
        const handleEvent = (event:any) => setSettings( getSettings(featureFlagsRef.current) );
        window.addEventListener('updateFeatureSettings', handleEvent);
        return () => window.removeEventListener('updateFeatureSettings', handleEvent)
    }, []);



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
        if (chatEndpoint) dispatch({ field: 'chatEndpoint', value: chatEndpoint });
    }, [chatEndpoint]);

    const router = useRouter();

    // Handle callback URL redirect
    useEffect(() => {
        const callbackUrl = router.query.callbackUrl as string;
        if (session && callbackUrl) {
            router.push(callbackUrl);
        }
    }, [session, router]);


    const handleSelectConversation = async (conversation: Conversation) => {
        statsService.openConversationsEvent();
        window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false}} ));
        window.dispatchEvent(new Event('cleanupApiKeys'));
        // if we click on the conversation we are already on, then dont do anything
        if (selectedConversation && (conversation.id === selectedConversation.id) && isRemoteConversation(selectedConversation)) return;
        //loading 
        //old conversations that do not have IsLocal are automatically local
        if (!('isLocal' in conversation)) {
            conversation.isLocal = true;
        }
        // setLoadingSelectedConv(true);
        setLoadingMessage('Loading Conversation...');

        let newSelectedConv = null;
        // check if it isLocal? if not get the conversation from s3
        if (isRemoteConversation(conversation)) { 
            const remoteConversation = await fetchRemoteConversation(conversation.id, conversationsRef.current, dispatch);
            if (remoteConversation) {
                newSelectedConv = {...remoteConversation, folderId: conversation.folderId || null}; 
            }
        } else {
            newSelectedConv = conversationWithUncompressedMessages(cloneDeep(conversation));
        }
        setLoadingMessage('');

        if (newSelectedConv) {
            //add last used assistant if there was one used else should be removed
            if (newSelectedConv.messages && newSelectedConv.messages.length > 0) {
                const lastMessage: Message = newSelectedConv.messages[newSelectedConv.messages.length - 1];
                if (lastMessage.data && lastMessage.data.state && lastMessage.data.state.currentAssistant) {
                    const astName = lastMessage.data.state.currentAssistant;
                    const assistantPrompt =  promptsRef.current.find((prompt:Prompt) => prompt.name === astName);
                    const assistant = assistantPrompt?.data?.assistant ? assistantPrompt.data.assistant : DEFAULT_ASSISTANT;
                    dispatch({ field: 'selectedAssistant', value: assistant });
                }
            } else {
                dispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT });
            }

            const isModelAvailable = conversation.model ? Object.keys(availableModels).includes(conversation.model.id) : false;
            if (!isModelAvailable) { // for cases when the model used in these conversation are no longer available to the user
                const validModel =  getDefaultModel(DefaultModels.DEFAULT);
                newSelectedConv.model = validModel;
                await handleUpdateConversation(conversation, {
                    key: 'model',
                    value: validModel,
                })
            }

            dispatch({ field: 'page', value: 'chat' });

            dispatch({  field: 'selectedConversation',
                        value: newSelectedConv
                    });
                    
            // Reset standalone flag when selecting a conversation
            dispatch({ field: 'isStandalonePromptCreation', value: false });

        }
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


    const handleCreateFolder = (name: string, type: FolderType):FolderInterface => {

        const newFolder: FolderInterface = {
            id: uuidv4(),
            date: getFullTimestamp(),
            name,
            type,
        };

        const updatedFolders = [...folders, newFolder];

        dispatch({ field: 'folders', value: updatedFolders });
        saveFolders(updatedFolders);
        foldersRef.current = updatedFolders;
        return newFolder;
    };

    const handleDeleteFolder = (folderId: string) => {
        const folderType : FolderType | undefined= foldersRef.current.find((f:FolderInterface) => f.id === folderId)?.type;
        
        console.log("Deleting folder of type: ", folderType);

        switch (folderType) {
            case 'chat':
            const updatedConversations = conversationsRef.current.reduce((acc: Conversation[], c:Conversation) => {
                                            if (c.folderId === folderId) {
                                                statsService.deleteConversationEvent(c);
                                                deleteConversationCleanUp(c);
                                            } else {
                                                acc.push(c);
                                            }
                                            return acc;
                                        }, [] as Conversation[]);


            if (updatedConversations.length > 0) {
                const selectedNotDeleted = selectedConversation ?
                    updatedConversations.some((conversation:Conversation) =>
                        conversation.id === selectedConversation.id) : false;
                if (!selectedNotDeleted) { // was deleted
                    const newSelectedConversation = updatedConversations[updatedConversations.length - 1];
                    handleSelectConversation(newSelectedConversation);
                }

            } else {
                    dispatch({
                        field: 'selectedConversation',
                        value: {
                            id: uuidv4(),
                            name: t('New Conversation'),
                            messages: [],
                            model: getDefaultModel(DefaultModels.DEFAULT),
                            prompt: DEFAULT_SYSTEM_PROMPT,
                            temperature: DEFAULT_TEMPERATURE,
                            folderId: null,
                            isLocal: getIsLocalStorageSelection(storageSelection)

                        },
                    });

                localStorage.removeItem('selectedConversation');
            }
            dispatch({ field: 'conversations', value: updatedConversations });
            saveConversations(updatedConversations);
            break
            case 'prompt':
                const updatedPrompts: Prompt[] =  promptsRef.current.map((p:Prompt) => {
                    if (p.folderId === folderId) {
                        const isReserved = (isAssistant(p) && p?.data?.tags?.includes(ReservedTags.SYSTEM));
                        if (isReserved) {
                            return {
                                ...p,
                                folderId: null,
                            };
                        }
                        const canDelete = (!p.data || !p.data.noDelete); 
        
                        if (selectedAssistant && p?.data?.assistant?.definition.assistantId === selectedAssistant.definition.assistantId) dispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT }); 
                        if(isAssistant(p) && canDelete ){
                           const assistant = getAssistant(p);
                           if (assistant && assistant.assistantId) deleteAssistant(assistant.assistantId);
                        }
                        return undefined;
                    }
                    return p;
                }).filter((p): p is Prompt => p !== undefined);;
        
                dispatch({ field: 'prompts', value: updatedPrompts });
                savePrompts(updatedPrompts);
                break
            case 'workflow':
                const updatedWorkflows: WorkflowDefinition[] = workflows.map((p:WorkflowDefinition) => {
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
                break
        }
        const updatedFolders = foldersRef.current.filter((f:FolderInterface) => (f.id !== folderId));
        
        dispatch({ field: 'folders', value: updatedFolders });
        saveFolders(updatedFolders);
        foldersRef.current = updatedFolders;
    };


    const handleUpdateFolder = (folderId: string, name: string) => {
        const updatedFolders = foldersRef.current.map((f:FolderInterface) => {
            if (f.id === folderId) {
                return {...f, name: name};
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

        const lastConversation = conversationsRef.current[conversationsRef.current.length - 1];

        // Create a string for the current date like Oct-18-2021
        const date = getDateName();

        // See if there is a folder with the same name as the date
        let folder = foldersRef.current.find((f:FolderInterface) => f.name === date);

        if (!folder) {
            folder = handleCreateFolder(date, "chat");
        }

        const newConversation: Conversation = {
            id: uuidv4(),
            name: t('New Conversation'),
            messages: [],
            model: lastConversation?.model ?? (defaultModelId ? availableModels[defaultModelId] : Object.values(availableModels)[0]),
            prompt: DEFAULT_SYSTEM_PROMPT,
            temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
            folderId: folder.id,
            promptTemplate: null,
            isLocal: getIsLocalStorageSelection(storageSelection),
            date: getFullTimestamp(),
            ...params
        };
        if (isRemoteConversation(newConversation)) uploadConversation(newConversation, foldersRef.current);

        statsService.newConversationEvent();

        const updatedConversations = [...conversationsRef.current, newConversation];

        dispatch({ field: 'selectedConversation', value: newConversation });
        dispatch({ field: 'conversations', value: updatedConversations });

        saveConversations(updatedConversations);

        dispatch({ field: 'loading', value: false });
    };

    const handleForkConversation = async (messageIndex: number, setAsSelected = true) => {
            statsService.forkConversationEvent();
            if (selectedConversation) {
                setLoadingMessage("Forking Conversation...");
                const newConversation = cloneDeep({
                                                   ...selectedConversation,  
                                                   id: uuidv4(), 
                                                   codeInterpreterAssistantId: undefined,
                                                   date: getFullTimestamp(),
                                                   messages: selectedConversation?.messages.slice(0, messageIndex + 1)
                                                             .map((m:Message) => {
                                                                if ( m.data?.state?.codeInterpreter ) {
                                                                    const {codeInterpreter, ...state} = m.data?.state;
                                                                    return {...m, data: {...m.data, state : state}}
                                                                }
                                                                return m;
                                                             })});
                if (isRemoteConversation(newConversation)) await uploadConversation(newConversation, foldersRef.current);
                statsService.newConversationEvent();
    
                const updatedConversations = [...conversations, newConversation];
                dispatch({ field: 'conversations', value: updatedConversations });
                saveConversations(updatedConversations);
                setLoadingMessage("");
                if (setAsSelected) await handleSelectConversation(newConversation);
            }
            
    };

    const handleUpdateSelectedConversation = (updatedConversation: Conversation) => {
        const { single, all } = updateConversation(
            updatedConversation,
            [...conversationsRef.current], 
        );

        if (isRemoteConversation(updatedConversation)) uploadConversation(single, foldersRef.current);
    
        dispatch({
            field: 'selectedConversation',
            value: single,
        }); 

        dispatch({field: 'conversations', value: all});
    }

    

    const handleUpdateConversation = async (
        conversation: Conversation,
        data: KeyValuePair,
    ) => {

        // console.log("Previous Conversation: ", conversation)
        // console.log("Updating data: ", data)

        const completeConversation: Conversation | null | undefined = await getCompleteConversation(conversation);
        // would only happen in cases of faiing to fetch remote conversation which already has a failed alert
        if (!completeConversation) return; 
       
        const updatedConversation: Conversation = { // will be the full conversation 
            ...completeConversation,
            [data.key]: data.value,
        };
        const { single, all } = updateConversation(
            updatedConversation,
            conversations, 
        );

        if (selectedConversation && (conversation.id === selectedConversation.id)) dispatch({field: 'selectedConversation', value: single});
        if (isRemoteConversation(conversation)) uploadConversation(single, foldersRef.current);
       
        dispatch({ field: 'conversations', value: all });
    };

    const getCompleteConversation = async (conversation: Conversation) => {
        const isRemote = isRemoteConversation(conversation);
        const isSelected = selectedConversation && (conversation.id === selectedConversation.id);

        return isSelected ? selectedConversation :
                 isRemote ? await fetchRemoteConversation(conversation.id) 
                          : conversationWithUncompressedMessages(conversation);
    }


    const clearWorkspace = async () => {
        dispatch({ field: 'conversations', value: [] });
        dispatch({ field: 'prompts', value: [] });
        dispatch({ field: 'folders', value: [] });

        saveConversations([]);
        saveFolders([]);
        savePrompts([]);

        dispatch({ field: 'selectedConversation', value: null });
    }

    useEffect(() => {
        if (!messageIsStreaming &&
            conversationStateId !== "init" &&
            conversationStateId !== "post-init"
        ) {

            if (selectedConversation) {
                saveConversationDirect(selectedConversation);
            }
            saveConversationsDirect(conversationsRef.current);
        }
    }, [conversationStateId]);


    const handleAddMessages = (selectedConversation: Conversation | undefined, messages: any) => {
        if (selectedConversation) {
            dispatch(
                {
                    type: 'conversation',
                    action: {
                        type: 'addMessages',
                        conversation: selectedConversation,
                        messages: messages
                    }
                }
            )
        }
    };

    
    const handleConversationAction = async (conversationAction: ConversationAction) => {
        // check if we have the entire conversation 
        let conversation = conversationAction.conversation;

        const completeConversation: Conversation | null | undefined = await getCompleteConversation(conversation);
        // would only happen in cases of faiing to fetch remote conversation which already has a failed alert
        if (!completeConversation) return; 

        dispatch({
            type: 'conversation',
            action: conversationAction,
          });
        
    }

    const getDefaultModel = (defaultType: DefaultModels) => {
        let model: Model | undefined = undefined;
        switch (defaultType) {
            case (DefaultModels.DEFAULT): 
                if (defaultModelId) model = availableModels[defaultModelId];
                break;
            case (DefaultModels.ADVANCED): 
                if (advancedModelId) model = availableModels[advancedModelId];
                break;
            case (DefaultModels.CHEAPEST): 
                if (cheapestModelId) model = availableModels[cheapestModelId];
                break;
        } 
        return model ?? (selectedConversation?.model ??  Object.values(availableModels)[0]);
    }

    // EFFECTS  --------------------------------------------

    useEffect(() => {
        if (window.innerWidth < 640) {
            dispatch({ field: 'showChatbar', value: false });
            dispatch({ field: 'showPromptbar', value: false });
        }
        // check if the conversation has messages 
        if (selectedConversation && !selectedConversation.messages) {
            console.warn("Warning: Selected Conversation has no messages!");
            //will fetch the remote conversation data and uncompress local messages 
            handleSelectConversation(selectedConversation);
        } 
    }, [selectedConversation]);


    useEffect (() => {
        if (!user && session?.user) setUser(session.user as DefaultUser);
    }, [session])


    useEffect(() => {
        // @ts-ignore
        if (["RefreshAccessTokenError", "SessionExpiredError"].includes(session?.error)) {
            signOut();
            setUser(null);
        }
    }, [session]);


    // Amplify Data Calls - Happens Right After On Load--------------------------------------------

    useEffect(() => {

        const fetchModels = async (hasAdminAccess: boolean) => {      
            console.log("Fetching Models...");
            let message = 'There was a problem retrieving the available models, please contact our support team.';
            try {
                const response = await getAvailableModels();
                if (response.success && response.data) {
                    if (response.data?.models.length === 0) {
                        if (hasAdminAccess) message = "Click on the gear icon on the left sidebar, select 'Admin Interface', and navigate to the 'Supported Models' tab to enable model availability.";
                    } else {
                        const defaultModel = response.data.default;
                        const models = response.data.models;
                        // for on-load for those who have no saved default, no last conversations with a valid model reference
                        if (selectedConversation && selectedConversation?.model?.id === '') {
                            handleUpdateSelectedConversation({...selectedConversation, model: defaultModel ?? lowestCostModel(models)});
                        }

                        if (defaultModel) {
                            // console.log("DefaultModel dispatch: ", defaultModel);
                            dispatch({ field: 'defaultModelId', value: defaultModel.id });
                        }
                        if (response.data.cheapest) dispatch({ field: 'cheapestModelId', value: response.data.cheapest.id });
                        if (response.data.advanced) dispatch({ field: 'advancedModelId', value: response.data.advanced.id });
                        const modelMap = models.reduce((acc:any, model:any) => ({...acc, [model.id]: model}), {});
                        dispatch({ field: 'availableModels', value: modelMap});  

                        //save default model 
                        localStorage.setItem('defaultModel', JSON.stringify(defaultModel));
                        return;
                    }
                } 
            } catch (e) {
                console.log("Failed to fetch models: ", e);
            } 
            dispatch({ field: 'modelError', value: {code: null, title: "Failed to Retrieve Models",
                                                    messageLines: [message]} as ErrorMessage});  
        };

        const fetchDataDisclosureDecision = async (featureOn: boolean) => {
            if (featureOn) {
                try {
                    const decision = await checkDataDisclosureDecision();
                    const decisionBodyObject = JSON.parse(decision.body);
                    const decisionValue = decisionBodyObject.acceptedDataDisclosure;
                    // console.log("Decision: ", decisionValue);
                    sethasAcceptedDataDisclosure(decisionValue);
                    if (!decisionValue) { // Fetch the latest data disclosure only if the user has not accepted it
                        const latestDisclosure = await getLatestDataDisclosure();
                        const latestDisclosureBodyObject = JSON.parse(latestDisclosure.body);
                        // console.log(latestDisclosure);
                        const latestDisclosureUrlPDF = latestDisclosureBodyObject.pdf_pre_signed_url;
                        const latestDisclosureHTML = latestDisclosureBodyObject.html_content;
                        setDataDisclosure({url: latestDisclosureUrlPDF, html: latestDisclosureHTML});
                        // console.log("Data Disclosure: ", {url: latestDisclosureUrlPDF, html: latestDisclosureHTML});
                        checkScrollableContent();
                    }
                } catch (error) {
                    console.error('Failed to check data disclosure decision:', error);
                    sethasAcceptedDataDisclosure(false);
                }
            }

            setLoadingAmplify(false); 
        };

        const fetchAccounts = async () => {      
            console.log("Fetching Accounts...");
            try {
                const response = await getAccounts();
                if (response.success) {
                    const defaultAccount = response.data.find((account: any) => account.isDefault);
                    if (defaultAccount && !defaultAccount.rateLimit) defaultAccount.rateLimit = noRateLimit; 
                    dispatch({ field: 'defaultAccount', value: defaultAccount || noCoaAccount});  
                    return;
                } else {
                    console.log("Failed to fetch accounts.");
                }
            } catch (e) {
                console.log("Failed to fetch accounts: ", e);
            }
            dispatch({ field: 'defaultAccount', value: noCoaAccount});   
        };

        const fetchAmplifyUsers = async () => {      
            console.log("Fetching Amplify Users...");
            try {
                const response = await fetchEmailSuggestions("*");
                if (response && response.emails) {
                    dispatch({ field: 'amplifyUsers', value: response.emails});  
                } else {
                    console.log("Failed to fetch amplify users.");
                }
            } catch (e) {
                console.log("Failed to fetch amplify users: ", e);
            }  
        };

        const fetchUserAppConfigs = async () => {      
            console.log("Fetching User App Configs...");
            try {
                const response = await getUserAppConfigs();
                if (response.success) {
                    const data = response.data;
                    if (AdminConfigTypes.EMAIL_SUPPORT in data) {
                        const emailData = data[AdminConfigTypes.EMAIL_SUPPORT];
                        if (emailData && emailData.isActive && emailData.email) dispatch({ field: 'supportEmail', value: emailData.email});  
                    }
                    if (AdminConfigTypes.AI_EMAIL_DOMAIN in data) {
                        const emailDomain = data[AdminConfigTypes.AI_EMAIL_DOMAIN];
                        dispatch({ field: 'aiEmailDomain', value: emailDomain});  
                    }
                    if (AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE in data) {
                        const storageData = data[AdminConfigTypes.DEFAULT_CONVERSATION_STORAGE];
                            // honor users selection if it exists
                        if (!storageSelection && storageData) {
                            dispatch({ field: 'storageSelection', value: storageData as ConversationStorage}); 
                            saveStorageSettings(storageData as ConversationStorage);
                        }
                    }

                } else {
                    console.log("Failed to fetch user app configs.");
                }
            } catch (e) {
                console.log("Failed to fetch user app configs: ", e);
            }  
        };

        const fetchSettings = async () => {
            console.log("Fetching Settings...");
            try {
                const result = await fetchUserSettings();
                if (result.success) {
                    if (result.data) {
                        const serverSettings = result.data as Settings;
                        
                        // Preserve local theme preference - don't let server override it
                        const localTheme = ThemeService.getInitialTheme();
                        serverSettings.theme = localTheme;
                        
                        saveSettings(serverSettings);
                        window.dispatchEvent(new Event('updateFeatureSettings'));
                    }
                } else {
                    console.log("Failed to get user settings: ", result);
                }
            } catch (e) {
                console.log("Failed to get user settings: ", e);
            }
        }

        const fetchPowerPoints = async () => {   
            console.log("Fetching PowerPoints...");
            try {
                const response = await getPowerPoints();
                if (response.success) {
                    dispatch({ field: 'powerPointTemplateOptions', value: response.data });
                } else {
                    console.log("Failed to fetch powerpoints.");
                }
            } catch (e) {
                console.log("Failed to fetch powerpoints: ", e);
            } 
        };


        const fetchArtifacts = async () => {      
            console.log("Fetching Remote Artifacts...");
            try {
                const response = await getAllArtifacts();
                if (response.success) { 
                    if (response.data) dispatch({ field: 'artifacts', value: response.data});  
                } else {
                    console.log("Failed to fetch remote Artifacts.");
                } 
            } catch (e) {
                console.log("Failed to fetch remote Artifacts: ", e);
            }
        };


        const fetchFeatureFlags = async () => {
            console.log("Fetching Feature Flags...");
            try {
                // returns the groups you are inquiring about in a object with the group as the key and is they are on the group as the value
                const result = await getFeatureFlags();
                if (result.success && result.data) {
                    const flags: { [key:string] : boolean } = result.data;
                    // console.log("feature flags:", flags)
                    if (Object.keys(flags).length > 0) dispatch({ field: 'featureFlags', value: flags});
                    localStorage.setItem('mixPanelOn', JSON.stringify(flags.mixPanel ?? false));
                    return flags;
                } else {
                    console.log("Failed to get feature flags: ", result);
                }
            } catch (e) {
                console.log("Failed to get feature flagss: ", e);
            }
            return {};
        }

        const fetchWorkspaces = async (user: string) => {      
            console.log("Fetching user workspaces...");
            try {
                const response = await getSharedItems();

                if (response.success) {
                    const workspaces = response.items.filter((item: { sharedBy: string; }) =>  item.sharedBy === user);
                    dispatch({ field: 'workspaces', value: workspaces});  
                    storageSet('workspaces', JSON.stringify(workspaces));
                    return;
                } else {
                    console.log("Failed to fetch user workspaces.");
                }
            } catch (e) {
                console.log("Failed to fetch user workspaces: ", e);
            }  
        };

        const syncConversations = async (conversations: Conversation[], folders: FolderInterface[]) => {
            try {
                const days = getArchiveNumOfDays();
                const allRemoteConvs = await fetchAllRemoteConversations(days === 0 ? undefined : days);
                if (allRemoteConvs) return updateWithRemoteConversations(allRemoteConvs, conversations, folders, dispatch, getDefaultModel(DefaultModels.DEFAULT));
            } catch (e) {
                console.log("Failed to sync cloud conversations: ", e);
            }
            console.log("Failed to sync cloud conversations.");
            return {newfolders: []};
        }


        const syncGroups = async () => {
            console.log("Syncing Groups...");
            try {
                const userGroups = await fetchAstAdminGroups();
                if (userGroups.success) {
                    const groupData = contructGroupData(userGroups.data);
                    dispatch({ field: 'groups', value: groupData.groups});
                    return groupData;
                } 
            } catch (e) {
                console.log("Failed to import group data: ", e);
            }
            console.log("Failed to import group data.");
            return {groups: [], groupFolders: [] as FolderInterface[], groupPrompts: [] as Prompt[]};
        }


        const fetchPrompts = () => {
            console.log("Fetching Base Prompts...");
            const updatedFolders:FolderInterface[] = [...foldersRef.current.filter((f:FolderInterface) => !isBaseFolder(f.id) && !isOutDatedBaseFolder(f.id)),
                                                      ...basePrompts.folders];
            const updatedPrompts: Prompt[] =  [...promptsRef.current.filter((p: Prompt) => !p.folderId || (!isBaseFolder(p.folderId) && !isOutDatedBaseFolder(p.folderId))),
                                               ...basePrompts.prompts]
            
                    // currently we have no base conversations 
            return {updatedConversations: conversationsRef.current, updatedFolders, updatedPrompts};
        }

        // return list of assistants 
        const fetchAssistants = async (promptList:Prompt[], foldersList: FolderInterface[]) => {
            console.log("Fetching Assistants...");
            try {
                const assistants = await listAssistants();
                if (assistants) return syncAssistants(assistants, promptList, foldersList.map(f => f.id));
            } catch (e) {
                console.log("Failed to  list assistants: ", e);
            }
            console.log("Failed to list assistants.");
            return [];

        }

        // On Load Data
        const handleOnLoadData = async (flags: { [key: string]: boolean }) => {
            // new basePrompts no remote call 
            let { updatedConversations, updatedFolders, updatedPrompts} = fetchPrompts();

            let assistantLoaded = false;
            let groupsLoaded = false;

            const checkAndFinalizeUpdates = () => {
                if (assistantLoaded && groupsLoaded) {

                    const containsAssistantCreator = false;
                    if (!containsAssistantCreator) updatedPrompts.push()
                    // Only dispatch when both operations have completed
                    dispatch({ field: 'prompts', value: updatedPrompts });
                    dispatch({ field: 'syncingPrompts', value: false });
                    savePrompts(updatedPrompts);
                }
            }


            // Handle remote conversations
            // console.log("storeCloudConversations", flags.storeCloudConversations )
            if (flags.storeCloudConversations) {
                syncConversations(updatedConversations, updatedFolders)
                    .then(cloudConversationsResult => {
                        // currently base prompts does not have conversations so we know we are done syncing at this point 
                        dispatch({field: 'syncingConversations', value: false});
                        console.log('sync conversations complete');
                        const newCloudFolders = cloudConversationsResult.newfolders;
                        if (newCloudFolders.length > 0) {
                            const handleCloudFolderUpdate = () => {
                                updatedFolders = [...updatedFolders, ...cloudConversationsResult.newfolders];
                                dispatch({ field: 'folders', value: updatedFolders });
                                saveFolders(updatedFolders);
                            };

                            // to avoid a race condition between this and groups folders. we need to updates folders after groups because sync conversations call will likely take longer in most cases
                            if (groupsLoaded) {
                                handleCloudFolderUpdate();
                            } else {
                                console.log("Waiting on group folders to update");
                                // Poll or wait until groups are loaded
                                const checkGroupsLoaded = setInterval(() => {
                                    if (groupsLoaded) {
                                        clearInterval(checkGroupsLoaded);
                                        handleCloudFolderUpdate();
                                        console.log("Syncing cloud conversation folders done");
                                    }
                                }, 100); // Check every 100 milliseconds
                            }
                        }
                    })
                    .catch(error => console.log("Error syncing conversations:", error));
            } else {
                dispatch({field: 'syncingConversations', value: false});
            }

            // Fetch assistants
            fetchAssistants(updatedPrompts, updatedFolders)
                    .then(assistantsResultPrompts => {
                        // assistantsResultPrompts includes both list assistants and imported assistants
                        updatedPrompts = [...updatedPrompts.filter((p:Prompt) => !isAssistant(p) || (isAssistant(p) && p.groupId)),
                                            ...assistantsResultPrompts];
                        // dispatch({ field: 'prompts', value: updatedPrompts});
                        console.log('sync assistants complete');
                        assistantLoaded = true;
                        checkAndFinalizeUpdates(); 
                    })
                    .catch(error => {
                        console.log("Error fetching assistants:", error);
                        assistantLoaded = true;
                    });
                    
            // Sync groups
            syncGroups()
                .then(groupsResult => {
                    // filter out group folders that are hidden
                    const hiddenFolderIds: string[] = getHiddenGroupFolders().map((f:FolderInterface) => f.id);
                    const filteredGroupFolders:FolderInterface[] = groupsResult.groupFolders 
                                                                               .filter((f:FolderInterface) => !hiddenFolderIds.includes(f.id));
                    updatedFolders = [...updatedFolders.filter((f:FolderInterface) => !f.isGroupFolder), 
                                      ...filteredGroupFolders]
                    dispatch({field: 'folders', value: updatedFolders});
                    saveFolders(updatedFolders);

                    const groupPrompts = filterAstsByFeatureFlags(groupsResult.groupPrompts, flags);
                    updatedPrompts = [...updatedPrompts.filter((p : Prompt) => !p.groupId ), 
                                        ...groupPrompts];
                    
                    groupsLoaded = true;
                    console.log('sync groups complete');
                    checkAndFinalizeUpdates();
                    
                })
                .catch(error => {
                    console.log("Error syncing groups:", error); 
                    groupsLoaded = true;
                });

        }

        const handleFeatureDependantOnLoadData = async () => {
            const flags = await fetchFeatureFlags();
            fetchDataDisclosureDecision(flags.dataDisclosure);
            fetchModels(flags.adminInterface);
            if (flags.artifacts) fetchArtifacts(); // fetch artifacts 

            //Conversation, prompt, folder dependent calls
            handleOnLoadData(flags);
        }

        if (user && user.email && initialRender) {
            setInitialRender(false);
            
            // independent function calls / high priority
            fetchSettings(); // fetch user settings
            console.log("has workspaces" , workspaces);
            // local storage on load should set workspaces if fetched before  
            // saves us the extra calls   
            if (workspaces === null) fetchWorkspaces(user.email); 
            handleFeatureDependantOnLoadData(); 
            fetchAccounts();  // fetch accounts for chatting charging
            fetchAmplifyUsers();
            fetchUserAppConfigs();
            fetchPowerPoints();
 
        } 
    
    }, [user]);


    // ON LOAD --------------------------------------------

    useEffect(() => {
        if (!initialRender) return;
        
        const initializeData = async () => {
            console.log("Initial On Load");
            const settings = getSettings(featureFlags);
            setSettings(settings);

            // Use ThemeService as the source of truth for theme
            const initialTheme = ThemeService.getInitialTheme();
            if (settings.theme !== initialTheme) {
                // Update settings to match ThemeService
                settings.theme = initialTheme;
                saveSettings(settings);
            }
            
            dispatch({
                field: 'lightMode',
                value: initialTheme,
            });

            // will save us the call if a user does not have workspaces 
            const savedWorkspaces = await storageGet('workspaces');
            if (savedWorkspaces) {
                dispatch({ field: 'workspaces', value: JSON.parse(savedWorkspaces) });
            }

            if (window.innerWidth < 640) {
                dispatch({ field: 'showChatbar', value: false });
                dispatch({ field: 'showPromptbar', value: false });
            } else {
                const showChatbar = localStorage.getItem('showChatbar');
                if (!!showChatbar) {
                    dispatch({ field: 'showChatbar', value: showChatbar === 'true' });
                }

                const showPromptbar = localStorage.getItem('showPromptbar');
                if (!!showPromptbar) {
                    dispatch({ field: 'showPromptbar', value: showPromptbar === 'true' });
                }
            }

            const pluginLoc = localStorage.getItem('pluginLocation');
            if (pluginLoc) {
                dispatch({ field: 'pluginLocation', value: JSON.parse(pluginLoc) });
            }

           
            const storageSelection = localStorage.getItem('storageSelection');
            if (storageSelection) {
                dispatch({field: 'storageSelection', value: storageSelection});
            }

            const hiddenGroups = localStorage.getItem('hiddenGroupFolders');
            if (hiddenGroups) {
                dispatch({field: 'hiddenGroupFolders', value: JSON.parse(hiddenGroups) });
            }

            const prompts = await storageGet('prompts');
            const promptsParsed = JSON.parse(prompts ? prompts : '[]')
            if (prompts) {
                dispatch({ field: 'prompts', value: promptsParsed });
            }

            const workflows = await storageGet('workflows');
            if (workflows) {
                dispatch({ field: 'workflows', value: JSON.parse(workflows) });
            }

            let folderIds: string[] = [];

            const folders = await storageGet('folders');
            const foldersParsed = JSON.parse(folders ? folders : '[]')
            if (folders) {
                // for older folders with no date, if it can be transform to the correct format then we add the date attribte
                let updatedFolders:FolderInterface[] = foldersParsed.map((folder:FolderInterface) => {
                                            return "date" in folder ? folder : addDateAttribute(folder);
                                        })
                // Make sure the "assistants" folder exists and create it if necessary
                const assistantsFolder = updatedFolders.find((f:FolderInterface) => f.id === "assistants");
                if (!assistantsFolder) updatedFolders.push( baseAssistantFolder );
                
                dispatch({ field: 'folders', value: updatedFolders});
                folderIds = updatedFolders.map((f: FolderInterface) => f.id)
            }

            // Create a string for the current date like Oct-18-2021
            const dateName = getDateName();

            const conversationHistory = await storageGet('conversationHistory');
            let conversations: Conversation[] = JSON.parse(conversationHistory ? conversationHistory : '[]');
            //ensure all conversation messagea are compressed and folder exists
            conversations = compressAllConversationMessages(conversations).map((c: Conversation) => 
                                                !c.folderId || folderIds.includes(c.folderId) ? c : {...c, folderId: null});

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
                        date: getFullTimestamp(),
                        name: dateName,
                        type: "chat"
                    };

                    folder = newFolder;
                    const updatedFolders = [...foldersParsed, newFolder];

                    dispatch({ field: 'folders', value: updatedFolders });
                    saveFolders(updatedFolders);
                }

                let defaultModel = localStorage.getItem('defaultModel');
                defaultModel = defaultModel ? JSON.parse(defaultModel) : lastConversation?.model;

                //new conversation on load 
                const newConversation: Conversation = {
                    id: uuidv4(),
                    name: t('New Conversation'),
                    messages: [],
                    model: (defaultModel ?? {id:'', name: '', description: '', inputContextWindow: 0, supportsImages: false, supportsReasoning: false}) as Model, 
                    prompt: DEFAULT_SYSTEM_PROMPT,
                    temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
                    folderId: folder.id,
                    promptTemplate: null,
                    isLocal: getIsLocalStorageSelection(storageSelection)
                };

                if (isRemoteConversation(newConversation)) uploadConversation(newConversation, foldersRef.current);
                // Ensure the new conversation is added to the list of conversationHistory
                conversations.push(newConversation);

                selectedConversation = { ...newConversation };

            }

            dispatch({ field: 'selectedConversation', value: selectedConversation });

            if (conversationHistory) {
                const cleanedConversationHistory = cleanConversationHistory(conversations, getDefaultModel(DefaultModels.DEFAULT));

                dispatch({ field: 'conversations', value: cleanedConversationHistory });
                saveConversations(cleanedConversationHistory)
            }

            dispatch({
                field: 'conversationStateId',
                value: 'post-init',
            });
        };

        initializeData();
    }, [initialRender]);

    const [preProcessingCallbacks, setPreProcessingCallbacks] = useState([]);
    const [postProcessingCallbacks, setPostProcessingCallbacks] = useState([]);


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
        const isAtBottom = scrollableElement.scrollHeight - scrollableElement.scrollTop <= scrollableElement.clientHeight + 1;
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


    if (session) {                          // dont want to go here if its null
        if (featureFlags.dataDisclosure && hasAcceptedDataDisclosure === false  && window.location.hostname !== 'localhost') {
                return (
                    <main className={`flex h-screen w-screen flex-col text-sm ${lightMode}`}>
                        <div className="flex flex-col items-center justify-center min-h-screen text-center dark:bg-[#444654] bg-white dark:text-white text-black">
                            <h1 className="text-2xl font-bold dark:text-white">Amplify Data Disclosure Agreement</h1>
                            {dataDisclosure?.url && <a className="hover:text-blue-500" href={dataDisclosure.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', marginBottom: '10px' }}>Download the data disclosure agreement</a>}
                            {dataDisclosure && dataDisclosure.html ? (
                                <div
                                    className="data-disclosure dark:bg-[#343541] bg-gray-50 dark:text-white text-black text-left"
                                    style={{
                                        overflowY: 'scroll',
                                        border: '1px solid #ccc',
                                        padding: '20px',
                                        marginBottom: '10px',
                                        height: '500px',
                                        width: '35%',
                                    }}
                                    onScroll={handleScroll}
                                    dangerouslySetInnerHTML={{ __html: dataDisclosure.html }}
                                >   
                                </div>

                            ) : (
                                <div className="flex flex-col items-center justify-center" style={{ height: '500px', width: '30%' }}>
                                    <Loader />
                                    <p className="mt-4">Loading agreement...</p>
                                </div>
                            )}
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
                                        if (user && user.email) {
                                            if (inputEmail.toLowerCase() === user.email.toLowerCase()) {
                                                if (hasScrolledToBottom) {
                                                    saveDataDisclosureDecision(user.email, true);
                                                    sethasAcceptedDataDisclosure(true);
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
                                    if ( user && user.email ) {
                                        if (inputEmail.toLowerCase() === user.email.toLowerCase()) {
                                            if (hasScrolledToBottom) {
                                                saveDataDisclosureDecision(user.email, true);
                                                sethasAcceptedDataDisclosure(true);
                                            } else {
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

        // @ts-ignore
        return (
            <HomeContext.Provider
                value={{
                    ...contextValue,
                    handleNewConversation,
                    shouldStopConversation,
                    handleForkConversation,
                    handleCreateFolder,
                    handleDeleteFolder,
                    handleUpdateFolder,
                    handleSelectConversation,
                    handleUpdateConversation,
                    handleUpdateSelectedConversation, 
                    handleConversationAction,
                    getCompleteConversation,
                    preProcessingCallbacks,
                    postProcessingCallbacks,
                    addPreProcessingCallback,
                    removePreProcessingCallback,
                    addPostProcessingCallback,
                    removePostProcessingCallback,
                    clearWorkspace,
                    handleAddMessages,
                    setLoadingMessage,
                    getDefaultModel
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
                            <UserMenu
                                email={user?.email}
                                name={session?.user?.name}
                            />


                            <TabSidebar
                                side={"left"}
                                footerComponent={null}
                            >
                                <Tab icon={<IconMessage />} title="Chats"><Chatbar /></Tab>
                                <Tab icon={<IconSparkles />} title="Assistants"><Promptbar /></Tab>
                                <Tab icon={<IconHammer />} title="Settings"><SettingsBar /></Tab>
                            </TabSidebar>

                            <div className="flex flex-1">
                                {page === 'chat' && (
                                    <Chat stopConversationRef={stopConversationRef} />
                                )}
                                {/* {page === 'market' && (
                                    <Market items={[
                                        // {id: "1", name: "Item 1"},
                                    ]} />
                                )} */}
                                {page === 'home' && (
                                    <MyHome />
                                )}
                            </div>
                            

                        </div>
                        <LoadingDialog open={!!loadingMessage} message={loadingMessage}/>
                        <LoadingDialog open={loadingAmplify} message={"Setting Up Amplify..."}/>

                        

                    </main>
                )}

            </HomeContext.Provider>
        );
    } else if (isLoading) {
        return (
            <main
                className={`flex h-screen w-screen flex-col text-sm text-black dark:text-white ${lightMode}`}
                style={{backgroundColor: lightMode === 'dark' ? 'black' : 'white'}}>
            <div
                className="flex flex-col items-center justify-center min-h-screen text-center text-black dark:text-white"
                style={{color: lightMode === 'dark' ? 'white' : 'black'}}>
                    <Loader />
                    <h1 className="mt-6 mb-4 text-2xl font-bold">
                        Loading...
                    </h1>

                    {/*<progress className="w-64"/>*/}
                </div>
            </main>);
    } else {
        return (
            <main
                className={`flex h-screen w-screen flex-col text-sm text-black dark:text-white ${lightMode}`} 
                style={{backgroundColor: lightMode === 'dark' ? 'black' : 'white'}}>
                <div
                    className="flex flex-col items-center justify-center min-h-screen text-center text-black dark:text-white">
                    <div className="mb-8">
                        <Logo width={200} height={60} />
                    </div>
                    <button
                        onClick={() => signIn('cognito')}
                        id="loginButton"
                        className="shadow-md"
                        style={{
                            backgroundColor: 'white',
                            border: '2px solid #ccc',
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

    const chatEndpoint = process.env.CHAT_ENDPOINT;
    const mixPanelToken = process.env.MIXPANEL_TOKEN;
    const cognitoClientId = process.env.COGNITO_CLIENT_ID;
    const cognitoDomain = process.env.COGNITO_DOMAIN;
    
    // const googleApiKey = process.env.GOOGLE_API_KEY;
    // const googleCSEId = process.env.GOOGLE_CSE_ID;
    // if (googleApiKey && googleCSEId) {
    //     serverSidePluginKeysSet = true;
    // }

    return {
        props: {
            chatEndpoint,
            mixPanelToken,
            cognitoClientId,
            cognitoDomain,
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

