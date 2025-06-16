import {  Conversation, Message } from "@/types/chat";
import {getSession} from "next-auth/react"
import { sendChatRequestWithDocuments } from "./chatService";
import { Artifact, ArtifactBlockDetail } from "@/types/artifacts";
import { messageTopicData, messageTopicDataPast } from "@/types/topics";
import { lzwUncompress } from "@/utils/app/lzwCompression";
import cloneDeep from 'lodash/cloneDeep';
import { Model } from "@/types/model";
import { ARTIFACT_TRIGGER_CONDITIONS } from "@/utils/app/const";
import { Account } from "@/types/accounts";
import { scrubMessages } from "@/utils/app/messages";


const DIVIDER_CUSTOM_INSTRUCTIONS = `
            There are several tasks for you to complete, you must response to each task with the cooresponding required Response Instructions format. As a prereq to starting the tasks you must fist understand the 'Given Data':
            Expect Data 1 - Collected Topic Data:
            { "PreviousTopics": 
                [ { 
                "range": "<start number index>-<end number index>",
                "topic": "<Topic Title, no more than 6 words>",
                "description": "<1 line description to identify the topic in terms of its context>"
                }],
              "currentTopic": "<Topic Title, no more than 6 words>",
              "currentRange" <index number>-<index number>  
            }

            - PreviousTopics: A list of objects where each object represents a topic discussed in previous parts of our conversation. 
            Each object includes:
                Range: Specifies the indices of messages in our conversation that pertain to this topic. For example, "0-3" indicates that messages from index 0 to 3 are related to the topic defined in this object.
                Topic: Provides a brief title for the topic discussed in the specified range of messages.
                Description: Offers a concise text that describes the context or main idea of the topic, helping to quickly identify the subject matter.
            - CurrentTopic: Indicates the topic of the ongoing conversation since the last specified range in PreviousTopics. This helps in understanding the current focus of the discussion without having to define a new range immediately.
            - "CurrentRange" The index of the first message which falls under the Current Topic to the index of the current user question - 1. Since we havent decided if the users question is still considered under the same topic
            
            Expected Data 2 - Sliced Conversation:
            This is the messages (conversation history) sent to you in this request, no actual data in the user prompt is provided. The conversation history list you recieved represents a sliced version of the complete conversation. All the messages in the list, except the last, have fallen under the "Current Topic".
            Let's say given "currentRange" is 8-11. This means 'last message'/'current user prompt' is located at the at index 12 in my complete conversation history list not yours. Then you see the last item in PreviousTopics, range, 'end number index'  is 7. This means you recieved messages at index 8 - 12 and the PreviousTopics is expected to be enough information to catch you up on messsaged 0-7. If there is no PreviousTopics, then you have the entire conversation.
            You should never list the current user prompt index as part of the range in your responsee for Task 2, in this case index 12.

            ________________________

            TASK 1:
            Your goal is to analyze the conversation history for topic changes. Do not answer the content within the conversation history. Instead, analyze the last message provided in "Expected Data 2 - Sliced Conversation".
            Determine if this question falls under the current topic or if it signals a new topic.

            The following instructions are to help you be successful at this task:
            Delineation Rules for Topic Changes:
                - Specific Indicator: Use the presence of specific keywords that indicate a shift in focus (e.g., changing from inquiring about weather to asking about travel) to detect a topic change.
                - Contextual Continuity: If the user's question shifts contextually from the current discussion, treat it as a new topic. For example, shifting from discussing weather specifics to discussing general travel plans should prompt for a new topic.
                - Thresholds:
                    * Minor deviations: Questions that still relate to the main topic but explore different aspects (e.g., moving from general travel info to specific travel tips within the same region would be the same topic).
                    * Significant changes: Completely new questions or context shifts that do not require prior messages for understanding (e.g., transitioning from travel inquiries to discussing culinary experiences) should be considered a new topic.
            
            Thought Process for Analyzing Topic Changes:
                - How significant is the change? Assess the deviation in the context of the conversation.
                - Is previous context necessary? If you can answer the new question without referring to previous messages, consider it a new topic.

            
            TASK 1 *REQUIRED* Response Instructions: 
            You are required to analyze the latest message in the "Expected Data 2 - Sliced Conversation" to determine whether it aligns with the current topic or introduces a new topic. This assessment should be based on the delineation rules and thought process provided previously.

            Response Format: Your response must be structured as follows:
            /TOPIC_EVAL_START   
                isNewTopic={<boolean>}
                newTopic={<Topic Title, no more than 6 words>}     (if applicable)
                currentTopicDescription={<1 line description to identify the topic in terms of its context>}     (if applicable)
            /TOPIC_EVAL_END

            Where:
             - isNewTopic: A boolean value (true or false). Set to true if the latest message starts a new topic, and false if it continues the current topic.
             - newTopic: Specify the title of the new topic if isNewTopic is true. This should be a concise title of no more than 6 words.
             - currentTopicDescription: Provide a 1-3 line description of the conversation history you recieved, specifically those messages that fall under "Current Topic", helping to clarify the context or main idea. Applicable only if isNewTopic is true. If current topic is 'NO CURRENT TOPIC' then omit currentTopicDescription

            Example Valid Responses:

            Example 1 (Introducing a New Topic):

            /TOPIC_EVAL_START   
                isNewTopic={true}
                newTopic={new topic title}    
                currentTopicDescription={this is a description of the messages that were under 'current topic'}
            /TOPIC_EVAL_END

            Example 2 (Current Topic still applies):

            /TOPIC_EVAL_START   
                isNewTopic={false}
            /TOPIC_EVAL_END
            _______________________________

            TASK 2:

            you are tasked with determining which sections of the conversation remain relevant given the current context. This involves a thoughtful review of both the outcome from Task 1 and the provided "Collected Topic Data" to assess relevance based on the current topic of discussion—whether it be the ongoing "CurrentTopic" or a newly identified topic from Task 1.

            Objective: Identify and specify the ranges of past conversation messages that are still relevant to the current user message and the current topic of discussion.

            Steps to Follow:

                - Review the Outcome of Task 1: Determine the current topic, either continuing the previous or newly identified.
                - Analyze 'Collected Topic Data': Evaluate the titles and descriptions of previous topics to decide if knowledge from those messages could benefit the current discussion.
                - Determine Relevance: Decide which message ranges are relevant by considering their content's applicability to the current topic.
                - Provide the range as captured in the PreviousTopics objects. If the current topic is applicable to the conversation then add the range from the 'currentRange' attribute.
                - Think step by step. Here should be your thought pattern:
                    1. Analyze ranges in each item of the PreviousTopics lists. Look at currentRange.
                    2. Determine which of those ranges are relevant. You MUST only include ranges that had descriptions that are relevant to the topic determined in task 1.
                    3. Ensure you have the correct response format.
                - Ranges come straight from the Expected Data that was given to you.
            
            Relevance Criteria: A past message is considered relevant if:

            It contains foundational information that contributes to a fuller understanding of the current topic.
            It provides context or background that enhances the current discussion.
            It directly relates to the current user query or topic at hand.

            TASK 2 *REQUIRED* Response Instructions: 
            
            Response Format: Once relevance is determined, format your response as follows:

            /INCLUDE_MESSAGES_START
                ranges={specified ranges of relevant messages separated by commas}
            /INCLUDE_MESSAGES_END

            Example Valid Responses:

            Example 1 (Blending Topics from Academic Advice to Specific Majors):

            Let's say I talk about a university, discussing details like its acceptance rate, location, and programs offered for messages 0-6. Then I ask for advice on study habits and balancing coursework, shifting the focus to personal academic strategies - this new topic is about study techniques for messages 7-11. Now I decide to blend these topics by asking how certain majors might influence my study habits or workload for messages found in range currentRange.
            This means all messages are deemed important.

            Context: Discussion transitions from general university information to study techniques and then to how specific majors might affect study habits.
            Relevance Determination: Messages discussing university details and study techniques are both relevant to the new question about majors and study habits.

            Your Response to Example 1:
            /INCLUDE_MESSAGES_START   
                ranges={ALL}
            /INCLUDE_MESSAGES_END


            note: if the current topic is NO CURRENT TOPIC, then you MUST respond with the Ranges as {ALL}.
            

            Example 2 (Selection of ranges):
            Following the Think step by step:
                1. Looking at the ranges in each item of the PreviousTopics lists and other data. Lets say the ranges are 0-3, 4-7, 8-11, 12-18   and  currentRange=19-21
                2. Determining which of those ranges are relevant. Lets say the relevant ranges are 0-3, 12-18, and the Current Topic is relevant as well.
                3. Gather the ranges straight from the Given Data and the currentRange since, we deemed the Current Topic messages are important.

            Your Response to Example 2:

            /INCLUDE_MESSAGES_START   
                ranges={0-3, 12-18, 19-21}
            /INCLUDE_MESSAGES_END


            Example 3 (New Topic with no PreviousTopics data):
            Based on the decision of Task 1, you will decide to include or omit the currentRange. 
                - The topic is new and the Current Topic is NOT relevant. Your Response:
                    /INCLUDE_MESSAGES_START   
                        ranges={}
                    /INCLUDE_MESSAGES_END
                - The topic is new and the Current Topic is relevant. The currentRange is 3-11. Your Response:
                    /INCLUDE_MESSAGES_START   
                            ranges={3-11}
                    /INCLUDE_MESSAGES_END
                - The topic is NOT new then obviously the Current Topic is relevant. Your Response:
                    /INCLUDE_MESSAGES_START   
                            ranges={ALL}
                    /INCLUDE_MESSAGES_END

            Guidelines for Evaluation:
            Consider how the information in previous messages can enhance or clarify the current topic.
            Assess the continuity and flow of the discussion to ensure that the selected messages provide a cohesive and comprehensive understanding of the topic.
            Use the context provided by both the outcome of Task 1 and the "Collected Topic Data" to make informed decisions about relevance.

            For Task 1 and 2 respond with ONLY the /TOPIC_EVAL and /INCLUDE_MESSAGES data. You MUST include both responses.
`;

