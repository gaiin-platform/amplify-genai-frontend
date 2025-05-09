import React, {FC, useContext, useEffect, useState} from 'react';
import {ExportFormatV4, ShareItem} from "@/types/export";
import {
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
        state: {statsService, workspaces},
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
        <div className={`dark:border-white/20`}>

            {importModalOpen && (
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
                    />
            )}

            <div className="mb-2 text-lg pb-2 font-bold text-black dark:text-neutral-200 flex items-center border-b">
              Workspaces
            </div>

            {workspaces && workspaces.map((item: ShareItem, index: number) => 
                 <button
                    key={index}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-lg pb-2 pt-3 pr-2 text-sm transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-[#343541]/90"
                    onClick={() => {
                        handleFetchShare(item);
                    }}
                >
                    <IconRocket className='ml-2 mb-1' size={22}/>
                    <div className="flex flex-row gap-1 break-all text-left leading-3 pr-1">
                        <div className="flex-1 break-all text-left text-[15px] leading-3 pr-1"
                            style={{wordWrap: "break-word"}} // Added word wrap style
                        >
                            {item.note}
                        </div>
                        <div className="mb-1 text-gray-500">{new Date(item.sharedAt).toLocaleString()}</div>
                    </div>
                </button>
            )}
        </div>
    );
};

export default LegacyWorkspaces;