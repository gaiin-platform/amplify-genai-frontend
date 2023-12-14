import {Assistant, AssistantDefinition} from "@/types/assistant";
import {OpenAIModel, OpenAIModelID, OpenAIModels} from "@/types/openai";
import {ChatBody, Message, newMessage} from "@/types/chat";
import {sendChatRequest} from "@/services/chatService";
import {Stopper} from "@/utils/app/tools";
import {v4 as uuidv4} from 'uuid';

const failureResponse = (messages: Message[], reason: string) => {
    return {
        success: false,
        messages: [
            messages,
            newMessage({
                role: "assistant",
                data: {isError: true},
                content: reason,
            })
        ]
    }
}

const doAssistantOp = async (stopper:Stopper, opName:string, data:any, errorHandler=(e:any)=>{}) => {
    const op = {
        data: data,
        op: opName
    };

    console.log("Assistant Op:", op);

    const response = await fetch('/api/assistant/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: stopper.signal,
        body: JSON.stringify(op),
    });

    console.log("Assistant Op response:", response);

    if (response.ok){
        try {
            const result = await response.json();
            console.log("Assistant Op result:", result);

            return result;
        } catch (e){
            return {success:false, message:"Error parsing response."};
        }
    }
    else {
        return {success:false, message:`Error calling assistant: ${response.statusText} .`}
    }
}

const addData = (data:{[key:string]:any}) => {
    return (m:Message) => {
        return {...m, data: {...m.data, ...data}}
    };
}

const addDataToMessages = (messages:Message[], data:{[key:string]:any}) => {
    return messages.map((m) => {
        return {...m, data: {...m.data, ...data}}
    });
}

export const sendChat = async (apikey:string, stopper:Stopper, assistant:Assistant, instructions:string, messages:Message[], messageCallback?: (msg: string) => void, model?: OpenAIModel) => {

    const {success, message, data} = await doAssistantOp(
        stopper,
        '/chat',
        {id: assistant.id,
            fileKeys:[],
            messages: messages});

    console.log("Chat response:", success, message, data);

    if(!success){
        return failureResponse([], message);
    }

    const newMessages:Message[] = data.map(addData({assistantId: assistant.id}));
    console.log("New messages: ", newMessages);

    return {success:true, messages:data};
}


export const createAssistant = async (user:string, assistantDefinition:AssistantDefinition, abortSignal= null)=> {

    // if((!assistantDefinition.fileKeys || assistantDefinition.fileKeys.length === 0) &&
    //     (!assistantDefinition.tools || assistantDefinition.tools.length === 0)){
    //     return {
    //         assistantId: uuidv4(),
    //         provider: 'amplify'
    //     }
    // }

    const response = await fetch('/api/assistant/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({op:"/create", data:assistantDefinition }),
        signal: abortSignal,
    });

    const result = await response.json();
    const id = result.data.assistantId;
    return {assistantId:id, provider:'openai'};
};