const ARTIFACT_CUSTOM_INSTRUCTIONS = `
            Expected Data 3 - List of Artifact Defitions:
            [ <Artifact Definitions - objects separated by commas> ]

            Artifact Definition: Each artifact is defined with the following attributes:
            {
            "id": "<unique identifier>",
            "description": "<brief description of the artifact>",
            "type": "<type of the artifact>",
            "messageIndex": <index indicating when the artifact was introduced in the conversation>
            }

            Task 3 Instructions:
            This task involves assessing the relevance of predefined artifacts within the context of the ongoing conversation. These artifacts, which vary in type and content, are linked to specific messages within the conversation timeline, allowing for a contextual understanding of their significance based on the current topic and relevant message ranges identified in earlier tasks.

            Objective: Determine whether each artifact should be considered relevant to the current conversation. Relevance will be assessed based on the artifact's content, type, and its introduction in relation to the current focus of the conversation.

            Steps to Follow:

                - Review Artifacts: Examine each artifact's description, type, and the message index to understand its initial context.
                - Refer to Task Outcomes: Use the results from Tasks 1 and 2 to ascertain which parts of the conversation are still relevant.
                - Evaluate Artifact Relevance: Decide if the artifact's content supports, enhances, or is essential to the current discussion based on its initial context and the ongoing conversation's focus.
            
            Relevance Criteria: An artifact is deemed relevant if:
                - It supports or adds significant context or background information to the current topic and final user message.
                - It is closely related to the message ranges identified as relevant in Task 2.
                - The type of artifact directly contributes to a better understanding or resolution of the current user query (final usermessage).
            
            
            TASK 3 *REQUIRED* Response Format: After evaluating the artifacts, format your response as follows:

            /ARTIFACT_RELEVANCE_START
                artifactIds={<list of relevant unique artifact identifiers>}
            /ARTIFACT_RELEVANCE_END
            
            Guidelines for Evaluation:
            Analyze the impact of each artifact on the conversation's current trajectory.
            Consider both the artifact's content and the timing of its introduction relative to the current focus areas identified in Task 2.
            Ensure that the relevance assessment is aligned with the overarching goals and flow of the conversation.
            If the user prompt is reffering to any past artifact in any form then assume it is relevant and should be included

            For Task 3 Respond with ONLY the /ARTIFACT_RELEVANCE data
`;

