import React, {useContext, useEffect, useRef, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {Conversation, Message, newMessage} from "@/types/chat";
import {deepMerge} from "@/utils/app/state";
import { MetaHandler, sendChatRequestWithDocuments } from "@/services/chatService";
import { IconHammer, IconFileText, IconTable, IconCode, IconChartBar, IconEye, IconEyeOff } from "@tabler/icons-react";
import { Artifact, ArtifactBlockDetail, ArtifactMessageStatus, validArtifactTypes, resolveNUIType, sniffContentType } from "@/types/artifacts";
import { lzwCompress, lzwUncompress } from "@/utils/app/lzwCompression";
import { getDateName } from "@/utils/app/date";
import { fixJsonString } from "@/utils/app/errorHandling";
import { DefaultModels, Model } from "@/types/model";
import { CodeBlockDetails, extractCodeBlocksAndText } from "@/utils/app/codeblock";
import { saveArtifact, getAllArtifacts } from "@/services/artifactsService";
import { jsonrepair } from "jsonrepair";
import { v4 as uuidv4 } from "uuid";
import { buildArtifactSavePayload, resolveArtifactName } from "@/components/NewUI/shared/artifactLibraryModel";

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
            messageIsStreaming,
            defaultAccount,
            featureFlags
        },
        dispatch: homeDispatch, handleUpdateSelectedConversation, getDefaultModel
    } = useContext(HomeContext);
    const llmPromptedRef = useRef<boolean>(false);

    const versionContentMapRef  = useRef<{[key:string]:string}>({});

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


const ARTIFACT_CUSTOM_INSTRUCTIONS = `You are generating the content of an artifact. Follow the rules for the artifact type strictly.

## Artifact type rules

### Type: spreadsheet
Output ONLY raw CSV content — no markdown fences, no prose, no explanation.
- First row must be the header row with column names.
- Use commas as delimiters. Wrap any field that contains a comma, newline, or double-quote in double-quotes; escape internal double-quotes by doubling them.
- CRITICAL: cells that list multiple items MUST keep natural punctuation including commas. Always quote such cells.
  ✓ Correct:  "Variables, control flow, functions, debugging"
  ✗ Wrong:    Variables control flow functions debugging  (commas stripped)
- Do NOT wrap the CSV in a code block. The entire response (before the ${startMarker} summary) must be plain CSV text.
- Example (correct):
  Name,Department,Skills
  Alice,"Engineering, Backend","Python, SQL, Docker"
  Bob,Marketing,"Copywriting, SEO"

### Type: code
Output the code in a single fenced code block with the correct language identifier.
- Include the filename as a comment on the first line (e.g. \`# main.py\` or \`// app.js\`).
- No prose outside the code block (before the ${startMarker} summary).
- Example: ${"```python\n# main.py\nprint('Hello')\n```"}

### Type: visualization
Output a single self-contained HTML document.
- All CSS and JavaScript must be inline (no external CDN or fetch calls).
- The document must render correctly in a sandboxed iframe.
- Do NOT wrap in a code block — output raw HTML starting with <!DOCTYPE html> or <html>.
- For SVG: output the raw <svg …> element directly, no wrapper.
- For Mermaid diagrams: use a ${"```mermaid"} code block.
- For data charts: prefer Vega-Lite in a ${"```vega"} code block.

### Type: document  (default)
Respond in valid Markdown. Use headings, lists, tables, and code blocks as appropriate.
- If you include code, wrap it in a fenced code block with the language identifier.
- Do not wrap the whole document in a code block.

## Output structure
1. The artifact content (per the type rules above).
2. REQUIRED: A brief 1–2 sentence summary wrapped in ${startMarker} ... ${endMarker} tags immediately after the content. Never skip this.
   Example: ${startMarker} I've created the departments CSV with 33 rows and 2 columns. Let me know if you'd like any changes. ${endMarker}

