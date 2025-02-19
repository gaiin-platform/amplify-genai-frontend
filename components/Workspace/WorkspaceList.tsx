import React, {FC, useContext, useEffect, useState} from 'react';
import {ExportFormatV4, ShareItem} from "@/types/export";
import {
    IconCloudComputing,
    IconRocket,
} from '@tabler/icons-react';
import {getSharedItems} from "@/services/shareService";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {SaveWorkspaceModal} from "@/components/Workspace/SaveWorkspaceModal";
import {ImportWorkspaceModal} from "@/components/Workspace/ImportWorkspaceModal";
import HomeContext from "@/pages/api/home/home.context";
import {saveWorkspaceMetadata} from "@/utils/app/settings";
import {Workspace} from "@/types/workspace";
import {v4} from "uuid";
import {useSession} from "next-auth/react";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";

type SharedItemsListProps = {};

function groupBy(key: string, array: ShareItem[]): { [key: string]: ShareItem[] } {
    return array.reduce((result: { [key: string]: ShareItem[] }, currentItem) => {
        (result[currentItem[key as keyof ShareItem]] = result[currentItem[key as keyof ShareItem]] || []).push(currentItem);
        return result;
    }, {});
}

const WorkspaceList: FC<SharedItemsListProps> = () => {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
    const [selectedKey, setSelectedKey] = useState<string>("");
    const [selectedNote, setSelectedNote] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [groupedItems, setGroupedItems] = useState<{ [key: string]: ShareItem[] }>({});
    const { data: session } = useSession();
    const user = session?.user;

    const {
        state: {workspaceMetadata, workspaceDirty, statsService},
        dispatch: homeDispatch,
        clearWorkspace
    } = useContext(HomeContext);


    const fetchData = async () => {
        try {
            if (user?.email) {

                statsService.openWorkspacesEvent();

                try {
                    const result = await getSharedItems();

                    if (result.success) {
                        const mine = result.items.filter((item: { sharedBy: string; }) => {
                            return item.sharedBy === user.email;
                        });
                        const grouped = groupBy('note', mine);
                        setGroupedItems(grouped);
                    }

                } finally {
                    setIsLoading(false);
                }
            }
        } catch (e) {
            alert("Unable to context the Amplify API. Please check your Internet connection and try again later.")
        }
    };

    useEffect(() => {
        const name = user?.email;

        fetchData();

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


    return (
        <div className={`border-t dark:border-white/20`}>

            {importModalOpen && (
                <ImportWorkspaceModal
                    onImport={() => {
                        setImportModalOpen(false);
                    }}
                    onCancel={() => {
                        setImportModalOpen(false);
                    }}
                    includeConversations={true}
                    includePrompts={true}
                    includeFolders={true}
                    importKey={selectedKey}
                    note={selectedNote}
                    date={selectedDate}
                    editable={false}
                />
            )}

            <SaveWorkspaceModal
                open={isModalOpen}
                onShare={() => {
                    setIsModalOpen(false);
                    setIsLoading(true);
                    fetchData();
                }}
                onCancel={() => {
                    setIsModalOpen(false)
                }}
                includeConversations={true}
                includePrompts={true}
                includeFolders={true}
                editable={false}
            />


            <div className="flex flex-row w-full items-center p-3">
                <div className="w-full flex items-center">
                    <button
                        className="text-sidebar flex w-full flex-shrink-0 cursor-pointer select-none items-center gap-3 rounded-md border dark:border-white/20 p-3 dark:text-white transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-gray-500/10"
                        onClick={() => {
                            setIsModalOpen(true);
                        }}
                    >
                        <IconCloudComputing size={16}/>
                        Save
                    </button>
                </div>
                <div className="w-full flex items-center pl-2">
                    <button
                        className="text-sidebar flex w-full flex-shrink-0 cursor-pointer select-none items-center gap-3 rounded-md border dark:border-white/20 p-3 dark:text-white transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-gray-500/10"
                        onClick={() => {

                            let proceed = true;
                            if (workspaceDirty) {
                                proceed = confirm(`Are you sure you want to create a new workspace? This will overwrite your current workspace. Your unsaved workspace changes will be lost.`);
                            }

                            if(proceed) {

                                let name = prompt("Please provide a name for the new workspace.");

                                if(name == null || name.trim().length == 0) {
                                    return;
                                }

                                clearWorkspace().then(()=> {

                                    if(name) {
                                        const updatedWorkspace:Workspace = {
                                            description: "",
                                            id: v4(),
                                            name: name,
                                            createdAt: new Date().toISOString(),
                                            lastAccessedAt: new Date().toISOString(),
                                            updatedAt: new Date().toISOString(),
                                            tags:[],
                                            data:{}
                                        };
                                        homeDispatch({field: 'workspaceMetadata', value: updatedWorkspace});
                                        saveWorkspaceMetadata(updatedWorkspace);
                                        window.location.reload();
                                    }
                                }).catch(err => {
                                    console.error(err);
                                    alert("Unable to load workspace. Please try again.");
                                });
                            }
                        }}
                    >
                        <IconRocket size={16}/>
                        New
                    </button>
                </div>
            </div>

            {workspaceMetadata && (
                <div className="flex flex-col items-center pt-3 pl-3 pr-3">
                    <div className="text-md"><b>Workspace:</b> {workspaceMetadata.name}</div>
                    {workspaceDirty && <span className="text-red-500 text-xs">(unsaved changes)</span>}
                </div>
            )}

            <h3 className="text-lg border-b p-3 ml-3 mr-3">Your Workspaces</h3>

            {isLoading && (
                <div className="flex flex-row ml-6 mt-6">
                    <LoadingIcon/>
                    <span className="text-l font-bold ml-2">Loading...</span>
                </div>
            )}

            {Object.entries(groupedItems)
                .map(([note, items]) => (
                    <div key={note} className="sharedBy-group ml-3 mt-2 p-2">
                      <ExpansionComponent title={note.slice(0, 30)}
                                          content={items.map((item, index) => (
                            <button
                                key={index}
                                className="flex w-full cursor-pointer items-center gap-3 rounded-lg pb-2 pt-3 pr-2 text-sm transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-[#343541]/90"
                                onClick={() => {
                                    handleFetchShare(item);
                                }}
                            >
                                <IconRocket className='ml-2' size={18}/>
                                <div className="flex-1 flex-col break-all text-left text-[12.5px] leading-3 pr-1">
                                    <div className="mb-1 text-gray-500">{new Date(item.sharedAt).toLocaleString()}</div>
                                    <div
                                        className="relative max-w-5 flex-1 break-all text-left text-[12.5px] leading-3 pr-1"
                                        style={{wordWrap: "break-word"}} // Added word wrap style
                                    >
                                        {item.note}
                                    </div>
                                </div>
                            </button>
                        ))}
                          />
                    </div>
                ))}
        </div>
    );
};

export default WorkspaceList;