import { IconLibrary,  IconTrash } from '@tabler/icons-react';

import { FC, useContext, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import HomeContext from '@/pages/api/home/home.context';
import { conversationWithCompressedMessages, saveConversations } from '@/utils/app/conversation';
import { Conversation } from '@/types/chat';
import { Artifact, ArtifactBlockDetail } from '@/types/artifacts';
import { deleteArtifact, getArtifact } from '@/services/artifactsService';
import toast from 'react-hot-toast';
import { uploadConversation } from '@/services/remoteConversationService';
import { animate } from '../Loader/LoadingIcon';
import { FiCommand } from 'react-icons/fi';
import styled from 'styled-components';



interface Props {
  iconSize: number | string;
}

export const LoadingIcon = styled(FiCommand)`
  color: lightgray;
  font-size: 16px;
  animation: ${animate} 2s infinite;
`;

export const ArtifactsSaved: FC<Props> = ({
  iconSize
}) => {
  const { 
    state: { selectedConversation, conversations, folders, artifacts}, dispatch: homeDispatch
  } = useContext(HomeContext);



  const conversationsRef = useRef(conversations);

  useEffect(() => {
      conversationsRef.current = conversations;
  }, [conversations]);

  const foldersRef = useRef(folders);

  useEffect(() => {
      foldersRef.current = folders;
  }, [folders]);

  const [artifactList, setSetArtifactList] = useState<any>(artifacts);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [hoveredItem, setHoveredItem] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const artifactsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSetArtifactList(artifacts);
  }, [artifacts]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (artifactsRef.current && !artifactsRef.current.contains(event.target as Node)) setIsOpen(false);
    };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, []);




const handleUpdateConversation = (updatedConversation: Conversation, artifact: Artifact ) => {
  // update selectedConversation to include the completed selectArtifacts
    const conversationArtifacts = updatedConversation.artifacts ?? {};
    artifact = {...artifact, version: 1};
    let artifactList = [artifact];

    if (Object.keys(conversationArtifacts).includes(artifact.artifactId)) {
      artifact.version = conversationArtifacts[artifact.artifactId].slice(-1)[0].version + 1;
      artifactList = [...conversationArtifacts[artifact.artifactId], artifact];
    }

    updatedConversation.artifacts = {...conversationArtifacts, [artifact.artifactId]: artifactList };
    
    const lastMessageData = updatedConversation.messages.slice(-1)[0].data;
    updatedConversation.messages.slice(-1)[0].data.artifacts = [...(lastMessageData.artifacts ?? []), {artifactId: artifact.artifactId, name: artifact.name, createdAt:  artifact.createdAt, description: artifact.description, version: artifact.version === 1 ? undefined : artifact.version} as ArtifactBlockDetail];

    // Final updates for conversation and artifacts
    if (selectedConversation && selectedConversation.isLocal) {
        const updatedConversations: Conversation[] = conversationsRef.current.map(
            (conversation:Conversation) => {
                if (conversation.id === selectedConversation.id) {
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

    homeDispatch({
        field: 'selectedConversation',
        value: updatedConversation,
    }); 

}

const handleAddArtifactToConversation = async (key: string,) => {
    setIsLoading(true);
    const result = await getArtifact(key);
    if (result.success) {
      const artifact:Artifact = result.data;
      if (selectedConversation)  handleUpdateConversation({...selectedConversation}, artifact);
    } else {
      alert("Unable to retrieve the artifact at this time. Please try again later.");
    } 
    setIsLoading(false);
    setIsOpen(false);
}


const handleDeleteArtifact = async (key: string, index:number) => {
    setIsLoading(true);
    if (confirm("Are you sure you want to delete this artifact? You will not be able to undo this change.")) {
      const result = await deleteArtifact(key);
      if (result) {
        toast("Artifact successfully deleted");
        const updatedList = artifactList.filter((_:any, i:number) => i !== index);;
        homeDispatch({field: "artifacts", value: updatedList});
        setIsLoading(false);
        setSetArtifactList(updatedList);
        setHoveredItem(-1);
      } else {
        alert("Unable to delete the artifact at this time. Please try again later.");
      }
    }
}

if (artifacts.length === 0) return <></>;

return (
        <div className='flex flex-col '>
        <button
            className="ml-2 cursor-pointer hover:opacity-50"
            onClick={(e) => setIsOpen(!isOpen)}
            title={"Add Artifacts To Conversation"}
            >
            <IconLibrary className="block text-neutral-500 dark:text-neutral-200" size={iconSize} /> 
        </button>

        {isOpen &&
        <div ref={artifactsRef}  
            className="overflow-auto fixed z-50 border border-neutral-300 rounded bg-neutral-100 dark:border-neutral-600 bg-neutral-100 dark:bg-[#444654]"
            style={{maxHeight: `200px`, top: 50}}>
                <ul className="suggestions-list ">
                {artifacts.map((artifact, index) => (
                    <li key={index} onClick={() => { if (!isLoading) handleAddArtifactToConversation(artifact.key)}} 
                    onMouseEnter={() => setHoveredItem(index)} onMouseLeave={() => setHoveredItem(-1)}
                    title={`${artifact.description}\n - ${artifact.sharedBy ? `Shared by: ${artifact.sharedBy}` : artifact.createdAt}`}
                    className="p-2.5 border-b border-neutral-300 dark:border-b-neutral-600 hover:bg-neutral-200 dark:hover:bg-[#343541]/90 flex flex-row gap-2">
                      <label className='truncate flex-grow' style={{maxWidth: hoveredItem === index || isLoading ? '200px' : '224px', cursor: isLoading ? 'default': 'pointer'}}> {artifact.name}</label>
                      
                      { isLoading ? 
                        <LoadingIcon/>
                        :
                        <button
                          type="button"
                          style={{ display: hoveredItem === index ? 'block' : 'none' }}
                          className={` ml-auto text-sm  rounded  text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100`}
                          onClick={() => (handleDeleteArtifact(artifact.key, index))}
                      >
                          <IconTrash size={16} />
                        </button> 

                        
                      }
                        
                    </li>
                ))}
                </ul>
        </div> }
        </div>
)
};