const SMART_INCLUDE_ARTIFACT_INSTRUCTIONS = (prompt: string) => `
    Task 4 Instructions:
    Determine if we should include the artifact instructions based on the current user prompt.
    
    Artifact Trigger Conditions:
    ${ARTIFACT_TRIGGER_CONDITIONS}

    Guidelines:
    - Evaluate User Input to determine if it matches the artifact trigger conditions based on keywords such as "outline," "full project," "detailed analysis," or "extensive documentation."
    - Consider the likelihood of the user wanting to create an artifact based on the request. Anything above 40% likelihood should be included.
    - If you are unsure then respond with true.
    
    User Prompt: 
    ${prompt}

    Response Format:
    /INCLUDE_ARTIFACT_INSTRUCTIONS_START
        includeInstructions={<boolean(true or false)>}
    /INCLUDE_ARTIFACT_INSTRUCTIONS_END  
`;


export const getFocusedMessages = async (chatEndpoint:string, conversation:Conversation, statsService: any, 
                                         isArtifactsOn: boolean, isSmartMessagesOn: boolean, 
                                         homeDispatch:any, advancedModel: Model, cheapestModel: Model, account: Account | undefined) => {
    const defaultResponse = () => ({focusedMessages: conversation.messages, includeArtifactInstr: isArtifactsOn});
    if (!isArtifactsOn && !isSmartMessagesOn)  return defaultResponse();
    
    const controller = new AbortController();
    
    const accessToken = await getSession().then((session) => { 
                                // @ts-ignore
                                return session.accessToken
                            })
    let customInstructions = isSmartMessagesOn ? DIVIDER_CUSTOM_INSTRUCTIONS : "";

    const topicData = gatherDataForPrompt(cloneDeep(conversation), isSmartMessagesOn, isArtifactsOn);
    const messageTopicDataOnly = scrubMessages(topicData.messages)
    // only if we artifacts defined will we include the instructions 
    if (topicData.artifactLen > 0) customInstructions +=  ARTIFACT_CUSTOM_INSTRUCTIONS;

    if (isArtifactsOn) {
        // determine if we should include the artifact instructions based on the last message
        const lastMsg = conversation.messages.slice(-1)[0];
        customInstructions += SMART_INCLUDE_ARTIFACT_INSTRUCTIONS(lastMsg.content);
    } 

    // if no artifacts in conversation or smart messages turned on then we can return 
    if (!customInstructions) return defaultResponse();

    try {
        const chatBody = {
            model: isSmartMessagesOn ? advancedModel : cheapestModel, 
            messages: messageTopicDataOnly,
            key: accessToken,
            prompt: customInstructions,
            temperature: 0.8,
            maxTokens: 2000,
            skipRag: true,
            skipCodeInterpreter: true,
            accountId: account?.id,
            rateLimit: account?.rateLimit
        };

        
        statsService.sendChatEvent(chatBody);

        const response = await sendChatRequestWithDocuments(chatEndpoint, accessToken, chatBody, controller.signal);

        const responseData = response.body;
        const reader = responseData ? responseData.getReader() : null;
        const decoder = new TextDecoder();
        let done = false;
        let text = '';
        try {
            while (!done) {
        
                // @ts-ignore
                const {value, done: doneReading} = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value);
        
                if (done) break;
        
                text += chunkValue;
            }
            return focusMessages(cloneDeep(conversation), text, topicData.currentTopic, topicData.currentTopicStart, topicData.artifactMap, homeDispatch);
        } finally {
            if (reader) {
                await reader.cancel(); 
                reader.releaseLock();
            }
        }

    } catch (e) {
        console.error("Error prompting for focused Conversation Messages: ", e);
        // think about adding artifact descriptions and ids in case of failure. 
    }   
    return defaultResponse();
    
}


