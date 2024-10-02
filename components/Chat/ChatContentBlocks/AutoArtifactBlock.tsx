
import React, {useContext, useEffect, useRef, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation, Message, newMessage} from "@/types/chat";
import {getSession} from "next-auth/react"
import {deepMerge} from "@/utils/app/state";
import { conversationWithCompressedMessages, saveConversations } from "@/utils/app/conversation";
import { uploadConversation } from "@/services/remoteConversationService";
import { MetaHandler, sendChatRequestWithDocuments } from "@/services/chatService";
import { OpenAIModelID, OpenAIModels } from "@/types/openai";
import { IconHammer } from "@tabler/icons-react";
import { Artifact, ArtifactBlockDetail, validArtifactTypes } from "@/types/artifacts";
import { lzwCompress, lzwUncompress } from "@/utils/app/lzwCompression";
import { getDateName } from "@/utils/app/date";

interface Props {
    content: string;
    ready: boolean;
    message:Message;
}

const AutoArtifactsBlock: React.FC<Props> = ({content, ready, message}) => {
    const {
        state: {
            selectedConversation,
            conversations,
            folders,
            statsService,
            chatEndpoint,
            artifactIsStreaming

        },
        dispatch: homeDispatch,
        handleAddMessages: handleAddMessages
    } = useContext(HomeContext);

    // for artifact block
    // const [artifactDetails, setArtifactDetails] = useState <ArtifactDetails | null> (null);
    const [llmPrompted, setLlmPrompted]  = useState<boolean>(false);


    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

const startMarker = '<>';
const endMarker = '</>';


const ARTIFACT_CUSTOM_INSTRUCTIONS = `Follow these structural guidelines strictly:
    - IMPORTANT" Respond in valid markdown for any code blocks ex. ${"```html  <your code> ```"}  If you are asked to draw a diagram, you can use Mermaid diagrams using mermaid.js syntax in a ${"```mermaid code block. If you are asked to visualize something, you can use a ```"}vega code block with Vega-lite. 
    - If you need to say anything to the user that is not part of the artifact, wrap it in a ${startMarker} <your comments not part of the artifact> ${endMarker} tag.
    
    Example: ${startMarker} Sure! I can create an artifact for you! ${endMarker}
    
    - **Do not** include explanations, overviews, or guidance outside the ${startMarker} and ${endMarker} tags. Any instructions, comments, or final steps should always be wrapped in these tags.
    - If your artifact consists of only text, place it in a text block. 
    - **You are forbidden** from using the start and end markers for any other use.
    - When creating an extension, new version, or update to an existing artifact, output the entire contents of the artifact.
    - Any code must be enclosed in a valid markdown code block for proper formatting.
    
    **Additional Guidelines:**
    - For interactive components (e.g., HTML, CSS, or widgets), ensure users can preview or download the artifact files if relevant (This will be handled for you). 
    - If any ambiguities exist in the user’s request, provide fallback suggestions within the ${startMarker} and ${endMarker} tags.
`


useEffect(() => {
    // ready is !messageIsStreaming
    if (ready && !message.data.artifactStatus && !llmPrompted && !artifactIsStreaming) {
        setLlmPrompted(true);
        message.data.artifactStatus = 'running';

        homeDispatch({field: 'messageIsStreaming', value: true}); 
        homeDispatch({field: 'artifactIsStreaming', value: true});
        setLlmPrompted(true);
        
        try {
            const data = JSON.parse(content)
            const artifactDetail = {
                artifactId: data.id,
                name: data.name, 
                createdAt: getDateName(),
                description: data.description,
                version: undefined // determined later
            }
            // setArtifactDetails(artifactDetail);
            const instr = data.instructions;
            const includeArtifactsId = data.includeArtifactsId || [];

            const additionalContent =  appendRelevantArtifacts(includeArtifactsId, data.id);
            // includeArtifactsId
            getArtifactMessages(instr + additionalContent,  artifactDetail as ArtifactBlockDetail, data.type);

        } catch {
            console.log("error parsing auto artifacts bloack ");
            alert("Unfortunately, we were unable to produce your artifact at this time. Please resend your last prompt to try again.");
        }        
    }
}, [ready]);

const appendRelevantArtifacts = (includeArtifactsId: string[], currentId: string) => {
    console.log(
        "included artifacts: ", includeArtifactsId
    );
    if ( selectedConversation && includeArtifactsId.length > 0 || 
       (selectedConversation?.artifacts && selectedConversation.artifacts[currentId])) {
        if (!includeArtifactsId.includes(currentId)) includeArtifactsId.push(currentId);
       let instr = "These are previous artifacts that may or may not be useful for you to look at:"; 
       includeArtifactsId.forEach((id: string) => {
        if (selectedConversation.artifacts && selectedConversation.artifacts[id]) {
            const artifact = selectedConversation.artifacts[id];
            const lastArtifact = artifact.slice(-1)[0].contents;
            instr += `Artifact ID: ${id}, Content: ${lzwUncompress(lastArtifact)}\n`;
            if (id === currentId) instr += 'Write out the entire artifact if you are reusing any content from this artifact\n\n'
        }
        });
    } 
    return '';
}

const shouldAbort = ()=>{
    // return stopConversationRef.current === true;
    return false;
}

const getArtifactMessages = async (llmInstructions: string, artifactDetail: ArtifactBlockDetail, type: string = '') => {
    if (selectedConversation && selectedConversation?.messages) {
        const controller = new AbortController();

        const accessToken = await getSession().then((session) => { 
                                            // @ts-ignore
                                            return session.accessToken
                                            })
        let currentState = {};
        const metaHandler: MetaHandler = {
            status: (meta: any) => {
                //console.log("Chat-Status: ", meta);
                // homeDispatch({type: "append", field: "status", value: newStatus(meta)})
            },
            mode: (modeName: string) => {
                //console.log("Chat-Mode: "+modeName);
            },
            state: (state: any) => {
                currentState = deepMerge(currentState, state);
            },
            shouldAbort: () => {
                if (shouldAbort()) {
                    controller.abort();
                    return true;
                }
                return false;
            }
        };
        
        try {
            // setup selectedArtifacts
            let selectArtifacts = selectedConversation.artifacts ? (selectedConversation.artifacts[artifactDetail.artifactId] ?? []) : [];
            const artifactVersion = selectArtifacts.length === 0 ? 1 : selectArtifacts.slice(-1)[0].version + 1;
            artifactDetail.version = artifactVersion;
            const artifact: Artifact = {...artifactDetail, 
                                            contents: [], 
                                            tags: [],
                                            type: validArtifactTypes.includes(type) ? type : '',
                                            version: artifactVersion
                                        }
            selectArtifacts.push(artifact);
            homeDispatch({field: "selectedArtifacts", value: selectArtifacts});
            
            const chatBody = {
            model: selectedConversation.model || OpenAIModels[OpenAIModelID.GPT_4o_AZ],
            messages: [{role: 'user', content: llmInstructions} as Message],
            key: accessToken,
            prompt: ARTIFACT_CUSTOM_INSTRUCTIONS,
            temperature: 0.5,
            maxTokens: 4000,
            skipRag: true,
            skipCodeInterpreter: true,
            artifactsMode: true,
            requestId: Math.random().toString(36).substring(7)
            };

            // console.log("ArtifactDetails: ", artifactDetail)

            statsService.sendChatEvent(chatBody);
            homeDispatch({field: "currentRequestId", value: chatBody.requestId});

            window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: true, artifactIndex:  selectArtifacts.length - 1}} ));

            const response = await sendChatRequestWithDocuments(chatEndpoint || '', accessToken, chatBody, controller.signal, metaHandler);

            let updatedConversation: Conversation = {...selectedConversation, artifacts: selectedConversation.artifacts || {}};
           // selectedConversation with the assistant message stripped of artifact block data
            const messageLen = selectedConversation.messages.length - 1;
            const responseData = response.body;
            const reader = responseData ? responseData.getReader() : null;
            const decoder = new TextDecoder();
            let done = false;
            let text = selectedConversation.messages[messageLen].content + '\n\n';
            
            let artifactText: string = '';
            let isAssistantMsg = false;

            let buffer = '';
            try {
                
                while (!done) {

                    // @ts-ignore
                    const {value, done: doneReading} = await reader.read();
                    done = doneReading;
                    const chunkValue = decoder.decode(value);
                   
                    if (done) break;
                    buffer += chunkValue;

                    if (buffer.length > 6) {
                    
                        if ((buffer.includes(startMarker) && !isAssistantMsg) || (buffer.includes(endMarker) && isAssistantMsg)) {
                            // Split the buffer based on the first occurrence of the marker
                            let splitText;
                            if (buffer.includes(startMarker)) {
                                splitText = buffer.split(startMarker);
                                // Everything before the start marker goes to artifactText
                                artifactText += splitText[0];
                                // Everything after the start marker goes to text
                                buffer = splitText[1];
                                isAssistantMsg = true;
                            } else if (buffer.includes(endMarker)) {
                                splitText = buffer.split(endMarker);
                                // Everything before the end marker goes to text
                                text += splitText[0];
                                // Everything after the end marker goes to artifactText
                                buffer = splitText[1];
                                isAssistantMsg = false;
                            }
                        
                            // Clean up buffer by removing the markers
                            buffer = '';
                        }

                        if (isAssistantMsg) {
                            text += buffer;
                            let updatedMessages: Message[] = [];
                            updatedMessages = updatedConversation.messages.map((message, index) => {
                                    if (index === messageLen) {
                                        return { ...message,
                                                content: text,
                                                data: {...(message.data || {}), state: currentState}
                                            };
                                    }
                                    return message;
                                });

                            updatedConversation = {
                                ...selectedConversation,
                                messages: updatedMessages,
                            };
                            homeDispatch({
                                field: 'selectedConversation',
                                value: updatedConversation,
                            }); 
                        
                        } else {
                            artifactText += buffer;
                            selectArtifacts[selectArtifacts.length - 1].contents = lzwCompress(artifactText);
                            homeDispatch({field: "selectedArtifacts", value: selectArtifacts});
                        }
                        buffer = '';
                    }
            }

            homeDispatch({field: 'messageIsStreaming', value: false});
            homeDispatch({field: 'artifactIsStreaming', value: false});

             // update selectedConversation to include the completed selectArtifacts
            updatedConversation.artifacts = {...(updatedConversation.artifacts ?? {}), [artifact.artifactId]: selectArtifacts };
            const lastMessageData = updatedConversation.messages.slice(-1)[0].data;
            updatedConversation.messages.slice(-1)[0].data.artifactStatus = 'complete';
            updatedConversation.messages.slice(-1)[0].data.artifacts = [...(lastMessageData.artifacts ?? []), artifactDetail];

            // Final updates for conversation and artifacts
            if (selectedConversation.isLocal) {
                const updatedConversations: Conversation[] = conversationsRef.current.map(
                    (conversation:Conversation) => {
                        if (conversation.id === selectedConversation.id) {
                            return conversationWithCompressedMessages(updatedConversation);
                        }
                        return conversation;
                    },
                );
                if (updatedConversations.length === 0) {
                    updatedConversations.push(conversationWithCompressedMessages(updatedConversation));
                }
                homeDispatch({field: 'conversations', value: updatedConversations});
                saveConversations(updatedConversations);
            } else {
                uploadConversation(updatedConversation, foldersRef.current);
            }

            homeDispatch({
                field: 'selectedConversation',
                value: updatedConversation,
            }); 
            
            } finally {
                if (reader) {
                    await reader.cancel(); 
                    reader.releaseLock();
                } 
            }

        } catch (e) {
            console.error("Error prompting for Artifact Messages: ", e);
        }   
    }
}

    return <div className="flex flex-col gap-4 ">           
            <div className="flex flex-row gap-3 rounded-xl text-neutral-600 border-2 dark:border-none dark:text-white bg-neutral-100 dark:bg-[#343541] rounded-md shadow-lg p-1 pl-2">
                <IconHammer size={20}/>
                Creating Your Artifact...
            </div>
        </div>;
};


export default AutoArtifactsBlock;
