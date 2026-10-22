import React, {useContext, useEffect, useRef, useState} from "react";
import HomeContext from "@/components/Home/home.context";
import {Conversation, Message, newMessage} from "@/types/chat";
import {deepMerge} from "@/utils/app/state";
import { MetaHandler, sendChatRequestWithDocuments } from "@/services/chatService";
import { IconHammer, IconFileText, IconTable, IconCode, IconChartBar, IconEye, IconEyeOff, IconAlertTriangle } from "@tabler/icons-react";
import { Artifact, ArtifactBlockDetail, ArtifactMessageStatus, validArtifactTypes, resolveNUIType, sniffContentType } from "@/types/artifacts";
import { lzwCompress, lzwUncompress } from "@/utils/app/lzwCompression";
import { getDateName } from "@/utils/app/date";
import { fixJsonString } from "@/utils/app/errorHandling";
import { DefaultModels, Model } from "@/types/model";
import { saveArtifact, getAllArtifacts } from "@/services/artifactsService";
import { jsonrepair } from "jsonrepair";
import { v4 as uuidv4 } from "uuid";
import { buildArtifactSavePayload, resolveArtifactName } from "@/components/NewUI/shared/artifactLibraryModel";
import { buildArtifactContentMap, pickBaseVersion } from "@/components/NewUI/shared/artifactContentMap";
import { appendAutoArtifactChunk, mergeAutoArtifactMessage } from "@/components/NewUI/shared/autoArtifactStream";

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
    const selectedConversationRef = useRef(selectedConversation);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);
    selectedConversationRef.current = selectedConversation;

    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

// The per-type artifact rules (CSV / code / visualization / document) are added by the backend's
// ArtifactModeAssistant. They contain literal HTML/SVG, which the WAF in front of the app rejects as XSS
// (403) when it is sent from the browser, so this request carries only a short, markup-free system prompt.
const ARTIFACT_SYSTEM_PROMPT = 'You are generating the content of an artifact.';

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
            const updatedConversation = mergeAutoArtifactMessage(selectedConversation, message.id, {
                artifactStatus: ArtifactMessageStatus.CANCELLED,
            });
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
    return [ArtifactMessageStatus.STOPPED, ArtifactMessageStatus.CANCELLED, ArtifactMessageStatus.COMPLETE, ArtifactMessageStatus.INCOMPLETE].includes(status);
}

useEffect(() => {
    if (isInEndState(message.data.artifactStatus)) {
        llmPromptedRef.current = false;
    }
    
}, [message.data]);


// Continue a cut-off artifact from the text that was already saved, instead of regenerating it.
const resumeArtifactRef = useRef<() => void>(() => {});
resumeArtifactRef.current = () => {
    const resume = (message.data as any)?.artifactResume as {prompt: string; type: string} | undefined;
    const detail: ArtifactBlockDetail | undefined = message.data?.artifacts?.[0];
    if (!resume || !detail || artifactIsStreaming || messageIsStreaming) return;

    const messageKey = `processing-msg-${message.id}`;
    const cooldownKey = `cooldown-msg-${message.id}`;
    if ((window as any)[messageKey]) return;

    const versions = selectedConversation?.artifacts?.[detail.artifactId];
    const latest = versions && versions.length > 0 ? versions[versions.length - 1] : undefined;
    const partialText = latest ? lzwUncompress(latest.contents as any) : '';

    (window as any)[messageKey] = true;
    message.data.artifactStatus = ArtifactMessageStatus.RUNNING;
    homeDispatch({field: 'messageIsStreaming', value: true});
    homeDispatch({field: 'artifactIsStreaming', value: true});
    getArtifactMessages(resume.prompt, {...detail}, resume.type, messageKey, cooldownKey, partialText);
};