const focusMessages = (selectedConversation: Conversation, llmResponse: string, currentTopic: string, currentTopicStart:number, artifactMap: { [key: string]: number[] }, homeDispatch:any) => {

    const extractMarkers = ["/TOPIC_EVAL", "/INCLUDE_MESSAGES", "/ARTIFACT_RELEVANCE", "/INCLUDE_ARTIFACT_INSTRUCTIONS"];

    const tasks = extractMarkers.map((marker) => 
        extractResponseContent(cloneDeep(llmResponse), marker + '_START', marker + '_END')
    );
    const msgLenIdx = selectedConversation.messages.length - 1;
     // You may not need to call parseTask1Response if you do not use its output directly in this function.
    const messageTopicData = parseResponseForMessageData(tasks[0], currentTopic, currentTopicStart, msgLenIdx);
    // update conversation with message data
    if (messageTopicData) {
        const updatedMessages = selectedConversation.messages;
        // add to assistant message data
        if (messageTopicData.pastTopic && msgLenIdx > 0) updatedMessages[msgLenIdx - 1].topicData = {pastTopic: messageTopicData.pastTopic};
        // add to current user message data
        if (messageTopicData.currentTopic) updatedMessages[msgLenIdx].topicData = {currentTopic: messageTopicData.currentTopic};
        homeDispatch({field: 'selectedConversation', value: {...selectedConversation, messages: updatedMessages}});

    }

    const focusedMessages = relevantMessages(tasks[1], cloneDeep(selectedConversation.messages));
    const lastMsgIndex = focusedMessages.length - 1;
    // get relevant artifacts
    const relevantArtifacts = relevantArtifactContent(tasks[2], artifactMap);
    focusedMessages[lastMsgIndex].content += relevantArtifacts;

    const includeArtifactInstr = extractIncludeArtifactInstructions(tasks[3]);

    return {focusedMessages: focusedMessages as Message[], includeArtifactInstr: includeArtifactInstr}; 
    
}




