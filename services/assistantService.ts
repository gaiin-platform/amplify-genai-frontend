import {AssistantDefinition, AssistantProviderID} from "@/types/assistant";
import {Message} from "@/types/chat";
import {v4 as uuidv4} from 'uuid';
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/assistant";
const SERVICE_NAME = "assistant";

const addData = (data: { [key: string]: any }) => {
    return (m: Message) => {
        return { ...m, data: { ...m.data, ...data } }
    };
}

const addDataToMessages = (messages: Message[], data: { [key: string]: any }) => {
    return messages.map((m) => {
        return { ...m, data: { ...m.data, ...data } }
    });
}

export const createAssistant = async (assistantDefinition: AssistantDefinition, abortSignal = null) => {
    if (!("disclaimer" in assistantDefinition)) assistantDefinition.disclaimer = '';
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/create",
        data: { ...assistantDefinition },
        service: SERVICE_NAME
    };

    if (assistantDefinition.provider === 'openai') {
        if (assistantDefinition.dataSources) {
            assistantDefinition.fileKeys = assistantDefinition.dataSources.map((ds) => ds.id);
        }

        op.data = { ...assistantDefinition };

        const result = await doRequestOp(op);

        const id = result.data.assistantId;
        return {assistantId: id, id, provider: 'openai'};
    } else if (assistantDefinition.provider === AssistantProviderID.AMPLIFY) {

        try {
            const result = await doRequestOp(op);
            // console.log("result", result);

            return {
                id: result.data.id,
                assistantId: result.data.assistantId,
                provider: AssistantProviderID.AMPLIFY,
                data_sources: result.data.data_sources,
                ast_data: result.data.ast_data,
                name: assistantDefinition.name || "Unnamed Assistant",
                description: assistantDefinition.description || "No description provided",
                instructions: assistantDefinition.instructions || assistantDefinition.description,
                disclaimer: assistantDefinition.disclaimer || ""
            }
        } catch {
            console.error("Failed to parse assistant data from response");
            return {
                id: null,
                assistantId: null,
                provider: AssistantProviderID.AMPLIFY
            }

        }
    }

    return {
        assistantId: uuidv4(),
        provider: AssistantProviderID.AMPLIFY,
        dataSources: assistantDefinition.dataSources || [],
        ast_data: assistantDefinition.data,
        name: assistantDefinition.name || "Unnamed Assistant",
        description: assistantDefinition.description || "No description provided",
        instructions: assistantDefinition.instructions || assistantDefinition.description,
    }
};

export const listAssistants = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/list",
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    
    return result.success ? result.data : [];
}

export const deleteAssistant = async (assistantId: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/delete",
        data: { assistantId },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    return result.success;
}

// Simple function to send a direct message to an assistant (for standalone mode)
import { getSession } from "next-auth/react";
import { MetaHandler, sendChatRequestWithDocuments } from "./chatService";
import { emptyAstPathData } from "@/components/Promptbar/components/AssistantModalComponents/AssistantPathEditor";
import { DEFAULT_SYSTEM_PROMPT } from "@/utils/app/const";
import { deepMerge } from "@/utils/app/state";

export const sendDirectAssistantMessage = async (
  chatEndpoint: string,
  assistantId: string,
  assistantName: string,
  message: string,
  model: any, 
  previousMessages: Array<{role: string, content: string}> = [],
  options: any,
  messageState: any,
  handleMessageState: (state: any) => void,
  setResponseStatus: (status: string) => void,
  controller: AbortController
) => {
  try {
    const session = await getSession();
    
    // @ts-ignore
    if (!session || !session.accessToken || !chatEndpoint) {
      throw new Error("No session or chat endpoint available");
    }
    
    // Create user message with assistant data embedded
    const userMessage = {
      role: 'user',
      content: message,
      // This is the critical part - message data needs to include assistant info
      data: {
        assistant: {
          definition: {
            assistantId: assistantId,
            name: assistantName
          }
        }
      }
    };
    
    // Convert previous messages to proper format with assistant data
    const formattedPreviousMessages = previousMessages.map(msg => {
      if (msg.role === 'user') {
        return {
          ...msg,
          data: {
            assistant: {
              definition: {
                assistantId: assistantId,
                name: assistantName
              }
            }
          }
        };
      }
      return msg;
    });
    
    // Add the current message to the history
    const allMessages = [...formattedPreviousMessages, userMessage];
    
    const chatBody = {
      model: model,
      prompt: DEFAULT_SYSTEM_PROMPT,
      messages: allMessages,
      temperature: 0.7,
      maxTokens: model?.outputTokenLimit ? Math.round(model.outputTokenLimit / 2) : 2000,
      // Pass assistantId directly in the top level and in options
      assistantId: assistantId,
      assistantName: assistantName,
      skipRag: false,
      skipCodeInterpreter: false,
      skipMemory: true, // Skip memory processing
      ...options,
    };

    const metaHandler: MetaHandler = {
      status: (meta: any) => {
        setResponseStatus(meta.message ?? "");
      },
      mode: (modeName: string) => {},
      state: (state: any) => handleMessageState(deepMerge(messageState, state)),
      shouldAbort: () => false
    };
    // console.log("chatBody", chatBody);
    // @ts-ignore
    const response = await sendChatRequestWithDocuments(chatEndpoint, session.accessToken, chatBody, controller.signal, metaHandler);
    
    return {
      success: response.ok,
      response
    };
  } catch (error) {
    console.error("Error sending message to assistant:", error);
    return {
      success: false,
      error
    };
  }
}

