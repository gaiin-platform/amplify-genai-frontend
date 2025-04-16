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
    IconPlus,
    IconFileUpload,
    IconCircleX,
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
import { EmailsAutoComplete } from "../Emails/EmailsAutoComplete";
import { Group } from "@/types/groups";
import { includeGroupInfoBox } from "../Emails/EmailsList";
import { Conversation } from "@/types/chat";
import React from "react";
import { ArtifactPreview } from "./ArtifactPreview";
import { CodeBlockDetails, extractCodeBlocksAndText } from "@/utils/app/codeblock";
import ActionButton from "../ReusableComponents/ActionButton";
import { getDateName } from "@/utils/app/date";
import { stringToColor } from "@/utils/app/data";

  interface Props {
    artifactIndex: number;
}


export const Artifacts: React.FC<Props> = ({artifactIndex}) => { //artifacts 
    const {state:{statsService, selectedConversation, selectedArtifacts, artifactIsStreaming, 
                  conversations, folders, groups, featureFlags, amplifyUsers},
           dispatch:homeDispatch, handleUpdateSelectedConversation} = useContext(HomeContext);

    const [selectArtifactList, setSelectArtifactList] = useState<Artifact[]>(selectedArtifacts ?? []);
    const [versionIndex, setVersionIndex] = useState<number>(artifactIndex || (selectArtifactList?.length ?? 1) - 1);
    
    
    const getArtifactContents = () => {
        return selectArtifactList ? lzwUncompress(selectArtifactList[versionIndex].contents) : '';
    }
    
    const [codeBlocks, setCodeBlocks] = useState<CodeBlockDetails[]>([]);


    useEffect(() => {
        setIsPreviewing(false);
        setIsEditing(false);
        setIsSharing(false);
        
        if (!artifactIsStreaming)  setCodeBlocks(extractCodeBlocksAndText(getArtifactContents()));
        console.log(codeBlocks);
    }, [artifactIsStreaming, versionIndex, selectArtifactList]);


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
    const [input, setInput] = useState<string>('');
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

    
    const handleAddEmails = () => {
        const entries = input.split(',').map(email => email.trim()).filter(email => email);
        let entriesWithGroupMembers:string[] = [];

        if (groups && groups.length > 0) {
            entries.forEach((e: any) => { 
                if ( e.startsWith('#')) {
                    const group = groups.find((g:Group) => g.name === e.slice(1));
                    if (group) entriesWithGroupMembers = [...entriesWithGroupMembers, 
                                                        ...Object.keys(group.members)];  //.filter((e: string) => e !== user)
                } else {
                    entriesWithGroupMembers.push(e);
                }
            });
        }

        const newEmails = entriesWithGroupMembers.filter(email => /^\S+@\S+\.\S+$/.test(email) && !shareWith.includes(email));
        setShareWith([...shareWith, ...newEmails]);
        setInput('');
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
        await uploadArtifact(artifact.name.replace(/\s+/g, '_'), artifactContent, tags);
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
            onClick={() => {
                onCancel();
                setIsModalOpen(false);
            }
            }
            >Cancel
        </button>
        <button className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300" 
            onClick={onSubmit}
            >{submitText}
        </button>
    </div>
    
    </>

}

const chat_icons_cn = "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"

   return ( 
   <div id="artifactsTab" className={`flex-0 text-base overflow-hidden min-h-screen bg-gray-200 dark:bg-[#343541] text-black dark:text-white border-l border-black px-4`}>
        <div className="flex flex-col" > 
            {/* Modals */}
           
                {isLoading && 
                <div className="flex justify-center w-full"> 
                    <div className="z-50 absolute" style={{ transform: `translateY(100%)`}}>
                        <div className="p-3 flex flex-row items-center border border-gray-500 bg-[#202123]">
                            <LoadingIcon style={{ width: "24px", height: "24px" }}/>
                            <span className="text-lg font-bold ml-2 text-white">{isLoading}</span> 
                        </div>
                    </div> </div>}

                {(isModalOpen) &&  
                    <div className="shadow-xl flex justify-center w-full">
                        <div className="p-4  border border-gray-500 rounded z-50 absolute bg-white dark:bg-[#444654]" style={{ transform: `translateY(50%)`}}>
                        {/* {isSaving || isUploading && <>
                        <TagsList tags={selectArtifactList[versionIndex].tags} 
                            setTags={(tags) => {
                                    const artifactTags =  selectArtifactList[versionIndex].tags;                                
                                        // setTags(tags);
                                        // item.tags = [...itemTags, ...tags.filter(tag => !itemTags.includes(tag))]
                                    
                                    }}
                            removeTag={(tag) => {
                            
                                    // item.tags = item.tags?.filter(x => x != tag)
                                
                            }}
                        /> 

                        </>} */}
                        
                    {isSharing && <div className="flex flex-col gap-2" >

                        {/* <div className="flex w-full flex-wrap pb-2 mt-2"> */}
                        {"Send Amplify Artifact"}
                        {featureFlags.assistantAdminInterface && groups && groups.length > 0  &&  <>{includeGroupInfoBox}</>}
                        <div className='flex flex-row gap-2'>
                            <div className="flex-shrink-0 ml-[-6px] mr-2">
                                <button
                                    type="button"
                                    title='Add Account'
                                    className="ml-2 mt-1 px-3 py-1.5 text-white rounded bg-neutral-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500"
                                    onClick={handleAddEmails}
                                >
                                    <IconPlus size={18} />
                                </button>
                            </div>
                            <div className='w-full relative mb-4'>
                                <EmailsAutoComplete
                                    input = {input}
                                    setInput =  {setInput}
                                    allEmails = {allEmails}
                            alreadyAddedEmails = {Object.keys(shareWith)}
                            /> 
                            </div>  
                        </div>   
                        <div className="h-[62px] overflow-y-auto "> 
                            {shareWith.map((email, index) => (
                                <div 
                                    key={index}
                                    className="flex items-center justify-between bg-white dark:bg-neutral-200 rounded-md px-2 py-0 mr-2 mb-2 shadow-lg"
                                    style={{ backgroundColor: stringToColor(email) }}
                                >
                                    <button
                                        className="text-gray-800 transition-all"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShareWith(shareWith.filter(x => x !== email));
                                        }}
                                        title="Remove Email"
                                    >
                                        <IconCircleX size={17} />
                                        
                                    </button>
                                    <div className="ml-1">
                                        <label className="text-gray-800 font-medium text-sm">{email}</label>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <CancelSubmitButtons
                        submitText="Share"
                        onSubmit={() => handleShareArtifact()}
                        onCancel={() => setIsSharing(false)}
                        />
                    {/* </div> */}
                    </div>
                    }


                    {/* {isUploading && <>
                        <CancelSubmitButtons
                        submitText="Upload"
                        onSubmit={handleUploadAsFile}
                        onCancel={() => {
                            setIsUploading(false)
                            setTags([])
                        }}
                        />
                    
                    </>}

                    {isSaving && <>
                        <CancelSubmitButtons
                        submitText="Save"
                        onSubmit={handleSaveArtifact}
                        onCancel={() => {
                            setIsSaving(false)
                            setTags([])
                        }}
                        />
                    </>} */}
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
            
            <div className="flex justify-center items-center ">
                <div className="w-full flex flex-row justify-between mr-2">
                    
                    <div className="flex flex-col w-full px-2">
                        
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
                    

                    <div className="h-min mt-8 flex flex-col gap-3 items-center p-2 border border-gray-500 dark:border-gray-500 shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                        {isPreviewing ?
                            <button
                            className={chat_icons_cn}
                            id="viewCode"
                            onClick={() => {
                                setIsPreviewing(false)}}
                            title="View Code"
                            disabled={artifactIsStreaming}
                            >
                            <IconCode size={24}/>
                            </button> :             
                            <button
                                className={chat_icons_cn}
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
                            className={chat_icons_cn}
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
                            className={chat_icons_cn}
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
                            className={chat_icons_cn}
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
                                className={chat_icons_cn}
                                id="copyArtifact"
                                onClick={copyOnClick}
                                title="Copy Artifact"
                                disabled={artifactIsStreaming}
                            >
                                <IconCopy size={24}/>
                            </button>
                        
                        )}

                        <button
                            className={chat_icons_cn}
                            id="downlaodArtifact"
                            onClick={handleDownloadArtifact}
                            title="Download Artifact"
                            disabled={artifactIsStreaming}
                        >
                            <IconDownload size={24}/>
                        </button>

                        <button
                            className={chat_icons_cn}
                            id="emailArtifact"
                            title="Email Artifact"
                            disabled={artifactIsStreaming}
                            onClick={()=> statsService.mailArtifactEvent()}
                        >
                            <a className={chat_icons_cn}
                                href={`mailto:?body=${encodeURIComponent( getArtifactContents() )}`}>
                                <IconMail size={24}/>
                            </a>
                            
                        </button>

                        <button
                            className={chat_icons_cn}
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
                            className={chat_icons_cn}
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
                            className={chat_icons_cn}
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



