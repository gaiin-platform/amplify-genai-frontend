import { getLatestAgentState } from "@/services/agentService";
import { MetaHandler, sendChatRequestWithDocuments } from "@/services/chatService";
import { Conversation, Message } from "@/types/chat";
import { newStatus } from "@/types/workflow";
import { deepMerge } from "./state";
import { getSession } from "next-auth/react";
import { Model } from "@/types/model";
import { Account } from "@/types/accounts";
import cloneDeep from "lodash/cloneDeep";
import { lzwCompress, lzwUncompress } from "./lzwCompression";

 
export const listenForAgentUpdates = async function(sessionId: string, onAgentStateUpdate: (state: any) => boolean) {
  let errorsRemaining = 15;
  let shouldContinue = true;
  let wasAborted = false;
  const handleStopGenerationEvent = () => {
    shouldContinue = false;
    wasAborted = true;
  }
  window.addEventListener('killChatRequest', handleStopGenerationEvent);
  while (shouldContinue && errorsRemaining > 0) {
      try {
        const state = await getLatestAgentState(sessionId);
        if (wasAborted) break;
        if (!state.success) errorsRemaining--;
        shouldContinue = onAgentStateUpdate(state);
        if (shouldContinue) await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        // It is possible the state has not been written yet, so we will retry a few times
        console.error("Error checking agent state:", error);
          
        errorsRemaining--;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
  }
  window.removeEventListener('killChatRequest', handleStopGenerationEvent);
}


export const agentMessages = (agentResult: any, userPrompt: string, msgData: any, dataSources?: any[], conversationMessages?: Message[])  => {
    const msgs: any[] = [];

    // FIRST MESSAGE AT INDEX 0: Collect ALL data sources from conversation in ONE message
    // This will be picked up by the backend as RAG sources (since it's not the last message)
    if (dataSources && dataSources.length > 0) {
        msgs.push({
            role: "user",
            content: "",
            data: {
                dataSources: dataSources
            }
        });
    }

    // THEN add the files system message if needed
    const conatinsFiles = agentResult.data.files && Object.keys(agentResult.data.files).length > 0;
    if (conatinsFiles) {
        msgs.push({
            role: "system",
            content: `
        Unless the user tells you otherwise, use the most specific markdown block in the list below to provide the user access to the files, images, and other outputs you create.
        Use the plain file reference as a last resort.

        You can reference files, images, and other outputs by using the EXACT syntax:
        \`\`\`agent
        <filename>
        \`\`\` anywhere in your response.

        There are some additional special markdown blocks that you should use:

        If the file is CSV, agent_table will display a rich table editor with the data from the file, a great way to get data from numpy/pandas back to the user:
        \`\`\`agent_table
        <filename>
        \`\`\`

        If the file is an image, agent_image will display a rich image viewer with the image from the file...good for outputs from matplotlib in particular!
        \`\`\`agent_image
        <filename>
        \`\`\`

        ALWAYS display CSV in an agent_table.
        Always display images in an agent_image.

        These are the files available to you:
        ${Object.values(agentResult.data.files).map((file: any) => `${file.original_name}`).join('\n')}
        `
        });
    }

    msgs.push({
        role: "user",
        data: {...msgData},
        content:
            `The user's prompt was: ${userPrompt}` +
            `\n\nAn assistant has attempted to help with this request. Here is the log of their work:\n---------------------\n${JSON.stringify(agentResult.data.result)}` +
            `\n\n---------------------` +
            `\n\n**CRITICAL INSTRUCTIONS - READ CAREFULLY:**\n` +
            `1. ONLY use information from: (a) The assistant's work log above, (b) Reference documents provided to you in this conversation.\n` +
            `2. If reference documents are provided, they contain the ACTUAL content you need. Read and use them.\n` +
            `3. NEVER say things like "I don't have access", "I need you to provide", or "I cannot see the document". If documents were provided, you CAN see them.\n` +
            `4. NEVER make up or assume information not in the assistant's log or reference documents.\n` +
            `5. If the assistant's work answers the question, use that answer.\n` +
            `6. If the assistant's work is incomplete/wrong AND reference documents are available, use the reference documents instead.\n` +
            `7. If neither the assistant nor reference documents have the answer, say "The available information does not contain the answer to this question."\n` +
            `\nAnswer the user's prompt now based ONLY on what is provided in this conversation.`
    })

    return msgs as Message[];
} 


export const handleAgentRunResult = async (agentResult: any, selectedConversation: Conversation, model: Model, defaultAccount: Account | undefined, homeDispatch: any, statsService:any, chatEndpoint: string) => {
    const requestId = Math.random().toString(36).substring(7);
    homeDispatch({field: "currentRequestId", value: requestId});

    const controller = new AbortController();
    const handleStopGenerationEvent = () => {
        if (!controller.signal.aborted) controller.abort("User requested to stop generation");
        console.log("Kill agent chat event trigger, control signal aborted value: ", controller.signal.aborted);
    }
    window.addEventListener('killChatRequest', handleStopGenerationEvent);
    
    let currentState =  selectedConversation.messages.slice(-1)[0].data.state;
    
    homeDispatch({ field: "status", value: [newStatus( {
                                                    animated: true,
                                                    inProgress: true,
                                                    sticky: true,
                                                    summary: `Finalizing response...`,
                                                    icon: "info",
                                                })] })

    
    const metaHandler: MetaHandler = {
        status: (meta: any) => {},
        mode: (modeName: string) => {},
        state: (state: any) => {
            currentState = deepMerge(currentState, state);
            
        },
        shouldAbort: () => false
    };

    const accessToken = await getSession().then((session) => { 
                            // @ts-ignore
                            return session.accessToken
                        })

    const userPromptMsg = selectedConversation.messages
    .filter(message => message.role === 'user')
    .slice(-1)[0];
    const userPrompt = userPromptMsg?.content;
    const msgData = userPromptMsg?.data;

    // Helper to add unique data source
    const addDataSource = (arr: any[], doc: any, seenIds: Set<string>) => {
        const docId = doc.id || doc.contentKey || doc.key;
        if (!seenIds.has(docId)) {
            seenIds.add(docId);
            arr.push({
                id: doc.id || docId,
                type: doc.type || doc.dataType || "",
                name: doc.name || "",
                metadata: doc.metadata || {}
            });
        }
    };

    // Separate current message's data sources (attached) from older messages (RAG)
    const currentMessageDataSources: any[] = [];
    const olderMessagesDataSources: any[] = [];
    const seenIds = new Set<string>();

    // Current message's data sources (attached documents)
    msgData?.dataSources?.forEach((doc: any) => addDataSource(currentMessageDataSources, doc, seenIds));

    // Older messages' data sources (RAG sources)
    selectedConversation.messages.forEach((msg: Message) => {
        if (msg === userPromptMsg) return;

        // From user messages
        msg.data?.dataSources?.forEach((doc: any) => addDataSource(olderMessagesDataSources, doc, seenIds));

        // From assistant RAG context
        msg.data?.state?.sources?.documentContext?.sources?.forEach((doc: any) =>
            addDataSource(olderMessagesDataSources, doc, seenIds)
        );
    });

    console.log("Current message data sources (attached):", currentMessageDataSources);
    console.log("Older messages data sources (RAG):", olderMessagesDataSources);

    const chatBody: any = {
        model: model,
        messages: agentMessages(agentResult, userPrompt, msgData, olderMessagesDataSources, selectedConversation.messages),
        key: accessToken,
        prompt: "You are an AI assistant responding to a user's question. You have been provided with: (1) an assistant's work log, and (2) reference documents via RAG retrieval. CRITICAL RULES: Only use information from these sources. If reference documents are provided in the conversation, you HAVE access to their content - use it. Never claim you lack access to provided information. Never make up information. If the provided sources don't contain the answer, explicitly state that. Always ground your response in the actual content provided to you.",
        temperature: 0.5,
        maxTokens: 4000,
        ragOnly: true,
        skipRag: false,
        skipCodeInterpreter: true,
        accountId: defaultAccount?.id,
        rateLimit: defaultAccount?.rateLimit,
        disableTools: true,
        assistantId: (() => {
            const aid = msgData?.assistant?.definition?.assistantId;
            // Strip layered-assistant prefixes so the agent summarization call
            // is routed as a plain LLM request, not through the layered router.
            if (aid && (aid.startsWith('astr/') || aid.startsWith('astgr/'))) return undefined;
            return aid;
        })(),
        dataSources: currentMessageDataSources || []
    };

    statsService.sendChatEvent(chatBody);
    const response = await sendChatRequestWithDocuments(chatEndpoint || '', accessToken, chatBody, controller.signal, metaHandler);
                 
    let updatedConversation = cloneDeep(selectedConversation);

    const responseData = response.body;
    const reader = responseData ? responseData.getReader() : null;
    const decoder = new TextDecoder();
    let done = false;
    let text = '';
    const lastIndex = updatedConversation.messages.length - 1;
    try {
        homeDispatch({ field: 'status', value: [] });
        while (!done) {
            if (controller.signal.aborted)  break;
    
            // @ts-ignore
            const {value, done: doneReading} = await reader.read();
            done = doneReading;
            const chunkValue = decoder.decode(value);
    
            if (done) break;
    
            text += chunkValue;
            if (updatedConversation) {
              let updatedMessages: Message[] = [];
              updatedMessages = updatedConversation.messages.map((message, index) => {
                      if (index === lastIndex) {
                          return { ...message,
                                  content: text,
                                  data: {...(message.data || {}), state: currentState}
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
   
      }
 
    } finally {
        if (reader && !controller.signal.aborted) {
            await reader.cancel(); 
            reader.releaseLock();
        }
        window.removeEventListener('killChatRequest', handleStopGenerationEvent);
        homeDispatch({field: 'messageIsStreaming', value: false}); 
    
    } 

    updatedConversation.messages[lastIndex].data.state.agentRun.endTime = new Date();
    updatedConversation.messages[lastIndex].data.state.agentLog = lzwCompress(JSON.stringify(agentResult));
    return updatedConversation;
}


export const handleAgentRun = async ( sessionId: string, onStatusUpdate: (status: any) => void ) => {
    let agentResult = null;
    let wasAborted = false;
    
    const handleStopGenerationEvent = () =>  wasAborted = true;
    window.addEventListener('killChatRequest', handleStopGenerationEvent);
    
    try {
        const statusInfo = newStatus(
            {   animated: true,
                inProgress: true,
                sticky: true,
                icon: "info",
            }
        );
        
        await listenForAgentUpdates(sessionId, (state) => {
            if (wasAborted) return false;

            if (state.data?.result) {
                agentResult = state;
                return false;
            }
            let msg = getThinkingMessage();
            let details = "";

            if (state && state.success && state.data && state.data.state) {

                state = state.data;
                console.log("Agent state updated:", state);
                try {
                    const tool_call = JSON.parse(state.state);
                    const tool = tool_call.tool;
                    if (tool === "terminate"){
                        msg = "Hold on..."
                    } else if(tool === "exec_code"){
                        msg = "Executing code..."
                        details = `\`\`\`python\n\n${tool_call.args.code}\n\n\`\`\``;
                    } else {
                        const formatToolCall = (toolCall: any) => {
                            const lines = [`Calling: ${toolCall.tool}`, '   with:'];
                            Object.entries(toolCall.args).forEach(([key, value]) => {
                                lines.push(`      ${key}: ${JSON.stringify(value)}`);
                            });
                            return lines.join('\n');
                        }

                        msg = "Calling: " + tool_call.tool;
                        details = formatToolCall(tool_call);
                    }
                } catch (e) {
                    console.error("Error parsing tool call:", e);
                    msg = typeof state.state === 'string' ?
                            state.state : `Agent state updated: ${JSON.stringify(state)}`;
                }
               
            }  

            statusInfo.summary = msg;
            statusInfo.message = details

            onStatusUpdate(statusInfo);
            return state.inProgress ?? true;
        });

        // If aborted during the process, return null
        if (wasAborted) return null;

        return agentResult;
        
    } finally {
        window.removeEventListener('killChatRequest', handleStopGenerationEvent);
    }
}


export const isWaitingForAgentResponse = (conversation: Conversation) => {
    const lastMsgState = conversation.messages && conversation.messages.slice(-1)[0]?.data?.state;
    if ( lastMsgState?.agentRun && !lastMsgState.agentRun.endTime ) return lastMsgState.agentRun;
    return null;
}


export function getThinkingMessage() {
    const messages = [
        "Thinking...",
        "Contemplating...",
        "Processing...",
        "Analyzing...",
        "Computing...",
        "Working on it...",
        "Calculating...",
        "Evaluating..."
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
}

export const getAgentLog = (message: Message) => {
    let agentLog = message.data?.state?.agentLog;
    if (agentLog && Array.isArray(agentLog)) {
        // need to uncompress
        try {
            agentLog = JSON.parse(lzwUncompress(agentLog));
        } catch (e) {
            console.error("Error uncompressing agent log", e);
            return undefined;
        }
    }
    return agentLog;
}