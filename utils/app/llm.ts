/* Prompt for data

This handles the complexities of making a request to chat-js and collecting the stream response,
given that you will only get the entire completed response and not the streamed chunks. 

if you need the stream then you can replicate similar logic and refer to various other places used to:
examples found: components/chat/autoArtifactsBlock,
                components/chat/PromptHighlightedText

We could certaintly call the chat endpoint in amplify lambda however, this is faster. 
*/

import {  Message } from "@/types/chat";
import { Model } from "@/types/model";
import {getSession } from "next-auth/react"
import { sendChatRequestWithDocuments } from "@/services/chatService";
import { getClientJWT } from '@/utils/client/getClientJWT';
import cloneDeep from 'lodash/cloneDeep';



export const promptForData = async (chatEndpoint:string, messages: Message[], model: Model, 
                                     prompt: string, statsService: any = null, maxTokens: number = 4000) => {
    const controller = new AbortController();
    
     let accessToken = await getClientJWT();
     if (!accessToken) {
         // Fallback: try to get token directly from session
         const session = await getSession();
         if (session && (session as any).accessToken) {
             accessToken = (session as any).accessToken;
         }
     }
     
     if (!accessToken) {
         throw new Error("No valid access token available");
     }

    try {
        const updatedMessages = cloneDeep(messages);
        // remove ds 
        updatedMessages.forEach(m => {
            if (m.data) {
                if (m.data.dataSources) m.data.dataSources = null;
                if (m.data.state && m.data.state.sources) m.data.state.sources = null;
            }
        })
        
        const chatBody = {
            model: model,
            messages: updatedMessages,
            key: accessToken,
            prompt: prompt,
            temperature: 0.5,
            maxTokens: maxTokens,
            skipRag: true,
            skipCodeInterpreter: true
        };

        if (statsService) statsService.sendChatEvent(chatBody);

        const response = await sendChatRequestWithDocuments(chatEndpoint, accessToken, chatBody, controller.signal);

        const responseData = response.body;
        const reader = responseData ? responseData.getReader() : null;
        const decoder = new TextDecoder();
        let done = false;
        let text = '';
        try {
            while (!done) {
        
                // @ts-ignore
                const {value, done: doneReading} = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value);
        
                if (done) break;
        
                text += chunkValue;
            }
            // console.log("final llm response: ", text);
            return text;
        } finally {
            if (reader) {
                await reader.cancel(); 
                reader.releaseLock();
            }
        }

    } catch (e) {
        console.error("Error prompting for data: ", e);
        return null;
        
    }
}
