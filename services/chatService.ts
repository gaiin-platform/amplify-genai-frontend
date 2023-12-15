// chatService.js
import { getEndpoint } from '@/utils/app/api';
import {ChatBody, JsonSchema, newMessage} from "@/types/chat";
import { Plugin } from '@/types/plugin';



export async function sendChatRequest(apiKey:string, chatBody:ChatBody, plugin?:Plugin|null, abortSignal?:AbortSignal) {

    if(chatBody.response_format && chatBody.response_format.type === 'json_object') {
        if(!chatBody.messages.some(m => m.content.indexOf('json') > -1)) {
            chatBody.messages.push(newMessage({role: 'user', content: 'Please provide a json object as output.'}))
        }
    }

    chatBody = {
        ...chatBody,
        // @ts-ignore
        messages: [...chatBody.messages.map(m => {
            return {role: m.role, content: m.content}
        })],
    }

    let body;
    if (!plugin) {
        body = JSON.stringify(chatBody);
    } else {
        // body = JSON.stringify({
        //     ...chatBody,
        //     googleAPIKey: pluginKeys
        //         .find((key) => key.pluginId === 'google-search')
        //         ?.requiredKeys.find((key) => key.key === 'GOOGLE_API_KEY')?.value,
        //     googleCSEId: pluginKeys
        //         .find((key) => key.pluginId === 'google-search')
        //         ?.requiredKeys.find((key) => key.key === 'GOOGLE_CSE_ID')?.value,
        // });
    }
    const endpoint = getEndpoint(plugin);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
        body,
    });

    return response;
}