
import React, {useContext, useEffect, useRef, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation, Message, newMessage} from "@/types/chat";
import {getSession} from "next-auth/react"
import {deepMerge} from "@/utils/app/state";
import { MetaHandler, sendChatRequestWithDocuments } from "@/services/chatService";
import { IconHammer } from "@tabler/icons-react";
import { Artifact, ArtifactBlockDetail, ArtifactMessageStatus, validArtifactTypes } from "@/types/artifacts";
import { lzwCompress, lzwUncompress } from "@/utils/app/lzwCompression";
import { getDateName } from "@/utils/app/date";
import { fixJsonString } from "@/utils/app/errorHandling";
import { DefaultModels } from "@/types/model";
import { CodeBlockDetails, extractCodeBlocksAndText } from "@/utils/app/codeblock";


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
            artifactIsStreaming,
        },
        dispatch: homeDispatch, handleUpdateSelectedConversation, getDefaultModel
    } = useContext(HomeContext);

    const [llmPrompted, setLlmPrompted]  = useState<boolean>(false);
    const versionContentMapRef  = useRef<{[key:string]:string}>({});


    const shouldAbortRef  = useRef<boolean>(false);

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
    - IMPORTANT" Respond in valid markdown for any CODE blocks ex. ${"```html  <your code> ```"}  If you are asked to draw a diagram, you can use Mermaid diagrams using mermaid.js syntax in a ${"```mermaid code block. If you are asked to visualize something, you can use a ```"}vega code block with Vega-lite. 
    
    - Include File Names in Code Blocks: 
  All code blocks must include the file name as a comment on the first line. The file name should be appropriate for the context and follow the required naming conventions for Sandpack (if Applicable) based on the type of project. ex. Sandpack React projects require the entry code to be named App.js
  Ensure that names are consistently used where files are imported or referenced. IMPORTANT: This will not apply to Artifacts of type 'text' 

  For example, in a react artifact type:
  
        ${"```javascript"}
        // App.js
        import Header from './Header';
        ${"```"}

        ${"```javascript"}
        // Header.js
        export default function Header() { 
            return <h1>Header Component</h1>;
        }
        ${"```"}

    And for a static HTML artifact type:
        
        ${"```html"}
        <!-- index.html -->
        <html>
            <body>
                <script src="index.js"></script>
            </body>
        </html>
        ${"```"}

        ${"```javascript"}
        // index.js
        console.log('Hello, World!');
        ${"```"}

    - NOT EVERYTHING IS A CODE BLOCK, if you are asked to write a paper for example, and not explicitly told to make a txt or docx file, then you will respond with the text ONLY, NO code block. You must always determine if a \`\`\` code block is necessary or not
    - If you need to say/comment anything to the user that is NOT part of the artifact, wrap it in a ${startMarker} <your comments not part of the artifact> ${endMarker} tag AT THE END OF YOUR ARTIFACT OUTPUT
    
    Example use: ${startMarker} some text you would like to tell the user ${endMarker}
    
    - **Do not** include explanations, overviews, or guidance outside the ${startMarker} and ${endMarker} tags. Any instructions, comments, or final steps should always be wrapped in these tags.
    - If your artifact consists of only text, place it in a text block. 
    - You are forbidden from using the start and end markers for any other use.
    - When creating an extension, new version, or update to an existing artifact, output the entire contents of the artifact.
    - Any code must be enclosed in a valid markdown code block for proper formatting.
    
    **Additional Guidelines:**
    - For interactive components (e.g., HTML, CSS, or widgets), ensure users can preview or download the artifact files if relevant (This will be handled for you). 
    - If any ambiguities exist in the user’s request, provide fallback suggestions within the ${startMarker} and ${endMarker} tags.
    - ensure your artifacts are as complete as possible.
`  

const ARTIFACT_VERSION_INSTRUCTIONS = `
    It is required to have a complete and/or fully functional artifact version.

1. **Referencing Components**: You will be provided with an Map where each the key corresponds to a specific section of the artifact and the content of the component is the value. 
Components are to be referred to by their key in the format '~A{number}'.

2. **Updating Components**:
   - If you are updating a component section, include the complete content of that section including edits in the new version, regardless of the extent of changes.
   - For any component sections that remains unchanged, reference it using the '~A{number}' format, where number comes from the key values in the format 'A{number}'

3. **Example Response Format**: structurinng the new version of an artifact with JavaScript at key A0 (~A0)  you decided there will be no changes applied to this section, HTML at index A1 (~1) you determine you will be applying changes, and a new CSS component:

   ~A0

   \`\`\`html
   <!-- Complete HTML content with chnages-->
   \`\`\`
 
   \`\`\`css
   /* New CSS content */
   /* ... */
   \`\`\`

5. **Consistency**: Ensure that the new version maintains the integrity and functionality of the artifact. All component sections, whether updated or referenced by their key, should work together seamlessly in the new version.
If you provide a ~A# then assume I will insert the context for that specific referenced content and thus does not need to be reproduced by you. 

Please save yourself work, if you can reuse any part of the the Artifact Context (when it makes sense to do so) then you must provide a ~A# so, we can save tokens.
You goal is to maximize the saved tokens **while providing the user with a qulity response (top priority)**. 
`;