/**
 * Adds a path to an assistant
 * @param assistantId The ID of the assistant
 * @param astPath The path to add to the assistant
 * @param groupId The ID of the group, if adding to a group
 * @param isPublic Whether the path is public
 * @param accessTo The access control settings for the path
 * @returns Success status and the updated assistant info
 */
export const addAssistantPath = async (assistantId: string, astPath: string, groupId?: string, isPublic?: boolean, accessTo?: any) => {
    // Convert path to lowercase for consistency
    let op = null;
    const lowerCasePath = astPath.toLowerCase();
    const data = { 
      assistantId: assistantId, 
      astPath: lowerCasePath,
      isPublic: isPublic ?? emptyAstPathData.isPublic,
      accessTo: accessTo ?? emptyAstPathData.accessTo
    };
    if (groupId) {
        console.log("Adding path to group assistant: ", groupId);
        op = {
          method: 'POST',
          path: "/groups",
          op: URL_PATH + "/add_path",
          data: { 
            group_id: groupId,
            path_data: data
          },
          service: "groups"
        };
    } else {
      op = {
        method: 'POST',
        path: URL_PATH,
        op: "/add_path",
          data: data,
        service: SERVICE_NAME
      }; 
    }
    return await doRequestOp(op);
    
};

/**
 * Looks up an assistant by path
 * @param astPath The path to look up
 * @returns Success status and the assistant info if found
 */
export const lookupAssistant = async (astPath: string) => {
  try {
    // Convert path to lowercase for consistency
    const lowerCasePath = astPath.toLowerCase();
    
    const op = {
      method: 'POST',
      path: URL_PATH,
      op: "/lookup",
      data: { astPath: lowerCasePath },
      service: SERVICE_NAME
    };
    
    const result = await doRequestOp(op);
    
    // Handle nested response formats - API Gateway might be wrapping the response
    let actualResult = result;
    
    // Check if there's a statusCode and body - API Gateway format
    if (result.statusCode && result.body) {
      try {
        // Body might be a string that needs parsing
        const parsedBody = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
        actualResult = parsedBody;
      } catch (parseError) {
        console.error('Error parsing response body:', parseError);
      }
    }
    
    // Now check success on the actual result
    if (actualResult.success) {
      // Get the correct path - try top level first, then data, then pathFromDefinition
      const path = actualResult.data?.astPath || 
                   actualResult.data?.data?.astPath ||
                   actualResult.data?.pathFromDefinition;
      
      // Return all the data we have, including name and definition if available
      return {
        success: true,
        message: actualResult.message || 'Assistant found',
        assistantId: actualResult.data?.assistantId,
        astPath: path, // Use the derived path
        pathFromDefinition: actualResult.data?.pathFromDefinition,
        public: actualResult.data?.public || false,
        // Include these important fields if they exist
        name: actualResult.data?.name,
        definition: actualResult.data?.definition,
        // Pass along the entire data object for completeness
        data: actualResult.data
      };
    } else {
      return {
        success: false,
        message: actualResult.message || 'Assistant not found at this path'
      };
    }
  } catch (error) {
    console.error(`Error looking up assistant path:`, error);
    return { 
      success: false, 
      message: `Error looking up path: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
};

/**
 * Rescan websites associated with an assistant
 * @param assistantId The ID of the assistant to update website content for
 * @param forceRescan If true, will force a rescan of all websites regardless of scan frequency
 * @returns Success status and any relevant data from the rescan operation
 */
export const rescanWebsites = async (assistantId: string, forceRescan: boolean = false) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/rescan_websites",
        data: { 
            assistantId,
            forceRescan
        },
        service: SERVICE_NAME
    };
    
    const result = await doRequestOp(op);
    return result;
};


export const getSiteMapUrls = async (sitemap: string, maxPages?: number) => {
  const data: { sitemap: string, maxPages?: number } = { sitemap }
  if (maxPages) {
    data.maxPages = maxPages;
  }
  console.log("data", data);
  const op = {
      method: 'POST',
      path: URL_PATH,
      op: "/extract_sitemap_urls",
      data: data,
      service: SERVICE_NAME
  };
  
  const result = await doRequestOp(op);
  return result;
};