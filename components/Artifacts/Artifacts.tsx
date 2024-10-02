import { useEffect, useState, useContext, useRef } from "react";
import HomeContext from "@/pages/api/home/home.context";
import { useSession } from "next-auth/react";
import Loader from "@/components/Loader/Loader";
import cloneDeep from 'lodash/cloneDeep';

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
} from '@tabler/icons-react';
import { Artifact, ArtifactBlockDetail } from "@/types/artifacts";
import { ArtifactContentBlock } from "./ArtifactsContentBlock";
import { lzwCompress, lzwUncompress } from "@/utils/app/lzwCompression";
import { LoadingDialog } from "@/components/Loader/LoadingDialog";
import SidebarActionButton from "@/components/Buttons/SidebarActionButton";
import { ArtifactEditor } from "./ArtifactEditor";
import toast from "react-hot-toast";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { getAllArtifacts, saveArtifact, shareArtifact } from "@/services/artifactsService";
import { TagsList } from "../Chat/TagsList";
import { downloadArtifacts, extractCodeBlocksAndText, uploadArtifact } from "@/utils/app/artifacts";
import { EmailsAutoComplete } from "../Emails/EmailsAutoComplete";
import { Group } from "@/types/groups";
import { fetchEmailSuggestions } from "@/services/emailAutocompleteService";
import { stringToColor } from "../Emails/EmailsList";
import { Conversation } from "@/types/chat";
import { conversationWithCompressedMessages, saveConversations } from "@/utils/app/conversation";
import { uploadConversation } from "@/services/remoteConversationService";
import React from "react";
import { ArtifactPreview } from "./ArtifactPreview";

  interface Props {
    artifactIndex: number;
}

