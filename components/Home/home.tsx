import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import { Tab, TabSidebar } from "@/components/TabSidebar/TabSidebar";
import { SettingsBar } from "@/components/Settings/SettingsBar";
import { StorageProgressBar } from "@/components/Settings/StorageProgressBar";
import { checkDataDisclosureDecision, getLatestDataDisclosure, saveDataDisclosureDecision } from "@/services/dataDisclosureService";
import { sanitizeHtml } from '@/utils/sanitizeHtml';
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
    blockConversationHistoryWrites,
    condenseForConversationHistory,
    remoteForConversationHistory,
    upsertConversationEntry,
    onConversationHistoryChangedInOtherTab,
} from '@/utils/app/conversation';
import { getArchiveNumOfDays, getHiddenGroupFolders, saveFolders } from '@/utils/app/folders';
import { savePrompts } from '@/utils/app/prompts';
import { getSettings, saveSettings } from '@/utils/app/settings';
import { storageGet, storageGetStrict, storageSet } from '@/utils/app/storage';
import { getAccounts } from "@/services/accountService";

import { Conversation, Message, newMessage } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { FolderInterface, FolderType } from '@/types/folder';
import { Prompt } from '@/types/prompt';


import { Chat } from '@/components/Chat/Chat';
import { Chatbar } from '@/components/Chatbar/Chatbar';
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
// import { Market } from "@/components/Market/Market";
import { useSession, signOut } from "next-auth/react"
import Loader from "@/components/Loader/Loader";
import { ConversationAction, useHomeReducer } from "@/hooks/useHomeReducer";
import { MyHome } from "@/components/My/MyHome";
import { AssistantGallery } from "@/components/AssistantGallery/AssistantGallery";
import { DEFAULT_ASSISTANT } from '@/types/assistant';
import { deleteAssistant, listAssistants, listLayeredAssistants } from '@/services/assistantService';
import { LayeredAssistant } from '@/types/layeredAssistant';
import { filterAstsByFeatureFlags, getAssistant, isAssistant, syncAssistants } from '@/utils/app/assistants';
import { CONVERSATION_SAVE_CONFLICT_EVENT, fetchAllRemoteConversations, fetchRemoteConversation, replayPendingConversationSync, setConversationSyncUser, uploadConversation } from '@/services/remoteConversationService';
import {killRequest as killReq} from "@/services/chatService";
import { addDateAttribute, getFullTimestamp, getDateName } from '@/utils/app/date';
import HomeContext, {  ClickContext, Processor } from './home.context';
import { ReservedTags } from '@/types/tags';
import { noCoaAccount } from '@/types/accounts';
import { noRateLimit, normalizeRateLimits } from '@/types/rateLimit';
import { fetchAstAdminGroups } from '@/services/groupsService';
import { contructGroupData } from '@/utils/app/groups';
import { getAllArtifacts } from '@/services/artifactsService';
import { baseAssistantFolder, baseLayeredAssistantFolder, basePrompts, isBaseFolder, isOutDatedBaseFolder } from '@/utils/app/basePrompts';
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
import { ThemeService } from '@/utils/whiteLabel/themeService';
// New UI imports
import { NewSidebar } from '@/components/NewUI/sidebar/NewSidebar';
import { NewHome } from '@/components/NewUI/home/NewHome';
import { NewLogin } from '@/components/NewUI/home/NewLogin';
import { ChatsListView } from '@/components/NewUI/views/ChatsListView';
import { NewLibraryView } from '@/components/NewUI/views/NewLibraryView';
import { ConversationViewShell } from '@/components/NewUI/chat/ConversationViewShell';
import { NewSettingsModal } from '@/components/NewUI/settings/NewSettingsModal';
import { PromptTemplateDialogHost } from '@/components/NewUI/shared/PromptTemplateDialogHost';
import { LayeredBuilderHost } from '@/components/NewUI/shared/LayeredBuilderHost';
import { AssistantAdminUIHost } from '@/components/NewUI/shared/AssistantAdminUIHost';
import { UIPreferenceBanner, getUIPreference, setUIPreference, type UIPreference } from '@/components/NewUI/UIPreferenceBanner';
import { useStableFeatureFlags } from '@/components/NewUI/shared/useStableFeatureFlags';
import { NotebookFeatureGate } from '@/components/NewUI/shared/NotebookFeatureGate';
import { NewUiRolloutGate } from '@/components/NewUI/shared/NewUiRolloutGate';
import { getBrandName } from '@/utils/whiteLabel/branding';
import { KeyboardViewportFit } from '@/components/NewUI/shared/KeyboardViewportFit';
import { UiAnalytics } from '@/components/NewUI/shared/UiAnalytics';
import { isClassicUiSwitchAllowed } from '@/components/NewUI/shared/deploymentFeaturePolicy';
import { NewAssistantsView } from '@/components/NewUI/views/NewAssistantsView';
import { NewScheduledTasksView } from '@/components/NewUI/views/NewScheduledTasksView';
import { NewWorkflowsView } from '@/components/NewUI/views/NewWorkflowsView';
import { NewUILoadingStatus } from '@/components/NewUI/shared/NewUILoadingStatus';
import { BlankConversationCleanup } from '@/components/NewUI/shared/BlankConversationCleanup';
import { LocalChatsNotice } from '@/components/NewUI/shared/LocalChatsNotice';
import { UserPrefsSync } from '@/components/NewUI/shared/UserPrefsSync';
import { LastChatRestore } from '@/components/NewUI/shared/LastChatRestore';
import { FeatureFlagsSelfHeal } from '@/components/NewUI/shared/FeatureFlagsSelfHeal';
import { LiveHomeStateMirror } from '@/components/NewUI/shared/LiveHomeStateMirror';
import { ChatBusyNoticeHost } from '@/components/NewUI/shared/ChatBusyNoticeHost';
import { AnnouncementBanner } from '@/components/NewUI/shared/AnnouncementBanner';
import { isConversationStreaming, getStreamingConversationIds } from '@/hooks/useChatSendService';

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
    // resolves when the stored conversation history has been loaded into state; the cloud sync waits for it,
    // otherwise it would merge into (and persist) an empty list
    const historyLoadedRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
    if (historyLoadedRef.current === null) {
        let resolve: () => void = () => undefined;
        const promise = new Promise<void>((r) => { resolve = r; });
        historyLoadedRef.current = { promise, resolve };
    }
    // const [loadingSelectedConv, setLoadingSelectedConv] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');

    const [loadingAmplify, setLoadingAmplify] = useState<boolean>(true);

    // New UI preference — 'new' | 'classic' | null (null = show banner)
    const [uiPreference, setUiPreference] = useState<UIPreference>(null);
    // Initialize after mount so localStorage is available
    useEffect(() => {
        setUiPreference(getUIPreference());
    }, []);

    // New UI ⌘, shortcut — opens settings modal
    const [newUiSettingsSection, setNewUiSettingsSection] = useState<string | null>(null);
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === ',') {
                e.preventDefault();
                setNewUiSettingsSection('general');
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const [dataDisclosure, setDataDisclosure] = useState<{url: string, html: string | null}|null>(null);
    const [hasAcceptedDataDisclosure, sethasAcceptedDataDisclosure] = useState<boolean | null> (null);

    // Phase 27 bug fix: bridges the gap between NewHome writing the pending-message
    // sessionStorage bridge (see ConversationViewShell.tsx) and messageIsStreaming
    // actually flipping true. Without this, a brand-new conversation's
    // messages.length===0 window (before the DOM-injection bridge fires, ~150-300ms)
    // caused the NewHome/landing page to flash back in right after the user hit
    // send — looking like a revert to "old UI". NewHome.tsx dispatches
    // 'amplifyNewConversationSendPending' synchronously right before calling
    // handleNewConversation; we clear it once messageIsStreaming goes true (the
    // real signal that Chat.tsx's send pipeline has taken over) with a safety-net
    // timeout in case the bridge silently fails for any reason.
    const [pendingNewConversationSend, setPendingNewConversationSend] = useState(false);
    useEffect(() => {
        const handler = () => setPendingNewConversationSend(true);
        window.addEventListener('amplifyNewConversationSendPending', handler);
        return () => window.removeEventListener('amplifyNewConversationSendPending', handler);
    }, []);

    const { data: session, status } = useSession();
    const [user, setUser] = useState<any>(null);

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

    const selectedConversationRef = useRef(selectedConversation);

    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

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
            // a removed key (newValue === null) is storage housekeeping, not new data
            if (event.newValue === null || event.newValue === undefined) return;
            try {
                if (event.key === "conversationHistory") {
                    const conversations = JSON.parse(event.newValue);
                    if (Array.isArray(conversations)) dispatch({ field: 'conversations', value: conversations });
                } else if (event.key === "folders") {
                    const folders = JSON.parse(event.newValue);
                    if (Array.isArray(folders)) dispatch({ field: 'folders', value: folders });
                } else if (event.key === "prompts") {
                    const prompts = JSON.parse(event.newValue);
                    if (Array.isArray(prompts)) dispatch({ field: 'prompts', value: prompts });
                }
            } catch (e) {
                console.error('Could not apply a storage change from another tab', e);
            }
        };

        window.addEventListener('storage', handleStorageChange);

        // Remove the event listener on cleanup
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);


    // Another tab saved the conversation list. `storage` events do not fire for IndexedDB, so without
    // this each tab kept its own copy and the last one to save overwrote the others' new chats.
    useEffect(() => {
        return onConversationHistoryChangedInOtherTab(async () => {
            try {
                const raw = await storageGet('conversationHistory');
                if (!raw) return;
                let list: Conversation[] = JSON.parse(raw);
                const open = selectedConversationRef.current;
                // the chat open in THIS tab must never vanish because of what another tab did
                if (open && !list.some((c: Conversation) => c.id === open.id)) {
                    list = upsertConversationEntry(list, condenseForConversationHistory(open));
                }
                conversationsRef.current = list;
                dispatch({ field: 'conversations', value: list });
            } catch (e) {
                console.error('Failed to refresh conversations changed in another tab', e);
            }
        });
    }, []);

    // A cloud save found the chat changed elsewhere and kept this tab's version as a separate chat
    useEffect(() => {
        const handleConflictCopy = (event: any) => {
            const copy: Conversation | undefined = event?.detail?.copy;
            if (!copy) return;
            const updated = upsertConversationEntry(conversationsRef.current, remoteForConversationHistory(copy));
            conversationsRef.current = updated;
            dispatch({ field: 'conversations', value: updated });
            saveConversations(updated);
        };
        window.addEventListener(CONVERSATION_SAVE_CONFLICT_EVENT, handleConflictCopy);
        return () => window.removeEventListener(CONVERSATION_SAVE_CONFLICT_EVENT, handleConflictCopy);
    }, []);

    useEffect(() => {
        if (chatEndpoint) dispatch({ field: 'chatEndpoint', value: chatEndpoint });
    }, [chatEndpoint]);

    const router = useRouter();

    // Handle callback URL redirect
    useEffect(() => {
        const callbackUrl = router.query.callbackUrl as string;
        if (session && callbackUrl) {
            if (callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
                router.push(callbackUrl);
            }
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
            const remoteConversation = await fetchRemoteConversation(conversation.id, () => conversationsRef.current, dispatch);
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
        if(!chatEndpoint){
            return false;
        }

        const result = await killReq(requestId);

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

    const handleNewConversation = async (params: any = {}) => {
        const { assistant: paramAssistant, ...conversationParams } = params;
        dispatch({ field: 'selectedAssistant', value: paramAssistant ?? DEFAULT_ASSISTANT });
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
            messageCount: 0, // known blank: its cloud object is only created by the first message
            ...conversationParams
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
                                                   codeInterpreterRecordId: undefined,
                                                   date: getFullTimestamp(),
                                                   messages: selectedConversation?.messages.slice(0, messageIndex + 1)});
                if (isRemoteConversation(newConversation)) await uploadConversation(newConversation, foldersRef.current);
                statsService.newConversationEvent();
    
                const updatedConversations = [...conversationsRef.current, newConversation];
                conversationsRef.current = updatedConversations;
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
        // the list as it is NOW: fetching a cloud chat above can take seconds, and the copy captured when this
        // function started would drop (and persist the loss of) chats created or synced meanwhile
        const { single, all } = updateConversation(
            updatedConversation,
            [...conversationsRef.current],
        );
        conversationsRef.current = all;

        if (selectedConversation && (conversation.id === selectedConversation.id)) dispatch({field: 'selectedConversation', value: single});
        if (isRemoteConversation(conversation)) uploadConversation(single, foldersRef.current);
       
        dispatch({ field: 'conversations', value: all });
    };

    const getCompleteConversation = async (conversation: Conversation) => {
        const isRemote = isRemoteConversation(conversation);
        const isSelected = selectedConversation && (conversation.id === selectedConversation.id);

        return isSelected ? selectedConversation :
                 isRemote ? await fetchRemoteConversation(conversation.id).then(full => full ? { ...full, folderId: conversation.folderId ?? null } : full)
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

    // Phase 27 bug fix: clear the pending-send bridge flag once real streaming
    // has taken over (messageIsStreaming===true means Chat.tsx's send pipeline
    // is now driving the UI, so NewHome/ConversationViewShell no longer need the
    // synthetic override). A short safety-net timeout also clears the flag if
    // messageIsStreaming never flips true for some reason (e.g. the pending-
    // message DOM-injection bridge failed to find the hidden textarea/button),
    // so a genuinely stuck flag can't permanently hide NewHome for an empty
    // conversation the user isn't actually sending anything in.
    useEffect(() => {
        if (!pendingNewConversationSend) return;
        if (messageIsStreaming) {
            setPendingNewConversationSend(false);
            return;
        }
        const safetyTimer = setTimeout(() => setPendingNewConversationSend(false), 4000);
        return () => clearTimeout(safetyTimer);
    }, [pendingNewConversationSend, messageIsStreaming]);

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
        if (!user && session?.user) setUser(session.user);
    }, [session])


    useEffect(() => {
        // @ts-ignore
        if (["RefreshAccessTokenError", "SessionExpiredError"].includes(session?.error)) {
            // @ts-ignore
            console.warn(`[Auth] Signing out due to ${session?.error}`);
            // @ts-ignore
            signOut({ callbackUrl: `/?reason=${session?.error === 'RefreshAccessTokenError' ? 'refresh-failed' : 'session-expired'}` });
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
                if (response && response.user_email_map) {
                    const updatedUserEmailMap = Object.fromEntries(
                        Object.entries(response.user_email_map).map(([key, value]) => [
                            key, 
                            value && value !== '' ? value : key
                        ])
                    );
                    dispatch({ field: 'amplifyUsers', value: updatedUserEmailMap});  
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
                    if (AdminConfigTypes.PROMPT_COST_ALERT in data) {
                        const promptCostData = data[AdminConfigTypes.PROMPT_COST_ALERT];
                        dispatch({ field: 'promptCostAlert', value: promptCostData});
                    }
                    if (AdminConfigTypes.WEB_SEARCH in data) {
                        const webSearchData = data[AdminConfigTypes.WEB_SEARCH];
                        if (webSearchData) {
                            // console.log("Web Search Data: ", webSearchData);
                            if (webSearchData.allowUserWebSearchKeys !== undefined) {
                                dispatch({ field: 'canAddWebSearchApiKey', value: webSearchData.allowUserWebSearchKeys });
                            }
                            
                            if (webSearchData.webSearchUserMessage !== undefined) {
                                dispatch({ field: 'webSearchUserMessage', value: webSearchData.webSearchUserMessage });
                            }

                        }
                        
                    }
                    if (AdminConfigTypes.USER_DOCUMENTATION_URL in data) {
                        const docUrl = data[AdminConfigTypes.USER_DOCUMENTATION_URL];
                        if (docUrl) {
                            dispatch({ field: 'userDocumentationUrl', value: docUrl });
                        }
                    }
                    if (AdminConfigTypes.DEFAULT_TIMEZONE in data) {
                        const tz = data[AdminConfigTypes.DEFAULT_TIMEZONE];
                        if (tz) {
                            dispatch({ field: 'defaultTimezone', value: tz });
                        }
                    }
                    if (AdminConfigTypes.RATE_LIMIT in data) {
                        const rateLimitConfig = data[AdminConfigTypes.RATE_LIMIT];
                        // New shape from backend: { limits, honorPersonalRateLimit }
                        // Legacy shape: single object or array (no 'limits' key)
                        const rawLimits = rateLimitConfig?.limits ?? rateLimitConfig;
                        dispatch({ field: 'adminRateLimits', value: normalizeRateLimits(rawLimits) });
                        if (rateLimitConfig?.honorPersonalRateLimit) {
                            dispatch({ field: 'honorPersonalRateLimit', value: rateLimitConfig.honorPersonalRateLimit });
                        }
                    }
                    // console.log("data", data);
                    if ('groupRateLimits' in data) {
                        const rawGroupLimits: Record<string, any> = data['groupRateLimits'] || {};
                        const groupRateLimits = Object.entries(rawGroupLimits)
                            .map(([groupName, rateLimit]) => ({
                                groupName,
                                limits: normalizeRateLimits(rateLimit).filter(
                                    (l: any) => l && l.rate !== null && l.period !== 'Unlimited'
                                ),
                            }))
                            .filter((g) => g.limits.length > 0);
                            console.log("groupRateLimits", groupRateLimits);
                        dispatch({ field: 'groupRateLimits', value: groupRateLimits });
                    }
                    if (AdminConfigTypes.DEFAULT_SMART_MESSAGES in data) {
                        const defaultSmartMessages = data[AdminConfigTypes.DEFAULT_SMART_MESSAGES] as boolean;
                        console.log("defaultSmartMessages", defaultSmartMessages);
                        const updatedFlags = { ...featureFlagsRef.current, smartMessages: defaultSmartMessages };
                        dispatch({ field: 'featureFlags', value: updatedFlags });
                        // Re-derive settings so brand new users (no saved localStorage) get the admin default
                        setSettings(getSettings(updatedFlags));
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

                        // Apply chat color palette from server settings to DOM
                        if (serverSettings.chatColorPalette) {
                            document.body.setAttribute('data-chat-palette', serverSettings.chatColorPalette);
                        }

                        // UI preference normally roams from the server, but deployment
                        // policy always overrides a stored classic selection. While policy
                        // is unresolved, retain the local choice rather than flashing a stale server value.
                        if (serverSettings.uiPreference === 'new' || serverSettings.uiPreference === 'classic') {
                            const cachedPolicyDisallowsClassic = localStorage.getItem('amplify_classic_ui_switch_allowed') === 'false';
                            const effectivePreference = cachedPolicyDisallowsClassic
                                ? 'new'
                                : getUIPreference() === 'new' && serverSettings.uiPreference === 'classic'
                                    ? 'new'
                                    : serverSettings.uiPreference;
                            const local = getUIPreference();
                            if (effectivePreference !== local) {
                                localStorage.setItem('amplify_new_ui_preference', effectivePreference);
                                if (effectivePreference === 'new') {
                                    document.cookie = 'X-Amplify-UI=new; path=/; SameSite=Lax; max-age=31536000';
                                } else {
                                    document.cookie = 'X-Amplify-UI=; path=/; SameSite=Lax; max-age=0';
                                }
                            }
                            setUiPreference(effectivePreference);
                            if (cachedPolicyDisallowsClassic && serverSettings.uiPreference !== 'new') {
                                void setUIPreference('new');
                            }
                        }
                        // ──────────────────────────────────────────────────────────────

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
            // The flags gate everything loaded afterwards (models, artifacts, assistant
            // filtering) and this runs once per load, so a transient failure gets a couple
            // of retries before we continue with {}.
            const retryDelaysMs = [1000, 3000];
            for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
                try {
                    // returns the groups you are inquiring about in a object with the group as the key and is they are on the group as the value
                    const result = await getFeatureFlags();
                    if (result.success && result.data && Object.keys(result.data).length > 0) {
                        const flags: { [key:string] : boolean } = result.data;
                        console.log("feature flags:", flags)
                        dispatch({ field: 'featureFlags', value: flags});
                        localStorage.setItem('mixPanelOn', JSON.stringify(flags.mixPanel ?? false));
                        return flags;
                    }
                    console.log("Failed to get feature flags: ", result);
                } catch (e) {
                    console.log("Failed to get feature flagss: ", e);
                }
                if (attempt < retryDelaysMs.length) {
                    await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
                }
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
                // Saves/deletes that never reached the cloud in an earlier session are re-sent first
                // (bounded wait) so the list below cannot resurrect or shadow them.
                await Promise.race([
                    replayPendingConversationSync().catch((e) => console.log("Pending conversation sync failed: ", e)),
                    new Promise((resolve) => setTimeout(resolve, 15000)),
                ]);
                const days = getArchiveNumOfDays();
                const allRemoteConvs = await fetchAllRemoteConversations(days === 0 ? undefined : days);
                // do not merge before the stored history is in state (it would be written over an empty list)
                await Promise.race([historyLoadedRef.current?.promise, new Promise((resolve) => setTimeout(resolve, 30000))]);
                // merge into the live list at apply time, not the snapshot from before the download
                if (allRemoteConvs) return updateWithRemoteConversations(allRemoteConvs, conversations, folders, dispatch, () => conversationsRef.current);
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

        // return list of layered assistants
        const fetchLayeredAssistants = async () => {
            try {
                const result = await listLayeredAssistants();
                if (result?.success && Array.isArray(result.data)) {
                    dispatch({ field: 'layeredAssistants', value: result.data as LayeredAssistant[] });
                }
            } catch (e) {
                console.log("Failed to list layered assistants: ", e);
            } finally {
                dispatch({ field: 'syncingLayeredAssistants', value: false });
            }
        };

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

            // Fetch layered assistants (independent of the regular assistant fetch)
            fetchLayeredAssistants();

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

        if (user && user.email) setConversationSyncUser(user.email);

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
                const layeredAssistantsFolder = updatedFolders.find((f:FolderInterface) => f.id === "layered_assistants");
                if (!layeredAssistantsFolder) updatedFolders.push( baseLayeredAssistantFolder );
                
                dispatch({ field: 'folders', value: updatedFolders});
                folderIds = updatedFolders.map((f: FolderInterface) => f.id)
            }

            // Create a string for the current date like Oct-18-2021
            const dateName = getDateName();

            let conversationHistory: string | null = null;
            try {
                conversationHistory = await storageGetStrict('conversationHistory');
            } catch (e) {
                // Could not read the stored chats. Starting with an empty list is fine, but saving that list would
                // overwrite the real history, so writes are blocked until the page is reloaded.
                console.error('Failed to read the stored conversation history', e);
                blockConversationHistoryWrites();
                alert("Your saved conversations could not be loaded from this browser's storage. Please reload the page. Your conversations have not been changed.");
            }
            let conversations: Conversation[] = [];
            try {
                conversations = JSON.parse(conversationHistory ? conversationHistory : '[]');
            } catch (e) {
                console.error('The stored conversation history is not valid JSON', e);
                blockConversationHistoryWrites();
                alert("Your saved conversations are damaged and could not be read. They were not overwritten. Please contact support before continuing.");
            }
            //ensure all conversation messagea are compressed and folder exists
            conversations = compressAllConversationMessages(conversations).map((c: Conversation) => 
                                                !c.folderId || folderIds.includes(c.folderId) ? c : {...c, folderId: null});

            // call fetach all conversations 
            const lastConversation: Conversation | null = (conversations.length > 0) ? conversations[conversations.length - 1] : null;
            const lastConversationFolder: FolderInterface | null = lastConversation && foldersParsed ? foldersParsed.find((f: FolderInterface) => f.id === lastConversation.folderId) : null;

            let selectedConversation: Conversation | null = lastConversation ? { ...lastConversation } : null;

            // Reuse the last chat only if it is today's untouched "New Conversation". It must be the FULL
            // conversation: the history holds cloud chats as metadata stubs and local chats compressed,
            // and sending a message on top of such a stub overwrote the real chat with just the new message.
            let reuseLast = !!lastConversation && lastConversation.name === 'New Conversation' &&
                !(lastConversationFolder && lastConversationFolder.name !== dateName);
            if (reuseLast && lastConversation) {
                if (isRemoteConversation(lastConversation)) {
                    const full = await Promise.race([
                        fetchRemoteConversation(lastConversation.id, undefined, undefined, true),
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
                    ]).catch(() => null);
                    if (full) {
                        selectedConversation = { ...full, folderId: lastConversation.folderId ?? full.folderId ?? null, isLocal: false };
                    } else {
                        reuseLast = false; // could not load it: start a fresh chat rather than risk overwriting it
                    }
                } else {
                    selectedConversation = conversationWithUncompressedMessages({ ...lastConversation });
                }
            }

            if (!reuseLast) {

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
                    isLocal: getIsLocalStorageSelection(storageSelection),
                    messageCount: 0, // known blank: its cloud object is only created by the first message
                };

                if (isRemoteConversation(newConversation)) uploadConversation(newConversation, foldersRef.current);
                // Ensure the new conversation is added to the list of conversationHistory
                conversations.push(newConversation);

                selectedConversation = { ...newConversation };

            }

            dispatch({ field: 'selectedConversation', value: selectedConversation });

            if (conversationHistory) {
                const cleanedConversationHistory = cleanConversationHistory(conversations, getDefaultModel(DefaultModels.DEFAULT));

                // the ref is normally refreshed after a render; set it now so the cloud sync merges into this list
                conversationsRef.current = cleanedConversationHistory;
                dispatch({ field: 'conversations', value: cleanedConversationHistory });
                saveConversations(cleanedConversationHistory)
            }

            dispatch({
                field: 'conversationStateId',
                value: 'post-init',
            });
            // let the state settle so the sync merges into the loaded list
            historyLoadedRef.current?.resolve();
        };

        initializeData().catch((e) => { console.error('initializeData failed', e); historyLoadedRef.current?.resolve(); });
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
        } else {
            // Element not yet in DOM; defer until dataDisclosure renders
            dispatch({ field: 'hasScrolledToBottom', value: false });
        }
    };

    useEffect(() => {
        if (dataDisclosure?.html) {
            // Re-check after the disclosure HTML has been rendered into the DOM
            requestAnimationFrame(() => {
                const scrollableElement = document.querySelector('.data-disclosure');
                if (scrollableElement) {
                    const hasScrollableContent = scrollableElement.scrollHeight > scrollableElement.clientHeight;
                    dispatch({ field: 'hasScrolledToBottom', value: !hasScrollableContent });
                }
            });
        }
    }, [dataDisclosure]);


    // The chat shell stays mounted behind NewHome while a conversation is empty, so a
    // first message can be injected the moment it's sent (see the render below).
    const chatShellHidden = (selectedConversation?.messages?.length ?? 0) === 0
        && !isConversationStreaming(messageIsStreaming, getStreamingConversationIds(), selectedConversation?.id)
        && !pendingNewConversationSend;

    if (session) {                          // dont want to go here if its null
        if (featureFlags.dataDisclosure && hasAcceptedDataDisclosure === false  && window.location.hostname !== 'localhost') {
                return (
                    <main className={`flex h-screen w-screen flex-col text-sm ${lightMode}`}>
                        <div className="flex flex-col items-center justify-center min-h-screen text-center dark:bg-[#444654] bg-white dark:text-white text-black">
                            <h1 className="text-2xl font-bold dark:text-white">Amplify Data Disclosure Agreement</h1>
                            {dataDisclosure?.url && <a className="hover:text-blue-500" href={dataDisclosure.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', marginBottom: '10px' }}>Download the data disclosure agreement</a>}
                            {dataDisclosure && dataDisclosure.html ? (
                                <>
                                    {/* Scoped typography for Word-generated MsoNormal markup. */}
                                    <style>{`
                                        .disclosure-gate .MsoNormal,
                                        .disclosure-gate p.MsoNormal,
                                        .disclosure-gate li.MsoNormal,
                                        .disclosure-gate div.MsoNormal {
                                            margin: 0 0 8pt 0; line-height: 115%;
                                            font-size: 12pt; font-family: "Times New Roman", serif;
                                        }
                                        .disclosure-gate h1.MsoNormal,
                                        .disclosure-gate h2.MsoNormal,
                                        .disclosure-gate h3.MsoNormal {
                                            margin: 12pt 0 8pt 0; line-height: 115%;
                                            font-size: 14pt; font-family: "Times New Roman", serif;
                                        }
                                        .disclosure-gate a { color: #467886; text-decoration: underline; }
                                    `}</style>
                                    <div
                                        className="disclosure-gate data-disclosure dark:bg-[#343541] bg-gray-50 dark:text-white text-black text-left"
                                        style={{
                                            overflowY: 'scroll',
                                            border: '1px solid #ccc',
                                            padding: '20px',
                                            marginBottom: '10px',
                                            height: '500px',
                                            width: '35%',
                                        }}
                                        onScroll={handleScroll}
                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(dataDisclosure.html ?? '') }}
                                    />
                                </>

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
                                                    saveDataDisclosureDecision(true);
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
                                                saveDataDisclosureDecision(true);
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
                {/* Global Storage Progress Bar */}
                <StorageProgressBar />

                <Head>
                    <title>Amplify</title>
                    <meta name="description" content="ChatGPT but better." />
                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
                    />
                    <link rel="icon" href="/favicon.ico" />
                </Head>
                {/* Resolve the UI choice before any conversation exists. The banner owns
                    an opaque New UI cover while the server/local preference is resolved,
                    preventing the classic layout and loader from painting during startup. */}
                <UIPreferenceBanner
                    onSelectNew={() => setUiPreference('new')}
                    onSelectClassic={() => setUiPreference('classic')}
                />
                {selectedConversation && (
                    <main
                        // app-safe-area: safe-area insets, and the shell height while the iOS
                        // keyboard is open (see KeyboardViewportFit / globals.css).
                        className={`app-safe-area flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
                        // 100dvh tracks the *visible* viewport on mobile (URL bar / toolbars),
                        // so the composer cap isn't taller than what's on screen. Browsers
                        // without dvh drop this declaration and keep h-screen (100vh).
                        style={{ height: '100dvh' }}
                    >
                        {/* ── NEW UI LAYOUT ── gated: New UI renders only while the New UI rollout
                            flag is confirmed enabled (see NewUiRolloutGate); 'pending' renders nothing. */}
                        <NewUiRolloutGate uiPreference={uiPreference}>
                        {(effectiveUi) => effectiveUi === 'pending' ? null : effectiveUi === 'new' ? (
                            <div className="flex h-full w-full flex-col overflow-hidden">
                            {/* Admin announcement banner — in flow above the sidebar/content row. */}
                            <AnnouncementBanner />
                            <div className="flex min-h-0 w-full flex-1 overflow-hidden max-md:flex-col" style={{ fontFamily: 'Inter, sans-serif' }} data-new-ui-shell="true">
                                {/* Renders nothing — prunes leftover empty placeholder chats
                                    once after load so refreshing never grows Recents. */}
                                <BlankConversationCleanup />
                                {/* Renders nothing — one-time toast for chats stored only in this browser,
                                    with a button that moves them to the user's account. */}
                                <LocalChatsNotice />
                                <KeyboardViewportFit />
                                {/* Renders nothing — tags all Mixpanel events with UI Version=new
                                    and emits UI Loaded / Page Viewed. */}
                                <UiAnalytics variant="new" />
                                {/* Renders nothing — applies server-synced display prefs
                                    (chat font, storage selection) after fetchSettings completes,
                                    and seeds 'future-cloud' default for brand-new users. */}
                                <UserPrefsSync />
                                {/* Renders nothing — re-fetches /feature_flags (backoff) when the
                                    one startup request failed, so flag-gated controls come back
                                    without a refresh. */}
                                <FeatureFlagsSelfHeal />
                                {/* Renders nothing — remembers the conversation being
                                    viewed and re-opens it after a refresh, so reloading
                                    inside a chat no longer drops the user on the
                                    new-chat view. */}
                                <LastChatRestore />
                                <LiveHomeStateMirror />
                                <ChatBusyNoticeHost />

                                {/* Unified new sidebar — stays visible on every page, Notebook included,
                                    so Notebook behaves like Library/Assistants/Workflows (a page inside
                                    the persistent shell) rather than a full-bleed takeover. */}
                                <NewSidebar
                                    email={user?.email}
                                    name={session?.user?.name}
                                    username={(session?.user as any)?.username}
                                />

                                {/* Main content area */}
                                <div id="main-content" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                                    {/* Bug fix (Phase 27): `messageIsStreaming || loading` keeps the chat
                                        view showing even in the brief window where a brand-new
                                        conversation has messages.length===0 but a send is already in
                                        flight (the pending-message sessionStorage bridge in
                                        ConversationViewShell.tsx takes ~150-300ms to inject text + click
                                        send — during that window `messages.length` is genuinely 0, which
                                        previously flashed NewHome/landing page ["old UI"] right after the
                                        user hit send on the very first message of a new conversation).
                                        `pendingNewConversationSend` (see effect below) covers the gap
                                        between NewHome's sessionStorage write and messageIsStreaming
                                        actually flipping true. */}
                                    {/* `messages?.length` — not `messages.length`: a conversation
                                        record can reach `selectedConversation` with NO `messages`
                                        field at all. updateWithRemoteConversations() writes the raw
                                        /get/all cloud metadata into `conversations` without running
                                        it through cleanConversationHistory() (the only thing that
                                        backfills `messages: []`), and several paths dispatch a
                                        history record straight into `selectedConversation`. Reading
                                        it blind is an unhandled TypeError that blanks the whole app;
                                        treating unknown as "no messages" shows the landing page and
                                        lets the repair effect (~line 748) re-fetch. */}
                                    {page === 'chat' && (!selectedConversation || chatShellHidden) && (
                                        <NewHome />
                                    )}
                                    {/* ConversationViewShell is always mounted while page=chat AND a
                                        conversation exists — even when messages.length === 0.
                                        This is necessary so Chat + ChatInput render immediately when
                                        handleNewConversation fires (before any messages are added),
                                        letting ConversationViewShell inject the pending message.
                                        We hide it visually (position:absolute, overflow:hidden, 0×0)
                                        while NewHome is showing so the user only sees the landing page.
                                        Chat.tsx sizes itself by windowInnerDims so it renders inputs
                                        even when the container is collapsed. */}
                                    {page === 'chat' && selectedConversation && (
                                        <div
                                            key={selectedConversation.id}
                                            style={chatShellHidden ? {
                                                position: 'fixed',
                                                top: 0,
                                                left: '-100vw',
                                                width: '100vw',
                                                height: '100vh',
                                                pointerEvents: 'none',
                                                visibility: 'hidden',
                                            } : {
                                                display: 'flex',
                                                flex: 1,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <ConversationViewShell stopConversationRef={stopConversationRef} hidden={chatShellHidden} />
                                        </div>
                                    )}
                                    {page === 'home' && (
                                        <NewHome />
                                    )}
                                    {(page as any) === 'chats' && (
                                        <ChatsListView />
                                    )}
                                    {(page as any) === 'library' && (
                                        <NewLibraryView />
                                    )}
                                    {page === 'assistantGallery' && (
                                        <NewAssistantsView />
                                    )}
                                    {(page as any) === 'scheduledTasks' && featureFlags.scheduledTasks && (
                                        <NewScheduledTasksView />
                                    )}
                                    {(page as any) === 'workflows' && (
                                        <NewWorkflowsView />
                                    )}
                                    {page === 'notebook' && (
                                        <NotebookFeatureGate />
                                    )}
                                </div>

                                {/* ⌘, global settings shortcut for new UI */}
                                {newUiSettingsSection !== null && (
                                    <NewSettingsModal
                                        openToSection={newUiSettingsSection}
                                        onClose={() => setNewUiSettingsSection(null)}
                                    />
                                )}

                                {/* "Use this prompt template" popup. Mounted here, as a
                                    sibling of the settings modal rather than inside it, so
                                    the launcher (Settings → Prompt Templates) can close
                                    itself without unmounting the popup. Renders nothing
                                    until the amplifyUsePromptTemplate event fires. */}
                                <PromptTemplateDialogHost />
                                {/* Layered Assistant Builder — listens for openLayeredBuilderTrigger.
                                    The event's only classic-UI listener is UserMenu, which is not
                                    rendered in this branch. This host provides the equivalent for
                                    the new UI. */}
                                <LayeredBuilderHost />
                                {/* Assistant Admin Interface — listens for openAstAdminInterfaceTrigger.
                                    The event's only classic-UI listener is UserMenu, which is not
                                    rendered in this branch. This host provides the equivalent for
                                    the new UI. */}
                                <AssistantAdminUIHost />
                            </div>
                            </div>
                        ) : (
                            /* ── CLASSIC UI LAYOUT (unchanged) ── */
                            <div className="flex h-full w-full">
                                {/* Renders nothing — UI Version=classic counterpart of the above. */}
                                <UiAnalytics variant="classic" />
                                <UserMenu
                                    email={user?.email}
                                    name={session?.user?.name}
                                    username={(session?.user as any)?.username}
                                />

                                {page !== 'notebook' && (
                                    <TabSidebar
                                        side={"left"}
                                    >
                                        <Tab icon={<IconMessage />} title="Chats" onClick={() => dispatch({ field: 'page', value: 'chat' })}><Chatbar /></Tab>
                                        <Tab icon={<IconSparkles />} title="Assistants" onClick={() => dispatch({ field: 'page', value: 'chat' })}><Promptbar /></Tab>
                                        <Tab icon={<IconHammer />} title="Settings" onClick={() => dispatch({ field: 'page', value: 'chat' })}><SettingsBar /></Tab>
                                    </TabSidebar>
                                )}

                                <div id="main-content" tabIndex={-1} className="flex flex-1">
                                    {page === 'chat' && (
                                        <Chat stopConversationRef={stopConversationRef} />
                                    )}
                                    {page === 'home' && (
                                        <MyHome />
                                    )}
                                    {page === 'assistantGallery' && (
                                        <AssistantGallery />
                                    )}
                                    {page === 'notebook' && (
                                        <NotebookFeatureGate />
                                    )}
                                </div>
                            </div>
                        )}
                        </NewUiRolloutGate>

                        {/* Transient operational loading messages (Loading Conversation…, Forking…) */}
                        {uiPreference === 'classic' ? (
                            <LoadingDialog open={!!loadingMessage} message={loadingMessage}/>
                        ) : (
                            <NewUILoadingStatus open={!!loadingMessage} message={loadingMessage || 'Loading…'} />
                        )}
                        {/* "Setting Up Amplify…" — unresolved and New UI startup use the
                            quiet accessible treatment; only an explicit classic choice uses
                            the legacy LoadingDialog. */}
                        {uiPreference === 'classic' ? (
                            <LoadingDialog open={loadingAmplify} message={"Setting Up Amplify..."}/>
                        ) : (
                            <NewUILoadingStatus open={loadingAmplify} message={`Setting up ${getBrandName()}…`} />
                        )}
                    </main>
                )}

            </HomeContext.Provider>
        );
    } else if (isLoading) {
        return (
            <main
                className={`flex h-screen w-screen flex-col text-sm text-black dark:text-white ${lightMode}`}
                style={{backgroundColor: lightMode === 'dark' ? 'black' : 'white'}}>
                {/* Keep authentication startup on the New UI loading treatment too;
                    the legacy Loader here rendered before the authenticated preference
                    gate could mount. */}
                <NewUILoadingStatus open message="Loading Amplify…" />
            </main>);
    } else {
        return (
            <main
                className={`flex h-screen w-screen flex-col text-sm text-black dark:text-white ${lightMode}`} 
                style={{backgroundColor: lightMode === 'dark' ? 'black' : 'white'}}>
                <NewLogin />
            </main>
        );
    }
};
export default Home;
