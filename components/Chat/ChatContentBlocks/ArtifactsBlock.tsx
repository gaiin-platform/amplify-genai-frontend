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
        if (selectedConversation && selectedConversation.messages) {
            const msg = selectedConversation.messages[messageIndex];
            if (msg && msg.data && msg.data.artifacts) setArtifacts(msg.data.artifacts);
        }

        // console.log(selectedConversation?.artifacts);
        
    }, [selectedConversation])



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
        <div className="flex flex-col w-full mt-5 text-gray-800">
            <div className="mr-3 dark:text-white">Artifacts:</div>

            <div className="flex flex-wrap">
                {selectedConversation && artifacts.map((artifact: ArtifactBlockDetail, i:number) => (
                    (Object.keys(selectedConversation.artifacts ?? {}).includes(artifact.artifactId) && 
                    <div key={i} className="mr-3 mb-3">
                        <div className="relative group">
                            <div 
                                className="rounded-lg shadow-lg overflow-hidden relative cursor-pointer"
                                style={{
                                    width: '200px',
                                    height: '200px',
                                }}
                                onClick={() => handleOpenArtifacts(artifact)}
                                title={artifact.description}
                            >
                                {/* Custom tooltip that appears on hover */}
                                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-3 py-1 rounded-md text-sm max-w-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
                                    <div className="text-center truncate">
                                        {artifact.name.length > 40 ? (
                                            <span title={artifact.name}>{artifact.name.substring(0, 40)}...</span>
                                        ) : (
                                            artifact.name
                                        )}
                                    </div>
                                </div>

                                {/* Artifact icon and background */}
                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-gray-700 dark:to-gray-800">
                                    <div className="text-yellow-600 dark:text-gray-300">
                                        <IconLibrary size={64} stroke={1.5} />
                                    </div>
                                </div>
                                
                                {/* Bottom label with artifact name */}
                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-60 text-white">
                                    <div className="truncate text-sm">
                                        {artifact.name}
                                    </div>
                                    {artifact.version && (
                                        <div className="text-xs text-gray-300">
                                            Version {artifact.version}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Remove button */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        className="p-1 bg-white rounded-full shadow-md hover:bg-gray-200"
                                        onClick={(e) => {
                                            e.stopPropagation(); 
                                            handleRemoveArtifact(artifact);
                                        }}
                                        title="Remove Artifact from Conversation"
                                        id="removeArtifactFromConversation"
                                    >
                                        <IconX size={18} />
                                    </button>
                                </div>

                                {/* Created date - only show on hover */}
                                {artifact.createdAt && (
                                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="px-2 py-1 bg-black bg-opacity-60 text-white text-xs rounded">
                                            {artifact.createdAt}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>)
                ))}
            </div>
        </div> 

   )
   

}
