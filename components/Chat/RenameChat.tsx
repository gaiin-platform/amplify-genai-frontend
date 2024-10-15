import {  Message } from "@/types/chat";
import { ModelID, Models } from "@/types/model";
import {getSession} from "next-auth/react"
import { sendChatRequestWithDocuments } from "@/services/chatService";
import cloneDeep from 'lodash/cloneDeep';



export const callRenameChat = async (chatEndpoint:string, messages: Message[], statsService: any) => {
    const controller = new AbortController();
    
     const accessToken = await getSession().then((session) => { 
                                // @ts-ignore
                                return session.accessToken
                            })

    try {
        const updatedMessages = cloneDeep(messages);
        // remove ds 
        updatedMessages.forEach(m => {
            if (m.data) {
                if (m.data.dataSources) m.data.dataSources = null;
                if (m.data.state && m.data.state.sources) m.data.state.sources = null;
            }
        })
        
        updatedMessages[0].content = `Look at the following prompt: "${updatedMessages[0].content}" \n\nYour task: As an AI proficient in summarization, create a short concise title for the given prompt. Ensure the title is under 30 characters.`
        const chatBody = {
            model: Models[ModelID.CLAUDE_3_HAIKU],
            messages: updatedMessages,
            key: accessToken,
            prompt: "Respond with only the title name and nothing else.",
            temperature: 0.5,
            maxTokens: 10,
            skipRag: true,
            skipCodeInterpreter: true
        };

        statsService.sendChatEvent(chatBody);

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
        
                if (done) {
                    break;
                }
        
                text += chunkValue;
            }
            // console.log(text)
            return text;
        } finally {
            if (reader) {
                await reader.cancel(); 
                reader.releaseLock();
            }
        }

    } catch (e) {
        console.error("Error prompting for rename: ", e);
        const content = messages[0].content;
        return content.length > 30 ? content.substring(0, 30) + '...' : content;
        
    }
}