// wont ever get here with only 1 message since prepareChatService isnt called unles messages is > 1
const gatherTopicData = (conversation: Conversation) => {
    let currentTopic: string = '';
    let currentTopicStart = 0;
    const previousTopics:messageTopicDataPast[] = [];


    for (let i = conversation.messages.length - 2; i >= 0; i--) {
        const msg = conversation.messages[i];
        const msgTopicData = msg.topicData;
        if ( msgTopicData ) {
            if (msgTopicData.pastTopic) previousTopics.unshift( msgTopicData.pastTopic );
            if (!currentTopic && msgTopicData.currentTopic) {
                currentTopic = msgTopicData.currentTopic;
                currentTopicStart = i;
            }
        } 
    }                                               //id no version number

    const slicedMessages = conversation.messages.slice(currentTopicStart);
    const curIdx = conversation.messages.length - 1;
    const expectedData = { previousTopics: previousTopics,
                           currentTopic: currentTopic ? currentTopic : "NO CURRENT TOPIC" ,
                           currentRange: `${currentTopicStart}-${curIdx === 0 ? 0 : curIdx - 1}`}

    const messageData = `
         Collected Topic Data:
        ${JSON.stringify(expectedData)}}
    `

    return { slicedMessages: slicedMessages, topicMessageData: messageData,
           currentTopic: currentTopic, currentTopicStart: currentTopicStart };
}

const gatherArtifactData = (conversation: Conversation) => {
    const artifacts:any = [];
    let artifactMap:{ [key: string]: number[] }  = {};
    let artifactIndexes:{ [key: string]: number }  = {};


    for (let i = conversation.messages.length - 2; i >= 0; i--) {
        const msg = conversation.messages[i];
        if (msg.data.artifacts) {
            msg.data.artifacts.forEach((a:ArtifactBlockDetail) => {
                // so we know it is the most recent version since we are starting from the most recent messages
                if (!Object.keys(artifactIndexes).includes(a.artifactId)) {
                    artifactIndexes[a.artifactId] = i;
                }
            })
        }
    }                                               //id no version number
    Object.keys(conversation.artifacts || {}).map((id : string) => {
        const artifact:Artifact | undefined = conversation.artifacts && conversation.artifacts[id].slice(-1)[0]; // latests version
                                
        if (artifact) {     
            artifacts.push({id: id, name: artifact.name, description: artifact.description, type: artifact.type, messageIndex: artifactIndexes[id]});
            artifactMap[id] = artifact?.contents || [];  
        }
    })

    const messageData = `
        ${artifacts.length > 0 ? `
        List of Artifact Defitions:
        ${JSON.stringify(artifacts)}` 
        :  "" }
    `
    return {artifactMessageData: messageData, artifactLen: artifacts.length, 
            artifactMap: artifactMap};
}



