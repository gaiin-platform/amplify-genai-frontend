// src/hooks/useChatService.js

import { useContext } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import {sendChatRequest as send} from '../services/chatService';
import useStatsService from "@/services/eventService";
import {ChatBody, CustomFunction, JsonSchema, newMessage} from "@/types/chat";
import {ColumnsSpec, generateCSVSchema} from "@/utils/app/csv";
import { Plugin } from '@/types/plugin';
import { wrapResponse, stringChunkCallback } from "@/utils/app/responseWrapper";

export function useChatService() {
    const { state: { apiKey },
        preProcessingCallbacks,
        postProcessingCallbacks, } = useContext(HomeContext);

    const statsService = useStatsService();

    const sendCSVChatRequest = async (chatBody:ChatBody, columns:ColumnsSpec, plugin?:Plugin|null, abortSignal?:AbortSignal) => {
        const schema = generateCSVSchema(columns);
        const resp = await sendJsonChatRequestWithSchema(chatBody, schema, plugin, abortSignal);

        const tryParse = (chunk:string) => {
            try {
                return JSON.parse(chunk);
            } catch(e) {
                return null;
            }
        }

        const callback = stringChunkCallback((chunk) => {
            //console.log("Chunk received", chunk);

            return chunk;
        });

        return wrapResponse(resp, callback);
    }

    const sendJsonChatRequest = async (chatBody:ChatBody, jsonSchema:JsonSchema, plugin?:Plugin|null, abortSignal?:AbortSignal) => {
        const message = `
        Please generate JSON for the output.
        `
        const updatedChatBody = {
            ...chatBody,
            response_format: {type: 'json_object'},
            messages: [...chatBody.messages, newMessage({role: 'user', content: message})]
        };

        return await sendChatRequest(updatedChatBody, null, abortSignal);
    }

    const sendJsonChatRequestWithSchemaLoose = async (chatBody:ChatBody, jsonSchema:JsonSchema, plugin?:Plugin|null, abortSignal?:AbortSignal) => {
            const message = `
        Please generate JSON for the output using the following schema:
        ${JSON.stringify(jsonSchema, null, 2)}

        My response with this schema is (do your best to fit your output into it):
        `
            const updatedChatBody = {
                ...chatBody,
                response_format: {type: 'json_object'},
                messages: [...chatBody.messages, newMessage({role: 'user', content: message})]
            };

            return await sendChatRequest(updatedChatBody, null, abortSignal);
    }


    const sendJsonChatRequestWithSchema = async (chatBody:ChatBody, jsonSchema:JsonSchema, plugin?:Plugin|null, abortSignal?:AbortSignal) => {
        const functions = [
            {
                name: 'answer',
                description: 'Answer the question',
                parameters: jsonSchema,
            }
            ];

        return sendFunctionChatRequest(chatBody, functions, 'answer', plugin, abortSignal);
    }

    const sendFunctionChatRequest = async (chatBody:ChatBody, functions:CustomFunction[], functionToInvoke?:string, plugin?:Plugin|null, abortSignal?:AbortSignal) => {
        const updatedChatBody = {
            ...chatBody,
            functions: functions,
        };

        if(functionToInvoke) {
            updatedChatBody.function_call = functionToInvoke;
        }

        return await sendChatRequest(updatedChatBody, null, abortSignal);
    }

    const sendChatRequest = (chatBody:ChatBody, plugin?:Plugin|null, abortSignal?:AbortSignal) => {

        statsService.sendChatEvent(chatBody);

        preProcessingCallbacks.forEach(callback => callback({plugin: plugin, chatBody: chatBody}));
        let response = send(apiKey, chatBody, plugin, abortSignal);
        // It would be ideal to do this here, but then the streaming response
        // can't be done for reading into the chat... This is dispatched in the
        // Chat.
        //postProcessingCallbacks.forEach(callback => callback({plugin: plugin, chatBody: chatBody, response: response}));
        return response;
    };

    return { sendChatRequest, sendCSVChatRequest, sendJsonChatRequest };
}