const repairJson = async () => {
    const model = getDefaultModel(DefaultModels.ADVANCED);
    const fixedJson: string | null = await fixJsonString( model, chatEndpoint || "", statsService, content, "Failed to create artifact, attempting to fix...");
     // try to repair json
     if (fixedJson) {
        message.data.artifactStatus = ArtifactMessageStatus.RETRY;   
        prepareArtifacts(fixedJson, false);
     } else {
         message.data.artifactStatus = ArtifactMessageStatus.CANCELLED;
         if (selectedConversation) {
            const updatedConversation = {...selectedConversation};
            updatedConversation.messages[selectedConversation.messages.length - 1] = message;
            handleUpdateSelectedConversation(updatedConversation);
            // update conversation 
            console.log("reached artifact cancelled");
            alert("Unfortunately, we were unable to create your artifact at this time. Please resend your last prompt, possibly with a more advanced model to try again.");
            homeDispatch({field: 'messageIsStreaming', value: false}); 
            homeDispatch({field: 'artifactIsStreaming', value: false});
         }
     }
    return fixedJson;
}

useEffect(() => {
    if ( ready && !message.data.artifactStatus && !artifactIsStreaming && !llmPrompted ) prepareArtifacts(content, true); 
}, [ready]);


const prepareArtifacts = (jsonContent: string, retry: boolean) => {
    setLlmPrompted(true);
        message.data.artifactStatus = ArtifactMessageStatus.RUNNING;
        homeDispatch({field: 'messageIsStreaming', value: true}); 
        homeDispatch({field: 'artifactIsStreaming', value: true});

        try {
            const data = JSON.parse(jsonContent);
            
            const artifactDetail = {
                artifactId: data.id,
                name: data.name, 
                createdAt: getDateName(),
                description: data.description,
                version: undefined // determined later
            }
            // setArtifactDetails(artifactDetail);
            const instr = data.instructions + (data.type ? `This Artifact is expected to be of type: '${data.type}' `: '');
            const includeArtifactsId = data.includeArtifactsId || [];

            const additionalContent =  appendRelevantArtifacts(includeArtifactsId, data.id);
            // includeArtifactsId
            getArtifactMessages(instr + additionalContent,  artifactDetail as ArtifactBlockDetail, data.type);

        } catch {
            console.log("error parsing auto artifacts block ");
            // try to repair json
            if (retry) repairJson();
        }        
}



const appendRelevantArtifacts = (includeArtifactsId: string[], currentId: string) => {
    console.log(
        "included artifacts: ", includeArtifactsId
    );
    let instr = "These are previous artifacts that may or may not be useful for you to look at:\n"; 
    let versionInstr = '\n\n';
    if ( selectedConversation && includeArtifactsId.length > 0 || 
       (selectedConversation?.artifacts && selectedConversation.artifacts[currentId])) {
        if (!includeArtifactsId.includes(currentId)) includeArtifactsId.push(currentId);
       includeArtifactsId.forEach((id: string) => {
        if (selectedConversation.artifacts && selectedConversation.artifacts[id]) {
            const artifacts = selectedConversation.artifacts[id];
            const lastArtifact = artifacts.slice(-1)[0].contents;
            const content = lzwUncompress(lastArtifact);
            if (id === currentId) {
                versionInstr += ARTIFACT_VERSION_INSTRUCTIONS + '\nArtifact Context split up into parts:\n';
                let contentList: string[] = extractCodeBlocksAndText(content).map((detail: CodeBlockDetails) => 
                                                                                   detail.extension === ".txt" ? detail.code :
                                                                                   `\`\`\` ${detail.language} ${detail.code}\`\`\` `    
                                                                                   );
                                                                                    
                if (contentList.length > 0){
                    const contentMap: {[key:string]:string} = {};
                    contentList.forEach((part: string, index: number) => contentMap[`A${index}`] = part );
                    versionContentMapRef.current = contentMap;
                    versionInstr += JSON.stringify(contentMap);
                }
               
            } else {
                instr += `Artifact ID: ${id}, Content: ${content}\n\n`;
            }
        }
        });
    } 
    return instr + versionInstr;
}

useEffect(() => {
    const handleStopGenerationEvent = () => {
        shouldAbortRef.current = true;
        console.log("kill artifact even trigger recieved and controller. abort: ");
    }

    window.addEventListener('killArtifactRequest', handleStopGenerationEvent);
    return () => {
        window.removeEventListener('killArtifactRequest', handleStopGenerationEvent);
    };
},[]);

