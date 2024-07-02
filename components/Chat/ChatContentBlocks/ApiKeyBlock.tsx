import {useContext, useEffect, useRef, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {IconKey, IconRobot} from "@tabler/icons-react";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {createAssistant} from "@/services/assistantService";
import { useSession } from "next-auth/react"
import {AssistantDefinition, AssistantProviderID} from "@/types/assistant";
import {Prompt} from "@/types/prompt";
import {Conversation} from "@/types/chat";
import { createAssistantPrompt, handleUpdateAssistantPrompt} from "@/utils/app/assistants";
import { ApiKey } from "@/types/apikeys";



const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: lightgray;
  font-size: 1rem;
  animation: ${animate} 2s infinite;
`;


interface Props {
    content: string;
}


const ApiKeyBlock: React.FC<Props> = ({content}) => {
    const [error, setError] = useState<string | null>(null);
    const [isIncomplete, setIsIncomplete] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);



    const [operationData, setOperationData] = useState<any>(JSON.parse(content));


    const [loadingMessage, setLoadingMessage] = useState<string>("");

    const {state:{selectedConversation, statsService, messageIsStreaming},  dispatch:homeDispatch} = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user;

    function parsePrefixedLines(text: string): {[key:string]:string} {
        if (typeof text !== 'string' || text.length === 0) {
            throw new Error('Input text must be a non-empty string');
        }

        const resultMap:{[key:string]:string} = {};
        const lines: string[] = text.split('\n');
        let currentPrefix: string | null = null;
        const contentBuffer: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line: string = lines[i].trim();
            const match: RegExpMatchArray | null = line.match(/^(\s*"?(\w+)"?\s*):(.*)$/);
            if (match) {
                // When a new prefix is found, save the previous prefix and its content
                if (currentPrefix !== null) {
                    resultMap[currentPrefix] =
                        contentBuffer.join('\n');
                }
                // Extract current prefix from the regex match, removing quotes if present
                currentPrefix = match[2].replaceAll('"', '');
                contentBuffer.push(match[3]);
            } else if (currentPrefix !== null) {
                // If we are in a prefixed block, accumulate the content
                contentBuffer.push(line);
            }
        }

        // When the input ends, save the last prefix and its content
        if (currentPrefix !== null) {
            resultMap[currentPrefix] = contentBuffer.join('\n');
        }

        return resultMap;
    }

    const parseAssistant = (definitionStr: string) => {

        try {

            let definition = null;
            try{
                definition = JSON.parse(definitionStr);
            }
            catch(e) {
                definition = parsePrefixedLines(definitionStr);
            }

            if(definition.name){
                definition.name = definition.name.replace(/[^a-zA-Z0-9]+/g, '').trim();
            }
            if(!definition.instructions && definition.description) {
                definition.instructions = definition.description;
            }
            else if(!definition.instructions) {
                definition.instructions = definitionStr;
            }

            if(typeof definition.instructions !== "string") {
                definition.instructions = JSON.stringify(definition.instructions);
            }

            definition.provider = AssistantProviderID.AMPLIFY;
            definition.tags = [];
            definition.tools = [];

            definition.dataSources = 'knowledge';
            definition.data = {};
            definition.data.access = {read: true, write:true};

            return definition;
        } catch (e) {
            setIsIncomplete(true);
            return {
            };
        }
    }



    const handleCreateAPIKey = async () => {

        if(user?.email) {

            setLoadingMessage("Creating assistant...");
            setIsLoading(true);

            try {
   
                if (true) {
                    
                } else {
                    alert("Failed to create assistant. Please try again.");
                }
            } catch (e) {
                alert("Failed to create assistant. Please try again.");
            }

            setLoadingMessage("");
            setIsLoading(false);
        }
    }

    function formatString(str: String) {
        if (!str) return str; // Handle null, undefined, or empty string
        return str.charAt(0) + str.slice(1).toLowerCase();
    }


    useEffect(() => {
        if(!messageIsStreaming) {
            const assistant = parseAssistant('definition') as AssistantDefinition;

            if(assistant.name && assistant.description && assistant.instructions) {
                setIsIncomplete(false);
            }

            // setAssistantName(assistant.name);
            // setAssistantInstructions(assistant.instructions);
            // setAssistantDescription(assistant.description);
            // setAssistantDefinition(assistant);
            setIsLoading(false);
        }
    }, [messageIsStreaming]);

    const verifyRequiredKeys = () => {
        const requiredKeys = [ 'owner', 'delegate', 'account', 'appName', 'appDescription', 'rateLimit', 'accessTypes', 'systemUse'] 
        const data = operationData.DATA;
        // Check if all required keys are present in the data object
        const missingKeys = requiredKeys.filter(key => {
            return data[key] === undefined || data[key] === null;
        });
        // If there are no missing keys, the data is considered complete
        return missingKeys.length === 0;
    }

    useEffect(() => {
        console.log(operationData)
        console.log(operationData.OP)
        console.log(operationData.DATA)

        if(operationData.OP === 'CREATE') {
            setIsIncomplete(verifyRequiredKeys());
            setIsLoading(false);
        }
    }, [operationData]);


    // @ts-ignore
    return error ?
        <div>{error}</div> :
        isIncomplete ? <div>We are making progress on your request.</div> :
        <div style={{maxHeight: "450px"}}>
            {isLoading ? (
                <div className="flex flex-row items-center"><LoadingIcon/> <div className="ml-2">{loadingMessage}</div></div>
            ) : (
                <>
                    <div className="flex flex-col w-full mb-4 overflow-x-hidden gap-0.5">
                        <div className="flex flex-row items-center justify-center">
                            <div className="text-2xl font-bold">{operationData.OP}</div>
                            {operationData.OP === 'CREATE' ?
                            <></>:
                             (<div className="ml-2"><IconKey size={28}/> </div>) 
                            }
                        </div>

                        <div style={{ width: '99%' }}>
                            <ExpansionComponent title={"Instructions"} content={
                                <div style={{  wordWrap: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
                                     className="mb-2 max-h-24 overflow-y-auto text-sm text-gray-500">
                                        {operationData.DATA}
                                    </div>
                                }/>
                        </div>

                        {/* <div style={{ width: '99%' }}>
                            <ExpansionComponent title={"Instructions"} content={
                                <div  style={{  wordWrap: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }} 
                                      className="mb-2 max-h-24 overflow-y-auto text-sm text-gray-500">
                                        {assistantInstructions}
                                    </div>
                                }/>
                        </div> */}
                        
                        <button className="mt-4 w-full px-4 py-2 text-white bg-blue-500 rounded hover:bg-green-600"
                                onClick={handleCreateAPIKey}
                        >
                            {`${formatString(operationData.OP)} API Key`}
                        </button>
                    </div>
                </>
            )}
        </div>;
};

export default ApiKeyBlock;


