import {useContext, useEffect, useRef, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {IconRobot} from "@tabler/icons-react";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {createAssistant} from "@/services/assistantService";
import { useSession } from "next-auth/react"
import {AssistantDefinition, AssistantProviderID} from "@/types/assistant";
import {Conversation} from "@/types/chat";
import { createAssistantPrompt, handleUpdateAssistantPrompt} from "@/utils/app/assistants";
import toast from "react-hot-toast";
import React from "react";
import { getOpsForUser } from "@/services/opsService";
import { filterSupportedIntegrationOps } from "@/utils/app/ops";
import { opLanguageOptionsMap } from "@/types/op";
import { DefaultModels } from "@/types/model";
import { fixJsonString } from "@/utils/app/errorHandling";
import { camelCaseToTitle, stringToColor } from "@/utils/app/data";

interface AssistantProps {
    definition: string;
}


const AssistantBlock: React.FC<AssistantProps> = ({definition}) => {
    const {state:{selectedConversation, statsService, messageIsStreaming, prompts, featureFlags, chatEndpoint, defaultAccount},  
           dispatch:homeDispatch, getDefaultModel} = useContext(HomeContext);
    const { data: session } = useSession();
    const user = session?.user;
    const renderedRef = useRef<boolean>(false);

    const [error, setError] = useState<string | null>(null);
    const [isIncomplete, setIsIncomplete] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [assistantName, setAssistantName] = useState<string>("");
    const [assistantDefinition, setAssistantDefinition] = useState<AssistantDefinition|null>(null);
    const [assistantInstructions, setAssistantInstructions] = useState<string>("");
    const [assistantDescription, setAssistantDescription] = useState<string>("");
    const [assistantTools, setAssistantTools] = useState<any[]>([]);
    const [disclaimer, setDisclaimer] = useState<string>("");
    const [assistantTags, setAssistantTags] = useState<string[]>([]);
    const [opsLanguageVersion, setOpsLanguageVersion] = useState<string>('');

    // dont need to make the call if its never in use, this is set upon detection of operation attributes
    const cachedIntegrationsMap = useRef<{[url:string]: any}>({});
    

    const getIntegrations = async() => {
        if (!featureFlags.integrations) return [];
        const filterOps = async (data: any[]) => {
            const filteredOps = await filterSupportedIntegrationOps(data);
            if (filteredOps) {
                const urlMap = filteredOps.reduce((acc, obj) => {
                    acc[obj.url] = obj;
                    return acc;
                }, {});
                return urlMap;
            }
            return data;
        }
        const ops = await getOpsForUser();
        return ops.success ? await filterOps(ops.data) : {};
    }

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);


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

    const parseAssistant = async (definitionStr: string) => {

        try {

            let definition = null;
            try{
                definition = JSON.parse(definitionStr);
            }
            catch(e) {
                const model = getDefaultModel(DefaultModels.ADVANCED);
                const fixedJson: string | null = await fixJsonString(model, chatEndpoint || "", statsService, definitionStr, defaultAccount);
                // try to repair json
                const parsed:any  = fixedJson ? JSON.parse(fixedJson) : null;
                definition = parsed ?? parsePrefixedLines(definitionStr);
            }

            if(definition.name) definition.name = definition.name.replace(/[^a-zA-Z0-9]+/g, '').trim();


            if (!definition.instructions && definition.description) {
                definition.instructions = definition.description;
            } else if (!definition.instructions) {
                definition.instructions = definitionStr;
            }

            if (typeof definition.instructions !== "string") definition.instructions = JSON.stringify(definition.instructions);

            definition.provider = AssistantProviderID.AMPLIFY;


            const rawDS = getDocumentsInConversation(selectedConversation);
            const knowledge = rawDS.map(ds => {
                if (ds.key || (ds.id && ds.id.indexOf("://") > 0)) {
                    return ds;
                } else {
                    return {
                        ...ds,
                        id: "s3://"+ds.id
                    }
                }
            });

            definition.dataSources = knowledge;
            definition.data = {};
            definition.data.access = {read: true, write:true};
            
            if (typeof definition.tags == "string") definition.tags = definition.tags.split(',').map((t: string) => t.trim());
            if (!definition.tags) definition.tags = [];  
            definition.data.tags = definition.tags;

            if (definition.operations && featureFlags.integrations) {
                console.log("----CONTAINS OPERATIONS----"); 
                let integrationsMap: {[url:string]: any} = cachedIntegrationsMap.current;
                if (Object.keys(integrationsMap).length === 0) {
                    integrationsMap = await getIntegrations();
                    cachedIntegrationsMap.current = integrationsMap;
                } 
                const mappedOps = definition.operations.filter((url: string) => 
                                                 Object.keys(integrationsMap).includes(url))
                                                       .map((url: string) => integrationsMap[url]);                                      
                definition.tools = mappedOps;
                definition.data.operations = mappedOps; 
            }
            delete definition.operations;
            if (definition.opsLanguageVersion && 
                Object.keys(opLanguageOptionsMap(featureFlags)).includes(definition.opsLanguageVersion)) {
                    definition.data.opsLanguageVersion = definition.opsLanguageVersion;
                    delete definition.opsLanguageVersion;
            }

            return definition;
        } catch (e) {
            setIsIncomplete(true);
            return {
            };
        }
    }



    const handleCreateAssistant = async () => {

        if(user?.email && assistantDefinition) {

            setLoadingMessage("Creating assistant...");
            setIsLoading(true);

            try {
                const {id,assistantId,provider} = await createAssistant(assistantDefinition);

                // console.log("assistantId", assistantId);
                // console.log("provider", provider);
                
                assistantDefinition.id = id;
                assistantDefinition.provider = provider;
                assistantDefinition.assistantId = assistantId;


                if(assistantId) {
                    toast("Assistant created successfully!");
                    const createdAssistantPrompt = createAssistantPrompt(assistantDefinition);
                    handleUpdateAssistantPrompt(createdAssistantPrompt, prompts, homeDispatch);
                    statsService.createPromptEvent(createdAssistantPrompt);
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


    useEffect(() => {

        const getAssistantDefintion = async () => {
            renderedRef.current = true;
  
            const assistant = await parseAssistant(definition) as AssistantDefinition;

            if(assistant.name && assistant.description && assistant.instructions) {
                setIsIncomplete(false);
            }

            setAssistantName(assistant.name);
            setAssistantInstructions(assistant.instructions);
            setAssistantDescription(assistant.description);
            setAssistantTags(assistant.tags);
            if (assistant.disclaimer) setDisclaimer(assistant.disclaimer);
            if (assistant.tools) setAssistantTools(assistant.tools);
            if (assistant.data?.opsLanguageVersion) setOpsLanguageVersion(assistant.data.opsLanguageVersion);
            
            setAssistantDefinition(assistant);
            setIsLoading(false);

        }
        if (!messageIsStreaming && !renderedRef.current) getAssistantDefintion();
    }, [messageIsStreaming]);

    let dataSources = getDocumentsInConversation(selectedConversation);

    const section = (data: string, key: string) => (
        <div style={{  wordWrap: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
            className="mb-2 max-h-40 overflow-y-auto text-sm text-gray-500"
            key={key}>
            {data}
        </div>);

    // @ts-ignore
    return error ?
        <div>{error}</div> :
        isIncomplete ? <div>We are making progress on your assistant...</div> :
        <div>
            {isLoading ? (
                <div className="flex flex-row items-center"><LoadingIcon/> <div className="ml-2">{loadingMessage}</div></div>
            ) : (
                <div className="overflow-hidden" >
                    <div className="flex flex-col w-full mb-4 overflow-y-auto gap-0.5" style={{maxHeight: "480px"}}>
                        <div className="flex flex-row items-center justify-center">
                            <div className="mr-2"><IconRobot size={30} /></div>
                            <div className="text-2xl font-bold">{assistantName}</div>
                        </div>

                        <div style={{ width: '99%' }}>
                            <ExpansionComponent title={"Description"} 
                                content={<>{section(assistantDescription, "description")}</>}
                            />
                        </div>

                        <div style={{ width: '99%' }}>
                            <ExpansionComponent title={"Instructions"} 
                             content={<>{section(assistantInstructions, "intructions")}</>}
                            />
                        </div>
                        
                        {dataSources.length > 0 ?
                            <ExpansionComponent title={"Data Sources"} content={
                                <div>
                                    <div className="text-sm text-gray-500 max-h-40 overflow-y-auto">
                                        {dataSources.map((source, index) => {
                                            return <div key={index}>{source.name}</div>
                                        })}
                                    </div>
                                </div>
                            }/> : <div className="ml-2">No data sources attached</div>
                        }
                        
                        {opsLanguageVersion && 
                            <div className="flex flex-row gap-2 " > Op Language:
                            {section(opLanguageOptionsMap(featureFlags)[opsLanguageVersion as keyof typeof opLanguageOptionsMap], 'language')}
                        </div>}
                        {disclaimer &&  <div className="ml-2">Disclaimer: {section(disclaimer, "disclaimer")}</div> }
                        {assistantTags.length > 0 && 
                          <div className="ml-2">Assistant Tags: {section(assistantTags.join(', '), "tags")}</div>
                        }
                        
                        {assistantTools.length > 0 && 
                        <ExpansionComponent title={"Operations"} content={
                            <div>
                                <div className="text-sm text-gray-500 max-h-60 overflow-y-auto flex flex-col gap-3" >
                                    {assistantTools.map((op, index) => 
                                        <div key={index} className="text-neutral-200 "
                                        style={{
                                            border: '1px solid #ccc',
                                            padding: '10px',
                                            // margin: '10px 0',
                                            borderRadius: '5px',
                                          }}
                                        >
                                            <div className="flex flex-row gap-2 ">
                                                <label className="mb-2 text-bold" key={`${index}_name`} >
                                                       {camelCaseToTitle(op.name)}
                                                </label>

                                                <div className="ml-auto mt-[-6px] flex flex-row gap-1 items-center overflow-x-auto">
                                                    {/* Tags: */}
                                                    {op.tags?.filter((t:string) => !['default', 'all', "integration" ].includes(t))
                                                                .map((t : string) => 
                                                                <div key={t} style={{ backgroundColor: stringToColor(t)}} title={t}
                                                                className="my-0.5 p-0.5 text-center bg-white dark:bg-neutral-300 rounded-md h-[24px] min-w-[55px] shadow-lg text-gray-800 font-medium text-sm"> {t} </div>)
                                                    }
                                                </div>

                                            </div>
                                                {section(op.description, `${index}_description`)}
                                                <details className="text-gray-400 hover:text-gray-500 cursor-pointer">
                                                    <summary>Specification</summary>
                                                    <pre>{JSON.stringify(op, null, 2)}</pre>
                                                </details>
                                        </div>
                                    )}
                                </div>
                            </div>
                        }/>
                        }
                        
                        
                    </div>
                    <button className="my-2 w-full px-4 py-2 text-white bg-blue-500 rounded hover:bg-green-600"
                            onClick={handleCreateAssistant}
                    >
                        Create Assistant
                    </button>
                </div>
            )}
        </div>;
};

export default AssistantBlock;