const shouldAbort = () => {
    return shouldAbortRef.current;
}

const getArtifactMessages = async (llmInstructions: string, artifactDetail: ArtifactBlockDetail, type: string = '') => {
    statsService.createArtifactEvent(type);
    const requestId = Math.random().toString(36).substring(7);
    homeDispatch({field: "currentRequestId", value: requestId});
    if (selectedConversation && selectedConversation?.messages) {

        const accessToken = await getSession().then((session) => { 
                                            // @ts-ignore
                                            return session.accessToken
                                            })
            
        // Create a new controller
        const controller = new AbortController();   
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
                // console.log("SHould abort? , ", shouldAbort.current);
                if (shouldAbort()) {// isnt capturing the value for some reason
                    console.log('ABORTED MISSION') 
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
            model: selectedConversation.model ?? getDefaultModel(DefaultModels.ADVANCED),
            messages: [{role: 'user', content: llmInstructions} as Message],
            key: accessToken,
            prompt: ARTIFACT_CUSTOM_INSTRUCTIONS,
            temperature: 0.5,
            maxTokens: 4000,
            skipRag: true,
            skipCodeInterpreter: true,
            artifactsMode: true,
            requestId: requestId
            };

            statsService.sendChatEvent(chatBody);

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

            const placeholderRegex = /\~A(\d+)/g;

            let isAssistantMsg = false;

            let buffer = '';
            try {
                
                while (!done) {
                    // @ts-ignore
                    const {value, done} = await reader.read();
                    const chunkValue = decoder.decode(value);
                    if (chunkValue) buffer += chunkValue;

                    if (buffer.length > 7) {
                        // replace tag references with content:
                        if (versionContentMapRef.current && placeholderRegex.test(buffer)) {
                            console.log("Buffer contains tag(s):", buffer);
                        
                            buffer = buffer.replace(placeholderRegex, (match) => {
                                // Remove the leading `~` so the key becomes A<number>
                                const key = match.slice(1);
                                // Check if the key exists in versionContentMapRef.current
                                if (key in versionContentMapRef.current) {
                                    console.log("Tag replaced with context in the Buffer", key);
                                    return `\n${versionContentMapRef.current[key]}\n`;
                                } else {
                                    console.log("Buffer contained a tag with an invalid key:", key);
                                    return '';
                                }
                            });
                        }
                    
                        if ((buffer.includes(startMarker) && !isAssistantMsg) || (buffer.includes(endMarker) && isAssistantMsg)) {
                            // Split the buffer based on the first occurrence of the marker
                            let splitText;
                            if (buffer.includes(startMarker)) {
                                splitText = buffer.split(startMarker);

                                // Everything before the start marker goes to artifactText
                                artifactText += splitText[0];
                                // Everything after the start marker goes to text
                                text += splitText[1];
                                isAssistantMsg = true;
                            } else if (buffer.includes(endMarker)) {
                                splitText = buffer.split(endMarker);

                                // Everything before the end marker goes to text
                                text += splitText[0];
                                // Everything after the end marker goes to artifactText
                                artifactText += splitText[1];
                                isAssistantMsg = false;
                            }
                        
                            // Clean up buffer by removing the markers
                            buffer = ''; // if buffer is clear then we have already added to the correct vars and need to update both
                        }

                        if (isAssistantMsg || !buffer) {
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
                        
                        } 
                        if (!isAssistantMsg || !buffer) {
                            artifactText += buffer;
                            selectArtifacts[selectArtifacts.length - 1].contents = lzwCompress(artifactText);
                            homeDispatch({field: "selectedArtifacts", value: selectArtifacts});
                        }
                        buffer = '';
                    }
                    if (done || controller.signal.aborted) break;
                }
            
            } finally {
                if (reader) {
                    await reader.cancel(); 
                    reader.releaseLock();
                } 
                homeDispatch({field: 'messageIsStreaming', value: false});
                homeDispatch({field: 'artifactIsStreaming', value: false});

                // update selectedConversation to include the completed selectArtifacts
                updatedConversation.artifacts = {...(updatedConversation.artifacts ?? {}), [artifact.artifactId]: selectArtifacts };
                const lastMessageData = updatedConversation.messages.slice(-1)[0].data;
                updatedConversation.messages.slice(-1)[0].data.artifactStatus = controller.signal.aborted ? ArtifactMessageStatus.STOPPED : ArtifactMessageStatus.COMPLETE;
                updatedConversation.messages.slice(-1)[0].data.artifacts = [...(lastMessageData.artifacts ?? []), artifactDetail];

                
                handleUpdateSelectedConversation(updatedConversation);
                shouldAbortRef.current = false;
            }

        } catch (e) {
            console.error("Error prompting for Artifact Messages: ", e);
        }   
        setTimeout(() => {
            const event = new CustomEvent( 'triggerChatReRender' );
            window.dispatchEvent(event);
        }, 200)
        
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
