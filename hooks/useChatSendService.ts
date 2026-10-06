// src/hooks/useChatService.js
import { useCallback, useContext, useEffect, useRef } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { killRequest as killReq, MetaHandler } from '../services/chatService';
import { ChatBody, Conversation, CustomFunction, JsonSchema, Message, MessageType, newMessage } from "@/types/chat";
import { ColumnsSpec, } from "@/utils/app/csv";
import { Plugin, PluginID } from '@/types/plugin';
import json5 from "json5";
import { DefaultModels, Model } from "@/types/model";
import { newStatus } from "@/types/workflow";
import { ReservedTags } from "@/types/tags";
import { deepMerge } from "@/utils/app/state";
import toast from "react-hot-toast";
import { OutOfOrderResults } from "@/utils/app/outOfOrder";
import { conversationWithCompressedMessages, remoteForConversationHistory, saveConversations } from "@/utils/app/conversation";
import { getHook } from "@/utils/app/chathooks";
import { AttachedDocument } from "@/types/attacheddocument";
import { Prompt } from "@/types/prompt";
import { usePromptFinderService } from "@/hooks/usePromptFinderService";
import { useChatService } from "@/hooks/useChatService";
import { DEFAULT_TEMPERATURE } from "@/utils/app/const";
import { uploadConversation } from "@/services/remoteConversationService";
import { doReadMemoryOp } from '@/services/memoryService';
import { loadProjectContext } from '@/services/projectContextCache';
import { listProjectMemories, addProjectMemory } from '@/services/projectService';
import {
    ExtractedFact,
    Memory,
} from '@/types/memory';
import { getSettings } from '@/utils/app/settings';
import { useStableFeatureFlags } from '@/components/NewUI/shared/useStableFeatureFlags';
import { isBasePrompt } from '@/utils/app/basePrompts';
import { getDeploymentFeatureAvailability } from '@/components/NewUI/shared/deploymentFeaturePolicy';
import { promptForData } from '@/utils/app/llm';
import {
    buildExtractFactsPrompt,
    getRelevantMemories,
    buildMemoryContextPrompt,
    buildProjectExtractFactsPrompt
} from '@/utils/app/memory';
import { handleAgentRun, handleAgentRunResult, isWaitingForAgentResponse } from '@/utils/app/agent';
import { lzwCompress } from '@/utils/app/lzwCompression';
import { resolveContextString, messagesToCached } from '@/utils/app/contextConversations';
import { saveContextCache } from '@/utils/app/storage';
import { calculatePromptCostDetailed, formatCost } from '@/utils/app/costEstimation';
import { getFullTimestamp } from '@/utils/app/date';
import { getEnabledMCPToolsForLLM, handleMCPToolCall } from '@/services/mcpToolExecutor';

export type ChatRequest = {
    message: Message;
    endpoint?: string;
    deleteCount?: number;
    plugins?: Plugin[];
    existingResponse?: any;
    rootPrompt?: string | null;
    documents?: AttachedDocument[] | null;
    uri?: string | null;
    options?: { [key: string]: any };
    assistantId?: string;
    prompt?: Prompt;
    conversationId?: string;
};

/**
 * Agent-run polling guards. BOTH are module-level (not useRef) on purpose.
 *
 * `useSendService()` is instantiated by MANY components at once — Chat.tsx,
 * ConversationViewShell, ConversationComposer, and every AutonomousBlock /
 * OpBlock / InvokeBlock rendered inside a streamed message. Each instance runs
 * its own copy of the `isWaitingForAgentResponse` effect below, so a per-instance
 * `useRef` guard cannot prevent N concurrent pollers for the SAME sessionId.
 *
 * That was the actual bug behind the endless `/vu-agent/get-latest-agent-state`
 * flood: the first poller consumed the agent result and finished the chat, but
 * the other pollers kept hitting the endpoint once per second for the full
 * MAX_POLL_DURATION_MS (5 min) because the backend no longer returns a `result`
 * for an already-consumed session (so `state.inProgress ?? true` stayed true).
 *
 * _activeAgentPolls    — a session currently being polled by SOME instance.
 *                        Guarantees exactly one poller per session app-wide.
 * _exhaustedAgentSessions — a session already polled to a terminal state
 *                        (success, timeout, or error). Prevents a restart when
 *                        `endTime` fails to persist (stale conversation closure,
 *                        navigation mid-poll, etc.).
 *
 * A genuinely new agent task always gets a fresh sessionId, so neither set can
 * block legitimate work.
 */
const _activeAgentPolls = new Set<string>();
const _exhaustedAgentSessions = new Set<string>();

/**
 * An agentRun with no endTime that started longer ago than this is considered
 * dead (tab closed mid-run, crash, WAF block) and is never resumed. Must be
 * comfortably larger than MAX_POLL_DURATION_MS (5 min) in utils/app/agent.ts.
 */
const STALE_AGENT_RUN_MS = 10 * 60 * 1000;

