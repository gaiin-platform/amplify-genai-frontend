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
import { Account } from "@/types/accounts";
import { scrubMessages } from "./messages";



export const promptForData = async (chatEndpoint:string, messages: Message[], model: Model, 
                                    prompt: string, account?: Account, statsService: any = null, maxTokens: number = 4000) => {
    const controller = new AbortController();
    
     const accessToken = await getSession().then((session) => { 
                                // @ts-ignore
                                return session?.accessToken
                            })

    try {
        const chatBody = {
            model: model,
            messages: scrubMessages(messages),
            key: accessToken,
            prompt: prompt,
            temperature: 0.5,
            maxTokens: maxTokens,
            skipRag: true,
            skipCodeInterpreter: true,
            accountId: account?.id,
            rateLimit: account?.rateLimit
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