const gatherDataForPrompt = (conversation: Conversation, isSmartMessagesOn: boolean, isArtifactsOn: boolean) => {
    let messages = conversation.messages;
    const lastMsgIndex = messages.length - 1;
    const lastIdxContent = messages[lastMsgIndex].content;

    let updatedMessageContent = `
        USERS CURRENT PROMPT:
        ${lastIdxContent}
        \n___________________________\n
    `

    let curTopic = '';
    let curTopicStart = 0;
    if (isSmartMessagesOn) {
        const {slicedMessages, topicMessageData, currentTopic, currentTopicStart} = gatherTopicData(conversation);
        messages = slicedMessages;
        updatedMessageContent += topicMessageData;
        curTopic = currentTopic;
        curTopicStart = currentTopicStart;
    } 

    let artifactsMap = {};
    let artifactsLen = 0;
    if (isArtifactsOn) {
        const {artifactMessageData, artifactLen, artifactMap} = gatherArtifactData(conversation);
        updatedMessageContent += artifactMessageData;
        artifactsMap = artifactMap
        artifactsLen = artifactLen;
    }

    messages[lastMsgIndex].content = updatedMessageContent;

    return {messages: messages, 
            currentTopic: curTopic, currentTopicStart: curTopicStart,
            artifactMap: artifactsMap, artifactLen: artifactsLen};
}


function extractResponseContent(response: string, startMarker: string, endMarker: string): string {
    let startIndex = response.indexOf(startMarker);
    if (startIndex === -1) return '';
    startIndex += startMarker.length;
    const endIndex = response.indexOf(endMarker, startIndex);
    return response.slice(startIndex , endIndex).trim();
  }

// save topic in message data 
function parseResponseForMessageData(response: string, currentTopic: string, currentTopicStart:number, currentUserQIndex: number) {
    if (!response) return undefined;
    const isNewTopicMatch = response.match(/isNewTopic=\{(true|false)\}/);
    const isNewTopic = isNewTopicMatch ? isNewTopicMatch[1] === 'true' : false;

    if (isNewTopic) {
        const topicData:messageTopicData = {currentTopic: ''};

        const newTopicMatch = response.match(/newTopic=\{([^}]+)\}/);
        const topicDescriptionMatch = response.match(/currentTopicDescription=\{([^}]+)\}/);
        
        const topicDescription = topicDescriptionMatch ? topicDescriptionMatch[1] : null;
        if (topicDescription) topicData.pastTopic = {
                                            range: `${currentTopicStart}-${currentUserQIndex - 1}`,
                                            topic: currentTopic,
                                            description: topicDescription
                                         }

        const newTopic = newTopicMatch ? newTopicMatch[1] : null;
        if (newTopic) {
            topicData.currentTopic = newTopic;
            return topicData;
        }  
    }
    return undefined;
}


// compile new relevant messages to be used in the original prompt request 
function relevantMessages(response: string, messages: Message[]) {
    if (!response) return messages;

    const rangeMatch = response.match(/ranges=\{(.+)\}/);
    if (!rangeMatch || rangeMatch[1] === 'ALL') return messages;
  
    const ranges = rangeMatch[1];
  
    const result:Message[] = [];
    const parsedRanges = ranges.split(', ');
    const lastIdx = messages.length -1;
    parsedRanges.forEach(range => {
      let [start, end] = range.split('-').map(Number);
      if (end === lastIdx) end -= 1;
      result.push(...messages.slice(start, end + 1)); // Push the range of messages to result
    });
    result.push(messages[messages.length-1]);
    return result;
  }

// add any artifact contents 
function relevantArtifactContent(response: string, artifactMap: { [key: string]: number[] }) {
    console.log("Relevant Artifacts: ", response);
    if (!response) return '';
    const idsMatch = response.match(/artifactIds=\{([^}]+)\}/);
    const artifactIds = idsMatch ? idsMatch[1].split(', ') : [];
    // let existingArtifactIds = [];
    let artifactContent = '';

    if (artifactIds.length > 0 ) {
        artifactContent = "\n\n You may or may not find the following artifacts useful to answer the users prompt:\n";
        artifactIds.forEach((id: string) => {
            if (artifactMap[id]) artifactContent += `\n\n ArtifactId: ${id} \n${lzwUncompress(artifactMap[id])}`;
        });
    } 
    return artifactContent;
}

function extractIncludeArtifactInstructions(response: string) {
    console.log("Extract IncludeArtifactInstructions: ", response)
    if (!response) return true;
    
    // Look for 'true' or 'false' anywhere after 'includeInstructions='
    const includeInstr = response.match(/includeInstructions=.*?(true|false)/i);
    return includeInstr ? includeInstr[1].toLowerCase() === 'true' : true;
}