useEffect(() => {
    const handler = (e: Event) => {
        if ((e as CustomEvent).detail?.messageId === message.id) resumeArtifactRef.current();
    };
    window.addEventListener('continueArtifactRequest', handler);
    return () => window.removeEventListener('continueArtifactRequest', handler);
}, [message.id]);

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
                const contentMap = buildArtifactContentMap(content);

                if (Object.keys(contentMap).length > 0){
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




const getArtifactMessages = async (llmInstructions: string, artifactDetail: ArtifactBlockDetail, type: string = '', messageKey?: string, cooldownKey?: string, resumeText?: string) => {
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

        // Needed by the catch below, which runs outside the try's scope.
        let pendingList: Artifact[] | undefined;      // the list a placeholder artifact was pushed to
        let pendingArtifact: Artifact | undefined;    // that placeholder (undefined when resuming an existing one)
        let isResuming = false;
        let streamingStarted = false;                 // once true, the streaming finally{} owns cleanup

        try {
            // setup selectedArtifacts
            let selectArtifacts = selectedConversation.artifacts ? (selectedConversation.artifacts[artifactDetail.artifactId] ?? []) : [];
            // Resuming a cut-off artifact extends its latest version instead of adding a new one.
            const resuming = !!resumeText && selectArtifacts.length > 0;
            const artifactVersion = resuming
                ? selectArtifacts.slice(-1)[0].version
                : (selectArtifacts.length === 0 ? 1 : selectArtifacts.slice(-1)[0].version + 1);
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
            // `~A#` references in the model's output are expanded from this map, which is only filled in when the
            // request is first prepared. A retry/continue after a page reload skips that, and an empty map would
            // silently drop every referenced part, so rebuild it from the version this one builds on.
            if (Object.keys(versionContentMapRef.current ?? {}).length === 0) {
                const base = pickBaseVersion(selectArtifacts, resuming);
                if (base) versionContentMapRef.current = buildArtifactContentMap(lzwUncompress(base.contents as any));
            }
            if (!resuming) selectArtifacts.push(artifact);
            pendingList = selectArtifacts;
            pendingArtifact = resuming ? undefined : artifact;
            isResuming = resuming;
            homeDispatch({field: "selectedArtifacts", value: selectArtifacts});
            const model: Model = selectedConversation.model ?? getDefaultModel(DefaultModels.ADVANCED);
            const chatBody = {
            model: model,
            messages: [{role: 'user', content: llmInstructions} as Message],
            prompt: ARTIFACT_SYSTEM_PROMPT,
            temperature: 0.5,
            maxTokens: model.outputTokenLimit, // Default to max token
            skipRag: true,
            skipCodeInterpreter: true,
            artifactsMode: true,
            ...(resuming ? {continueFrom: resumeText} : {}),
            requestId: requestId,
            accountId: defaultAccount?.id,
            rateLimit: defaultAccount?.rateLimit
            };

            statsService.sendChatEvent(chatBody);

            window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: true, artifactIndex:  selectArtifacts.length - 1}} ));

            const response = await sendChatRequestWithDocuments(chatEndpoint || null, chatBody, controller.signal, metaHandler);
            // sendChatRequestWithDocuments returns the error text as a non-OK response instead of throwing.
            // Without this check that text would be read below as if it were the artifact itself.
            if (!response.ok) throw new Error((await response.text()).trim() || `Artifact request failed (${response.status}).`);

            let updatedConversation: Conversation = {...selectedConversation, artifacts: selectedConversation.artifacts || {}};
            const messageId = message.id;
            const messageLen = selectedConversation.messages?.findIndex(candidate => candidate.id === messageId) ?? -1;
            if (messageLen < 0) throw new Error('Artifact source message is no longer in the selected conversation');
            if (!response.body) throw new Error('Artifact generation returned an empty response stream');
            const responseData = response.body;
            const reader = responseData?.getReader();
            const decoder = new TextDecoder();
            let text = selectedConversation.messages[messageLen].content + '\n\n';
            let artifactText = resuming ? (resumeText as string) : '';

            const placeholderRegex = /\~A(\d+)/g;
            let isAssistantMsg = false;
            let buffer = '';
            let unresolvedPlaceholder = '';
            streamingStarted = true;
            try {
                while (!controller.signal.aborted) {
                    const {value, done} = await reader.read();
                    if (value) buffer += decoder.decode(value, { stream: !done });
                    else if (done) buffer += decoder.decode();

                    if (buffer.length > 0 || done) {
                        // replace tag references with content:
                        if (versionContentMapRef.current && (placeholderRegex.test(unresolvedPlaceholder + buffer) || unresolvedPlaceholder || /~A\d*$/.test(buffer))) {
                            const withCarry = unresolvedPlaceholder + buffer;
                            const completePlaceholders = done ? withCarry : withCarry.replace(/~A\d*$/, '');
                            unresolvedPlaceholder = withCarry.slice(completePlaceholders.length);
                            buffer = completePlaceholders.replace(placeholderRegex, (match) => {
                                const key = match.slice(1);
                                return key in versionContentMapRef.current
                                    ? `\n${versionContentMapRef.current[key]}\n`
                                    : '';
                            });
                        }
                    
                        const parsedChunk = appendAutoArtifactChunk(buffer, '', isAssistantMsg, done);
                        buffer = parsedChunk.buffer;
                        isAssistantMsg = parsedChunk.inAssistantText;
                        artifactText += parsedChunk.artifactText;
                        text += parsedChunk.assistantText;
                        if (parsedChunk.artifactText || done) {
                            selectArtifacts[selectArtifacts.length - 1].contents = lzwCompress(artifactText);
                            homeDispatch({field: 'selectedArtifacts', value: selectArtifacts});
                        }

                        const latestConversation = selectedConversationRef.current?.id === updatedConversation.id
                            ? selectedConversationRef.current
                            : updatedConversation;
                        updatedConversation = mergeAutoArtifactMessage({
                            ...latestConversation,
                            artifacts: updatedConversation.artifacts,
                        }, messageId, {
                            content: text,
                            state: currentState,
                        });
                        homeDispatch({ field: 'selectedConversation', value: updatedConversation });
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

                // The backend reports artifactCompletion: true only when the artifact finished.
                // A stream that ends without it (timeout, dropped connection, round limit) was cut off.
                const streamState = currentState as {artifactMode?: boolean; artifactCompletion?: boolean};
                const cutOff = streamState.artifactMode === true && streamState.artifactCompletion !== true;

                const rawContent = lzwUncompress(selectArtifacts[selectArtifacts.length - 1].contents as any);
                const unusableFallback = /no artifact was requested|please provide the (content|task|instructions)/i.test(rawContent.trim());
                if (!controller.signal.aborted && unusableFallback) {
                    updatedConversation = mergeAutoArtifactMessage(updatedConversation, messageId, {
                        artifactStatus: ArtifactMessageStatus.CANCELLED,
                    });
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

                // Update the source assistant message by stable ID; the conversation may
                // have gained another message while this artifact stream was in flight.
                const latestSelectedConversation = selectedConversationRef.current?.id === updatedConversation.id
                    ? { ...updatedConversation, ...selectedConversationRef.current }
                    : updatedConversation;
                updatedConversation = {
                    ...latestSelectedConversation,
                    artifacts: {
                        ...(latestSelectedConversation.artifacts ?? {}),
                        [artifact.artifactId]: selectArtifacts,
                    },
                };
                if (!controller.signal.aborted && !isAssistantMsg) {
                    const pendingText = unresolvedPlaceholder + buffer;
                    const parserFlush = appendAutoArtifactChunk('', pendingText, false, true);
                    artifactText += parserFlush.artifactText;
                    text += parserFlush.assistantText;
                    selectArtifacts[selectArtifacts.length - 1].contents = lzwCompress(artifactText);
                    updatedConversation = mergeAutoArtifactMessage(updatedConversation, messageId, { content: text });
                }
                updatedConversation = mergeAutoArtifactMessage(updatedConversation, messageId, {
                    artifactStatus: controller.signal.aborted
                        ? ArtifactMessageStatus.STOPPED
                        : (cutOff ? ArtifactMessageStatus.INCOMPLETE : ArtifactMessageStatus.COMPLETE),
                    ...(resuming ? {} : { artifactDetails: [artifactDetail] }),
                    ...(cutOff ? { artifactResume: { prompt: llmInstructions, type } } : {}),
                    artifactError: null,
                });

                handleUpdateSelectedConversation(updatedConversation);

                // ── Auto-save to server (fire-and-forget) so the artifact is
                //    immediately available in the library even without the user
                //    clicking "Save Artifact" manually.
                if (!controller.signal.aborted && !cutOff) {
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
            // The request failed before any artifact text streamed (e.g. blocked by the WAF, server error,
            // dropped connection). Nothing else will end the "Writing…" state, so end it here and say why.
            if (!streamingStarted && !controller.signal.aborted) {
                homeDispatch({field: 'messageIsStreaming', value: false});
                homeDispatch({field: 'artifactIsStreaming', value: false});
                llmPromptedRef.current = false;

                if (pendingArtifact && pendingList) {
                    const at = pendingList.indexOf(pendingArtifact);
                    if (at >= 0) pendingList.splice(at, 1);
                    homeDispatch({field: 'selectedArtifacts', value: [...pendingList]});
                    window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false } }));
                }

                const reason = (e instanceof Error && e.message ? e.message : 'Artifact generation failed.').slice(0, 500);
                const failedStatus = isResuming ? ArtifactMessageStatus.INCOMPLETE : ArtifactMessageStatus.CANCELLED;
                message.data = { ...(message.data || {}), artifactStatus: failedStatus, artifactError: reason };
                const latest = (selectedConversationRef.current?.id === selectedConversation.id
                    ? selectedConversationRef.current
                    : undefined) ?? selectedConversation;
                handleUpdateSelectedConversation(mergeAutoArtifactMessage(latest, message.id, {
                    artifactStatus: failedStatus,
                    artifactError: reason,
                    // Lets the card's Retry reuse the Continue machinery; an empty resume text starts a fresh run.
                    artifactResume: { prompt: llmInstructions, type },
                    ...(isResuming ? {} : { artifactDetails: [artifactDetail] }),
                }));
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
    const incomplete = message.data?.artifactStatus === ArtifactMessageStatus.INCOMPLETE;
    const canContinue = incomplete && !!message.data?.artifactResume && !artifactIsStreaming;
    // The artifact request itself failed (blocked, server error, dropped connection) — see getArtifactMessages' catch.
    const requestError: string | undefined = typeof message.data?.artifactError === 'string' ? message.data.artifactError : undefined;
    const requestFailed = cancelled && !!requestError;
    const canRetry = requestFailed && !!message.data?.artifactResume && !!message.data?.artifacts?.[0] && !artifactIsStreaming;
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

    /* ── The request failed: say so, and let the user try again ── */
    if (requestFailed) {
        return (
            <div
                data-nui-direct-artifact-card="error"
                role="alert"
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 12, maxWidth: 480,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-raised)',
                    margin: '6px 0',
                    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                }}
            >
                <IconAlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-error)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                        Couldn&apos;t create the artifact
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-error)', marginTop: 1, overflowWrap: 'anywhere' }}>
                        {requestError}
                    </div>
                </div>
                {canRetry && (
                    <button
                        type="button"
                        aria-label="Try creating the artifact again"
                        onClick={() => window.dispatchEvent(new CustomEvent('continueArtifactRequest', { detail: { messageId: message.id } }))}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '0 10px', height: 28, borderRadius: 7,
                            border: '1px solid var(--accent)',
                            background: 'transparent', color: 'var(--accent)',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                        }}
                    >
                        Try again
                    </button>
                )}
            </div>
        );
    }

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
    const displayType   = isGeneratingNow ? 'Writing…' : incomplete ? (requestError ? 'Couldn\u2019t continue \u2014 try again' : 'Cut off before finishing') : typeLabel(artifact?.type, artifact?.metadata?.language as string);
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
            {/* Continue a cut-off artifact */}
            {canContinue && (
                <button
                    type="button"
                    aria-label="Continue generating the cut-off artifact"
                    onClick={() => window.dispatchEvent(new CustomEvent('continueArtifactRequest', { detail: { messageId: message.id } }))}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '0 10px', height: 28, borderRadius: 7,
                        border: '1px solid var(--accent)',
                        background: 'transparent', color: 'var(--accent)',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                    }}
                >
                    Continue
                </button>
            )}
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
