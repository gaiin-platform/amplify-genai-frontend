import {Assistant, AssistantDefinition} from "@/types/assistant";
import {OpenAIModel, OpenAIModelID, OpenAIModels} from "@/types/openai";
import {ChatBody, Message, newMessage} from "@/types/chat";
import {sendChatRequest} from "@/services/chatService";
import {Stopper} from "@/utils/app/tools";
import {v4 as uuidv4} from 'uuid';
import {ExportFormatV4} from "@/types/export";

const failureResponse = (reason: string) => {
    return {
        success: false,
        message: reason,
        data: {}
    }
}


const doDownloadOp = async (opName:string, data:any, errorHandler=(e:any)=>{}) => {
    const op = {
        data: data,
        op: opName
    };

    const response = await fetch('/api/download/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: null,
        body: JSON.stringify(op),
    });


    if (response.ok){
        try {
            const result = await response.json();

            return result;
        } catch (e){
            return {success:false, message:"Error parsing response."};
        }
    }
    else {
        return {success:false, message:`Error calling assistant: ${response.statusText} .`}
    }
}

const serviceHook = (opName: string) => {

    return async (requestData: any) => {
        console.log(`${opName} request:`, requestData);

        const {success, message, data} = await doDownloadOp(
            opName,
            requestData);

        console.log(`${opName} response:`, success, message, data);

        if (!success) {
            return failureResponse(message);
        }

        return {success: true, message: `${opName} success.`, data: data};
    }
}

export interface ConversionOptions {
    format: string;
    userMessageHeader: string;
    assistantMessageHeader: string;
    messageHeader: string;
    conversationHeader: string;
}

export const convert = async (options:ConversionOptions, content:ExportFormatV4) => {
    try {
        const service = serviceHook('/convert');
        return await service({...options, content:content});
    } catch (e){
        return failureResponse("Error fetching item.");
    }
}
