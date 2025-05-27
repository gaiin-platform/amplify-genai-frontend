import HomeContext from "@/pages/api/home/home.context";
import {Conversation, Message} from "@/types/chat";
import React, {FC, useContext, useEffect, useRef, useState} from "react";
import { useSession } from "next-auth/react"
import {IconDownload} from '@tabler/icons-react';
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {ConversionOptions, convert} from "@/services/downloadService";
import { LatestExportFormat } from "@/types/export";
import { isRemoteConversation } from "@/utils/app/conversation";
import { fetchMultipleRemoteConversations } from "@/services/remoteConversationService";
import { ItemSelect } from "../ReusableComponents/ItemsSelect";
import { Modal } from "../ReusableComponents/Modal";

export interface DownloadModalProps {
    onDownloadReady: (url: string) => void;
    onCancel: () => void;
    includeConversations: boolean;
    selectedConversations?: Conversation[];
    selectedMessages?: Message[];
    showHeaders?: boolean;
    showInclude?: boolean;
}

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
  font-size: 4rem;
  animation: ${animate} 2s infinite;
`;

export const DownloadModal: FC<DownloadModalProps> = (
    {
        onDownloadReady,
        onCancel,
        includeConversations,
        selectedConversations = [],
        selectedMessages= [],
        showHeaders= true,
        showInclude = true,
    }) => {
    const {
        state: {prompts, conversations, folders, statsService, selectedConversation, powerPointTemplateOptions},
    } = useContext(HomeContext);

    const { data: session } = useSession();
    const user = session?.user;

    // Individual states for selected prompts, conversations, and folders
    const [isDownloading, setIsDownloading] = useState(false);
    const [includeConversationName, setIncludeConversationName] = useState(false);
    const [selectedMessagesState, setSelectedMessagesState] = useState<Message[]>([...selectedMessages]);
    const [selectedConversationsState, setSelectedConversations] = useState([...selectedConversations]);
    const [downloadUrl, setDownloadUrl] = useState<string|null>(null);

    const [format, setFormat] = useState<string>("docx");
    const [includeMode, setIncludeMode] = useState<string>("assistant");
    const [conversationHeader, setConversationHeader] = useState<string>("# ");
    const [userMessageHeader, setUserMessageHeader] = useState<string>("");
    const [assistantMessageHeader, setAssistantMessageHeader] = useState<string>("");
    const [messageHeader, setMessageHeader] = useState<string>("");



    const wordTemplateOptions = [
        "none",
    ];
    const shadow = "rounded p-0.5 shadow-[1px_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3)]";

    const [templateSelection, setTemplateSelection] = useState<string>(wordTemplateOptions[0]);
    const [templateOptions, setTemplateOptions] = useState<string[]>(wordTemplateOptions);

    const [canDownload, setCanDownload] = useState<boolean>(false);

    useEffect(() => {
        console.log("state: ", selectedConversationsState)
        setCanDownload(selectedConversationsState.length > 0);
    }, [selectedConversationsState]);


    const handleDownload = async () => {
        setIsDownloading(true);

        try {

            let exportedConversations:Conversation[] = [];

            if(selectedMessagesState.length > 0
                && selectedConversationsState
                && selectedConversationsState.length > 0){
                exportedConversations = [
                    {...selectedConversations[0], messages: [...selectedMessagesState]}
                ]
            } else {
                const conversationPromises = selectedConversationsState.map(async conv=> {
                    let includedMessages: Message[];
                    let conversation = conv;
                    if (selectedConversation && conversation.id !== selectedConversation.id &&
                        isRemoteConversation(conv)) {
                            const cloudConvResult = await fetchMultipleRemoteConversations([conv.id]);
                            const cloudConv = cloudConvResult.data;
                            if (cloudConv && cloudConv.length > 0) conversation = cloudConv[0];
                        }
                    switch (includeMode) {
                        case "assistant":
                            includedMessages = conversation.messages.filter(message => message.role === 'assistant');
                            break;

                        case "user":
                            includedMessages = conversation.messages.filter(message => message.role === 'user');
                            break;

                        case "all":
                            includedMessages = conversation.messages;
                            break;

                        case "starred":
                            includedMessages = conversation.messages.filter((message, index) => {
                                if (message.data && message.data.rating) {
                                    return true;
                                } else if (message.role === 'user' && conversation.messages.length > index + 1) {
                                    const next = conversation.messages[index + 1];
                                    return next.role === 'assistant' && next.data && next.data.rating;
                                } else {
                                    return false;
                                }
                            });
                            break;

                        case "starred_assistant":
                            includedMessages = conversation.messages.filter(message => message.role === "assistant" && message.data && message.data.rating);
                            break;

                        case "starred_user":
                            includedMessages = conversation.messages.filter(message => message.role === "user" && message.data && message.data.rating);
                            break;

                        default:
                            includedMessages = conversation.messages;
                    }

                    return {...conversation, messages: includedMessages};
                });
                exportedConversations = await Promise.all(conversationPromises);
            }
            

            const downloadData = { version: 4, history: exportedConversations, 
                                 folders: [], prompts: [],
                                } as LatestExportFormat;
            

            const withNewline = (s:string) => {
                return s ? s + "\n\n" : s;
            }

            const conversionOptions: ConversionOptions = {
                assistantHeader: withNewline(assistantMessageHeader),
                conversationHeader: withNewline(conversationHeader),
                format: format,
                messageHeader: withNewline(messageHeader),
                userHeader: withNewline(userMessageHeader),
                includeConversationName: includeConversationName
            }

            if(templateSelection !== 'none'){
               conversionOptions.templateName = templateSelection;
            }

            const result = await convert(conversionOptions, downloadData);

            statsService.downloadItemEvent(conversionOptions, downloadData);

            let resultArrived = false;
            let triesLeft = 60;

            const checkReady = async (url:string) => {
                try {
                    triesLeft = triesLeft - 1;
                    const result = await fetch(url);
                    if(result.ok){
                        resultArrived = true;
                        setDownloadUrl(url);
                        setIsDownloading(false);
                    }
                    else if(triesLeft > 0){
                        setTimeout(()=>checkReady(url), 1000);
                    }
                    else {
                        alert("Unable to download. Please check your Internet connection and try again.");
                        setIsDownloading(false);
                    }
                } catch (e) {
                    alert("Failed to reach the download service. Please check your Internet connection and try again.");
                    setIsDownloading(false);
                }
            }
            if (result.success) {
                
                const downloadUrl = result.data.url;
                checkReady(downloadUrl);
            } else {
                alert("Failed to reach the download service. Please check your Internet connection and try again.");
                setIsDownloading(false);
            }

        } catch (e) {
            alert("Failed to reach the download service. Please check your Internet connection and try again.");
            setIsDownloading(false);
        }

    }

    const isDone = () => {
        return !isDownloading && downloadUrl !== null
    }

    const preDownload = () => {
        return !isDownloading && !isDone()
    }

    const onClose = () => {
        onCancel();
        setDownloadUrl(null);
    }

    return (
        <Modal 
            width={() => window.innerWidth * (preDownload() ?  0.5 : 0.3)}
            height={() => preDownload() && includeConversations ? window.innerHeight *  0.6 : 280}
            transform={includeConversations ? "translateY(200px) !important" : ""}
            title={preDownload() ? "Download": ""}
            onCancel={onClose} 
            // showCancel={!isDownloading}
            cancelLabel={isDone() ? "Done" : undefined} // will default to Cancel
            onSubmit={handleDownload}
            submitLabel={"Download"}
            disableSubmit={!canDownload}
            showSubmit={preDownload()}
            resizeOnVarChange={isDownloading}
            content={ isDownloading ? (
                            <div className="flex flex-col items-center justify-center pb-2 border-b">
                                <LoadingIcon/>
                                <span className="text-black dark:text-white text-xl font-bold mt-4">Preparing download...</span>
                            </div>
                        ) :
                        ( downloadUrl != null ? (
                            <div className="flex flex-row items-center justify-center mb-6 text-2xl button">
                                <a href={downloadUrl || ""}
                                   id="downloadClick"
                                   className="bg-blue-500 hover:bg-green-500 text-white font-bold py-2 px-4 rounded"
                                >
                                    <IconDownload className="text-center w-full" size={34}/>
                                    <h1>Click to Download</h1>
                                </a>
                            </div>
                        ) : (
                            <div className="overflow-y-auto">

                                <h3 className="text-black dark:text-white text-lg mt-2 border-b">Options</h3>


                                <div id="optionsGrid" className="grid grid-cols-2 w-full items-center p-2 text-black dark:text-white">

                                    <div>Format</div>
                                    <div id="formatSelection" className="ml-2 rounded w-full text-black pr-2 pt-2">
                                    <select
                                        className={shadow}
                                        onChange={(e) => {
                                            if(e.target.value === 'pptx' && powerPointTemplateOptions.length > 0){
                                                setTemplateOptions(powerPointTemplateOptions);
                                                const defaultTemplate = powerPointTemplateOptions.includes("vanderbilt_1.pptx") ? "vanderbilt_1.pptx" : powerPointTemplateOptions[0];
                                                setTemplateSelection(defaultTemplate);
                                            }
                                            else {
                                                setTemplateOptions(wordTemplateOptions);
                                            }

                                            setFormat(e.target.value);
                                        }}
                                        value={format}
                                    >
                                        <option value="docx">Word</option>
                                        { powerPointTemplateOptions.length > 0 && <option value="pptx">PowerPoint</option>}
                                    </select>
                                    </div>

                                    <div>Template</div>
                                    <div id="templateSelection" className="ml-2 rounded w-full text-black pr-2 pt-2">
                                        <select
                                            className={shadow}
                                            onChange={(e) => {
                                                setTemplateSelection(e.target.value );
                                            }}
                                            value={templateSelection}
                                        >
                                            {templateOptions.map((template,index)=>(
                                                <option key="index" value={template}>{template}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>Include Conversation Name</div>
                                    <div id="convoNameInclusionSelection" className="ml-2 rounded w-full text-black pr-2 pt-2">
                                        <select
                                            className={shadow}
                                            onChange={(e) => {
                                                setIncludeConversationName(e.target.value === 'true');
                                            }}
                                            value={""+includeConversationName}
                                        >
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                    </div>

                                    {showInclude && (
                                    <div className="mt-2">Include</div>
                                        )}
                                    {showInclude && (
                                    <div id="includeSelection" className="ml-2 rounded text-black pr-2 pt-2">
                                        <select
                                            className={shadow}
                                            onChange={(e) => {
                                                setIncludeMode(e.target.value);
                                            }}
                                            value={includeMode}
                                        >
                                            <option value="assistant">Assistant Messages</option>
                                            <option value="user">User Prompts</option>
                                            <option value="all">All Messages & Prompts</option>
                                            {/* <option value="starred">Starred Prompts & Messages</option>
                                            <option value="starred_assistant">Starred Messages</option>
                                            <option value="starred_user">Starred Prompts</option> */}
                                        </select>
                                    </div>
                                        )}

                                    {showHeaders && (
                                    <div>Conversation Header</div>
                                        )}
                                    {showHeaders && (
                                    <div id="conversationHeaderText" className="ml-2">
                                        <textarea
                                            className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                            style={{resize: 'none'}}
                                            placeholder={
                                                "A markdown header to insert at the start of a conversation"
                                            }
                                            value={conversationHeader || ''}
                                            onChange={(e) => setConversationHeader(e.target.value)}
                                            rows={1}
                                        />
                                    </div>
                                        )}


                                    {showHeaders && (
                                    <div>Message Header</div>
                                        )}
                                    {showHeaders && (
                                    <div id="messageHeaderText" className="ml-2">
                                        <textarea
                                            className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                            style={{resize: 'none'}}
                                            placeholder={
                                                ""
                                            }
                                            value={messageHeader || ''}
                                            onChange={(e) => setMessageHeader(e.target.value)}
                                            rows={1}
                                        />
                                    </div>
                                        )}

                                    {showHeaders && (
                                    <div>User Message Header</div>
                                        )}
                                    {showHeaders && (
                                    <div id="userMessageHeaderText" className="ml-2">
                                        <textarea
                                            className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                            style={{resize: 'none'}}
                                            placeholder={
                                                ""
                                            }
                                            value={userMessageHeader || ''}
                                            onChange={(e) => setUserMessageHeader(e.target.value)}
                                            rows={1}
                                        />
                                    </div>
                                        )}
                                    {showHeaders && (
                                    <div>Assistant Header</div>
                                        )}
                                    {showHeaders && (
                                    <div id="assistantHeaderText" className="ml-2">
                                        <textarea
                                            className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                            style={{resize: 'none'}}
                                            placeholder={
                                                ""
                                            }
                                            value={assistantMessageHeader || ''}
                                            onChange={(e) => setAssistantMessageHeader(e.target.value)}
                                            rows={1}
                                        />
                                    </div>
                                    )}
                                </div>
                                {/* Dont need to render if we dont have conversations */}
                                { includeConversations &&  
                                <ItemSelect
                                    selectedConversationsState={selectedConversationsState}
                                    setSelectedConversations={setSelectedConversations}
                                    includeConversations={true}

                                />}

                            </div>
                        ))
                    
                    } 
        />
    );
};