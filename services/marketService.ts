import {Assistant, AssistantDefinition} from "@/types/assistant";
import {OpenAIModel, OpenAIModelID, OpenAIModels} from "@/types/openai";
import {ChatBody, Message, newMessage} from "@/types/chat";
import {sendChatRequest} from "@/services/chatService";
import {Stopper} from "@/utils/app/tools";
import {v4 as uuidv4} from 'uuid';

const failureResponse = (reason: string) => {
    return {
        success: false,
        message: reason,
        data: {}
    }
}

const doMarketOp = async (opName:string, data:any, errorHandler=(e:any)=>{}) => {
    const op = {
        data: data,
        op: opName
    };

    console.log("Market Op:", op);

    const response = await fetch('/api/market/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: null,
        body: JSON.stringify(op),
    });

    console.log("Market Op response:", response);

    if (response.ok){
        try {
            const result = await response.json();
            console.log("Market Op result:", result);

            return result;
        } catch (e){
            return {success:false, message:"Error parsing response."};
        }
    }
    else {
        return {success:false, message:`Error calling assistant: ${response.statusText} .`}
    }
}

export const getCategory = async (category:string ) => {

    const {success, message, data} = await doMarketOp(
        '/category/get',
        {category:category});

    console.log("Category response:", success, message, data);

    if(!success){
        return failureResponse(message);
    }

    return {success:true, message:"Category fetched successfully.", data:data};
}