## General rules
- Do not include explanations or commentary OUTSIDE the ${startMarker}...${endMarker} summary.
- When creating an update to an existing artifact, output the entire updated contents.
- If any ambiguities exist, note them in the summary (inside the tags).
- Ensure artifacts are complete and ready to use.
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
    const fixedJson: string | null = await fixJsonString( model, chatEndpoint || "", statsService, content, defaultAccount, "Failed to create artifact, attempting to fix...");
     // try to repair json
     if (fixedJson) {
        message.data.artifactStatus = ArtifactMessageStatus.RETRY; 
        llmPromptedRef.current = false;
        prepareArtifacts(fixedJson, false);
     } else {
         message.data.artifactStatus = ArtifactMessageStatus.CANCELLED;
         if (selectedConversation && selectedConversation.messages) {
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
    if (!llmPromptedRef.current) {
        llmPromptedRef.current = true;
        if (ready && !message.data.artifactStatus && !artifactIsStreaming && !messageIsStreaming) prepareArtifacts(content, true); 
    }
    
}, [ready]);

const isInEndState = (status: ArtifactMessageStatus) => {
    return [ArtifactMessageStatus.STOPPED, ArtifactMessageStatus.CANCELLED, ArtifactMessageStatus.COMPLETE].includes(status);
}

useEffect(() => {
    if (isInEndState(message.data.artifactStatus)) {
        llmPromptedRef.current = false;
    }
    
}, [message.data]);


const prepareArtifacts = (jsonContent: string, retry: boolean) => {
        // Create a unique key for this specific message content
        const contentHash = message.id ? `msg-${message.id}` : `content-${jsonContent.slice(0, 50).replace(/\s/g, '')}`;
        const messageKey = `processing-${contentHash}`;
        const cooldownKey = `cooldown-${contentHash}`;
        
        // Check if we're in cooldown period (3 seconds after last completion)
        const lastCompletion = (window as any)[cooldownKey];
        if (lastCompletion && Date.now() - lastCompletion < 3000) {
            console.log("Still in cooldown period, skipping artifact creation:", messageKey);
            return;
        }
        
        // Check if this message is already being processed
        if ((window as any)[messageKey] && !retry) {
            console.log("Message already being processed, skipping:", messageKey);
            return;
        }
        
        // Mark this message as being processed
        (window as any)[messageKey] = true;
        
        message.data.artifactStatus = ArtifactMessageStatus.RUNNING;
        homeDispatch({field: 'messageIsStreaming', value: true}); 
        homeDispatch({field: 'artifactIsStreaming', value: true});

        let data: any;
        try {
            // Absorb minor LLM formatting slips (trailing commas, stray characters,
            // etc.) before attempting a strict parse. This is a no-op on already-valid
            // JSON, so it never masks a genuine syntax error — it just avoids treating
            // trivially-fixable content as broken.
            let candidate = jsonContent;
            try {
                candidate = jsonrepair(jsonContent);
            } catch {
                candidate = jsonContent;
            }
            data = JSON.parse(candidate);
        } catch {
            console.log("error parsing auto artifacts block ");
            // Clean up the processing flag on error
            delete (window as any)[messageKey];
            // try to repair json
            if (retry) repairJson();
            return;
        }

        // From here on the JSON itself parsed successfully — any missing/empty
        // fields are a semantic gap (e.g. the model omitted an id, or genuinely had
        // nothing to generate), not a syntax error. Handle those directly instead of
        // routing through the JSON-repair/retry path, which is reserved for actually
        // broken JSON and would otherwise leave the message stuck at RUNNING forever
        // on the second (no-retry) pass.
        const artifactId = (typeof data.id === 'string' && data.id.trim()) || uuidv4();
        const instructions = typeof data.instructions === 'string' ? data.instructions.trim() : '';
        const description = typeof data.description === 'string' ? data.description.trim() : '';
        const requestedType = typeof data.type === 'string' ? data.type.trim() : '';

        if (!instructions && !description) {
            console.log("Artifact request has no usable instructions or description; cancelling quietly");
            delete (window as any)[messageKey];
            message.data = {
                ...(message.data || {}),
                artifactStatus: ArtifactMessageStatus.CANCELLED,
            };
            homeDispatch({field: 'messageIsStreaming', value: false});
            homeDispatch({field: 'artifactIsStreaming', value: false});
            return;
        }

        // Resolve name from the request itself when the model provided one.
        // Deliberately left empty (not defaulted to a generic label) when neither
        // is present — the completion-time auto-title step below prefers a real
        // title extracted from the generated content (e.g. the document's first
        // H1) over a generic placeholder, and only falls back to a generic label
        // if that extraction also comes up empty.
        const resolvedName: string = typeof data.name === 'string' ? data.name.trim() : '';

        const artifactDetail = {
            artifactId,
            name: resolvedName,
            createdAt: getDateName(),
            description,
            version: undefined // determined later
        };
        const instr = `${instructions || description}${requestedType ? `\nThis Artifact is expected to be of type: '${requestedType}'.` : ''}`;
        const includeArtifactsId = data.includeArtifactsId || [];

        const additionalContent = appendRelevantArtifacts(includeArtifactsId, artifactId);
        const webSearchContent = collectRecentWebSearchResults();

        const prompt = `${instr}\n\n${additionalContent}${webSearchContent}`

        getArtifactMessages(prompt,  artifactDetail as ArtifactBlockDetail, data.type, messageKey, cooldownKey);
}



