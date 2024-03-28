import {
    IconFileCheck,
} from '@tabler/icons-react';
import React, {useContext, useEffect} from "react";
import JSON5 from "json5";
import HomeContext from "@/pages/api/home/home.context";

interface Props {
    action: any;
    ready: boolean;
}

const AutonomousBlock: React.FC<Props> = (
    {action, ready}) => {


    const {
        state: {
            selectedConversation,
            selectedAssistant,
            conversations,
            folders,
            models,
            prompts,
            defaultModelId,
            featureFlags,
            workspaceMetadata,
            handleSend
        },
        handleUpdateConversation,
        handleCustomLinkClick,
        dispatch: homeDispatch,
        handleAddMessages: handleAddMessages
    } = useContext(HomeContext);

    function parseApiCall(str:string) {
        const functionName = str.split("(")[0];
        const paramsStr = str.substring(str.indexOf('(') + 1, str.lastIndexOf(')'));
        const params = JSON5.parse("["+paramsStr+"]");
        return { functionName, params };
    }

    const handlers:{[key:string]:(params:any)=>any} = {
        "/chats": (params:any) => {
            return conversations;
        },
        "/folders": (params:any) => {
            return folders;
        },
        "/models": (params:any) => {
            return models;
        },
        "/prompts": (params:any) => {
            return prompts;
        },
        "/defaultModelId": (params:any) => {
            return defaultModelId;
        },
        "/featureFlags": (params:any) => {
            return featureFlags;
        },
        "/workspaceMetadata": (params:any) => {
            return workspaceMetadata;
        },
        "/selectedConversation": (params:any) => {
            return selectedConversation;
        },
        "/selectedAssistant": (params:any) => {
            return selectedAssistant;
        },
    }

    const runAction = (action: any) => {
        try{
            const apiCall = parseApiCall(action);
            console.log("apiCall:", apiCall);

            const { functionName, params } = apiCall;
            const url = params[0];
            const handler = handlers[url];
            const result = handler(params);
            if(handleSend){
                handleSend({"role":"user","content":JSON.stringify(result)});
            }
            // const handler = handlers[functionName];
            // if (handler) {
            //     handler(params).then((result: any) => {
            //         console.log("result:", result);
            //     });
            // }
            // else {
            //     console.error("No handler found for function:", functionName);
            // }
        }
        catch (e) {
            console.error(e);
            return null;
        }
    }

    useEffect(() => {
        if (ready) {
            runAction(action);
        }
    }, [ready, action]);

    return <div>
        <div
            className="rounded-xl text-neutral-600 border-2 dark:border-none dark:text-white bg-neutral-100 dark:bg-[#343541] rounded-md shadow-lg mb-2 mr-2"
        >
            <div className="text-xl text-right p-4 -mb-10">
                <div className="text-gray-400 dark:text-gray-600">Working...</div>
            </div>
        </div>
    </div>;
};

export default AutonomousBlock;
