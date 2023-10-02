// chatService.js
import { getEndpoint } from '@/utils/app/api';
import {OpenAIModelID, OpenAIModels} from "@/types/openai";

export async function sendChatRequest(apiKey, chatBody, plugin = null, abortSignal= null) {

    chatBody = {
        ...chatBody,
        messages: chatBody.messages.map(m => {
            return {role: m.role, content: m.content}
        })
    }

    let body;
    if (!plugin) {
        body = JSON.stringify(chatBody);
    } else {
        body = JSON.stringify({
            ...chatBody,
            googleAPIKey: pluginKeys
                .find((key) => key.pluginId === 'google-search')
                ?.requiredKeys.find((key) => key.key === 'GOOGLE_API_KEY')?.value,
            googleCSEId: pluginKeys
                .find((key) => key.pluginId === 'google-search')
                ?.requiredKeys.find((key) => key.key === 'GOOGLE_CSE_ID')?.value,
        });
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