const appendRelevantArtifacts = (includeArtifactsId: string[], currentId: string) => {
    console.log( "included artifacts: ", includeArtifactsId );
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
                                                                                   `\`\`\`${detail.language} \n${detail.code} \n\`\`\` `
                                                                                   );

                if (contentList.length > 0){
                    const contentMap: {[key:string]:string} = {};
                    contentList.forEach((part: string, index: number) => contentMap[`A${index}`] = part );
                    versionContentMapRef.current = contentMap;
                    console.log("CONTENT MAP: ", contentMap )
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

const collectRecentWebSearchResults = (): string => {
    if (!featureFlags.webSearch || !selectedConversation?.messages) {
        return "";
    }

    // Get last 3 assistant messages with web search results
    const assistantMessages = selectedConversation.messages
        .filter(msg => msg.role === 'assistant')
        .slice(-3)
        .reverse(); // Most recent first

    const webSearchResults: Array<{
        name: string;
        url: string;
        content: string;
    }> = [];

    // Collect all web search sources from these messages
    for (const msg of assistantMessages) {
        const sources = msg.data?.state?.sources?.webSearch?.sources;
        if (sources && Array.isArray(sources)) {
            sources.forEach((source: any) => {
                // Avoid duplicates by checking URL
                if (!webSearchResults.some(existing => existing.url === source.url)) {
                    webSearchResults.push({
                        name: source.name || 'Unknown Source',
                        url: source.url || '',
                        content: source.content || ''
                    });
                }
            });
        }
    }

    if (webSearchResults.length === 0) {
        return "";
    }

    // Format as supplemental context for the LLM
    const formattedResults = webSearchResults
        .map((source, index) =>
            `[${index + 1}] ${source.name}\nURL: ${source.url}\nContent: ${source.content}`
        )
        .join('\n\n---\n\n');
    console.log("Formatted Results: ", formattedResults);
    return `\n\nSupplemental Web Search Results:\n\n${formattedResults}`;
}


const containsPartialMarker = (buffer: string) => {
    const endChars = buffer.slice(-3);
    return endChars.includes("~") || endChars.includes("<");
}


const getArtifactMessages = async (llmInstructions: string, artifactDetail: ArtifactBlockDetail, type: string = '', messageKey?: string, cooldownKey?: string) => {
    statsService.createArtifactEvent(type);
    const requestId = Math.random().toString(36).substring(7);
    console.log("Artifact Request id: ", requestId);
    homeDispatch({field: "currentRequestId", value: requestId});
    if (selectedConversation && selectedConversation?.messages) {

        // Create a new controller
        const controller = new AbortController(); 

        const handleStopGenerationEvent = () => {
            controller.abort();
            message.data = {
                ...(message.data || {}),
                artifactStatus: ArtifactMessageStatus.STOPPED,
            };
            homeDispatch({ field: 'artifactIsStreaming', value: false });
            homeDispatch({ field: 'messageIsStreaming', value: false });
            console.log("Kill artifact event trigger, control signal aborted value: " , controller.signal.aborted);
        }

        window.addEventListener('killArtifactRequest', handleStopGenerationEvent);

        let currentState = {};
        const metaHandler: MetaHandler = {
            status: (meta: any) => {},
            mode: (modeName: string) => {},
            state: (state: any) => currentState = deepMerge(currentState, state),
            shouldAbort: () => false
        };
        
        try {
            // setup selectedArtifacts
            let selectArtifacts = selectedConversation.artifacts ? (selectedConversation.artifacts[artifactDetail.artifactId] ?? []) : [];
            const artifactVersion = selectArtifacts.length === 0 ? 1 : selectArtifacts.slice(-1)[0].version + 1;
            artifactDetail.version = artifactVersion;

            // Normalise the declared type: 'csv' → 'spreadsheet', raw language names → 'code', etc.
            // We keep the original string on the artifact so the renderer can use it for language sniffing.
            const normalizedType = validArtifactTypes.includes(type) ? type : '';

            // Detect language for 'code' type so the card shows "Code · Python" etc.
            const isCodeLike = resolveNUIType(type) === 'code';
            const codeLang = isCodeLike ? (type === 'code' ? '' : type) : '';

            const artifact: Artifact = {
                ...artifactDetail,
                contents: [],
                tags: [],
                type: normalizedType,
                version: artifactVersion,
                // Store language hint for code artifacts in metadata
                metadata: codeLang ? { language: codeLang } : undefined,
            }
            selectArtifacts.push(artifact);
            homeDispatch({field: "selectedArtifacts", value: selectArtifacts});
            const model: Model = selectedConversation.model ?? getDefaultModel(DefaultModels.ADVANCED);
            const chatBody = {
            model: model,
            messages: [{role: 'user', content: llmInstructions} as Message],
            prompt: ARTIFACT_CUSTOM_INSTRUCTIONS,
            temperature: 0.5,
            maxTokens: model.outputTokenLimit, // Default to max token
            skipRag: true,
            skipCodeInterpreter: true,
            artifactsMode: true,
            requestId: requestId,
            accountId: defaultAccount?.id,
            rateLimit: defaultAccount?.rateLimit
            };

            statsService.sendChatEvent(chatBody);

            window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: true, artifactIndex:  selectArtifacts.length - 1}} ));

            const response = await sendChatRequestWithDocuments(chatEndpoint || null, chatBody, controller.signal, metaHandler);

            let updatedConversation: Conversation = {...selectedConversation, artifacts: selectedConversation.artifacts || {}};
           // selectedConversation with the assistant message stripped of artifact block data
            const messageLen = selectedConversation.messages?.length - 1;
            const responseData = response.body;
            const reader = responseData ? responseData.getReader() : null;
            const decoder = new TextDecoder();
            let text = selectedConversation.messages[messageLen].content + '\n\n';
            let artifactText: string = '';

            const placeholderRegex = /\~A(\d+)/g;
            let isAssistantMsg = false;
            let buffer = '';
            try {
                while (!controller.signal.aborted) {
                    // @ts-ignore
                    const {value, done} = await reader.read();
                    const chunkValue = decoder.decode(value);
                    if (chunkValue) buffer += chunkValue;

                    if ((buffer.length > 2 && !containsPartialMarker(buffer)) || done) {
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

                    if (done) break;
                }
            
            } catch (error) {
                if (!controller.signal.aborted) console.error("Artifact Streaming Error occurred", error);
            } finally {
                // Clean up the processing flag and set cooldown
                if (messageKey) {
                    delete (window as any)[messageKey];
                }
                if (cooldownKey) {
                    (window as any)[cooldownKey] = Date.now(); // Set cooldown timestamp
                    console.log("Artifact completed, setting cooldown for:", cooldownKey);
                }
                
                if (reader && !controller.signal.aborted) {
                    await reader.cancel(); 
                    reader.releaseLock();
                } 
                llmPromptedRef.current = false;
                homeDispatch({field: 'messageIsStreaming', value: false});
                homeDispatch({field: 'artifactIsStreaming', value: false});

                const rawContent = lzwUncompress(selectArtifacts[selectArtifacts.length - 1].contents as any);
                const unusableFallback = /no artifact was requested|please provide the (content|task|instructions)/i.test(rawContent.trim());
                if (!controller.signal.aborted && unusableFallback) {
                    updatedConversation.messages[messageLen].data = {
                        ...(updatedConversation.messages[messageLen].data || {}),
                        artifactStatus: ArtifactMessageStatus.CANCELLED,
                    };
                    homeDispatch({ field: 'selectedArtifacts', value: selectArtifacts.slice(0, -1) });
                    handleUpdateSelectedConversation(updatedConversation);
                    if (messageKey) delete (window as any)[messageKey];
                    window.removeEventListener('killArtifactRequest', handleStopGenerationEvent);
                    return;
                }

                // Resolve the final type and title only after generation completes so
                // document H1 headings win over request descriptions.
                const completedArtifact = selectArtifacts[selectArtifacts.length - 1];
                if (!controller.signal.aborted && !type) {
                    const sniffed = sniffContentType(rawContent);
                    if (sniffed !== 'document') completedArtifact.type = sniffed;
                }
                if (!controller.signal.aborted) {
                    const finalName = resolveArtifactName({
                        ...completedArtifact,
                        name: artifactDetail.name,
                        description: artifactDetail.description,
                    }, rawContent);
                    artifactDetail.name = finalName;
                    completedArtifact.name = finalName;
                    const conversationId = selectedConversation?.id;
                    if (conversationId) {
                        completedArtifact.metadata = {
                            ...(completedArtifact.metadata ?? {}),
                            conversationId,
                        };
                    }
                    homeDispatch({ field: 'selectedArtifacts', value: [...selectArtifacts] });
                }

                // update selectedConversation to include the completed selectArtifacts
                updatedConversation.artifacts = {...(updatedConversation.artifacts ?? {}), [artifact.artifactId]: selectArtifacts };
                const lastMessageData = updatedConversation.messages.slice(-1)[0].data;
                updatedConversation.messages.slice(-1)[0].data.artifactStatus = controller.signal.aborted ? ArtifactMessageStatus.STOPPED : ArtifactMessageStatus.COMPLETE;
                updatedConversation.messages.slice(-1)[0].data.artifacts = [...(lastMessageData.artifacts ?? []), artifactDetail];

                handleUpdateSelectedConversation(updatedConversation);

                // ── Auto-save to server (fire-and-forget) so the artifact is
                //    immediately available in the library even without the user
                //    clicking "Save Artifact" manually.
                if (!controller.signal.aborted) {
                    const artifactToSave = selectArtifacts[selectArtifacts.length - 1];
                    const savePayload = buildArtifactSavePayload(artifactToSave);
                    const saveRequest = savePayload && selectedConversation?.id
                        ? { ...savePayload, conversationId: selectedConversation.id }
                        : savePayload;
                    const saveResult = saveRequest ? await saveArtifact(saveRequest) : null;
                    if (saveResult?.success) {
                        const response = await getAllArtifacts();
                        if (response.success) homeDispatch({ field: 'artifacts', value: response.data });
                    } else {
                        console.error('Artifact save rejected by server:', saveResult?.message || saveResult);
                    }
                }
            }

        } catch (e) {
            console.error("Error prompting for Artifact Messages: ", e);
            // Clean up the processing flag on error (but don't set cooldown for errors)
            if (messageKey) {
                delete (window as any)[messageKey];
            }
        }
        // clean up event listener
        window.removeEventListener('killArtifactRequest', handleStopGenerationEvent);

        setTimeout(() => {
            const event = new CustomEvent( 'triggerChatReRender' );
            window.dispatchEvent(event);
        }, 300)
        
    }
}

    // Determine if still generating (no end-state yet)
    const statusIsEnd = message.data?.artifactStatus &&
        isInEndState(message.data.artifactStatus as ArtifactMessageStatus);
    const generating = !statusIsEnd;

    return (
        <DirectArtifactCard
            message={message}
            generating={generating}
        />
    );
};

