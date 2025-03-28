// import AutoArtifactsBlock from "./AutoArtifactBlock";


import { useEffect, useState, useContext, useRef } from "react";
import HomeContext from "@/pages/api/home/home.context";
import { IconLibrary, IconX } from "@tabler/icons-react";
import { Conversation, Message } from "@/types/chat";
import { Artifact, ArtifactBlockDetail } from "@/types/artifacts";
import toast from "react-hot-toast";
import React from "react";


  interface Props {
    message: Message;
    messageIndex: number;
}

// this displays a clickable button to open up the artifact in the artifact window 
// supports coming from assitant (coming from autoArtifacts block) and from message data (when saved artifact gets introduced to conversation)
export const ArtifactsBlock: React.FC<Props> = ({message, messageIndex}) => {

    const {state:{statsService, conversations, folders, messageIsStreaming, artifactIsStreaming, selectedConversation},  
           dispatch:homeDispatch, handleUpdateSelectedConversation} = useContext(HomeContext);

    const [artifacts, setArtifacts] = useState <ArtifactBlockDetail[] | undefined > ((message?.data?.artifacts));
    

    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);


    const conversationsRef = useRef(conversations);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);
    
    useEffect(()=> {
        if (!artifacts && message?.data.artifacts) setArtifacts(message.data.artifacts);
    }, [message])

    useEffect(()=> {
        if (selectedConversation) {
            const msg = selectedConversation.messages[messageIndex];
            if (msg && msg.data && msg.data.artifacts) setArtifacts(msg.data.artifacts);
        }

        // console.log(selectedConversation?.artifacts);
        
    }, [selectedConversation])


    const [isHovered, setIsHovered] = useState <number> (-1);

    if (!artifacts || messageIsStreaming || artifactIsStreaming) return <></>;

    const handleOpenArtifacts = (artifact: ArtifactBlockDetail) =>  {
        if (selectedConversation && selectedConversation.artifacts) {
            //if the version no longer exists then do an alert and open the latest version 
            // make sure the conversation still has the artifact saved.
            const artifactsList = selectedConversation.artifacts[artifact.artifactId];
            if (artifactsList && artifactsList.length > 0) {
                homeDispatch({field: "selectedArtifacts", value: artifactsList});
                let index = artifactsList.length - 1;
                if (artifact.version) {
                    const foundIdx = artifactsList.findIndex((a:Artifact) => a.version === artifact.version);
                    if (foundIdx !== -1) {
                        index = foundIdx;
                    } else {
                        toast('This version is no longer available, directing you to the latest version of this artifact.');
                        handleRemoveArtifact(artifact);
                    }
                } else {
                    index = 0;
                }
                window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: true, artifactIndex: index}} ));
            } else {
                alert('Artifact not found.');
            }
            
        }  
    }

    const handleRemoveArtifact = (artifact: ArtifactBlockDetail) =>  {
        if (selectedConversation) {
            const updatedArtifacts = artifacts.filter((a: ArtifactBlockDetail) => JSON.stringify(a) !== JSON.stringify(artifact));
            const updatedConversation = {...selectedConversation};
            updatedConversation.messages[messageIndex].data.artifacts = updatedArtifacts;

            handleUpdateSelectedConversation(updatedConversation);
        }
    }

   return (
     <div className="flex flex-col gap-3 "
     >
        {selectedConversation &&  artifacts.map((artifact: ArtifactBlockDetail, i:number) => (
            (Object.keys(selectedConversation.artifacts ?? {}).includes(artifact.artifactId) && 
            <button onMouseEnter={() => setIsHovered(i)} onMouseLeave={() => setIsHovered(-1)}
                onClick={() => handleOpenArtifacts(artifact)} 
                title={artifact.description}
                disabled={artifactIsStreaming || messageIsStreaming}
                className="bg-yellow-400 dark:bg-[#B0BEC5] rounded-xl shadow-lg h-12 my-1.5 "
                key={i}
                id="artifactsButtonBlock"
            >
                <div className="flex flex-row text-black">
                    <div
                        className="w-14 h-12 flex-none bg-cover rounded-l-xl text-center overflow-hidden"
                        style={{backgroundImage: 'url("/sparc_apple.png")'}}
                        title={artifact.name}>
                    </div>
                    <div className="ml-5 mt-3">
                        <IconLibrary/>
                    </div>
                    <div className="mt-3 ml-3 text-[15px] text-start truncate max-w-[300px]">        
                        {artifact.name}
                    </div>
                    {artifact.version && 
                        <div className="mt-3 ml-2 text-[15px] text-gray-500 truncate">    
                            -  Version {artifact.version}
                        </div>}
                    {isHovered === i &&
                        <>
                            <div className="mt-3 mr-2 ml-auto text-[14px] whitespace-nowrap">    
                                {artifact.createdAt}
                            </div>

                            <div className="mr-4 mt-3.5 text-gray-500 hover:text-neutral-900"
                                id="removeArtifactFromConversation"
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    handleRemoveArtifact(artifact)}}
                                title="Remove Artifact from Conversation"
                            >
                                <IconX size={18} />
                            </div> 
                        </>
                        
                    }
                               
                </div>
            </button>)
            ))
        }
        
     </div> 

   )
   

}
