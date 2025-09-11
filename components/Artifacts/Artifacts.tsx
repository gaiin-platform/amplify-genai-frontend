import { useEffect, useState, useContext, useRef } from "react";
import HomeContext from "@/pages/api/home/home.context";
import { useSession } from "next-auth/react";
import Loader from "@/components/Loader/Loader";
import cloneDeep from 'lodash/cloneDeep';
import {throttle} from '@/utils/data/throttle';

import {
    IconCheck,
    IconCopy,
    IconEdit,
    IconTrash,
    IconDownload,
    IconMail,
    IconArrowNarrowLeft,
    IconChevronLeft,
    IconChevronRight,
    IconShare,
    IconDeviceFloppy,
    IconPresentation,
    IconInfoCircle,
    IconFileUpload,
    IconCode,
    IconCopyPlus,
} from '@tabler/icons-react';
import { Artifact, ArtifactBlockDetail } from "@/types/artifacts";
import { ArtifactContentBlock } from "./ArtifactsContentBlock";
import { lzwCompress, lzwUncompress } from "@/utils/app/lzwCompression";
import { ArtifactEditor } from "./ArtifactEditor";
import toast from "react-hot-toast";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { getAllArtifacts, saveArtifact, shareArtifact } from "@/services/artifactsService";
import { downloadArtifacts, uploadArtifact } from "@/utils/app/artifacts";
import { AddEmailWithAutoComplete } from "../Emails/AddEmailsAutoComplete";
import { Group } from "@/types/groups";
import { includeGroupInfoBox } from "../Emails/EmailsList";
import { Conversation } from "@/types/chat";
import React from "react";
import { ArtifactPreview } from "./ArtifactPreview";
import { CodeBlockDetails, extractCodeBlocksAndText } from "@/utils/app/codeblock";
import ActionButton from "../ReusableComponents/ActionButton";
import { getDateName } from "@/utils/app/date";
import { resolveRagEnabled } from "@/types/features";

  interface Props {
    artifactIndex: number;
}