/* ─── Module-level panel-open tracker (same pattern as ArtifactInlineCardLayer) */
let _autoArtifactPanelOpen = false;
if (typeof window !== 'undefined') {
    window.addEventListener('openArtifactsTrigger', (e: Event) => {
        _autoArtifactPanelOpen = !!((e as CustomEvent).detail?.isOpen);
    });
}

/* Type icon lookup */
function typeIcon(type: string | undefined): React.ReactNode {
    switch (resolveNUIType(type)) {
        case 'spreadsheet': return <IconTable size={18} style={{ color: 'var(--accent)' }} />;
        case 'code':        return <IconCode  size={18} style={{ color: 'var(--accent)' }} />;
        case 'visualization': return <IconChartBar size={18} style={{ color: 'var(--accent)' }} />;
        default:            return <IconFileText size={18} style={{ color: 'var(--accent)' }} />;
    }
}
function typeLabel(type: string | undefined, language?: string): string {
    switch (resolveNUIType(type)) {
        case 'spreadsheet': return 'Spreadsheet';
        case 'code': {
            const lang = language || (type && type !== 'code' ? type : '');
            return lang ? `Code · ${lang.charAt(0).toUpperCase()}${lang.slice(1)}` : 'Code';
        }
        case 'visualization': return 'Visualization';
        default: return 'Document';
    }
}

