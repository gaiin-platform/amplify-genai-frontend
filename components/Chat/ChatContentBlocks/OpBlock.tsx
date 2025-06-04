
import {useContext, useEffect, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {IconRobot} from "@tabler/icons-react";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { useOpsService} from "@/hooks/useOpsService";
import { useSession } from "next-auth/react";
import {Conversation, Message, newMessage} from "@/types/chat";
import {useSendService} from "@/hooks/useChatSendService";
import {resolveServerHandler} from "@/utils/app/ops";
import JsonForm from "@/components/JsonForm/JsonForm";
import React from "react";
import { DefaultModels } from "@/types/model";



interface OpProps {
    definition: string;
    message: Message;
}


function parseStringWithPrefixes(inputString: string): Record<string, string | string[]> {
    const result: Record<string, string | string[]> = {};

    const lines = inputString.split('\n');
    let currentPrefix: string | null = null;
    let currentValue: string = '';

    for (const line of lines) {
        const prefixMatch = line.match(/^(\w+):\s*(.*)/);
        if (prefixMatch) {
            if (currentPrefix !== null) {
                if (result[currentPrefix]) {
                    if (Array.isArray(result[currentPrefix])) {
                        // @ts-ignore
                        result[currentPrefix].push(currentValue.trim());
                    } else {
                        // @ts-ignore
                        result[currentPrefix] = [result[currentPrefix], currentValue.trim()];
                    }
                } else {
                    result[currentPrefix] = currentValue.trim();
                }
            }
            currentPrefix = prefixMatch[1];
            currentValue = prefixMatch[2];
        } else {
            currentValue += '\n' + line.trim();
        }
    }

    if (currentPrefix !== null) {
        if (result[currentPrefix]) {
            if (Array.isArray(result[currentPrefix])) {
                (result[currentPrefix] as string[]).push(currentValue.trim());
            } else {
                (result[currentPrefix] as string[]) = [(result[currentPrefix] as string), currentValue.trim()];
            }
        } else {
            result[currentPrefix] = currentValue.trim();
        }
    }

    return result;
}


const OpBlock: React.FC<OpProps> = ({definition, message}) => {
    const [error, setError] = useState<string | null>(null);
    const [isIncomplete, setIsIncomplete] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [op, setOp] = useState<any>({});

    const {state:{messageIsStreaming, selectedConversation, selectedAssistant, chatEndpoint, defaultAccount}, dispatch:homeDispatch, getDefaultModel} = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user;

    const {getOp, executeOp} = useOpsService();
    const {handleSend} = useSendService();

    const getDocumentsInConversation = (conversation?:Conversation) => {
        if(conversation){
            // Go through every message in the conversation and collect all of the
            // data sources that are in the data field of the messages
            return conversation.messages.filter( m => {
                return m.data && m.data.dataSources
            })
                .flatMap(m => m.data.dataSources);
        }

        return [];
    }

    const getAction = (raw:any) => {
        // Check if raw is an array
        if(Array.isArray(raw)){
            return raw[0];
        }
        return raw;
    }

    const parseOp = (definitionStr: string) => {

        try {

            let op = parseStringWithPrefixes(definitionStr);

            const id = op._id;
            const args:any[] = [];

            op.id = id;
            op.args = args;

            const rawDS = getDocumentsInConversation(selectedConversation);
            const knowledge = rawDS.map(ds => {
                if(ds.key || (ds.id && ds.id.indexOf("://") > 0)){
                    return ds;
                }
                else {
                    return {
                        ...ds,
                        id: "s3://"+ds.id
                    }
                }
            });

            op._dataSources = knowledge;

            return op;
        } catch (e) {
            setIsIncomplete(true);
            return {
            };
        }
    }

    const getServerSelectedAssistant = (message:Message) => {

        const aid = (message.data && message.data.state) ?
            message.data.state.currentAssistantId : null;

        console.log(`Server-set assistantId: "${aid}"`)

        return aid;
    }



    const handleDoOp = async () => {

        if(user?.email && op && selectedConversation) {

            setLoadingMessage("Working on it...");
            setIsLoading(true);

            try {

                console.log("Executing operation", op._id);
                console.log("With message", message);

                const id = op.id || "";
                const args = Object.entries(op)
                    .filter(([key, value]) => !hiddenKeys.includes(key))
                    .map(([key, value]) => value);

                const handler = resolveServerHandler(message, id, chatEndpoint, getDefaultModel(DefaultModels.CHEAPEST), defaultAccount);

                let request = null;
                const assistantId =
                    getServerSelectedAssistant(message) ||
                    selectedAssistant?.id;

                if(!handler){
                    request = {
                        options: {assistantId},
                        message: newMessage({
                            role: "user",
                            content: "The _id for the specified operation is invalid. Please make sure the _id matches " +
                                "the ID of one of the allowed ops.",
                            label: "Operation Result Not Shown",
                            data:{actionResult:true}
                        })
                    };
                }
                else {
                    console.log("Handler is", handler);
                    const result = await handler(args);

                    console.log("Result is", result)

                    if(result) {

                        const msgStr = result.message ?
                            result.message : JSON.stringify(result);

                        const message = newMessage({
                            role: "user",
                            content: "The result of the operation was:\n\n" + msgStr,
                            label: "Operation Result Not Shown",
                            data:{actionResult:true}
                        })

                        request = {
                            options: {assistantId},
                            message
                        };
                    }
                    else {
                        const message = newMessage({
                            role: "user",
                            content: "Operation did not produce a result, so it was likely successful.",
                            label: "Operation Result Not Shown",
                            data:{actionResult:true}
                        })

                        request = {
                            options: {assistantId},
                            message
                        };
                    }
                }

                if(request) {
                    const shouldAbort = () => false;
                    if (handleSend) {
                        handleSend(
                            request,
                            shouldAbort);
                    }
                }


            } catch (e) {
                alert("Something went wrong. Please try again.");
            }

            setLoadingMessage("");
            setIsLoading(false);
        }
    }


    useEffect(() => {
        if(!messageIsStreaming) {
            const op = parseOp(definition);

            if(op) {
                setIsIncomplete(false);
            }
            setOp(op);
            setIsLoading(false);
        }
    }, [messageIsStreaming]);

    let dataSources = getDocumentsInConversation(selectedConversation);

    const hiddenKeys = ["_id", "_title", "_dataSources", "_button", "args", "id"];

    const getComponent = (index:any, key:string, value:any) => {
        if (key.startsWith("s_")){
            // Create a password field

            const isString = typeof value === "string";
            const strValue = isString ? value : JSON.stringify(value);

            return (
                <div className="text-sm text-gray-500 flex items-center space-x-2">
                    <label className="w-24">{key.substring(2)}:</label>
                    <input
                        type="password"
                        className="mt-2 w-96 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                        value={strValue}
                        onChange={(e) => {}}
                    />
                </div>
            );
        }
        else {
           return (
               <div className="text-sm text-gray-500 flex items-center space-x-2">
                   <label className="w-24">{key}:</label>
                   <input
                       className="mt-2 w-96 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                       value={value}
                       onChange={(e) => {}}
                   />
               </div>
         );
        }

    }

    // @ts-ignore
    return error ?
        <div>{error}</div> :
        isIncomplete ? <div>We are still missing some details...</div> :
            <div style={{maxHeight: "450px"}}>
                {isLoading ? (
                    <div className="flex flex-row items-center"><LoadingIcon/> <div className="ml-2">{loadingMessage}</div></div>
                ) : (
                    <>
                        <div className="flex flex-col w-full mb-4">
                            <div className="flex flex-row items-center justify-center">
                                <div className="mr-2"><IconRobot size={30} /></div>
                                <div className="text-2xl font-bold">{op._title || "My Plan"}</div>
                            </div>
                            <div className="flex flex-row">
                                <JsonForm
                                    onChange={(key:string, value:any) => {
                                        console.log("Setting", key, value);
                                        setOp({...op, [key]: value});
                                    }}
                                    form={op}/>
                            </div>
                            <div className="flex flex-row mb-4">
                                <button className="mt-4 w-full px-4 py-2 text-white bg-blue-500 rounded hover:bg-green-600"
                                        onClick={handleDoOp}
                                >
                                    {op._button || "Go"}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>;
};

export default OpBlock;