export const Artifacts: React.FC<Props> = ({artifactIndex}) => { //artifacts 
    const {state:{statsService, selectedConversation, selectedArtifacts, artifactIsStreaming, 
                  conversations, folders, groups, featureFlags, amplifyUsers, ragOn},
           dispatch:homeDispatch, handleUpdateSelectedConversation} = useContext(HomeContext);

    const [selectArtifactList, setSelectArtifactList] = useState<Artifact[]>(selectedArtifacts ?? []);
    const [versionIndex, setVersionIndex] = useState<number>(artifactIndex || (selectArtifactList?.length ?? 1) - 1);
    
    
    const getArtifactContents = () => {
        return selectArtifactList ? lzwUncompress(selectArtifactList[versionIndex].contents) : '';
    }
    
    const [codeBlocks, setCodeBlocks] = useState<CodeBlockDetails[]>([]);

    // Add state for dynamic width adjustment
    const [dynamicWidth, setDynamicWidth] = useState<string>('auto');
    const artifactsRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        setIsPreviewing(false);
        setIsEditing(false);
        setIsSharing(false);
        
        if (!artifactIsStreaming)  setCodeBlocks(extractCodeBlocksAndText(getArtifactContents()));
        console.log(codeBlocks);
    }, [artifactIsStreaming, versionIndex, selectArtifactList]);

    // Add ResizeObserver to detect space usage
    useEffect(() => {
        const detectSpaceUsage = () => {
            const mainContainer = document.querySelector('.flex.h-full');
            const chatScrollWindow = document.querySelector('#chatScrollWindow');
            
            if (mainContainer && chatScrollWindow) {
                const containerRect = mainContainer.getBoundingClientRect();
                const chatRect = chatScrollWindow.getBoundingClientRect();
                
                // Calculate how much of the chat area is actually being used
                const chatContentElements = chatScrollWindow.querySelectorAll('.enhanced-chat-message');
                let maxContentWidth = 0;
                
                chatContentElements.forEach(element => {
                    const elementRect = element.getBoundingClientRect();
                    if (elementRect.width > maxContentWidth) {
                        maxContentWidth = elementRect.width;
                    }
                });
                
                // If chat content is narrow, signal the grid to be more flexible
                const chatAreaWidth = chatRect.width;
                const utilizationRatio = maxContentWidth / chatAreaWidth;
                
                if (utilizationRatio < 0.6) {
                    // Chat is using less than 60% of its space, expand artifacts
                    setDynamicWidth('calc(100vw - 400px)'); // Reduced from 300px to 400px to give more space to chat
                } else {
                    setDynamicWidth('40vw'); // Reduced from 50vw to 40vw for default size
                }
                
                // Apply the change to the parent grid container
                const gridContainer = mainContainer.querySelector('.grid.grid-cols-2');
                if (gridContainer) {
                    if (utilizationRatio < 0.6) {
                        (gridContainer as HTMLElement).style.gridTemplateColumns = '3fr 2fr'; // Changed from 1fr 2fr to 3fr 2fr (60/40 split favoring chat)
                    } else {
                        (gridContainer as HTMLElement).style.gridTemplateColumns = '3fr 2fr'; // Changed from 1fr 1fr to 3fr 2fr (60/40 split favoring chat)
                    }
                }
            }
        };

        // Immediate detection on mount
        detectSpaceUsage();
        
        const handleResize = throttle(detectSpaceUsage, 250);
        window.addEventListener('resize', handleResize);

        const handleArtifactEvent = (event: any) => {
            // Immediate detection when artifacts open/close
            setTimeout(detectSpaceUsage, 0);
            // Also check after DOM settles
            setTimeout(detectSpaceUsage, 50);
        };
        
        window.addEventListener('openArtifactsTrigger', handleArtifactEvent);

        // Check when chat content changes (messages added/edited)
        const handleChatReRender = () => {
            setTimeout(detectSpaceUsage, 100);
        };
        window.addEventListener('triggerChatReRender', handleChatReRender);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('openArtifactsTrigger', handleArtifactEvent);
            window.removeEventListener('triggerChatReRender', handleChatReRender);
        };
    }, []);


    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);


    useEffect(() => {
        setVersionIndex(artifactIndex);
    },[artifactIndex])



    useEffect(() => {
        if (selectedArtifacts)  setSelectArtifactList(selectedArtifacts);
    },[selectedArtifacts]);

    const artifactEndRef = useRef<HTMLDivElement>(null);

    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isSharing, setIsSharing] = useState<boolean>(false);
    // const [isSharing, setIsSharing] = useState<boolean>(false);
    const [tags, setTags] = useState<string[]>([]);
    const [allEmails, setAllEmails] = useState<Array<string> | null>(null);
    const [shareWith, setShareWith] = useState<string[]>([]);
    const { data: session } = useSession();
    const user = session?.user?.email;

    const [messagedCopied, setMessageCopied] = useState(false);
    const [innerHeight, setInnerHeight] = useState(window.innerHeight);
    const [isLoading, setIsLoading] = useState<string>('');


    useEffect(() => {
        const fetchEmails = async () => {
            const emailSuggestions =  amplifyUsers;
            // add groups  #groupName
            const groupForMembers = groups.map((group:Group) => `#${group.name}`);
            setAllEmails(emailSuggestions ? [...emailSuggestions,
                                             ...groupForMembers].filter((e: string) => e !== user) : []);
        };
        if (!allEmails) fetchEmails();
    }, [open]);

    const scrollDown = () => {
        if (artifactIsStreaming) {
            artifactEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    const throttledScrollDown = throttle(scrollDown, 250);
    
    useEffect(() => {
        throttledScrollDown();
    }, [selectedConversation, throttledScrollDown]);

    useEffect(() => {
        if (isSaving || isSharing || isUploading) setIsModalOpen(true);
        if (!isSaving && !isSharing && !isUploading) setIsModalOpen(false);
    }, [isSaving, isSharing, isUploading]);

    
    // Process emails and handle group expansion
    const processEmailEntries = (entries: string[]) => {
        let entriesWithGroupMembers: string[] = [];

        entries.forEach((e: string) => {
            if (e.startsWith('#')) {
                const group = groups.find((g: Group) => g.name === e.slice(1));
                if (group) {
                    entriesWithGroupMembers = [...entriesWithGroupMembers,
                    ...Object.keys(group.members).filter((member: string) => member !== user)];
                }
            } else {
                entriesWithGroupMembers.push(e);
            }
        });

        // Filter valid emails and avoid duplicates
        const newEmails = entriesWithGroupMembers.filter(email => 
            /^\S+@\S+\.\S+$/.test(email) && !shareWith.includes(email)
        );
        
        if (newEmails.length > 0) {
            setShareWith([...shareWith, ...newEmails]);
        }
    };

    // Handle both adding and removing emails
    const handleUpdateEmails = (updatedEmails: string[]) => {
        // Check if we're adding or removing emails
        if (updatedEmails.length > shareWith.length) {
            // Adding emails - find newly added ones
            const addedEmails = updatedEmails.filter(email => !shareWith.includes(email));
            if (addedEmails.length > 0) {
                processEmailEntries(addedEmails);
            }
        } else if (updatedEmails.length < shareWith.length) {
            // Removing emails - directly update shareWith
            setShareWith(updatedEmails);
        } else if (updatedEmails.length === shareWith.length) {
            // Same length - might be a replacement, update directly
            setShareWith(updatedEmails);
        }
    };


    useEffect(() => {
        const updateInnerWindow = () => {
            setInnerHeight(window.innerHeight);
        }
        // Listen to window resize to update the size
        window.addEventListener('resize', updateInnerWindow);
        return () => {
          window.removeEventListener('resize', updateInnerWindow);
        };
      }, []);

    useEffect(() => {
        const handleArtifactEvent = (event:any) => {
            const isArtifactsOpen = event.detail.isOpen;
            if (!isArtifactsOpen) cleanUp();
        };
        window.addEventListener('openArtifactsTrigger', handleArtifactEvent);
        return () => {
            window.removeEventListener('openArtifactsTrigger', handleArtifactEvent);
        };
    }, []);

    const cleanUp = () => {
        homeDispatch({field: "selectedArtifacts", value: undefined});
    }
    

    const handleChangeVersion = (index: number) => {
        setIsPreviewing(false);
        setIsEditing(false);
        if (artifactIsStreaming) {
            alert("Can't change artifact version while new version is streaming");
            return;
        }

        if (selectArtifactList && index < selectArtifactList.length && index >= 0) setVersionIndex(index);
    };

    const copyOnClick = () => {
        statsService.copyArtifactEvent();
        if (!navigator.clipboard) return;
        if (selectArtifactList) {
            const artifactContent = getArtifactContents();
            navigator.clipboard.writeText(artifactContent).then(() => {
                setMessageCopied(true);
                setTimeout(() => {
                    setMessageCopied(false);
                }, 2000);
            });
        }
    };

    const handleEditArtifact = (editedContent: string) => {
        statsService.editArtifactEvent();
        if (selectedConversation) {
            const updatedConversation = { ...selectedConversation };
            let currentArtifact = selectArtifactList[versionIndex];
            const curLen = selectArtifactList.length;
            // if the versionIndex is the last then just update the artifact
            let updatedArtifacts = selectArtifactList;
            const newContent =  lzwCompress(editedContent)
            if (versionIndex === curLen - 1) {
                currentArtifact.contents = newContent;
                updatedArtifacts = [
                    ...selectArtifactList.slice(0, versionIndex), 
                    currentArtifact
                ];
                
            } else { // else create a new version and add it
                let newVersion = cloneDeep(currentArtifact);
                newVersion.version = selectArtifactList[curLen - 1].version + 1;
                newVersion.contents = newContent;
                newVersion.createdAt = getDateName();
                updatedArtifacts = [...selectArtifactList, newVersion];

                const lastMessageData = updatedConversation.messages.slice(-1)[0].data;
                updatedConversation.messages.slice(-1)[0].data.artifacts = [...(lastMessageData.artifacts ?? []), {artifactId: newVersion.artifactId, name: newVersion.name, createdAt:  newVersion.createdAt, description: newVersion.description, version: newVersion.version} as ArtifactBlockDetail];

            }
            if (selectedConversation) handleUpdateConversationArtifacts(updatedConversation, currentArtifact.artifactId, updatedArtifacts);
            setVersionIndex(updatedArtifacts.length - 1);
            setCodeBlocks(extractCodeBlocksAndText(getArtifactContents()));

        }
    };

    const handleCopyVersion = () => {
        statsService.addCopyOfArtifactEvent();
        const curLen = selectArtifactList.length;
        if (selectedConversation) {
            const updatedConversation = { ...selectedConversation };
            let copyArtifact = cloneDeep(selectArtifactList[versionIndex]);
            copyArtifact.createdAt = getDateName();
            copyArtifact.version = selectArtifactList[curLen - 1].version + 1;
            let updatedArtifacts =  [
                            ...selectArtifactList, 
                            copyArtifact
                        ];
            
            const lastMessageData = updatedConversation.messages.slice(-1)[0].data;
            updatedConversation.messages.slice(-1)[0].data.artifacts = [...(lastMessageData.artifacts ?? []), {artifactId: copyArtifact.artifactId,  name: copyArtifact.name, createdAt:  copyArtifact.createdAt, description: copyArtifact.description, version: copyArtifact.version} as ArtifactBlockDetail];

            handleUpdateConversationArtifacts(updatedConversation, copyArtifact.artifactId, updatedArtifacts);
            setVersionIndex(updatedArtifacts.length - 1);   

        }
        
    }



    const handleUpdateConversationArtifacts = (updatedConversation: Conversation, artifactId:string, updatedArtifacts: Artifact[]) => {
        setSelectArtifactList(updatedArtifacts);
        homeDispatch({field: "selectedArtifacts", value: updatedArtifacts});
        updatedConversation.artifacts = updatedArtifacts.length === 0 ? {...updatedConversation.artifacts} :
                                                                        { ...updatedConversation.artifacts, 
                                                                            [artifactId]: updatedArtifacts
                                                                        };
        handleUpdateSelectedConversation(updatedConversation);
       
    }


    const handleDeleteArtifact = () => {
        statsService.deleteArtifactEvent();
        if (selectArtifactList) {
            const updatedArtifacts = selectArtifactList.filter((_, idx) => idx !== versionIndex);
            const artifactId:string = selectArtifactList[versionIndex].artifactId;
            if (selectedConversation) handleUpdateConversationArtifacts({...selectedConversation}, artifactId, updatedArtifacts);

            if (updatedArtifacts.length === 0 ) {
                handleCloseArtifactMode();
            } else {
                if (versionIndex === updatedArtifacts.length) setVersionIndex(versionIndex - 1);
                toast("Artifact Removed");
            } 
        }

    }


    const handleShareArtifact = async () => {
// add users email model 
        setIsLoading('Sharing Artifact...');
        
        // Check if we have emails to share with
        if (shareWith.length === 0) {
            setIsLoading('');
            alert('Please add at least one email address to share with.');
            return;
        }
        
        statsService.shareArtifactEvent(selectArtifactList[versionIndex], shareWith);
        const result = await shareArtifact(selectArtifactList[versionIndex], shareWith);
        if (result.success) {
            toast("Shared Successfully");
        } else {
            alert("Shared failed, please try again later...");
        }
        setIsLoading('');
        setIsSharing(false);
        setShareWith([]);
    }

    const handleDownloadArtifact = () => {
        statsService.downloadArtifactEvent();
        setIsLoading('Downloading Artifact...');
        const artifact = selectArtifactList[versionIndex];
        const artifactContent = getArtifactContents();
        downloadArtifacts(artifact.name.replace(/\s+/g, '_'), artifactContent, codeBlocks);
        setIsLoading('');

    }

    const handleUploadAsFile = async () => {
        statsService.uploadArtifactAsFileEvent();
        setIsUploading(false);
        setIsLoading('Upload Artifact to Amplify File Manager...');
        const artifact = selectArtifactList[versionIndex];
        const artifactContent = getArtifactContents();
        await uploadArtifact(artifact.name.replace(/\s+/g, '_'), artifactContent, tags, resolveRagEnabled(featureFlags, ragOn));
        handleTags();
        setIsLoading('');
    }

    const handleSaveArtifact = async () => {
        setIsSaving(false);
        setIsLoading('Saving Artifact...');
        const artifact = selectArtifactList[versionIndex];
        statsService.saveArtifactEvent({...artifact, tags: tags});
        const result = await saveArtifact({...artifact, tags: tags});
        setIsLoading('');
        if (result.success) {
            toast("Successully Saved Artifact");
            handleTags();
            // update artifacts
            const response = await getAllArtifacts();
            if (response.success) { 
                homeDispatch({ field: 'artifacts', value: response.data});  
            } else {
                console.log("Failed to save remote Artifacts.");
            } 
        } else {
            alert("Failed to save artifact at this time, please try again later.");
        }

    }

    const handleTags = () => {
        if (selectArtifactList[versionIndex].tags !== tags) {
            //update 
        }
        setTags([]);
    }


    const handleCloseArtifactMode = () => {
        window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false }} ));
    };


