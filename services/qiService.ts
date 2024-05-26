import { Conversation } from "@/types/chat";
import { OpenAIModelID, OpenAIModels } from "@/types/openai";
import { QiSummary, QiSummaryType } from "@/types/qi";
import {getSession} from "next-auth/react"
import {v4 as uuidv4} from 'uuid';
import { sendChatRequestWithDocuments } from "./chatService";
import { Message } from "ai";

const qiConversationPrompt = 
    `Generate a focused summary based on user and system exchanges, emphasizing the user's task: 

    Summary: 
    Summarize only the actionable and pertinent points discussed, avoiding transcription of extensive dialogue or content. Condense the summary into two to five sentences. 

    Purpose: 
    Please review the conversation in its entirety prior to this messaage and identify the key objectives and use cases. Highlight the primary reasons for this interaction and outline the problems the user aims to resolve. Please focus on the users questions to establish overall intent. 
    
    
    To ensure anonymity, replace anything you think is a persons name to NAME_REDACTED

    It is very important that you format your response correctly. Format your response as follows:
    /SUMMARY_START [Summary here] /SUMMARY_END
    /PURPOSE_START [Purpose and use case here] /PURPOSE_END
    `


export const createQiSummary = async (chatEndpoint:string, data:any, type: QiSummaryType, statsService: any) => {
    const controller = new AbortController();
    
     const accessToken = await getSession().then((session) => { 
                                // @ts-ignore
                                return session.accessToken
                            })

    try {
        const chatBody = {
            model: OpenAIModels[OpenAIModelID.CLAUDE_3_HAIKU],
            messages: [...data.messages, { role: 'user', content: getPrompt(type) } as Message],
            key: accessToken,
            prompt: "Ensure to follow the instructions exactly.",
            temperature: 0.5,
            maxTokens: 500,
            skipRag: true,
        };

        statsService.sendChatEvent(chatBody);

        const response = await sendChatRequestWithDocuments(chatEndpoint, accessToken, chatBody, null, controller.signal);

        const responseData = response.body;
        const reader = responseData ? responseData.getReader() : null;
        const decoder = new TextDecoder();
        let done = false;
        let text = '';
    
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

        return parseToQiSummary(text, type);

    } catch (e) {
        console.error("Error prompting for qi summary: ", e);
        return createEmptyQiSummary(type);
    }
}

const parseToQiSummary = (text: string, type: QiSummaryType) => {
    if (!text) return createEmptyQiSummary(type);
    
    const summaryRegex = /\/SUMMARY_START\s+([\s\S]*?)\s*\/SUMMARY_END/;
    const purposeRegex = /\/PURPOSE_START\s+([\s\S]*?)\s*\/PURPOSE_END/;

    const summaryMatch = text.match(summaryRegex);
    const purposeMatch = text.match(purposeRegex);

    const summary = createEmptyQiSummary(type);
    if (summaryMatch) summary.summary = summaryMatch[1].trim();
    if (purposeMatch) summary.purpose = purposeMatch[1].trim();
    return summary;
}

//in case our call for the llm to create this for us fails 
export const createEmptyQiSummary = (type: QiSummaryType) =>{
    return  { type: type,
              summary : '',
              purpose: '',
              includeUser: false
            } as QiSummary;
}

const getPrompt = (type: QiSummaryType) => {
    switch (type) {
        case QiSummaryType.CONVERSATION:
          return qiConversationPrompt;
        default:
          return "";
      }
}


export const uploadToQiS3 = async (data:any, type: QiSummaryType, errorHandler=(e:any)=>{}) => {

    const response = await fetch('/api/qi/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: null,
        body: JSON.stringify({'data': data, 'type': type.toLowerCase()}),
    });


    if (response.ok){
        try {
            const result = await response.json();

            return JSON.parse(result.body);
        } catch (e){
            return {success:false, message:"Error parsing response."};
        }
    }
    else {
        return {success:false, message:`Error calling upload qi to s3: ${response.statusText} .`}
    }
}