/* ─── DirectArtifactCard — renders inline without DOM-layer portal tricks ───── */
interface DirectCardProps {
    message: Message;
    generating: boolean;
}

const DirectArtifactCard: React.FC<DirectCardProps> = ({ message, generating }) => {
    const {
        state: { selectedConversation, selectedArtifacts, artifactIsStreaming },
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const [isPanelOpen, setIsPanelOpen] = useState(() => _autoArtifactPanelOpen);

    useEffect(() => {
        const handler = (e: Event) => {
            setIsPanelOpen(!!((e as CustomEvent).detail?.isOpen));
        };
        window.addEventListener('openArtifactsTrigger', handler);
        return () => window.removeEventListener('openArtifactsTrigger', handler);
    }, []);

    /* ── Artifact data lookup ── */
    const findArtifact = (): { artifact: Artifact; list: Artifact[]; idx: number } | null => {
        // Primary: message.data.artifacts → conversation.artifacts[id]
        const detail: ArtifactBlockDetail | undefined = message.data?.artifacts?.[0];
        if (detail?.artifactId && selectedConversation?.artifacts) {
            const list: Artifact[] | undefined = (selectedConversation.artifacts as any)[detail.artifactId];
            if (list && list.length > 0) {
                let idx = list.length - 1;
                if (detail.version) {
                    const found = list.findIndex((a: Artifact) => a.version === detail.version);
                    if (found !== -1) idx = found;
                }
                return { artifact: list[idx], list, idx };
            }
        }
        // Live streaming: fall back to selectedArtifacts
        if (artifactIsStreaming && selectedArtifacts && selectedArtifacts.length > 0) {
            const idx = selectedArtifacts.length - 1;
            return { artifact: selectedArtifacts[idx], list: selectedArtifacts, idx };
        }
        // Recovery: conversation has exactly one artifact family — link it
        if (selectedConversation?.artifacts) {
            const ids = Object.keys(selectedConversation.artifacts as Record<string, Artifact[]>);
            if (ids.length === 1) {
                const list = (selectedConversation.artifacts as any)[ids[0]] as Artifact[];
                if (list && list.length > 0) {
                    return { artifact: list[list.length - 1], list, idx: list.length - 1 };
                }
            }
        }
        return null;
    };

    const data = findArtifact();
    const artifact = data?.artifact ?? null;
    const stopped = message.data?.artifactStatus === ArtifactMessageStatus.STOPPED;
    const cancelled = message.data?.artifactStatus === ArtifactMessageStatus.CANCELLED;
    const isGeneratingNow = !stopped && !cancelled && (generating || (artifactIsStreaming && !artifact));

    const handleTogglePanel = () => {
        if (isPanelOpen) {
            window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false } }));
        } else if (data) {
            homeDispatch({ field: 'selectedArtifacts', value: data.list });
            window.dispatchEvent(new CustomEvent('openArtifactsTrigger', {
                detail: { isOpen: true, artifactIndex: data.idx },
            }));
        }
    };

    /* ── Unavailable state for cancelled/missing artifacts ── */
    const isCancelled = cancelled || stopped;
    if (!isGeneratingNow && !artifact && (isCancelled || !generating)) {
        return (
            <div
                data-nui-direct-artifact-card="unavailable"
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 14px', borderRadius: 10, maxWidth: 420,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-raised)',
                    color: 'var(--text-muted)', fontSize: 13,
                    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                    margin: '6px 0',
                }}
            >
                <IconFileText size={16} style={{ flexShrink: 0 }} />
                <span>{stopped ? 'Artifact generation stopped' : 'Artifact unavailable'}</span>
            </div>
        );
    }

    const displayTitle  = artifact?.name || (isGeneratingNow ? 'Creating artifact…' : 'Artifact');
    const displayType   = isGeneratingNow ? 'Writing…' : typeLabel(artifact?.type, artifact?.metadata?.language as string);
    const version       = artifact?.version;
    const showVersion   = !isGeneratingNow && typeof version === 'number' && version > 1;

    return (
        <div
            data-nui-direct-artifact-card="true"
            role="region"
            aria-label={isGeneratingNow ? 'Generating artifact' : `Artifact: ${displayTitle}`}
            style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 12, maxWidth: 480,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-raised)',
                margin: '6px 0', position: 'relative', overflow: 'hidden',
                fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            }}
        >
            {/* Shimmer during generation */}
            {isGeneratingNow && (
                <div aria-hidden="true" style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent) 8%, transparent) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'nui-artifact-shimmer 1.6s ease infinite',
                }} />
            )}
            {/* Icon */}
            <div aria-hidden="true" style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: isGeneratingNow ? 'color-mix(in srgb, var(--accent) 14%, var(--bg-active))' : 'var(--bg-active)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {isGeneratingNow ? (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                        style={{ animation: 'spin 0.9s linear infinite' }} aria-hidden="true">
                        <circle cx="9" cy="9" r="7" stroke="var(--accent)" strokeWidth="2"
                            strokeLinecap="round" strokeDasharray="28 16" />
                    </svg>
                ) : typeIcon(artifact?.type)}
            </div>
            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {displayTitle}
                </div>
                <div style={{
                    fontSize: 12, color: 'var(--text-muted)', marginTop: 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    <span>{displayType}</span>
                    {showVersion && (
                        <span style={{
                            background: 'var(--bg-active)', borderRadius: 4,
                            padding: '0 5px', fontSize: 11, color: 'var(--text-secondary)',
                        }}>v{version}</span>
                    )}
                </div>
            </div>
            {/* Open / Hide */}
            {!isGeneratingNow && (
                <button
                    type="button"
                    aria-label={isPanelOpen ? 'Hide artifact panel' : 'Open artifact panel'}
                    onClick={handleTogglePanel}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '0 10px', height: 28, borderRadius: 7,
                        border: '1px solid var(--border-subtle)',
                        background: 'transparent', color: 'var(--text-primary)',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                        transition: 'background 0.12s',
                        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                    {isPanelOpen ? <IconEyeOff size={13} aria-hidden="true" /> : <IconEye size={13} aria-hidden="true" />}
                    {isPanelOpen ? 'Hide' : 'Open'}
                </button>
            )}
        </div>
    );
};

export default AutoArtifactsBlock;