export const Artifacts: React.FC<Props> = ({artifactIndex}) => { //artifacts 
    const {state:{statsService, selectedConversation, selectedArtifacts, artifactIsStreaming, chatEndpoint, currentRequestId, conversations, folders, groups},  dispatch:homeDispatch} = useContext(HomeContext);

    const [selectArtifactList, setSelectArtifactList] = useState<Artifact[]>(selectedArtifacts ?? []);
    const [versionIndex, setVersionIndex] = useState<number>(artifactIndex || (selectArtifactList?.length ?? 1) - 1);

    // const [codeBlocks, setCodeBlocks] = useState< { language: string; code: string }[] >([]);

    useEffect(() => {
        setIsPreviewing(false);
        setIsEditing(false);
        setIsSharing(false);
    }, [artifactIsStreaming, versionIndex]);


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

    const markdownComponentRef = useRef<HTMLDivElement>(null);
    const divRef = useRef<HTMLDivElement>(null);

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
    const [highlightedText, setHighlightedText] = useState('');


    useEffect(() => {
        const fetchEmails = async () => {
            const emailSuggestions =  await fetchEmailSuggestions("*");
            // add groups  #groupName
            const groupForMembers = groups.map((group:Group) => `#${group.name}`);
            setAllEmails(emailSuggestions.emails ? [...emailSuggestions.emails,
                                                    ...groupForMembers].filter((e: string) => e !== user) : []);
        };
        if (!allEmails) fetchEmails();
    }, [open]);



  const checkForSelection = () => {
    const selection = window.getSelection()?.toString();
    if (selection) {
      setHighlightedText(selection); 
      console.log(selectArtifactList);
    } else {
      setHighlightedText('');
    }
    
  };

  React.useEffect(() => {
    document.addEventListener('mouseup', checkForSelection);

    return () => {
      document.removeEventListener('mouseup', checkForSelection);
    };
  }, []);

    useEffect(() => {
        if (isSaving || isSharing || isUploading) setIsModalOpen(true);
        if (!isSaving && !isSharing && !isUploading) setIsModalOpen(false);
    }, [isSaving, isSharing, isUploading]);

    
    const handleAddEmails = () => {
        const entries = input.split(',').map(email => email.trim()).filter(email => email);
        let entriesWithGroupMembers:string[] = [];

        if (groups.length > 0) {
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
        if (!navigator.clipboard) return;
        if (selectArtifactList) {
            const artifactContent = lzwUncompress(selectArtifactList[versionIndex].contents)
            navigator.clipboard.writeText(artifactContent).then(() => {
                setMessageCopied(true);
                setTimeout(() => {
                    setMessageCopied(false);
                }, 2000);
            });
        }
    };

    const handleEditArtifact = (editedContent: string) => {
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
                updatedArtifacts = [...selectArtifactList, newVersion];

                const lastMessageData = updatedConversation.messages.slice(-1)[0].data;
                updatedConversation.messages.slice(-1)[0].data.artifacts = [...(lastMessageData.artifacts ?? []), {artifactId: newVersion.artifactId, name: newVersion.name, createdAt:  newVersion.createdAt, description: newVersion.description, version: newVersion.version} as ArtifactBlockDetail];

            }
            if (selectedConversation) handleUpdateConversationArtifacts(updatedConversation, currentArtifact.artifactId, updatedArtifacts);
            setVersionIndex(updatedArtifacts.length - 1);
        }
    };


    const handleUpdateConversationArtifacts = (updatedConversation: Conversation, artifactId:string, updatedArtifacts: Artifact[]) => {
        setSelectArtifactList(updatedArtifacts);
        
        updatedConversation.artifacts = updatedArtifacts.length === 0 ? {...updatedConversation.artifacts} :
                                                                        { ...updatedConversation.artifacts, 
                                                                            [artifactId]: updatedArtifacts
                                                                        };
        // Dispatch the updated conversation to the home state
        homeDispatch({
            field: 'selectedConversation',
            value: updatedConversation,
        });

        if (updatedConversation.isLocal) {
            const updatedConversations: Conversation[] = conversationsRef.current.map(
                (conversation:Conversation) => {
                    if (conversation.id === updatedConversation.id) {
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

    }


    const handleDeleteArtifact = () => {
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
        setIsLoading('Downloading Artifact...');
        const artifact = selectArtifactList[versionIndex];
        const artifactContent = lzwUncompress(artifact.contents);
        downloadArtifacts(artifact.name.replace(/\s+/g, '_'), artifactContent);
        setIsLoading('');

    }

    const handleUploadAsFile = async () => {
        setIsUploading(false);
        setIsLoading('Upload Artifact to Amplify File Manager...');
        const artifact = selectArtifactList[versionIndex];
        const artifactContent = lzwUncompress(artifact.contents);
        await uploadArtifact(artifact.name.replace(/\s+/g, '_'), artifactContent, tags);
        handleTags();
        setIsLoading('');
    }

    const handleSaveArtifact = async () => {
        setIsSaving(false);
        setIsLoading('Saving Artifact...');
        const artifact = selectArtifactList[versionIndex];
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
                console.log("Failed to fetch remote Artifacts.");
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

   return ( 
   <div className={`flex-0 text-base overflow-hidden min-h-screen bg-gray-200 dark:bg-[#343541] text-black dark:text-white border-l border-black px-4`}>
        <div className="flex flex-col" ref={markdownComponentRef}> 
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
                    <div className="flex justify-center w-full">
                        <div className="p-4  border border-gray-500 rounded z-50 absolute bg-white dark:bg-[#444654]" style={{ transform: `translateY(100%)`}}>
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
                        
                    {isSharing && <div className="flex flex-col" >

                        {/* <div className="flex w-full flex-wrap pb-2 mt-2"> */}
                        {"Send Amplify Artifact"}
                        {groups.length > 0 && 
                            <div className='mb-2 flex flex-row gap-2 text-[0.795rem]'>
                                <IconInfoCircle size={14} className='mt-0.5 flex-shrink-0 text-gray-600 dark:text-gray-400' />
                                {'Use the "#" symbol to automatically include all members of the group.'}
                            </div>}
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


            <label className="mt-4 text-[36px] text-center"> Artifacts</label>
            <div className='absolute top-5 mr-auto ml-8 w-[26px]'> 
                <SidebarActionButton
                        handleClick={handleCloseArtifactMode}
                        title="Close">
                        <IconArrowNarrowLeft size={34} />
                </SidebarActionButton> 
            </div>
            
            <div className="flex justify-center items-center ">
                <div className="w-full flex flex-row justify-between mr-2">
                    
                    <div className="flex flex-col w-full px-2">
                        
                        {!isEditing && !isPreviewing &&  selectArtifactList && (
                            <div className="mt-8 flex flex-grow overflow-y-auto overflow-x-hidden justify-center" style={{height: innerHeight - 140}} 
                                    ref={divRef}
                            >
                                <ArtifactContentBlock
                                    artifactIsStreaming={artifactIsStreaming}
                                    selectedArtifact={selectArtifactList[versionIndex]}
                                    // handleCustomLinkClick={handleCustomLinkClick}
                                />
                            </div>
                        )}
                        {isEditing && ( 
                           
                            <ArtifactEditor
                                handleEditArtifact={handleEditArtifact}
                                setIsEditing={setIsEditing}
                                isEditing={isEditing}
                                artifactContent={selectArtifactList? lzwUncompress(selectArtifactList[versionIndex].contents) : ""}
                                height={innerHeight - 210}
                            /> 
                            
                        )} 
                        { isPreviewing  && 
                            <ArtifactPreview content={lzwUncompress(selectArtifactList[versionIndex].contents)} type={selectArtifactList[versionIndex].type} height={innerHeight - 155}/>
                        }
                        {selectArtifactList && 
                            <div className='mt-4 flex flex-row w-full'  title={`${versionIndex + 1} of ${selectArtifactList?.length}`}> 
                                    { !artifactIsStreaming && !isEditing && 
                                        <>
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
                                        </>
                                    }
                                    <div className="w-[550px] flex justify-center">
                                        <label className="mt-1.5" title={selectArtifactList[versionIndex].createdAt}>
                                            <label className="truncate"> {selectArtifactList[versionIndex].name} </label>
                                            {"  - Version: "}
                                            {selectArtifactList[versionIndex].version} 
                                        </label>
                                    </div>

                            </div>
                        }
                    </div>
                    

                    <div className="h-min mt-8 flex flex-col gap-3 items-center p-2 border border-gray-500 dark:border-gray-500">
                        {isPreviewing ?
                            <button
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            onClick={() => {
                                setIsPreviewing(false)}}
                            title="View Code"
                            // disabled={isEditing}
                            >
                            <IconCode size={24}/>
                            </button> :             
                            <button
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                onClick={() => {setIsEditing(false); setIsPreviewing(true);}}
                                title="Preview Artifact"
                                // disabled={isEditing}
                            >
                                <IconPresentation size={24}/>
                            </button> }
                        <button
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            onClick={() => {
                                setIsSharing(false); 
                                setIsUploading(false);
                                setIsSaving(true);

                                handleSaveArtifact();
                            }}
                            title="Save Artifact"
                        >
                            <IconDeviceFloppy size={24}/>
                        </button>

                        <button
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            onClick={() => {
                                setIsSaving(false);
                                setIsSharing(false);
                                setIsUploading(true);

                                handleUploadAsFile();
                            }}
                            title="Upload Artifact To Amplify File Manager"
                        >
                            <IconFileUpload size={24}/>
                        </button>
                        
                        {messagedCopied ? (
                            <IconCheck
                                size={24}
                                className="text-green-500 dark:text-green-400"
                            />
                        ) : (
                            <button
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                onClick={copyOnClick}
                                title="Copy Artifact"
                                disabled={isEditing}
                            >
                                <IconCopy size={24}/>
                            </button>
                        
                        )}

                        <button
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            onClick={handleDownloadArtifact}
                            title="Download Artifact"
                            disabled={isEditing}
                        >
                            <IconDownload size={24}/>
                        </button>

                        <button
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            title="Email Artifact"
                            disabled={isEditing}
                        >
                            <a className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                href={`mailto:?body=${encodeURIComponent( lzwUncompress(selectArtifactList[versionIndex].contents) )}`}>
                                <IconMail size={24}/>
                            </a>
                        </button>

                        <button
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            onClick={() => {
                                setIsSaving(false);
                                setIsUploading(false);
                                setIsSharing(true);
                                }}
                            title="Share Artifact"
                        >
                            <IconShare size={24}/>
                        </button>

                        <button
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            onClick={() => {setIsEditing(!isEditing)} }
                            title="Edit Artifact"
                        >
                            <IconEdit size={24}/>
                        </button>

                        <button
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            onClick={handleDeleteArtifact}
                            title="Delete Version"
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
    return  <div className={`border border-neutral-300 dark:border-neutral-600 ${isDisabled ? "opacity-30": ""}`}>
                <button
                    className={`p-1 text-neutral-500 dark:text-neutral-400 ${isDisabled ? "" :"hover:text-black dark:hover:text-neutral-100"}`}
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



