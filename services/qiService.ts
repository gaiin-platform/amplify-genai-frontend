import { Conversation } from "@/types/chat";
import { OpenAIModelID, OpenAIModels } from "@/types/openai";
import { QiSummary, QiSummaryType } from "@/types/qi";
import {getSession} from "next-auth/react"
import {v4 as uuidv4} from 'uuid';
import { sendChatRequestWithDocuments } from "./chatService";
import { Message } from "ai";

const qiConversationPrompt= 
    `Analyze the provided chat conversation and generate a detailed report based on the following criteria:

    Summary: Provide a concise overview of the entire conversation, capturing all critical points discussed. Focus on the main topics, key decisions made, and the overall flow of the dialogue.
    
    Description: Condense the summary into one to two sentences, specifically highlighting any issues identified during the conversation. Focus on the main problem or challenge discussed in the chat.
    
    Feedback and Improvements:
    Evaluate the alignment of the LLM's responses with the user's underlying intentions to gauge how effectively the system is recognizing and addressing user needs. Track and analyze the frequency and clarity of unanswered or partially answered questions as a key metric of conversational completeness. Identify specific instances in the dialogue where soliciting user feedback could have provided additional insights or improved user satisfaction. Propose measurable enhancements to the response strategies, such as increasing accuracy, reducing response time, or enriching the content provided. These suggestions should aim to directly enhance the quality and relevance of future interactions.
    
    It is very important that you format your response correctly. Format your response as follows:
    /SUMMARY_START [Your summary here] /SUMMARY_END
    /DESCRIPTION_START [Your concise issue-focused description here] /DESCRIPTION_END
    /FEEDBACK_START [Your detailed feedback and improvements, formatted in bullet points with newlines] /FEEDBACK_END`


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
    const descriptionRegex = /\/DESCRIPTION_START\s+([\s\S]*?)\s*\/DESCRIPTION_END/;
    const feedbackRegex = /\/FEEDBACK_START\s+([\s\S]*?)\s*\/FEEDBACK_END/;

    const summaryMatch = text.match(summaryRegex);
    const descriptionMatch = text.match(descriptionRegex);
    const feedbackMatch = text.match(feedbackRegex);

    const summary = createEmptyQiSummary(type);
    if (summaryMatch) summary.summary = summaryMatch[1].trim();
    if (descriptionMatch) summary.description = descriptionMatch[1].trim();
    if (feedbackMatch) summary.feedbackImprovements = feedbackMatch[1].trim();
    return summary;
}

//in case our call for the llm to create this for us fails 
export const createEmptyQiSummary = (type: QiSummaryType) =>{
    return  { type: type,
              summary : '',
              description: '',
              feedbackImprovements: ''
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
        body: JSON.stringify({'data': data, 'type': type}),
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