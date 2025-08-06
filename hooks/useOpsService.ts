import {useContext, useEffect, useRef, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {Op, OpDef} from "@/types/op";
import JSON5 from "json5";
import { Conversation } from "@/types/chat";
import { emptySchema } from "@/utils/app/tools";


export function useOpsService() {

    const {
        state: {conversations, selectedConversation, ops},
        dispatch:homeDispatch,
    } = useContext(HomeContext);

    const conversationsRef = useRef(conversations);


    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);


    function reformatOps(opsArray: OpDef[]): string {
        let result: string = '';

        opsArray.forEach(op => {
            result += op.name;
            result += ' -- ' + op.description + '\n';
        });

        return result.trim();
    }

    const parseArgValue = (arg:string) => {
        return arg.split(",").map((a:string) => JSON5.parse(a));
    }

    const formatSimpleConversationsMessage = (conversations:any) => {
        return conversations.map((c: any) => `Id: ${c.id}, Name: ${c.name}`).join('\n');
    }

    const removeOpBlocks = (message:string) => {
        return message.replace(/```op[^```]*```/g, '');
    }

    const formatSimpleMessagesMessage = (messages:any) => {
        return messages.map((m: any) => `# ${m.role}: ${removeOpBlocks(m.content)}`).join('\n');
    }

    const stripQuotes = (s:string) => {
        if(s.startsWith('"') && s.endsWith('"')){
            return s.substring(1, s.length-1);
        }
        else if (s.startsWith("'") && s.endsWith("'")){
            return s.substring(1, s.length-1);
        }
        return s;
    }



    const localOps:{[key:string]:Op} = {
        // @ts-ignore
        listOps: {
            id: 'listOps',
            name: 'List Ops',
            description: 'List all of the available ops',
            type: 'chat',
            parameters: emptySchema,
            paramChecker: (params: any) => {
                return true;
            },
            execute: async (context: any, params: any) => {
                const message = 'List of ops:\n' +
                    reformatOps(Object.values(ops));

                return {message};
            },
            data: {
                shouldConfirm: false
            }
        },
        // @ts-ignore
        listConversations:
            {
                id: 'listConversations',
                name: 'List Conversations',
                description: 'List all of the conversations',
                type: 'chat',
                parameters: emptySchema,
                paramChecker: (params: any) => {
                    return true;
                },
                execute: async (context: any, params: any) => {

                    const thisId = selectedConversation?.id || "";

                    const message = 'List of conversations:\n' +
                        formatSimpleConversationsMessage(
                            conversationsRef.current.filter((c:Conversation) => c.id !== thisId));

                    return {message};
                }
            },
        // @ts-ignore
        searchConversations:
            {
                id: 'searchConversations',
                name: 'Search Conversations',
                description: 'Search all of the conversations for a set of key words',
                type: 'chat',
                parameters: emptySchema,//'keywords': 'a comma separated list of keywords to search for'},
                paramChecker: (params: any) => {
                    return true;
                },
                execute: async (context: any, params: any) => {

                    const thisId = selectedConversation?.id || "";

                    console.log('Searching for keywords', params);

                    params = params.map((p:string) => stripQuotes(p));

                    const results = conversationsRef.current
                        .filter((c:Conversation) => c.id !== thisId)
                        .filter((c:Conversation) => {
                       const matches =  c.messages.filter((m) => {
                           return params.some((k: string) => m.content.includes(k));
                       });
                       return matches.length > 0;
                    });

                    const message = 'List of matching conversations:\n' +
                        formatSimpleConversationsMessage(results);

                    return {message};
                }
            },
        // @ts-ignore
        getConversation:
            {
                id: 'getConversation',
                name: 'Get Conversation',
                description: 'Get the contents of a conversation',
                type: 'chat',
                parameters: emptySchema,//{'id': 'ID of the conversation'},
                paramChecker: (params: any) => {
                    return true;
                },
                execute: async (context: any, params: any) => {

                    params = params.map((p:string) => stripQuotes(p));

                    console.log('Opening conversation id', params[0]);

                    const results = conversationsRef.current.filter((c:Conversation) => {
                        return c.id === params[0];
                    })[0];

                    const message = 'Conversation contents:\n-----------------\n' +
                        formatSimpleMessagesMessage(results.messages) +"\n-----------------";

                    return {message};
                }
            }
    };

    const addOp = (op:Op) => {
        ops[op.id] = op;
    }

    const removeOp = (opId:string) => {
        const updatedOps = delete ops[opId];
        homeDispatch({field: 'ops', value: updatedOps});
    }

    const getOp = (opId:string) => {
        return ops[opId];
    }

    const executeOp = async (opId:string, params:any) => {
        const opContext = {

        };

        const op = ops[opId];

        if(!op){
            alert("The plan had an error. I am going to let the Assistant know.");
            return {message: 'Op not found'};
        }

        console.log('Executing op', opId, 'with params', params);

        return op.execute(opContext, params);
    }

    for(const opId in localOps){
        addOp(localOps[opId]);
    }

    return {addOp, removeOp, getOp, executeOp};
}