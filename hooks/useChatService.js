// src/hooks/useChatService.js

import { useContext } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { sendChatRequest as send } from '../services/chatService';

export function useChatService() {
    const { state: { apiKey },
        preProcessingCallbacks,
        postProcessingCallbacks, } = useContext(HomeContext);

    const sendChatRequest = (chatBody, plugin, abortSignal) => {

        preProcessingCallbacks.forEach(callback => callback({plugin: plugin, chatBody: chatBody}));
        let response = send(apiKey, chatBody, plugin, abortSignal);
        // It would be ideal to do this here, but then the streaming response
        // can't be done for reading into the chat... This is dispatched in the
        // Chat.
        //postProcessingCallbacks.forEach(callback => callback({plugin: plugin, chatBody: chatBody, response: response}));
        return response;
    };

    return { sendChatRequest };
}