export function useSendService() {
    const {
        state: { selectedConversation, conversations, featureFlags, folders, chatEndpoint, statsService, extractedFacts, memoryExtractionEnabled, defaultAccount, promptCostAlert },
        getDefaultModel, handleUpdateSelectedConversation,
        postProcessingCallbacks,
        dispatch: homeDispatch,
    } = useContext(HomeContext);
    const stableFeatureFlags = useStableFeatureFlags();
    const deploymentAvailability = getDeploymentFeatureAvailability(stableFeatureFlags as any);


    const conversationsRef = useRef(conversations);
    const messageTimestampRef = useRef<string | undefined>(undefined);

    // Always-fresh handle on the selected conversation so the agent poller (which
    // can run for minutes) writes `endTime` back to the CURRENT conversation
    // instead of the snapshot captured when the poll started.
    const selectedConversationRef = useRef(selectedConversation);
    selectedConversationRef.current = selectedConversation;

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    const cleanupHomeState = () => {
        homeDispatch({ field: 'messageIsStreaming', value: false });
        homeDispatch({ field: 'loading', value: false });
        homeDispatch({ field: 'status', value: [] });
    }

    const {
        sendChatRequest,
        sendJsonChatRequestWithSchemaLoose,
        sendFunctionChatRequest,
        sendJsonChatRequest,
        sendJsonChatRequestWithSchema,
        sendCSVChatRequest
    } = useChatService();

    const { getPrefix } = usePromptFinderService();


    useEffect(() => {
        const awaitAgentRun = async (sessionId: string) => {
            // Already polled to a terminal state — never poll it again. Guards the
            // case where `endTime` failed to persist back onto the conversation.
            if (_exhaustedAgentSessions.has(sessionId)) return;

            // Some other useSendService() instance is already polling this session.
            // Only one poller per session may exist app-wide, otherwise the extra
            // pollers keep hammering the endpoint after the winner consumes the
            // result (the backend then stops returning `result`, so those loops run
            // to the full 5-minute timeout).
            if (_activeAgentPolls.has(sessionId)) return;
            _activeAgentPolls.add(sessionId);

            try {
                homeDispatch({ field: 'messageIsStreaming', value: true });
                const agentResult = await handleAgentRun(sessionId, (status: any) => homeDispatch({ field: "status", value: [newStatus(status)] }));
                // Re-read the conversation: the poll may have run for minutes.
                const conversation = selectedConversationRef.current ?? selectedConversation;
                if (agentResult && conversation) {
                    const lastIndex = conversation.messages.length - 1;
                    conversation.messages[lastIndex].data.state.agentLog = lzwCompress(JSON.stringify(agentResult));
                    const updatedConversation = await handleAgentRunResult(agentResult, conversation, getDefaultModel(DefaultModels.CHEAPEST), defaultAccount, homeDispatch, statsService, chatEndpoint || '');
                    handleUpdateSelectedConversation(updatedConversation);
                } else {
                    console.error("Agent run failed or timed out");
                    // Show a visible error toast so the user knows what happened.
                    // This covers both the WAF-blocked scenario and any case where
                    // the agent never responded within MAX_POLL_DURATION_MS.
                    toast.error(
                        "The assistant did not respond in time. Please try again.",
                        { duration: 8000 }
                    );
                    const updatedMessages = conversation?.messages;
                    if (updatedMessages) {
                        const lastMsgIndex = updatedMessages.length - 1;
                        updatedMessages[lastMsgIndex].content = "No response from the agent. Please try again later.";
                        if (updatedMessages[lastMsgIndex].data?.state?.agentRun) {
                            updatedMessages[lastMsgIndex].data.state.agentRun.endTime = new Date();
                        }
                        handleUpdateSelectedConversation({ ...conversation!, messages: updatedMessages });
                    }
                }
            } catch (e) {
                // Never let a throw here leave the session eligible for re-polling.
                console.error("Agent run handling failed:", e);
            } finally {
                _activeAgentPolls.delete(sessionId);
                // Permanently mark as exhausted so future useEffect ticks (triggered
                // by message changes while the poll was running) cannot restart it.
                _exhaustedAgentSessions.add(sessionId);
                cleanupHomeState();
            }
        }

        if (selectedConversation) {
            const agentRunData = isWaitingForAgentResponse(selectedConversation);
            if (agentRunData?.sessionId) {
                // A conversation reloaded from storage can carry an agentRun that never
                // got an endTime (tab closed mid-run, crash, WAF block). Polling it is
                // pointless — the run is long dead — and it would burn a full 5-minute
                // poll on every page load. Only resume runs that could plausibly still
                // be alive.
                const startedAt = agentRunData.startTime ? new Date(agentRunData.startTime).getTime() : NaN;
                const isStale = !Number.isNaN(startedAt) && (Date.now() - startedAt) > STALE_AGENT_RUN_MS;
                if (isStale) {
                    _exhaustedAgentSessions.add(agentRunData.sessionId);
                } else {
                    awaitAgentRun(agentRunData.sessionId);
                }
            }
        }
    }, [selectedConversation?.messages]);


    const handleSend = useCallback(
        async (request: ChatRequest, shouldAbort: () => boolean) => {
            return new Promise(async (resolve, reject) => {
                if (selectedConversation) {

                    let {
                        message,
                        deleteCount,
                        plugins,
                        existingResponse,
                        rootPrompt,
                        documents,
                        uri,
                        options,
                        conversationId
                    } = request;
                    messageTimestampRef.current = new Date().toISOString();

                    const featureOptions = getSettings(stableFeatureFlags).featureOptions;
                    // The user plugin selector and smart focused messages are
                    // permanently disabled; explicit MCP/connector tools continue
                    // through their dedicated request fields.
                    const pluginActive = false;
                    const pluginIds: string[] | null = pluginActive ? plugins?.map((plugin: Plugin) => plugin.id) ?? [] : null;

                    const { content, label } = getPrefix(selectedConversation, message);
                    if (content) {
                        message.content = content + " " + message.content;
                        message.label = label;
                    }

                   
                    let updatedConversation: Conversation;
                    if (deleteCount) {
                        const updatedMessages = [...(selectedConversation.messages ?? [])];
                        for (let i = 0; i < deleteCount; i++) {
                            updatedMessages.pop();
                        }
                        updatedConversation = {
                            ...selectedConversation,
                            messages: [...updatedMessages, message],
                            date: getFullTimestamp(),
                        };
                    } else {
                        updatedConversation = {
                            ...selectedConversation,
                            messages: [...(selectedConversation.messages ?? []), message],
                            date: getFullTimestamp(),
                        };
                    }

                    // 💰 PROMPT COST ALERT - Check cost before sending
                    if (selectedConversation
                        && selectedConversation?.model
                        && !options?.ragOnly
                        && promptCostAlert?.isActive) {

                        console.log('✅ Prompt cost alert IS ACTIVE - calculating cost...');

                        try {
                            // 🚀 OPTIMIZED: Calculate once with detailed breakdown, format once
                            const contextWindow = selectedConversation.model.inputContextWindow || 128000;
                            const { cost: estimatedCost, breakdown } = calculatePromptCostDetailed(
                                updatedConversation,
                                selectedConversation.model,
                                options
                            );
                            const numberOfPrompts = Math.ceil(breakdown.totalTokens / contextWindow);
                            const formattedCost = formatCost(estimatedCost);
                            const formattedThreshold = formatCost(promptCostAlert.cost);

                            console.log(`💰 Estimated prompt cost: ${formattedCost} | Threshold: ${formattedThreshold}`);

                            // Check if cost exceeds the admin-set threshold
                            if (estimatedCost > promptCostAlert.cost) {
                                console.log(`🚨 COST EXCEEDS THRESHOLD! (${formattedCost} > ${formattedThreshold}) - showing alert...`);

                                // Replace placeholders in the admin's alert message
                                let alertMessage = promptCostAlert.alertMessage ||
                                    'This prompt will cost approximately <totalCost>. Do you want to continue?';

                                // Handle both $<totalCost> (old style) and <totalCost> (new style)
                                alertMessage = alertMessage.replace(/\$<totalCost>/g, formattedCost);
                                alertMessage = alertMessage.replace(/<totalCost>/g, formattedCost);
                                alertMessage = alertMessage.replace(/<prompts>/g, numberOfPrompts.toString());

                                // Show confirmation dialog via home state
                                const confirmationPromise = new Promise<boolean>((resolveConfirm) => {
                                    homeDispatch({
                                        field: 'promptCostAlertModal',
                                        value: {
                                            isOpen: true,
                                            message: alertMessage,
                                            cost: formattedCost,
                                            prompts: numberOfPrompts,
                                            onConfirm: () => {
                                                homeDispatch({ field: 'promptCostAlertModal', value: null });
                                                resolveConfirm(true);
                                            },
                                            onDeny: () => {
                                                homeDispatch({ field: 'promptCostAlertModal', value: null });
                                                resolveConfirm(false);
                                            }
                                        }
                                    });
                                });

                                const userConfirmed = await confirmationPromise;

                                if (!userConfirmed) {
                                    // User cancelled - clean up and exit
                                    console.log('⚠️ User cancelled due to high cost');
                                    cleanupHomeState();
                                    resolve({ success: false, cancelled: true });
                                    return;
                                }

                                // User confirmed - log and proceed
                                console.log('✅ User confirmed high-cost prompt');
                            } else {
                                console.log(`✅ Cost within threshold (${formattedCost} <= ${formattedThreshold}) - proceeding without alert`);
                            }
                        } catch (error) {
                            // If cost calculation fails, log error but don't block the message
                            console.error('❌ Error calculating prompt cost:', error);
                            // Continue sending - don't block user due to calculation error
                        }
                    } else {
                        console.log('ℹ️ Prompt cost alert skipped:', {
                            reason: !promptCostAlert?.isActive ? 'Alert not active' :
                                !selectedConversation?.model ? 'No model selected' :
                                    options?.ragOnly ? 'RAG only mode' : 'Unknown'
                        });
                    }
                    // console.log("updated: ", updatedConversation.messages);

                    if (!updatedConversation.model) {
                        const defaultModel = getDefaultModel(DefaultModels.DEFAULT)
                        console.log("WARNING: MODEL IS UNDEFINED SETTING TO DEFAULT: ", defaultModel);
                        updatedConversation.model = defaultModel;
                    }

                    homeDispatch({
                        field: 'selectedConversation',
                        value: updatedConversation,
                    });

                    homeDispatch({ field: 'loading', value: true });
                    homeDispatch({ field: 'messageIsStreaming', value: true });

                    let isArtifactsOn = deploymentAvailability.artifacts &&
                        // Preserve provider/base-prompt limitations; routing decides whether to use it.
                        (!pluginIds || !pluginIds.includes(PluginID.CODE_INTERPRETER)) &&
                        // turn off artifacts for base prompt templates
                        !(selectedConversation?.promptTemplate && isBasePrompt(selectedConversation.promptTemplate.id));

                    // honor assistant does not support artifact flag 
                    const astFeatureOptions = message.data?.assistant?.definition?.featureOptions;
                    const explicitArtifactIntent = options?.artifactsMode === true;
                    if (!explicitArtifactIntent && astFeatureOptions && 'IncludeArtifactsInstr' in astFeatureOptions &&
                        !astFeatureOptions.IncludeArtifactsInstr) {
                        console.log("Artifacts disabled for assistant: ", message.data?.assistant?.definition?.name);
                        isArtifactsOn = false;
                    }

                    if (explicitArtifactIntent && !deploymentAvailability.artifacts) {
                        options = { ...(options || {}) };
                        delete options.artifactsMode;
                    }
                    if (!deploymentAvailability.artifacts) isArtifactsOn = false;
                    console.log("Artifacts available: ", isArtifactsOn)
                    if (selectedConversation?.promptTemplate && isBasePrompt(selectedConversation.promptTemplate.id)) {
                        console.log("Artifacts disabled for base prompt template: ", selectedConversation.promptTemplate.name);
                    }
                    // Smart focused messages are absent from the request path.

                    const isMemoryOn = deploymentAvailability.memory && stableFeatureFlags.memory === true;
                    console.log("Memory on: ", isMemoryOn)

                    console.log("Conversation tokens: ", updatedConversation.maxTokens);

                    const removedIds = new Set(updatedConversation.removedDocumentIds || []);

                    // Filter out removed documents from all messages
                    const filteredMessages = updatedConversation.messages.map(msg => {
                        if (msg.data?.dataSources && msg.data.dataSources.length > 0) {
                            const filteredDataSources = msg.data.dataSources.filter((ds: any) => !removedIds.has(ds.id));
                            return {
                                ...msg,
                                data: {
                                    ...msg.data,
                                    dataSources: filteredDataSources
                                }
                            };
                        }
                        return msg;
                    });

                    // ── Cross-conversation context injection ──────────────────
                    // Resolve context from other conversations (local or cached cloud)
                    // and prepend as a silent user message. This never touches the
                    // displayed conversation — it only exists in the outgoing request.
                    const contextEntries = updatedConversation.contextConversations ?? [];
                    let messagesForRequest = filteredMessages;
                    if (contextEntries.length > 0) {
                        const contextStr = await resolveContextString(
                            contextEntries,
                            conversationsRef.current,
                        );
                        if (contextStr.trim().length > 0) {
                            const contextMessage: Message = {
                                id: `ctx-inject-${Date.now()}`,
                                role: 'user',
                                content: `[Additional context from other conversations — use as background knowledge]\n\n${contextStr}\n\n[End of additional context]`,
                                type: 'context',
                                data: {},
                            };
                            messagesForRequest = [contextMessage, ...filteredMessages];
                        }
                    }
                    // ─────────────────────────────────────────────────────────

                    // Model selection remains explicit and assistant-aware. Automatic
                    // feature routing is performed once by the backend ordinary-chat
                    // router so UI and API requests cannot diverge.
                    const resolvedModel = updatedConversation.model;
                    console.log("Model in use: ", resolvedModel.name);

                    let chatBody: ChatBody = {
                        model: resolvedModel,
                        messages: messagesForRequest,
                        prompt: rootPrompt || updatedConversation.prompt || "",
                        temperature: updatedConversation.temperature || DEFAULT_TEMPERATURE,
                        maxTokens: updatedConversation.maxTokens || (Math.round(resolvedModel.outputTokenLimit / 2)),
                        conversationId
                    };

                    // Backend routing owns optional web-search selection. Do not
                    // send user preference fields that could bias that decision.

                    // Check if MCP is enabled (requires feature flag AND plugin enabled)
                    const isMCPOn = featureFlags.mcp && (plugins?.some(p => p.id === PluginID.MCP) ?? false);
                    console.log("MCP on: ", isMCPOn);

                    let mcpTools: any[] = [];
                    if (isMCPOn) {
                        // Load MCP tools for LLM
                        try {
                            mcpTools = await getEnabledMCPToolsForLLM();
                            if (mcpTools.length > 0) {
                                // Add MCP tools to the existing tools array
                                chatBody.tools = [...(chatBody.tools || []), ...mcpTools];
                                // Flag to indicate MCP tools need client-side execution
                                chatBody.mcpEnabled = true;
                                console.log(`MCP: Added ${mcpTools.length} tools to chat body`);
                            }
                        } catch (error) {
                            console.error("Failed to load MCP tools:", error);
                        }
                    }

                    console.log("Adding artifacts to chat body: ", selectedConversation.artifacts);

                    if (isArtifactsOn && selectedConversation.artifacts) {
                        console.log("Adding artifacts to chat body: ", selectedConversation.artifacts);
                        chatBody.artifacts = selectedConversation.artifacts;
                    }
                    // Automatic routing stays backend-owned. Explicit artifact
                    // requests are intent only; the backend applies deployment policy
                    // before resolving them to the artifact generator.
                    if (options?.artifactsMode === true && deploymentAvailability.artifacts) {
                        chatBody.artifactsMode = true;
                    }
                    if (options?.codeInterpreterOnly === true && deploymentAvailability.codeInterpreter) {
                        chatBody.codeInterpreterOnly = true;
                    }

                    if (updatedConversation.projectId) {
                        // console.log("Selected Project Memory ID:", selectedConversation.projectId);
                        chatBody.projectId = updatedConversation.projectId;
                    }

                    // Handle memory operations in parallel with the main request flow
                    if (isMemoryOn) {
                        // For memory context, use a short timeout to keep the request moving
                        // if memory retrieval takes too long
                        try {
                            // Create a promise with a timeout
                            const memoriesPromise = Promise.race([
                                doReadMemoryOp({}),
                                new Promise<any>((_, reject) =>
                                    setTimeout(() => reject(new Error('Memory fetch timeout')), 500) // 500ms timeout
                                )
                            ]);

                            const memoriesResponse = await memoriesPromise;
                            const allMemories = JSON.parse(memoriesResponse.body).memories || [];
                            const relevantMemories = getRelevantMemories(allMemories);
                            const memoryContext = buildMemoryContextPrompt(relevantMemories);

                            if (memoryContext) {
                                chatBody.prompt += '\n\n' + memoryContext;
                            }
                        } catch (error) {
                            // If memory fetching times out or fails, just proceed without it
                            console.log("Skipping memory context due to timeout or error:", error);
                        }
                    }


                    if (uri) {
                        chatBody.endpoint = uri;
                    }

                    if (documents && documents.length > 0) {

                        const dataSources = documents.map((doc) => {
                            if (doc.key && doc.key.indexOf("://") === -1) {
                                return { id: "s3://" + doc.key, type: doc.type, name: doc.name || "", metadata: doc.metadata || {} };
                            } else if (doc.key && doc.key.indexOf("://") > -1) {
                                return { id: doc.key, type: doc.type, name: doc.name || "", metadata: doc.metadata || {} };
                            } else {
                                return doc;
                            }
                        });

                        const filteredDataSources = dataSources.filter(doc => !removedIds.has(doc.id));

                        if (filteredDataSources.length > 0) {
                            chatBody.dataSources = filteredDataSources;
                        }
                    } else if (message.data && message.data.dataSources && message.data.dataSources.length > 0) {
                        const filteredDataSources = message.data.dataSources
                            .map((doc: any) => {
                                return { id: doc.id, type: doc.type, name: doc.name || "", metadata: doc.metadata || {} };
                            })
                            .filter((doc: any) => !removedIds.has(doc.id));

                        if (filteredDataSources.length > 0) {
                            chatBody.dataSources = filteredDataSources;
                        }
                    }

                    // Project context. The backend (amplify-lambda-js) attaches everything
                    // from chatBody.projectId itself — the project's assistant-independent
                    // instructions, its approved memories, and its knowledge-base files —
                    // so sending never waits on, or fails because of, a browser lookup.
                    // The only client-side pieces: tell the server which project files the
                    // user removed from this chat, and warn (without delaying the send)
                    // when the project is archived and therefore not applied.
                    if (updatedConversation.projectId) {
                        if (removedIds.size > 0) {
                            chatBody.excludedProjectFileIds = Array.from(removedIds).slice(0, 200);
                        }
                        loadProjectContext(updatedConversation.projectId, 1500)
                            .then(({ project }) => {
                                if (project.status !== 'active') {
                                    toast("This project is archived, so its instructions, files and memory aren't applied.", {
                                        id: 'project-context-notice',
                                    });
                                }
                            })
                            .catch(() => undefined);
                    }


                    //PLUGINS before options is assigned
                    //in case no plugins are defined, we want to keep the default behavior
                    if (!featureFlags.ragEnabled || (plugins && pluginActive && !pluginIds?.includes(PluginID.RAG))) {
                        options = { ...(options || {}), skipRag: true, ragOnly: false, ragEvaluation: false };
                        console.log('skipping rag');
                    } else if (featureFlags.ragEnabled && featureFlags.ragEvaluation && (pluginIds?.includes(PluginID.RAG) && pluginIds?.includes(PluginID.RAG_EVAL))) {
                        options = { ...(options || {}), ragEvaluation: true };
                    }
                    // Advanced Rag is default off for assistant use 
                    if (!featureFlags.cachedDocuments || options?.assistantId || options?.groupId) {
                        options = { ...(options || {}), skipDocumentCache: true };
                    }


                    // Do not let stale plugin settings re-enable/disable the interpreter.
                    // The backend selects it only when deployment policy permits it.
                    if (!deploymentAvailability.codeInterpreter) {
                        options = { ...(options || {}), skipCodeInterpreter: true };
                        delete options.codeInterpreterOnly;
                    } else if (options?.codeInterpreterOnly !== true) {
                        options = { ...(options || {}), codeInterpreterOnly: false };
                    }

                    if (selectedConversation && selectedConversation.tags) {
                        const tags = selectedConversation.tags;
                        if (tags.includes(ReservedTags.ASSISTANT_BUILDER)) {
                            // In assistants, this has the effect of
                            // disabling the use of documents so that we
                            // can just add the document to the list of documents
                            // the assistant is using.
                            options = {
                                ...(options || {}),
                                skipRag: true,
                                ragOnly: false
                            };
                        }
                    }

                    if (selectedConversation.model?.supportsReasoning) {
                        // If the assistant enforces a thinking level, use that; otherwise use the conversation setting
                        const astDefinitionData = message.data?.assistant?.definition?.data;
                        const enforcedThinking = astDefinitionData?.enforceThinkingLevel;
                        const reasoningLevel = enforcedThinking
                            ? astDefinitionData?.thinkingLevel
                            : selectedConversation.data?.reasoningLevel;

                        if (reasoningLevel === 'off') {
                            console.log("Disabling reasoning");
                            // Disable reasoning entirely
                            options = {
                                ...(options || {}),
                                disableReasoning: true
                            };
                        } else {
                            // Set reasoning level (low, medium, high)
                            options = {
                                ...(options || {}),
                                reasoningLevel: reasoningLevel
                            };
                        }
                    }

                    if (options) {
                        const mcpEnabledValue = (chatBody as any).mcpEnabled;
                        if (options.codeInterpreterOnly === true && !deploymentAvailability.codeInterpreter) {
                            options = { ...options };
                            delete options.codeInterpreterOnly;
                        }
                        Object.assign(chatBody, options);
                        if (mcpEnabledValue !== undefined) {
                            (chatBody as any).mcpEnabled = mcpEnabledValue;
                        }
                    }

                    // console.log("Chatbody:", chatBody);

                    const parseMessageType = (message: string): {
                        prefix: "chat" | "json" | "json!" | "csv" | "fn";
                        body: string;
                        options: any | null
                    } => {
                        // This regular expression will match 'someXYZ' as a prefix and capture
                        // the contents inside the parentheses.
                        const regex = /^(\w+[\!]?)\(([^)]*)\).*/;

                        const match = message.trim().match(regex);

                        // @ts-ignore
                        //console.log("Match",match[0],match[1],match[2]);

                        if (match &&
                            match.length === 3 &&
                            match[1] &&
                            (match[1] === "json"
                                || match[1] === "json!"
                                || match[1] === "csv"
                                || match[1] === "fn") &&
                            match[2]) {
                            try {
                                return {
                                    prefix: match[1],
                                    body: message.trim().slice(match[1].length),
                                    options: match[2].length > 0 ? json5.parse(match[2]) : {}
                                };
                            } catch (e) {

                            }
                        }

                        return { prefix: "chat", body: message, options: {} }; // Return null if the message does not match the expected format
                    }

                    const controller = new AbortController();
                    const handleStopGenerationEvent = () => {
                        controller.abort();
                        console.log("Kill chat event trigger, control signal aborted value: ", controller.signal.aborted);
                    }

                    window.addEventListener('killChatRequest', handleStopGenerationEvent);
                    try {

                        const { prefix, body, options } = parseMessageType(message.content);
                        let updated = { ...message, content: body };
                        chatBody.messages = [...chatBody.messages.slice(0, -1), updated];

                        if (request.endpoint) {
                            chatBody.endpoint = request.endpoint;
                        }

                        // console.log(`Prompt:`, { prefix: prefix, options, message });

                        const generateJsonLoose = (): Promise<Response> => {
                            if (options.length === 0) {
                                return sendJsonChatRequest(chatBody, controller.signal);
                            } else {
                                return sendJsonChatRequestWithSchemaLoose(chatBody, options as JsonSchema, controller.signal)
                            }
                        }

                        let outOfOrder = false;
                        let currentState: any = {};
                        let reasoningText = "";
                        let reasoningMode = false; // support gemini reasoning
                        let text = ''; // declared here so it's accessible after the stream loop

                        const metaHandler: MetaHandler = {
                            status: (meta: any) => {
                                //capture reasoning to compress and save in state at the end of the astresponse
                                if (meta.id === "reasoning") reasoningText += meta.message;
                                homeDispatch({ type: "append", field: "status", value: newStatus(meta) })
                            },
                            mode: (modeName: string) => {
                                //console.log("Chat-Mode: "+modeName);
                                outOfOrder = (modeName === "out_of_order");
                            },
                            state: (state: any) => {
                                currentState = deepMerge(currentState, state);
                                const notice = state?.modelRateLimit;
                                if (notice?.reachedLimit === true && !currentState.modelRateLimitToastShown) {
                                    toast.error(notice.message || "You have reached the rate limit for this model. Please use another model.", { duration: 8000 });
                                    currentState = { ...currentState, modelRateLimitToastShown: true };
                                }
                            },
                            shouldAbort: () => {
                                if (shouldAbort()) {
                                    controller.abort();
                                    return true;
                                }
                                return false;
                            }
                        };

                        const invokers = {
                            "fn": () => sendFunctionChatRequest(chatBody, options.functions as CustomFunction[], options.call, controller.signal, metaHandler),
                            "chat": () => sendChatRequest(chatBody, controller.signal, metaHandler),
                            "csv": () => sendCSVChatRequest(chatBody, options as ColumnsSpec, controller.signal, metaHandler),
                            "json": () => generateJsonLoose(),
                            "json!": () => sendJsonChatRequestWithSchema(chatBody, options as JsonSchema, controller.signal, metaHandler)
                        }

                        const response = existingResponse ?? await invokers[prefix]();


                        if (!response || !response.ok) {
                            cleanupHomeState();

                            // The real error message (e.g. rate-limit details) lives in the response
                            // body, not in statusText (which is often empty over HTTP/2). Read the
                            // body and surface it via a toast so it's always visible — native alert()
                            // can be suppressed by the browser and was getting missed in prod.
                            let errorMessage = "";
                            try {
                                // Clone the response to read the body (streams can only be read once)
                                    const clonedResponse = response.clone();
                                errorMessage = (await clonedResponse.text())?.trim();
                                try {
                                    const parsed = JSON.parse(errorMessage);
                                    if (parsed?.error) errorMessage = parsed.error;
                                } catch {
                                    // Legacy/plain-text error body.
                                }
                            } catch (readError) {
                                console.error("Error reading response body:", readError);
                            }

                            // Fallbacks so the user ALWAYS sees a meaningful message
                            if (!errorMessage) {
                                if (response?.status === 429) {
                                    errorMessage = "You've reached your usage rate limit. Please try again later or contact your administrator.";
                                } else if (response?.status === 503) {
                                    errorMessage = "The assistant is temporarily unavailable. Please try again.";
                                } else {
                                    errorMessage = response?.statusText || "Your request could not be completed. Please try again.";
                                }
                            }

                            toast.error(errorMessage, { duration: 8000 });
                            return;
                        }
                        const data = response.body;
                        if (!data) {
                            cleanupHomeState();
                            return;
                        }
                        homeDispatch({ field: 'loading', value: false });
                        const reader = data.getReader();
                        const decoder = new TextDecoder();
                        let done = false;
                        text = ''; // reset for this attempt (declared before the retry loop)

                        // Reset the status display
                        homeDispatch({
                            field: 'status',
                            value: [],
                        });

                        const updatedMessages: Message[] = [
                            ...updatedConversation.messages,
                            newMessage({
                                role: 'assistant',
                                content: "",
                                data: { state: currentState }
                            }),
                        ];
                        updatedConversation = {
                            ...updatedConversation,
                            messages: updatedMessages,
                        };
                        homeDispatch({
                            field: 'selectedConversation',
                            value: updatedConversation,
                        });


                        const eventOrderingMgr = new OutOfOrderResults();

                        while (!done) {
                            try {
                                if (shouldAbort()) {
                                    controller.abort();
                                    done = true;
                                    break;
                                }
                                const { value, done: doneReading } = await reader.read();
                                done = doneReading;
                                const chunkValue = decoder.decode(value);

                                if (!outOfOrder) {
                                    if (text.includes("<thought>")) reasoningMode = true;

                                    // Split by reasoning tags and process alternately
                                    const parts = chunkValue.split(/(<\/?thought>)/);

                                    for (const part of parts) {
                                        if (part === '<thought>') {
                                            reasoningMode = true;
                                        } else if (part === '</thought>') {
                                            reasoningMode = false;
                                        } else if (part) {
                                            if (reasoningMode) {
                                                reasoningText += part;
                                                homeDispatch({ type: "append", field: "status", value: newStatus({ id: "reasoning", summary: "Thinking Details:", message: part, icon: "bolt", inProgress: true, animated: true }) });
                                            } else {
                                                text += part;
                                            }
                                        }
                                    }

                                    if (text.includes("</thought>")) reasoningMode = false;
                                } else {
                                    let event = { s: "0", d: chunkValue };
                                    try {
                                        event = JSON.parse(chunkValue);
                                    } catch (e) {
                                        //console.log("Error parsing event", e);
                                    }
                                    eventOrderingMgr.addEvent(event);
                                    text = eventOrderingMgr.getText();
                                }

                                const updatedMessages: Message[] =
                                    updatedConversation.messages.map((message, index) => {
                                        if (index === updatedConversation.messages.length - 1) {
                                            let assistantMessage =
                                            {
                                                ...message,
                                                content: text,
                                                data: { ...(message.data || {}), state: currentState }
                                            };
                                            return assistantMessage
                                        }
                                        return message;
                                    });
                                updatedConversation = {
                                    ...updatedConversation,
                                    messages: updatedMessages,
                                };
                                homeDispatch({
                                    field: 'selectedConversation',
                                    value: updatedConversation,
                                });
                            } catch (error: any) {
                                console.error(`❌ [STREAM] Error name: ${error?.name}, message: ${error?.message}`);
                                console.error(`❌ [STREAM] Error stack:`, error?.stack);

                                if (selectedConversation.isLocal) {
                                    const updatedConversations: Conversation[] = conversationsRef.current.map(
                                        (conversation: Conversation) => {
                                            if (conversation.id === selectedConversation.id) {
                                                return conversationWithCompressedMessages(updatedConversation);
                                            }
                                            return conversation;
                                        },
                                    );
                                    if (updatedConversations.length === 0) {
                                        updatedConversations.push(conversationWithCompressedMessages(updatedConversation));
                                    }
                                    homeDispatch({ field: 'conversations', value: updatedConversations });
                                    saveConversations(updatedConversations);
                                } else {
                                    uploadConversation(updatedConversation, foldersRef.current);
                                    {
                                        const remoteEntry = remoteForConversationHistory(updatedConversation);
                                        const updatedConversations: Conversation[] = conversationsRef.current.length === 0
                                            ? [remoteEntry]
                                            : conversationsRef.current.map(c => c.id === updatedConversation.id ? remoteEntry : c);
                                        homeDispatch({ field: 'conversations', value: updatedConversations });
                                        saveConversations(updatedConversations);
                                        saveContextCache({ conversationId: updatedConversation.id, conversationName: updatedConversation.name, messages: messagesToCached(updatedConversation.messages ?? []), fetchedAt: Date.now() });
                                    }
                                }
                                cleanupHomeState();
                                return;
                            }
                        }

                        // Tool execution is handled by the backend for most tools
                        // For MCP tools, we handle execution client-side since MCP servers run locally

                        // Check if there are pending MCP tool calls that need client-side execution
                        if (isMCPOn && currentState.mcpToolCalls && currentState.mcpToolCalls.length > 0) {
                            console.log("[MCP] Executing tool calls client-side:", currentState.mcpToolCalls);

                            // Execute all MCP tool calls
                            const toolResults: any[] = [];
                            for (const toolCall of currentState.mcpToolCalls) {
                                try {
                                    homeDispatch({
                                        type: "append",
                                        field: "status",
                                        value: newStatus({
                                            id: `mcp_tool_${toolCall.id}`,
                                            summary: `Executing MCP Tool`,
                                            message: `Running ${toolCall.function?.name || toolCall.name}...`,
                                            icon: "plug",
                                            inProgress: true,
                                            animated: true
                                        })
                                    });

                                    const toolName = toolCall.function?.name || toolCall.name;
                                    let parsedArgs: Record<string, unknown>;
                                    if (toolCall.function?.arguments) {
                                        if (typeof toolCall.function.arguments === 'string') {
                                            try {
                                                parsedArgs = JSON.parse(toolCall.function.arguments);
                                            } catch (parseError) {
                                                throw new Error(
                                                    `Failed to parse JSON arguments for tool "${toolName}": ` +
                                                    `${parseError instanceof Error ? parseError.message : String(parseError)}`
                                                );
                                            }
                                        } else {
                                            parsedArgs = toolCall.function.arguments;
                                        }
                                    } else {
                                        parsedArgs = toolCall.arguments || {};
                                    }
                                    const { result, toolInfo } = await handleMCPToolCall(
                                        toolName,
                                        parsedArgs
                                    );

                                    toolResults.push({
                                        tool_call_id: toolCall.id,
                                        role: 'tool',
                                        name: toolCall.function?.name || toolCall.name,
                                        content: result.content,
                                        isError: result.isError,
                                        serverName: toolInfo.serverName,
                                        toolName: toolInfo.toolName,
                                        // Store full rawResult for rendering images and rich content
                                        rawResult: result.rawResult
                                    });

                                    console.log(`[MCP] Tool ${toolInfo.toolName} executed:`, result);
                                } catch (error) {
                                    console.error(`[MCP] Tool execution failed:`, error);
                                    toolResults.push({
                                        tool_call_id: toolCall.id,
                                        role: 'tool',
                                        name: toolCall.function?.name || toolCall.name,
                                        toolName: toolCall.function?.name || toolCall.name,
                                        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                        isError: true
                                    });
                                }
                            }

                            // Store tool results in the message state for display
                            const lastMsgIndex = updatedConversation.messages.length - 1;
                            if (lastMsgIndex >= 0) {
                                updatedConversation.messages[lastMsgIndex].data = {
                                    ...updatedConversation.messages[lastMsgIndex].data,
                                    state: {
                                        ...updatedConversation.messages[lastMsgIndex].data?.state,
                                        mcpToolResults: toolResults
                                    }
                                };
                            }

                            // Continue the conversation with tool results
                            // Build messages with assistant tool_calls and tool results
                            console.log("[MCP] Continuing conversation with tool results...");

                            // Store MCP tool results in message data for rendering
                            const mcpToolResultsForDisplay = toolResults.map(tr => ({
                                toolName: tr.toolName || tr.name || 'unknown',
                                serverName: tr.serverName,
                                content: tr.rawResult?.content || [{ type: 'text', text: tr.content }],
                                isError: tr.isError
                            }));

                            // Create assistant message with tool_calls
                            const assistantToolCallMessage = newMessage({
                                role: 'assistant',
                                content: text, // Include any text the assistant wrote
                                tool_calls: currentState.mcpToolCalls.map((tc: any) => ({
                                    id: tc.id,
                                    type: 'function',
                                    function: tc.function
                                })),
                                data: {
                                    mcpToolResults: mcpToolResultsForDisplay
                                }
                            });

                            // Create tool result messages
                            const toolResultMessages = toolResults.map(tr => newMessage({
                                role: 'tool',
                                tool_call_id: tr.tool_call_id,
                                content: tr.content
                            }));

                            // Update conversation with assistant message (with tool_calls) and tool results
                            const messagesWithToolResults = [
                                ...updatedConversation.messages.slice(0, -1), // Remove the current incomplete assistant message
                                assistantToolCallMessage,
                                ...toolResultMessages
                            ];

                            updatedConversation = {
                                ...updatedConversation,
                                messages: messagesWithToolResults
                            };

                            homeDispatch({
                                field: 'selectedConversation',
                                value: updatedConversation,
                            });

                            // Make a direct API call to continue the conversation with tool results
                            // Don't use handleSend recursively - it adds unnecessary user messages
                            console.log("[MCP] Sending continuation request with tool results...");

                            // Build continuation chatBody with tool results already in messages
                            const continuationChatBody: ChatBody = {
                                model: updatedConversation.model,
                                messages: messagesWithToolResults, // Messages already include tool_calls and tool results
                                prompt: rootPrompt || updatedConversation.prompt || "",
                                temperature: updatedConversation.temperature || DEFAULT_TEMPERATURE,
                                maxTokens: updatedConversation.maxTokens || (Math.round(updatedConversation.model.outputTokenLimit / 2)),
                                conversationId,
                                // Use the same tools from the original request (already includes MCP tools)
                                tools: chatBody.tools,
                                mcpEnabled: true,
                                skipRag: true,
                                skipCodeInterpreter: true
                            };


                            // Reset state for continuation
                            currentState = {};
                            text = '';

                            // Make direct API call for continuation
                            const continuationController = new AbortController();
                            const continuationMetaHandler: MetaHandler = {
                                status: (meta: any) => {
                                    if (meta.id === "reasoning") reasoningText += meta.message;
                                    homeDispatch({ type: "append", field: "status", value: newStatus(meta) })
                                },
                                mode: (modeName: string) => {
                                    outOfOrder = (modeName === "out_of_order");
                                },
                                state: (state: any) => {
                                    currentState = deepMerge(currentState, state);
                                    const notice = state?.modelRateLimit;
                                    if (notice?.reachedLimit === true && !currentState.modelRateLimitToastShown) {
                                        toast.error(notice.message || "You have reached the rate limit for this model. Please use another model.", { duration: 8000 });
                                        currentState = { ...currentState, modelRateLimitToastShown: true };
                                    }
                                },
                                shouldAbort: () => {
                                    if (shouldAbort()) {
                                        continuationController.abort();
                                        return true;
                                    }
                                    return false;
                                }
                            };

                            try {
                                const continuationResponse = await sendChatRequest(
                                    continuationChatBody,
                                    continuationController.signal,
                                    continuationMetaHandler
                                );

                                if (!continuationResponse || !continuationResponse.ok) {
                                    console.error("[MCP] Continuation request failed:", continuationResponse?.statusText);
                                    cleanupHomeState();
                                    resolve(text);
                                    return;
                                }

                                const continuationData = continuationResponse.body;
                                if (!continuationData) {
                                    cleanupHomeState();
                                    resolve(text);
                                    return;
                                }

                                const continuationReader = continuationData.getReader();
                                let continuationDone = false;
                                let continuationText = '';

                                // Add new assistant message for continuation response
                                const continuationMessages: Message[] = [
                                    ...messagesWithToolResults,
                                    newMessage({
                                        role: 'assistant',
                                        content: "",
                                        data: { state: currentState }
                                    }),
                                ];
                                updatedConversation = {
                                    ...updatedConversation,
                                    messages: continuationMessages,
                                };
                                homeDispatch({
                                    field: 'selectedConversation',
                                    value: updatedConversation,
                                });

                                while (!continuationDone) {
                                    if (shouldAbort()) {
                                        continuationController.abort();
                                        break;
                                    }
                                    const { value, done: doneReading } = await continuationReader.read();
                                    continuationDone = doneReading;
                                    const chunkValue = decoder.decode(value);
                                    continuationText += chunkValue;

                                    // Update the last message with streamed content
                                    const streamedMessages: Message[] =
                                        updatedConversation.messages.map((message, index) => {
                                            if (index === updatedConversation.messages.length - 1) {
                                                return {
                                                    ...message,
                                                    content: continuationText,
                                                    data: { ...(message.data || {}), state: currentState }
                                                };
                                            }
                                            return message;
                                        });
                                    updatedConversation = {
                                        ...updatedConversation,
                                        messages: streamedMessages,
                                    };
                                    homeDispatch({
                                        field: 'selectedConversation',
                                        value: updatedConversation,
                                    });
                                }

                                // Loop to handle multiple rounds of MCP tool calls
                                // This allows unlimited tool call chains (e.g., install → create → execute → ...)
                                const MAX_TOOL_ITERATIONS = 10; // Safety limit
                                let toolIteration = 0;
                                let currentChatBody = continuationChatBody;
                                let currentMessages = updatedConversation.messages;

                                while (currentState.mcpToolCalls && currentState.mcpToolCalls.length > 0 && toolIteration < MAX_TOOL_ITERATIONS) {
                                    toolIteration++;
                                    console.log(`[MCP] Tool iteration ${toolIteration}: ${currentState.mcpToolCalls.length} tool calls detected`);

                                    // Clear status from previous iteration to prevent stacking
                                    homeDispatch({ field: 'status', value: [] });

                                    // Execute the tool calls
                                    const newToolResults: any[] = [];
                                    for (const toolCall of currentState.mcpToolCalls) {
                                        try {
                                            homeDispatch({
                                                type: "append",
                                                field: "status",
                                                value: newStatus({
                                                    id: `mcp_tool_${toolCall.id}`,
                                                    summary: `Executing MCP Tool`,
                                                    message: `Running ${toolCall.function?.name || toolCall.name}...`,
                                                    icon: "plug",
                                                    inProgress: true,
                                                    animated: true
                                                })
                                            });

                                            const iterToolName = toolCall.function?.name || toolCall.name;
                                            let iterParsedArgs: Record<string, unknown>;
                                            if (toolCall.function?.arguments) {
                                                if (typeof toolCall.function.arguments === 'string') {
                                                    try {
                                                        iterParsedArgs = JSON.parse(toolCall.function.arguments);
                                                    } catch (parseError) {
                                                        throw new Error(
                                                            `Failed to parse JSON arguments for tool "${iterToolName}": ` +
                                                            `${parseError instanceof Error ? parseError.message : String(parseError)}`
                                                        );
                                                    }
                                                } else {
                                                    iterParsedArgs = toolCall.function.arguments;
                                                }
                                            } else {
                                                iterParsedArgs = toolCall.arguments || {};
                                            }
                                            const { result, toolInfo } = await handleMCPToolCall(
                                                iterToolName,
                                                iterParsedArgs
                                            );

                                            newToolResults.push({
                                                tool_call_id: toolCall.id,
                                                role: 'tool',
                                                content: result.content,
                                                isError: result.isError,
                                                serverName: toolInfo.serverName,
                                                toolName: toolInfo.toolName,
                                                // Store full rawResult for rendering images and rich content
                                                rawResult: result.rawResult
                                            });

                                            console.log(`[MCP] Tool ${toolInfo.toolName} executed:`, result);
                                        } catch (error) {
                                            console.error(`[MCP] Tool execution failed:`, error);
                                            newToolResults.push({
                                                tool_call_id: toolCall.id,
                                                role: 'tool',
                                                toolName: toolCall.function?.name || toolCall.name,
                                                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                                isError: true
                                            });
                                        }
                                    }

                                    // Build next continuation with new tool results
                                    // Store MCP tool results in message data for rendering
                                    const mcpToolResults = newToolResults.map(tr => ({
                                        toolName: tr.toolName || 'unknown',
                                        serverName: tr.serverName,
                                        content: tr.rawResult?.content || [{ type: 'text', text: tr.content }],
                                        isError: tr.isError
                                    }));

                                    const nextAssistantMessage = newMessage({
                                        role: 'assistant',
                                        content: continuationText,
                                        tool_calls: currentState.mcpToolCalls.map((tc: any) => ({
                                            id: tc.id,
                                            type: 'function',
                                            function: tc.function
                                        })),
                                        data: {
                                            mcpToolResults: mcpToolResults
                                        }
                                    });

                                    const nextToolMessages = newToolResults.map(tr => newMessage({
                                        role: 'tool',
                                        tool_call_id: tr.tool_call_id,
                                        content: tr.content
                                    }));

                                    const nextMessages = [
                                        ...currentMessages.slice(0, -1),
                                        nextAssistantMessage,
                                        ...nextToolMessages
                                    ];

                                    // Update conversation
                                    updatedConversation = {
                                        ...updatedConversation,
                                        messages: nextMessages
                                    };

                                    homeDispatch({
                                        field: 'selectedConversation',
                                        value: updatedConversation,
                                    });

                                    // Reset state for next iteration
                                    currentState = {};

                                    // Make another continuation request
                                    const nextChatBody: ChatBody = {
                                        ...currentChatBody,
                                        messages: nextMessages
                                    };

                                    console.log(`[MCP] Sending continuation request ${toolIteration + 1}...`);

                                    const nextResponse = await sendChatRequest(
                                        nextChatBody,
                                        continuationController.signal,
                                        continuationMetaHandler
                                    );

                                    if (!nextResponse || !nextResponse.ok || !nextResponse.body) {
                                        console.error("[MCP] Continuation request failed");
                                        break;
                                    }

                                    const nextReader = nextResponse.body.getReader();
                                    let nextDone = false;
                                    let nextText = '';

                                    // Add assistant message for next response
                                    const nextContinuationMessages: Message[] = [
                                        ...nextMessages,
                                        newMessage({
                                            role: 'assistant',
                                            content: "",
                                            data: { state: {} }
                                        }),
                                    ];
                                    updatedConversation = {
                                        ...updatedConversation,
                                        messages: nextContinuationMessages,
                                    };
                                    currentMessages = nextContinuationMessages;
                                    homeDispatch({
                                        field: 'selectedConversation',
                                        value: updatedConversation,
                                    });

                                    while (!nextDone) {
                                        if (shouldAbort()) {
                                            continuationController.abort();
                                            break;
                                        }
                                        const { value, done: doneReading } = await nextReader.read();
                                        nextDone = doneReading;
                                        const chunkValue = decoder.decode(value);
                                        nextText += chunkValue;

                                        const streamedMsgs: Message[] =
                                            updatedConversation.messages.map((msg, idx) => {
                                                if (idx === updatedConversation.messages.length - 1) {
                                                    return { ...msg, content: nextText, data: { ...(msg.data || {}), state: currentState } };
                                                }
                                                return msg;
                                            });
                                        updatedConversation = { ...updatedConversation, messages: streamedMsgs };
                                        currentMessages = streamedMsgs;
                                        homeDispatch({ field: 'selectedConversation', value: updatedConversation });
                                    }

                                    continuationText = nextText;
                                    // Loop will continue if currentState.mcpToolCalls was populated by continuationMetaHandler
                                }

                                if (toolIteration >= MAX_TOOL_ITERATIONS) {
                                    console.warn("[MCP] Maximum tool iterations reached");
                                    toast.error(
                                        'Tool execution was limited to prevent excessive iterations. Some tool operations may not have completed.',
                                        { duration: 5000 }
                                    );
                                }

                                // Save conversation
                                if (selectedConversation.isLocal) {
                                    const updatedConversations: Conversation[] = conversationsRef.current.map(
                                        (conversation: Conversation) => {
                                            if (conversation.id === selectedConversation.id) {
                                                return conversationWithCompressedMessages(updatedConversation);
                                            }
                                            return conversation;
                                        },
                                    );
                                    if (updatedConversations.length === 0) {
                                        updatedConversations.push(conversationWithCompressedMessages(updatedConversation));
                                    }
                                    homeDispatch({ field: 'conversations', value: updatedConversations });
                                    saveConversations(updatedConversations);
                                } else {
                                    uploadConversation(updatedConversation, foldersRef.current);
                                    {
                                        const remoteEntry = remoteForConversationHistory(updatedConversation);
                                        const updatedConversations: Conversation[] = conversationsRef.current.length === 0
                                            ? [remoteEntry]
                                            : conversationsRef.current.map(c => c.id === updatedConversation.id ? remoteEntry : c);
                                        homeDispatch({ field: 'conversations', value: updatedConversations });
                                        saveConversations(updatedConversations);
                                        saveContextCache({ conversationId: updatedConversation.id, conversationName: updatedConversation.name, messages: messagesToCached(updatedConversation.messages ?? []), fetchedAt: Date.now() });
                                    }
                                }

                                cleanupHomeState();
                                resolve(continuationText);
                            } catch (error) {
                                console.error("[MCP] Continuation request failed:", error);
                                cleanupHomeState();
                                resolve(text);
                            }
                            return;
                        }

                        // Persist the AgentCore record ID returned by the backend via state.
                        // The backend emits it nested under the codeInterpreter state key:
                        // state.codeInterpreter.codeInterpreterRecordId
                        if (currentState?.codeInterpreter?.codeInterpreterRecordId) {
                            updatedConversation = {
                                ...updatedConversation,
                                codeInterpreterRecordId: currentState.codeInterpreter.codeInterpreterRecordId
                            };
                        }

                        // Populate codeInterpreterMessageData on the final assistant message so
                        // the backend can see previous file outputs in subsequent turns.
                        // The backend schema requires files nested under a "values" object:
                        // { type: "image/png", values: { file_key, presigned_url, file_size, ... } }
                        // The stream already delivers files in this shape via currentState.codeInterpreter.content.
                        const ciFiles: any[] = currentState?.codeInterpreter?.content ?? [];
                        if (ciFiles.length > 0) {
                            const recordId = updatedConversation.codeInterpreterRecordId
                                          ?? chatBody.codeInterpreterRecordId;
                            const codeInterpreterMessageData = {
                                codeInterpreterRecordId: recordId,
                                role: 'assistant',
                                textContent: text,
                                // Preserve the values wrapper — the backend schema requires it.
                                content: ciFiles.map((file: any) => ({
                                    type: file.type,
                                    values: {
                                        file_key: file.values?.file_key,
                                        presigned_url: file.values?.presigned_url,
                                        file_key_low_res: file.values?.file_key_low_res,
                                        presigned_url_low_res: file.values?.presigned_url_low_res,
                                        file_size: file.values?.file_size ?? 0,
                                    },
                                })),
                            };
                            // Attach to the last message in the conversation (the assistant reply).
                            const msgs = updatedConversation.messages;
                            const lastMsg = msgs[msgs.length - 1];
                            updatedConversation = {
                                ...updatedConversation,
                                messages: [
                                    ...msgs.slice(0, -1),
                                    { ...lastMsg, codeInterpreterMessageData },
                                ],
                            };
                        }

                        //console.log("Dispatching post procs: " + postProcessingCallbacks.length);
                        postProcessingCallbacks.forEach(callback => callback({
                            chatBody: chatBody,
                            response: text
                        }));

                        const hook = getHook(selectedConversation.tags || []);
                        if (hook) {

                            const result = hook.exec({}, selectedConversation, text);

                            let updatedText = (result && result.updatedContent) ? result.updatedContent : text;

                            const updatedMessages: Message[] =
                                updatedConversation.messages.map((message, index) => {
                                    if (index === updatedConversation.messages.length - 1) {
                                        const disclaimer = message.data.state.currentAssistantDisclaimer;
                                        let astMsg = updatedText;
                                        if (disclaimer) astMsg += "\n\n" + disclaimer;
                                        if (reasoningText) message.data.state.reasoning = lzwCompress(reasoningText);

                                        return {
                                            ...message,
                                            content: astMsg,
                                        };
                                    }
                                    return message;
                                });
                            updatedConversation = {
                                ...updatedConversation,
                                messages: updatedMessages,
                            };
                            homeDispatch({
                                field: 'selectedConversation',
                                value: updatedConversation,
                            });
                        }

                        // Auto-remove denied/invalid data sources from message history so the
                        // context manager badge and ConversationContextManager reflect reality.
                        const removedDs = currentState?.removedDataSources;
                        if (removedDs && Array.isArray(removedDs.deniedAccess) && removedDs.deniedAccess.length > 0) {
                            // Backend now sends originalId (the exact per-user S3 key the frontend stored).
                            // Collect all denied originalIds directly; fall back to name-matching if missing.
                            const deniedOriginalIds = new Set<string>();
                            const deniedNames = new Set<string>();
                            removedDs.deniedAccess.forEach((d: any) => {
                                if (d?.originalId) deniedOriginalIds.add(d.originalId);
                                else if (d?.name) deniedNames.add(d.name);
                            });

                            // Resolve any name-based fallbacks by scanning message dataSources
                            const idsToRemove = new Set<string>(deniedOriginalIds);
                            if (deniedNames.size > 0) {
                                updatedConversation.messages.forEach((msg: any) => {
                                    msg.data?.dataSources?.forEach((ds: any) => {
                                        if (ds.name && deniedNames.has(ds.name)) idsToRemove.add(ds.id);
                                    });
                                });
                            }

                            if (idsToRemove.size > 0) {
                                const existing = new Set(updatedConversation.removedDocumentIds || []);
                                idsToRemove.forEach(id => existing.add(id));

                                const cleanedMessages = updatedConversation.messages.map((msg: any) => {
                                    if (!msg.data?.dataSources?.length) return msg;
                                    const filtered = msg.data.dataSources.filter((ds: any) => !idsToRemove.has(ds.id));
                                    if (filtered.length === msg.data.dataSources.length) return msg;
                                    return { ...msg, data: { ...msg.data, dataSources: filtered } };
                                });

                                updatedConversation = {
                                    ...updatedConversation,
                                    messages: cleanedMessages,
                                    removedDocumentIds: Array.from(existing)
                                };
                                homeDispatch({ field: 'selectedConversation', value: updatedConversation });
                            }
                        }

                        if (selectedConversation.isLocal) {
                            const updatedConversations: Conversation[] = conversationsRef.current.map(
                                (conversation: Conversation) => {
                                    if (conversation.id === selectedConversation.id) {
                                        return conversationWithCompressedMessages(updatedConversation);
                                    }
                                    return conversation;
                                },
                            );
                            if (updatedConversations.length === 0) {
                                updatedConversations.push(conversationWithCompressedMessages(updatedConversation));
                            }
                            homeDispatch({ field: 'conversations', value: updatedConversations });
                            saveConversations(updatedConversations);
                        } else {
                            uploadConversation(updatedConversation, foldersRef.current);
                            {
                                const remoteEntry = remoteForConversationHistory(updatedConversation);
                                const updatedConversations: Conversation[] = conversationsRef.current.length === 0
                                    ? [remoteEntry]
                                    : conversationsRef.current.map(c => c.id === updatedConversation.id ? remoteEntry : c);
                                homeDispatch({ field: 'conversations', value: updatedConversations });
                                saveConversations(updatedConversations);
                                saveContextCache({ conversationId: updatedConversation.id, conversationName: updatedConversation.name, messages: messagesToCached(updatedConversation.messages ?? []), fetchedAt: Date.now() });
                            }
                        }

                        if (!isWaitingForAgentResponse(updatedConversation)) homeDispatch({ field: 'messageIsStreaming', value: false });

                        // Auto-rename "New Conversation" after the first exchange.
                        // Chat.tsx does this too, but its useEffect([selectedConversation]) fires while
                        // messageIsStreaming is still true (stale closure), so it never renames in the
                        // new-UI path. We do it here where we know streaming has just ended.
                        if (
                            updatedConversation.name === 'New Conversation' &&
                            updatedConversation.messages.length > 1 &&
                            !isWaitingForAgentResponse(updatedConversation)
                        ) {
                            (async () => {
                                try {
                                    const promptMessages = updatedConversation.messages
                                        .slice(0, 1)
                                        .map(m => ({ ...m, data: {}, configuredTools: [] }));
                                    promptMessages[0].content = `Look at the following prompt: "${promptMessages[0].content}" \n\nYour task: As an AI proficient in summarization, create a short concise title for the given prompt. Ensure the title is under 30 characters.`;
                                    const customName = await promptForData(
                                        chatEndpoint || '',
                                        promptMessages,
                                        getDefaultModel(DefaultModels.CHEAPEST),
                                        'Respond with only the title name and nothing else.',
                                        defaultAccount,
                                        statsService,
                                        10
                                    );
                                    const firstMsg = updatedConversation.messages[0].content;
                                    const fallbackName = firstMsg && firstMsg.length > 30
                                        ? firstMsg.substring(0, 30) + '...'
                                        : firstMsg ?? updatedConversation.name;
                                    const renamedConversation = {
                                        ...updatedConversation,
                                        name: customName?.trim() || fallbackName,
                                    };
                                    handleUpdateSelectedConversation(renamedConversation);
                                } catch (e) {
                                    console.warn('Auto-rename failed:', e);
                                }
                            })();
                        }

                        // Run memory extraction after main response is processed
                        // Project chats never feed the global (cross-chat) memory: their facts belong to
                        // the project's own, approval-gated memory below.
                        if (isMemoryOn && memoryExtractionEnabled && !updatedConversation.projectId) {
                            // This runs completely independently and doesn't affect the main response flow
                            (async () => {
                                try {
                                    // get the last user message
                                    const userInput = updatedConversation.messages[updatedConversation.messages.length - 2]?.content || '';

                                    // console.log("User input: ", userInput);

                                    // Fetch existing memories for fact extraction
                                    const memoriesResponse = await doReadMemoryOp({});
                                    let existingMemories: Memory[] = [];

                                    try {
                                        const allMemories = JSON.parse(memoriesResponse.body).memories || [];
                                        existingMemories = getRelevantMemories(allMemories);
                                    } catch (error) {
                                        console.error("Error fetching existing memories for fact extraction:", error);
                                    }

                                    // Build and send fact extraction prompt
                                    const extractFactsPrompt = buildExtractFactsPrompt(userInput, existingMemories);

                                    // console.log("Extract facts prompt: ", extractFactsPrompt);

                                    const extractFactsResult = await promptForData(
                                        chatEndpoint || '',
                                        [], // Send empty array instead of conversation messages
                                        getDefaultModel(DefaultModels.CHEAPEST),
                                        extractFactsPrompt,
                                        defaultAccount,
                                        statsService
                                    );

                                    console.log("Extract facts result: ", extractFactsResult);

                                    if (!extractFactsResult) {
                                        console.warn('Fact extraction returned null response');
                                        return;
                                    }

                                    // Parse the response to extract facts
                                    const facts: ExtractedFact[] = [];
                                    const factBlocks = extractFactsResult.split('\n\n');

                                    for (const block of factBlocks) {
                                        if (!block.trim()) continue;

                                        const contentMatch = block.match(/FACT: (.*?)(?:\n|$)/);
                                        const taxonomyMatch = block.match(/TAXONOMY: (.*?)(?:\n|$)/);
                                        const reasoningMatch = block.match(/REASONING: ([\s\S]*?)(?:\n\n|$)/);

                                        if (contentMatch && taxonomyMatch) {
                                            facts.push({
                                                content: contentMatch[1].trim(),
                                                taxonomy_path: taxonomyMatch[1].trim(),
                                                reasoning: reasoningMatch ? reasoningMatch[1].trim() : "",
                                                conversation_id: conversationId || updatedConversation.id
                                            });
                                        }
                                    }

                                    // Filter out duplicates
                                    const existingContents = new Set(
                                        existingMemories.map((memory: Memory) => memory.content.toLowerCase().trim())
                                    );
                                    const uniqueFacts = facts.filter(fact =>
                                        !existingContents.has(fact.content.toLowerCase().trim())
                                    );

                                    // Update state with new facts
                                    homeDispatch({
                                        field: 'extractedFacts',
                                        value: [...(extractedFacts || []), ...uniqueFacts].filter(
                                            (fact, index, self) =>
                                                self.findIndex(f => f.content === fact.content) === index
                                        )
                                    });
                                } catch (error) {
                                    console.warn('Fact extraction process failed:', error);
                                }
                            })();
                        }

                        // Project memory extraction — separate from the global-memory
                        // block above (different gate: the project's own memoryEnabled
                        // flag, not the featureFlags.memory/includeMemory pair), and
                        // saves suggestions as pending. They appear in the project
                        // workspace but are never injected until the user approves them.
                        if (updatedConversation.projectId) {
                            (async () => {
                                try {
                                    const projectId = updatedConversation.projectId as string;
                                    const { project } = await loadProjectContext(projectId, 10000);
                                    if (project.status !== 'active' || !project.memoryEnabled) return;

                                    // What the extractor sees: the user's message and the assistant's
                                    // reply to it. A long message is a pasted document, not the user
                                    // talking about the project, so it is skipped entirely, and both
                                    // texts are bounded so nothing large is re-sent every turn.
                                    const messages = updatedConversation.messages as any[];
                                    const lastAssistant = messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1] : undefined;
                                    const lastUser = [...messages].reverse().find((candidate) => candidate.role === 'user');
                                    const userText: string = typeof lastUser?.content === 'string' ? lastUser.content : '';
                                    if (userText.trim().length < 20 || userText.length > 3000) return;
                                    const assistantText: string = typeof lastAssistant?.content === 'string' ? lastAssistant.content.slice(0, 1500) : '';
                                    const userInput = userText;

                                    const existingMemoriesResult = await listProjectMemories(projectId);
                                    const existingMemories = existingMemoriesResult.success ? (existingMemoriesResult.data || []) : [];
                                    const normalizeMemoryText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
                                    const existingContents = new Set(existingMemories.map((m: any) => normalizeMemoryText(m.content)));
                                    // So a corrected/updated fact (see "supersedes" below) can retire the
                                    // exact old record it replaces, rather than just sitting alongside it.
                                    const existingIdByContent = new Map(existingMemories.map((m: any) => [normalizeMemoryText(m.content), m.id]));

                                    const extractFactsPrompt = buildProjectExtractFactsPrompt(
                                        userInput,
                                        existingMemories.map((m: any) => m.content),
                                        assistantText
                                    );

                                    // The dev-config "cheapest" model can be mis-configured on the
                                    // backend for reasoning-disabled calls (see getDefaultModel usage
                                    // elsewhere); extraction only needs a quick structured-output call,
                                    // so reuse the model already known-good for this conversation instead
                                    // of forcing a separate, possibly-broken "cheapest" tier model.
                                    const extractionModel = updatedConversation.model || getDefaultModel(DefaultModels.CHEAPEST);

                                    // A request with only a system message and no user turn at all gets
                                    // rejected by some providers (Bedrock in particular) before it ever
                                    // reaches a model-specific error path, surfacing as the same generic
                                    // "Error retrieving response" regardless of which model is configured.
                                    // Give it a minimal real user turn instead of an empty messages array.
                                    const extractionMessages = [newMessage({ role: 'user', content: 'Extract the facts now.' })];

                                    let extractionTimeout: ReturnType<typeof setTimeout> | undefined;
                                    const extractFactsResult = await Promise.race([
                                        promptForData(
                                            chatEndpoint || '',
                                            extractionMessages,
                                            extractionModel,
                                            extractFactsPrompt,
                                            defaultAccount,
                                            statsService
                                        ),
                                        new Promise<null>((resolve) => {
                                            extractionTimeout = setTimeout(() => resolve(null), 15000);
                                        }),
                                    ]).finally(() => {
                                        if (extractionTimeout) clearTimeout(extractionTimeout);
                                    });

                                    if (!extractFactsResult) return;

                                    const cleanedResult = extractFactsResult
                                        .trim()
                                        .replace(/^```(?:json)?\s*/i, '')
                                        .replace(/\s*```$/, '');
                                    const parsed = JSON.parse(cleanedResult);
                                    const newFacts: string[] = Array.isArray(parsed?.facts)
                                        ? parsed.facts
                                            .filter((fact: unknown): fact is string => typeof fact === 'string')
                                            .map((fact: string) => fact.trim().slice(0, 1000))
                                            .filter(Boolean)
                                            .slice(0, 3)
                                        : [];

                                    // Old records a new fact corrects/replaces, e.g. a stated name that
                                    // changed. The model is asked to copy the exact existing text so it
                                    // can be matched back to its record id. Nothing is deleted here: the
                                    // superseded ids just ride along on the new PENDING suggestion, and the
                                    // backend only retires them if and when the owner approves this new
                                    // memory (service/project_memory.py: edit_project_memory). Rejecting
                                    // the suggestion, or never acting on it, leaves the old fact untouched.
                                    const supersedes: string[] = Array.isArray(parsed?.supersedes)
                                        ? parsed.supersedes
                                            .filter((item: unknown): item is string => typeof item === 'string')
                                            .slice(0, 5)
                                        : [];
                                    const supersededIds = Array.from(new Set(
                                        supersedes
                                            .map((old) => existingIdByContent.get(normalizeMemoryText(old)))
                                            .filter((id): id is string => Boolean(id))
                                    ));

                                    const uniqueFacts = newFacts.filter((fact) => {
                                        const normalized = fact.toLowerCase().replace(/\s+/g, ' ').trim();
                                        if (existingContents.has(normalized)) return false;
                                        existingContents.add(normalized);
                                        return true;
                                    });

                                    let suggested = 0;
                                    for (const fact of uniqueFacts) {
                                        const saved = await addProjectMemory({
                                            projectId,
                                            content: fact,
                                            sourceConversationId: updatedConversation.id,
                                            status: 'pending',
                                            ...(supersededIds.length > 0 ? { supersedesIds: supersededIds } : {}),
                                        });
                                        if (saved.success && saved.message !== 'Memory already exists.') suggested += 1;
                                    }
                                    if (suggested > 0) {
                                        // Nudge: the chat header shows a badge and this toast points at it.
                                        toast(`${suggested} memory suggestion${suggested === 1 ? '' : 's'} for ${project.name}. Open Project context to review.`, {
                                            id: 'project-memory-suggested',
                                            duration: 6000,
                                        });
                                        window.dispatchEvent(new CustomEvent('amplifyProjectMemorySuggested', { detail: { projectId, count: suggested } }));
                                    }
                                } catch (error) {
                                    console.warn('Project memory extraction failed:', error);
                                }
                            })();
                        }

                        resolve(text);

                    } catch (error: any) {
                        cleanupHomeState();
                        return;
                        //reject(error);
                        // Handle any other errors, as required.
                    } finally {
                        window.removeEventListener('killChatRequest', handleStopGenerationEvent);
                    }

                    if (!isWaitingForAgentResponse(updatedConversation)) {
                        //Reset the status display
                        homeDispatch({
                            field: 'status',
                            value: [],
                        });
                    }

                }
            });
        },
        [
            conversationsRef.current,
            selectedConversation
        ],
    );

    return {
        handleSend
    };
}
