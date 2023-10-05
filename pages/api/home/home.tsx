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
import {DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE} from '@/utils/app/const';
import {
    saveConversation,
    saveConversations,
    updateConversation,
} from '@/utils/app/conversation';
import {saveFolders} from '@/utils/app/folders';
import {savePrompts} from '@/utils/app/prompts';
import {getSettings} from '@/utils/app/settings';

import {Conversation} from '@/types/chat';
import {KeyValuePair} from '@/types/data';
import {FolderInterface, FolderType} from '@/types/folder';
import {OpenAIModelID, OpenAIModels, fallbackModelID} from '@/types/openai';
import {Prompt} from '@/types/prompt';

import {Chat} from '@/components/Chat/Chat';
import {Chatbar} from '@/components/Chatbar/Chatbar';
import {Navbar} from '@/components/Mobile/Navbar';
import Promptbar from '@/components/Promptbar';
import {Icon3dCubeSphere, IconApiApp, IconMessage, IconSettings, IconBook2} from "@tabler/icons-react";
import {IconUser, IconLogout} from "@tabler/icons-react";
import HomeContext, {Processor} from './home.context';
import {HomeInitialState, initialState} from './home.state';

import {v4 as uuidv4} from 'uuid';
import {useUser} from '@auth0/nextjs-auth0/client';
import styled from "styled-components";
import {Button} from "react-query/types/devtools/styledComponents";
import WorkflowDefinitionBar from "@/components/Workflow/WorkflowDefinitionBar";
import {WorkflowDefinition} from "@/types/workflow";
import {saveWorkflowDefinitions} from "@/utils/app/workflows";

const LoadingIcon = styled(Icon3dCubeSphere)`
  color: lightgray;
  height: 150px;
  width: 150px;
`;

interface Props {
    serverSideApiKeyIsSet: boolean;
    serverSidePluginKeysSet: boolean;
    defaultModelId: OpenAIModelID;
}


const Home = ({
                  serverSideApiKeyIsSet,
                  serverSidePluginKeysSet,
                  defaultModelId,
              }: Props) => {
    const {t} = useTranslation('chat');
    const {getModels} = useApiService();
    const {getModelsError} = useErrorService();
    const [initialRender, setInitialRender] = useState<boolean>(true);
    const {user, error: userError, isLoading} = useUser();

    const contextValue = useCreateReducer<HomeInitialState>({
        initialState,
    });


    const {
        state: {
            apiKey,
            lightMode,
            folders,
            workflows,
            conversations,
            selectedConversation,
            prompts,
            temperature,
        },
        dispatch,
    } = contextValue;


    const stopConversationRef = useRef<boolean>(false);

    const {data, error, refetch} = useQuery(
        ['GetModels', apiKey, serverSideApiKeyIsSet],
        ({signal}) => {
            if (!apiKey && !serverSideApiKeyIsSet) return null;

            return getModels(
                {
                    key: apiKey,
                },
                signal,
            );
        },
        {enabled: true, refetchOnMount: false},
    );

    useEffect(() => {
        if (data) dispatch({field: 'models', value: data});
    }, [data, dispatch]);

    useEffect(() => {
        dispatch({field: 'modelError', value: getModelsError(error)});
    }, [dispatch, error, getModelsError]);

    // FETCH MODELS ----------------------------------------------

    const handleSelectConversation = (conversation: Conversation) => {
        dispatch({
            field: 'selectedConversation',
            value: conversation,
        });

        saveConversation(conversation);
    };

    // FOLDER OPERATIONS  --------------------------------------------

    const handleCreateFolder = (name: string, type: FolderType) => {
        console.log("handleCreateFolder", name, type);

        const newFolder: FolderInterface = {
            id: uuidv4(),
            name,
            type,
        };

        const updatedFolders = [...folders, newFolder];

        dispatch({field: 'folders', value: updatedFolders});
        saveFolders(updatedFolders);
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
        const lastConversation = conversations[conversations.length - 1];

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
            folderId: null,
            promptTemplate: null,
            ...params
        };

        const updatedConversations = [...conversations, newConversation];

        dispatch({field: 'selectedConversation', value: newConversation});
        dispatch({field: 'conversations', value: updatedConversations});


        saveConversation(newConversation);
        saveConversations(updatedConversations);

        dispatch({field: 'loading', value: false});
    };

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

    const handleAddMessages = async (selectedConversation: Conversation | undefined, messages: any) => {

        if (selectedConversation) {

            const updatedMessages = [
                ...selectedConversation.messages,
                ...messages
            ];

            let updatedConversation = {
                ...selectedConversation,
                messages: updatedMessages,
            };

            await dispatch({
                field: 'selectedConversation',
                value: updatedConversation
            });

            saveConversation(updatedConversation);
            const updatedConversations = conversations.map(
                (conversation) => {
                    if (conversation.id === selectedConversation.id) {
                        return updatedConversation;
                    }
                    return conversation;
                },
            );
            if (updatedConversations.length === 0) {
                updatedConversations.push(updatedConversation);
            }
            await dispatch({field: 'conversations', value: updatedConversations});
        }

    };

    // EFFECTS  --------------------------------------------

    useEffect(() => {
        if (window.innerWidth < 640) {
            dispatch({field: 'showChatbar', value: false});
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
    }, [
        defaultModelId,
        dispatch,
        serverSideApiKeyIsSet,
        serverSidePluginKeysSet,
    ]);

    const [preProcessingCallbacks, setPreProcessingCallbacks] = useState([]);
    const [postProcessingCallbacks, setPostProcessingCallbacks] = useState([]);

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


    if (user) {
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
                    preProcessingCallbacks,
                    postProcessingCallbacks,
                    addPreProcessingCallback,
                    removePreProcessingCallback,
                    addPostProcessingCallback,
                    removePostProcessingCallback,
                    handleAddMessages
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
                                    <div className="m-0 p-0 border-t border-white/20 pt-1 text-sm">
                                        <button className="text-white" onClick={() => {
                                            window.location.href = '/api/auth/logout'
                                        }}>

                                            <div className="flex items-center">
                                                <IconLogout className="m-2"/>
                                                <span>{isLoading ? 'Loading...' : user?.name ?? 'Unnamed user'}</span>
                                            </div>

                                        </button>
                                    </div>
                                }
                            >
                                <Tab icon={<IconMessage/>}><Chatbar/></Tab>
                                <Tab icon={<IconSettings/>}><SettingsBar/></Tab>
                            </TabSidebar>

                            <div className="flex flex-1">
                                <Chat stopConversationRef={stopConversationRef}/>
                            </div>


                            <TabSidebar
                                side={"right"}
                            >
                                <Tab icon={<Icon3dCubeSphere/>}><Promptbar/></Tab>
                                <Tab icon={<IconBook2/>}><WorkflowDefinitionBar/></Tab>
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
                    <h1 className="mb-4 text-2xl font-bold">
                        Loading...
                    </h1>
                    <progress className="w-64"/>
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
                        onClick={() => window.location.href = '/api/auth/login'}
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

    let serverSidePluginKeysSet = false;

    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleCSEId = process.env.GOOGLE_CSE_ID;

    if (googleApiKey && googleCSEId) {
        serverSidePluginKeysSet = true;
    }

    return {
        props: {
            serverSideApiKeyIsSet: !!process.env.OPENAI_API_KEY,
            defaultModelId,
            serverSidePluginKeysSet,
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
