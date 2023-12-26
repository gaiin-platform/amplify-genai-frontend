// src/hooks/useChatService.js
import { incrementalJSONtoCSV } from "@/utils/app/incrementalCsvParser";
import { useContext } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import {sendChatRequest as send, sendChatRequestWithDocuments} from '../services/chatService';
import {ChatBody, CustomFunction, JsonSchema, newMessage} from "@/types/chat";
import {ColumnsSpec, generateCSVSchema} from "@/utils/app/csv";
import { Plugin } from '@/types/plugin';
import { wrapResponse, stringChunkCallback } from "@/utils/app/responseWrapper";

import {getSession} from "next-auth/react"

export function useChatService() {
    const { state: { apiKey , statsService, chatEndpoint, defaultAccount},
        preProcessingCallbacks,
        postProcessingCallbacks, } = useContext(HomeContext);


    const sendCSVChatRequest = async (chatBody:ChatBody, columns:ColumnsSpec, plugin?:Plugin|null, abortSignal?:AbortSignal) => {
        const schema = generateCSVSchema(columns);
        const resp = await sendJsonChatRequestWithSchema(chatBody, schema, plugin, abortSignal);

        const keys = Object.keys(columns).join(',');

        const parser = incrementalJSONtoCSV();
        let first = true;

        const callback = stringChunkCallback((chunk) => {
            const result = (first ? "```csv\n"+keys+"\n" : "") + parser(chunk);
            first = false;
            return result;
        });

        return wrapResponse(resp, callback);
    }

    const sendJsonChatRequest = async (chatBody:ChatBody, plugin?:Plugin|null, abortSignal?:AbortSignal) => {
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
        //let response = send(apiKey, chatBody, plugin, abortSignal);

        let response = null;

        if(!chatBody.dataSources){
            chatBody.dataSources = [];
        }
        // if(chatBody.dataSources && chatBody.dataSources.length > 0) {

            if(!chatEndpoint) {
                throw new Error("Chat endpoint not set. Please tell the system administrator to set the CHAT_ENDPOINT environment variable.");
            }

            if(defaultAccount && defaultAccount.id){
                chatBody.accountId = defaultAccount.id;
            }

            console.log("Sending chat request with documents")

            response = getSession().then((session) => {
                // @ts-ignore
                return sendChatRequestWithDocuments(chatEndpoint, session.accessToken, chatBody, plugin, abortSignal);
            });
        // }
        // else {
        //     response = send(apiKey, chatBody, plugin, abortSignal);
        // }

        // It would be ideal to do this here, but then the streaming response
        // can't be done for reading into the chat... This is dispatched in the
        // Chat.
        //postProcessingCallbacks.forEach(callback => callback({plugin: plugin, chatBody: chatBody, response: response}));
        return response;
    };

    return { sendChatRequest, sendFunctionChatRequest, sendCSVChatRequest, sendJsonChatRequest, sendJsonChatRequestWithSchemaLoose, sendJsonChatRequestWithSchema };
}