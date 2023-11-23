import {useContext, useEffect, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {IconRobot, IconZoomIn} from "@tabler/icons-react";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {createAssistant} from "@/services/assistantService";
import {UserContext} from "@auth0/nextjs-auth0/client";
import {Assistant, AssistantDefinition, AssistantProviderID} from "@/types/assistant";
import {Prompt} from "@/types/prompt";
import {MessageType} from "@/types/chat";
import {OpenAIModel} from "@/types/openai";
import {savePrompts} from "@/utils/app/prompts";


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


interface AssistantProps {
    definition: string;
}


const AssistantBlock: React.FC<AssistantProps> = ({definition}) => {
    const [error, setError] = useState<string | null>(null);
    const [isIncomplete, setIsIncomplete] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [assistantName, setAssistantName] = useState<string>("");
    const [assistantDefinition, setAssistantDefinition] = useState<AssistantDefinition|null>(null);
    const [assistantInstructions, setAssistantInstructions] = useState<string>("");
    const [assistantDescription, setAssistantDescription] = useState<string>("");
    const [assistantTools, setAssistantTools] = useState<string[]>([]);
    const [assistantTags, setAssistantTags] = useState<string[]>([]);
    const [assistantDocuments, setAssistantDocuments] = useState<string[]>([]);

    const {state:{selectedConversation, conversations, prompts}, dispatch:homeDispatch} = useContext(HomeContext);
    const {user} = useContext(UserContext);

    const parseAssistant = (definitionStr: string) => {

        try {
            const definition = JSON.parse(definitionStr);
            if(typeof definition.instructions !== "string") {
                definition.instructions = JSON.stringify(definition.instructions);
            }

            definition.provider = AssistantProviderID.OPENAI;
            definition.tags = [];
            definition.tools = [];
            definition.fileKeys = [];

            return definition;
        } catch (e) {
            setIsIncomplete(true);
            return {
            };
        }
    }

    const bindAssistantToConversation = async (id:string, definition:AssistantDefinition) => {
        if(selectedConversation) {

            const assistant:Assistant = {
                id, definition
            };

            const assistantPrompt:Prompt = {
                id: id,
                type: MessageType.ROOT,
                name: definition.name,
                description: definition.description,
                content: definition.instructions,
                folderId: null,
                data: {
                    assistant: assistant
                }
            };

            homeDispatch({
                    type: 'append',
                    field: 'prompts',
                    value: assistantPrompt,
            });

            const updatedPrompts = [...prompts, assistantPrompt];

            //homeDispatch({ field: 'prompts', value: updatedPrompts });

            savePrompts(updatedPrompts);

            // const existingAssistants = selectedConversation.data?.assistants || [];
            //
            // const updatedConversation = {
            //     ...selectedConversation,
            //     data:{
            //         ...selectedConversation.data,
            //         assistants: [...existingAssistants, assistant],
            //     }
            // }
            //
            // homeDispatch({
            //     field: 'selectedConversation',
            //     value: updatedConversation,
            // });
            //
            // const updatedConversations = conversations.map((conversation) => {
            //     if(conversation.id === selectedConversation.id) {
            //         return updatedConversation;
            //     } else {
            //         return conversation;
            //     }
            // });
            // homeDispatch({
            //     field: 'conversations',
            //     value: updatedConversations,
            // });

        }
    }

    const handleCreateAssistant = async () => {

        if(user?.name && assistantDefinition) {

            setLoadingMessage("Creating assistant...");
            setIsLoading(true);

            try {
                const {assistantId,provider} = await createAssistant(user.name, assistantDefinition);

                console.log("assistantId", assistantId);
                console.log("provider", provider);

                assistantDefinition.provider = provider;

                if(assistantId) {
                    alert("Assistant created successfully!");
                    bindAssistantToConversation(assistantId, assistantDefinition);
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

    const {
        state: {messageIsStreaming},
    } = useContext(HomeContext);


    useEffect(() => {
        if(!messageIsStreaming) {
            const assistant = parseAssistant(definition) as AssistantDefinition;

            if(assistant.name && assistant.description && assistant.instructions) {
                setIsIncomplete(false);
            }

            setAssistantName(assistant.name);
            setAssistantInstructions(assistant.instructions);
            setAssistantDescription(assistant.description);
            setAssistantDefinition(assistant);
            setIsLoading(false);
        }
    }, [messageIsStreaming]);


    // @ts-ignore
    return error ?
        <div>{error}</div> :
        isIncomplete ? <div>We are making progress on your assistant.</div> :
        <div style={{maxHeight: "450px"}}>
            {isLoading ? (
                <div className="flex flex-row items-center"><LoadingIcon/> <div className="ml-2">{loadingMessage}</div></div>
            ) : (
                <>
                    <div className="flex flex-col w-full mb-4">
                        <div className="flex flex-row items-center justify-center">
                            <div className="mr-2"><IconRobot size={30} /></div>
                            <div className="text-2xl font-bold">{assistantName}</div>
                        </div>
                        <ExpansionComponent title={"Description"} content={
                            <div className="text-sm text-gray-500">{assistantDescription}</div>
                        }/>
                        <ExpansionComponent title={"Instructions"} content={
                            <div className="mb-4">
                                <div className="text-sm text-gray-500">{assistantInstructions}</div>
                            </div>
                        }/>
                        <button className="mt-4 w-full px-4 py-2 text-white bg-blue-500 rounded hover:bg-green-600"
                                onClick={handleCreateAssistant}
                        >
                            Create Assistant
                        </button>
                    </div>
                </>
            )}
        </div>;
};

export default AssistantBlock;