const CancelSubmitButtons: React.FC<SubmitButtonProps> = ( { submitText, onSubmit, onCancel} ) => {
    return  <>
    <div className="flex flex-row items-center justify-end p-4">
        <button className="mr-2 w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300" 
            id="cancelArtifact"
            onClick={() => {
                onCancel();
                setIsModalOpen(false);
            }
            }
            >Cancel
        </button>
        <button className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300" 
            id="submitArtifact"
            onClick={onSubmit}
            >{submitText}
        </button>
    </div>
    
    </>

}

   return ( 
   <div 
        ref={artifactsRef}
        id="artifactsTab" 
        className={`text-base overflow-hidden h-full bg-gray-200 dark:bg-[#343541] text-black dark:text-white border-l border-black px-2`}
        style={{ width: dynamicWidth, minWidth: '400px', transition: 'width 0.3s ease-in-out' }}
   >
        <div className="flex flex-col h-full " > 
            {/* Modals */}
           
                {isLoading && 
                <div className="fixed top-14 ml-20 left-3/4 transform translate-x-3/4 z-[9999] pointer-events-none animate-float">
                    <div className="p-3 flex flex-row items-center border border-gray-500 bg-[#202123] rounded-lg shadow-xl pointer-events-auto">
                        <LoadingIcon style={{ width: "24px", height: "24px" }}/>
                        <span className="text-lg font-bold ml-2 text-white">{isLoading}</span>
                    </div>
                </div>}

                {(isModalOpen) &&  
                    <div className="shadow-xl flex justify-center w-full">
                        <div id="shareArtifactModal" className="p-4  border border-gray-500 rounded z-50 absolute bg-white dark:bg-[#444654]" style={{ transform: `translateY(50%)`}}>

                        
                    {isSharing && <div className="flex flex-col gap-2" >

                        {"Send Amplify Artifact"}
                        {featureFlags.assistantAdminInterface && groups && groups.length > 0  &&  <>{includeGroupInfoBox}</>}
                        
                        <AddEmailWithAutoComplete
                            id="artifactShare"
                            emails={shareWith}
                            allEmails={allEmails || []}
                            handleUpdateEmails={handleUpdateEmails}
                            displayEmails={true}
                        />

                        <CancelSubmitButtons
                        submitText="Share"
                        onSubmit={() => handleShareArtifact()}
                        onCancel={() => setIsSharing(false)}
                        />
                    </div>
                    }

                    </div>
                    </div>
                }


            <label id="artifactsLabel" className="mt-4 text-[36px] text-center"> Artifacts</label>
            <div className='absolute top-5 mr-auto ml-8 w-[26px]'> 
                
                <ActionButton
                        id="closeArtifactWindow"
                        handleClick={handleCloseArtifactMode}
                        title="Close">
                        <IconArrowNarrowLeft size={34} />
                </ActionButton> 

            </div>
            
            <div className="flex justify-center items-center flex-1">
                <div className="w-full flex flex-row justify-between">
                    
                    <div className="flex flex-col flex-1 px-2 min-w-0" id="artifactsTextDisplay">
                        
                        {!isEditing && !isPreviewing &&  selectArtifactList && (
                            <div className="mt-8 flex flex-grow overflow-y-auto overflow-x-hidden justify-center" style={{height: innerHeight - 140}} 
                            >
                                <ArtifactContentBlock
                                    artifactIsStreaming={artifactIsStreaming}
                                    selectedArtifact={selectArtifactList[versionIndex]}
                                    artifactId={selectArtifactList[versionIndex].artifactId}
                                    versionIndex={versionIndex}
                                    artifactEndRef={artifactEndRef}
                                />
                            </div>
                            
                        )}
                        
                        {isEditing && ( 
                           
                            <ArtifactEditor
                                handleEditArtifact={handleEditArtifact}
                                setIsEditing={setIsEditing}
                                isEditing={isEditing}
                                artifactContent={getArtifactContents()}
                                blocks={codeBlocks}
                                height={innerHeight - 210}
                            /> 
                            
                        )} 
                        { isPreviewing  && 
                            <ArtifactPreview codeBlocks={codeBlocks} artifactContent={getArtifactContents()} type={selectArtifactList[versionIndex].type} height={innerHeight - 160}/>
                        }
                        {selectArtifactList && 
                            <div className='mt-4 flex flex-row w-full'  title={`${versionIndex + 1} of ${selectArtifactList?.length}`}> 
                                    { !artifactIsStreaming && !isEditing && 
                                        <div className="flex"> 
                                        <VersionChangeButton
                                            nextIndex={versionIndex - 1}
                                            onClick={(i)=> handleChangeVersion(i)}
                                            isDisabled={versionIndex - 1 < 0}
                                            icon={<IconChevronLeft size={22}/>}
                                        />
                                        <VersionChangeButton
                                            nextIndex={versionIndex + 1}
                                            onClick={(i)=> handleChangeVersion(i)}
                                            isDisabled={versionIndex + 1 === selectArtifactList.length}
                                            icon={<IconChevronRight size={22}/>}
                                        />
                                        </div>
                                    }
                                    <div className=" ml-2 w-[550px] flex justify-center overflow-hidden">
                                        <label className="mt-1.5 whitespace-nowrap max-w-[540px] block overflow-x-auto" id="versionNumber" title={selectArtifactList[versionIndex].createdAt}>
                                            <span> {selectArtifactList[versionIndex].name} </span>
                                            {"  - Version: "}
                                            {selectArtifactList[versionIndex].version} 
                                        </label>
                                    </div>

                            </div>
                        }
                    </div>
                    

                    <div className="enhanced-chat-icons-vertical h-min mt-8 flex flex-col gap-3 items-center p-2 border border-gray-500 dark:border-gray-500 shadow-[0_2px_4px_rgba(0,0,0,0.3)] flex-shrink-0 ml-2">
                        {isPreviewing ?
                            <button
                            className="enhanced-chat-icon-button"
                            id="viewCode"
                            onClick={() => {
                                setIsPreviewing(false)}}
                            title="View Code"
                            disabled={artifactIsStreaming}
                            >
                            <IconCode size={24}/>
                            </button> :             
                            <button
                                className="enhanced-chat-icon-button"
                                id="previewArtifact"
                                onClick={() => {
                                    setIsEditing(false); 
                                    setIsPreviewing(true);
                                    statsService.previewArtifactEvent(selectArtifactList[versionIndex].type);
                                }}
                                title="Preview Artifact"
                                disabled={artifactIsStreaming}
                            >
                                <IconPresentation size={24}/>
                            </button> }
                        <button
                            className="enhanced-chat-icon-button"
                            id="saveArtifact"
                            onClick={() => {
                                setIsSharing(false); 
                                setIsUploading(false);
                                setIsSaving(true);

                                handleSaveArtifact();
                            }}
                            title="Save Artifact"
                            disabled={artifactIsStreaming}
                        >
                            <IconDeviceFloppy size={24}/>
                        </button>

                        <button
                            className="enhanced-chat-icon-button"
                            id="uploadArtifactAFM"
                            onClick={() => {
                                setIsSaving(false);
                                setIsSharing(false);
                                setIsUploading(true);

                                handleUploadAsFile();
                            }}
                            title="Upload Artifact To Amplify File Manager"
                            disabled={artifactIsStreaming}
                        >
                            <IconFileUpload size={24}/>
                        </button>

                        <button
                            className="enhanced-chat-icon-button"
                            id="addVersionCopy"
                            onClick={handleCopyVersion}
                            title="Add Version Copy To Artifact List"
                            disabled={artifactIsStreaming}
                        >
                            <IconCopyPlus size={24}/>
                        </button>
                        
                        {messagedCopied ? (
                            <IconCheck
                                size={24}
                                className="text-green-500 dark:text-green-400"
                            />
                        ) : (
                            <button
                                className="enhanced-chat-icon-button"
                                id="copyArtifact"
                                onClick={copyOnClick}
                                title="Copy Artifact"
                                disabled={artifactIsStreaming}
                            >
                                <IconCopy size={24}/>
                            </button>
                        
                        )}

                        <button
                            className="enhanced-chat-icon-button"
                            id="downlaodArtifact"
                            onClick={handleDownloadArtifact}
                            title="Download Artifact"
                            disabled={artifactIsStreaming}
                        >
                            <IconDownload size={24}/>
                        </button>

                        <button
                            className="enhanced-chat-icon-button"
                            id="emailArtifact"
                            title="Email Artifact"
                            disabled={artifactIsStreaming}
                            onClick={()=> statsService.mailArtifactEvent()}
                        >
                            <a className=""
                                href={`mailto:?body=${encodeURIComponent( getArtifactContents() )}`}>
                                <IconMail size={22}/>
                            </a>
                            
                        </button>

                        <button
                            className="enhanced-chat-icon-button"
                            id="shareArtifact"
                            onClick={() => {
                                setIsSaving(false);
                                setIsUploading(false);
                                setIsSharing(true);
                                }}
                            title="Share Artifact"
                            disabled={artifactIsStreaming}
                        >
                            <IconShare size={24}/>
                        </button>

                        <button
                            className="enhanced-chat-icon-button"
                            id="editArtifact"
                            onClick={() => {
                                setIsPreviewing(false); 
                                setIsEditing(!isEditing);
                            } }
                            title="Edit Artifact"
                            disabled={artifactIsStreaming}
                        >
                            <IconEdit size={24}/>
                        </button>


                        <button
                            className="enhanced-chat-icon-button"
                            id="deleteVersion"
                            onClick={handleDeleteArtifact}
                            title="Delete Version"
                            disabled={artifactIsStreaming}
                        >
                            <IconTrash size={24}/>
                        </button>
                      
                    </div>
                </div>
                
            </div>
            {(artifactIsStreaming &&
                <div style={{ transform: 'translateX(20px) translateY(-40px)' }}>
                <Loader type="ping" size="48"/>
                </div>
            )}
        </div>

    </div>

) 
   
   
   

}


interface ButtonProps {
    nextIndex: number;
    onClick: (i:number) => void;
    isDisabled: boolean;
    icon: JSX.Element;
}

const VersionChangeButton: React.FC<ButtonProps> = ( { nextIndex, onClick, isDisabled, icon} ) => {
    return  <div className={`h-[32px] w-[32px] border border-neutral-300 dark:border-neutral-600 ${isDisabled ? "opacity-30": ""}`}>
                <button
                    className={`p-1 text-neutral-500 dark:text-neutral-400 ${isDisabled ? "" :"hover:text-black dark:hover:text-neutral-100"}`}
                    id="indexButton"
                    onClick={() => onClick(nextIndex)}
                    // title={isDisabled ? "":}
                    disabled={isDisabled}
                >
                    {icon}
                </button>
            </div>

}


interface SubmitButtonProps {
    submitText: string;
    onSubmit:() => void;
    onCancel:() => void;
}



