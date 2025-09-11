import React, {FC, useContext, useEffect, useState} from 'react';
import { createPortal } from 'react-dom';
import {ExportFormatV4, ShareItem} from "@/types/export";
import {
    IconInfoCircle,
    IconRocket,
} from '@tabler/icons-react';
import HomeContext from "@/pages/api/home/home.context";
import {useSession} from "next-auth/react";
import { ImportAnythingModal, ImportFetcher } from '../Share/ImportAnythingModal';
import { loadSharedItem } from '@/services/shareService';
import { Conversation } from '@/types/chat';
import { isLocalConversation } from '@/utils/app/conversation';
import { Prompt } from '@/types/prompt';
import { isAssistant } from '@/utils/app/assistants';
import { baseAssistantFolder, isBaseFolder, isBasePrompt } from '@/utils/app/basePrompts';
import { FolderInterface } from '@/types/folder';
import { InfoBox } from '../ReusableComponents/InfoBox';

type Props = {};


const LegacyWorkspaces: FC<Props> = () => {
    const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
    const [selectedKey, setSelectedKey] = useState<string>("");
    const [selectedNote, setSelectedNote] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<string>("");
    // const [isLoading, setIsLoading] = useState<boolean>(true);
    const { data: session } = useSession();
    const user = session?.user;

    const {
        state: {statsService, workspaces, lightMode},
        dispatch: homeDispatch,
    } = useContext(HomeContext);


    useEffect(() => {
        statsService.openWorkspacesEvent();
    }, [user]);


    const handleFetchShare = async (item: ShareItem) => {
        let date = '';
        if(item.sharedAt){
            try {
                date = new Date(item.sharedAt).toISOString();
            }catch (e) {
                console.log(e);
            }
        }

        setSelectedKey(item.key);
        setSelectedNote(item.note);
        setSelectedDate(date);
        setImportModalOpen(true);
    }

    const fetchData: ImportFetcher = async () => {
        const result = await loadSharedItem(selectedKey);
        if (result.success) {
            const workspaceData = JSON.parse(result.item) as ExportFormatV4;
            // filter out remote conversations 
            workspaceData.history = workspaceData.history.filter((c: Conversation) => isLocalConversation(c));
            // filter out remote assistants 
            workspaceData.prompts = workspaceData.prompts.filter((p: Prompt) => !isAssistant(p) && !isBasePrompt(p.id));
            workspaceData.folders = workspaceData.folders.filter((f: FolderInterface) => !isBaseFolder(f.id) && f.id!== baseAssistantFolder.id);
            
            console.log("workspace item: ", workspaceData)
            return {success: true, message:"Loaded workspace data successfully.", data: workspaceData};
        } else {
            return {success: false, message:"Failed to load workspace data.", data: null};
        }
    }

    return (
        <div className="legacy-workspaces-container">

            {importModalOpen && createPortal(
               <div className={lightMode}>
                <ImportAnythingModal
                    onImport={(sharedData) => {
                        statsService.sharedItemAcceptedEvent(user?.email ?? 'Self', selectedNote, sharedData);
                        setImportModalOpen(false);
                    }}
                    onCancel={() => {
                        setImportModalOpen(false);
                    }}
                    importKey={selectedKey}
                    importFetcher={fetchData}
                    note={selectedNote}
                    importButtonLabel={"Import Items"}
                    title={"Choose Workspace Items to Import"}
                    /></div>,
                document.body
            )}
            
            <div className="settings-card">
                <div className="settings-card-header flex flex-row items-center gap-4">
                    <h3 className="settings-card-title">{"Workspaces"}</h3>
                    <p className="settings-card-description">Restore items from your legacy workspaces</p>
                </div>
        
            {/* Information Banner */}
            <InfoBox
                rounded={true}
                color="#9333ea"
                content={
              <div className="legacy-workspaces-info-content">
                <p className="legacy-workspaces-info-text">
                  Workspaces contain your previously saved conversations, prompts, and folders.
                </p>
                <p className="legacy-workspaces-info-subtitle">
                  Click on any workspace to selectively import items into your current session.
                </p>
              </div>
            }
            />

            {/* Workspaces Grid */}
            {workspaces && workspaces.length > 0 ? (
              <div className="legacy-workspaces-grid">
                {workspaces.map((item: ShareItem, index: number) => {
                  const formattedDate = new Date(item.sharedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={index}
                      className="legacy-workspace-card"
                      onClick={() => handleFetchShare(item)}
                    >
                      <div className="legacy-workspace-card-content">
                        <div className="legacy-workspace-card-header flex">
                          <div className="legacy-workspace-icon-wrapper">
                            <IconRocket size={24} className="legacy-workspace-icon" />
                          </div>
                          <h3 className="legacy-workspace-title">
                            {item.note || `Workspace ${index + 1}`}
                          </h3>
                          
                        </div>
                        
                        <div className="legacy-workspace-info">
                          
                          <p className="legacy-workspace-date">
                            Created {formattedDate}
                          </p>
                        </div>

                        <div className="legacy-workspace-actions">
                          <div className="legacy-workspace-action-hint ">
                            Click to import items →
                          </div>
                        </div>
                      </div>
                      
                      <div className="legacy-workspace-overlay">
                        <div className="legacy-workspace-overlay-content">
                          <IconRocket size={28} className="legacy-workspace-overlay-icon" />
                          <span className="legacy-workspace-overlay-text">Import Items</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="legacy-workspaces-empty">
                <div className="legacy-workspaces-empty-icon">
                  <IconRocket size={48} />
                </div>
                <h3 className="legacy-workspaces-empty-title">No Legacy Workspaces</h3>
                <p className="legacy-workspaces-empty-description">
                  You don&apos;t have any legacy workspaces to import. Legacy workspaces appear here when you have previously saved workspace data.
                </p>
              </div>
            )}
        </div>
        </div>
       
    );
};

export default LegacyWorkspaces;