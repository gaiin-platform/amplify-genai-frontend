import React, {FC, useContext, useEffect, useState} from 'react';
import {ExportFormatV4, ShareItem} from "@/types/export";
import {
    IconCaretDown,
    IconCaretRight,
    IconCheck,
    IconPencil,
    IconTrash,
    IconCloudComputing,
    IconRocket,
    IconShare,
    IconX, IconPlus,
} from '@tabler/icons-react';
import {getSharedItems, loadSharedItem} from "@/services/shareService";
import {useUser} from '@auth0/nextjs-auth0/client';
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {ImportAnythingModal} from "@/components/Share/ImportAnythingModal";
import {SaveWorkspaceModal} from "@/components/Workspace/SaveWorkspaceModal";
import {ImportWorkspaceModal} from "@/components/Workspace/ImportWorkspaceModal";
import HomeContext from "@/pages/api/home/home.context";
import {saveWorkspaceMetadata} from "@/utils/app/settings";
import {Workspace} from "@/types/workspace";
import {v4} from "uuid";

type SharedItemsListProps = {};

function groupBy(key: string, array: ShareItem[]): { [key: string]: ShareItem[] } {
    return array.reduce((result: { [key: string]: ShareItem[] }, currentItem) => {
        (result[currentItem[key as keyof ShareItem]] = result[currentItem[key as keyof ShareItem]] || []).push(currentItem);
        return result;
    }, {});
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
  font-size: 1rem;
  animation: ${animate} 2s infinite;
`;

const WorkspaceList: FC<SharedItemsListProps> = () => {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
    const [selectedKey, setSelectedKey] = useState<string>("");
    const [selectedNote, setSelectedNote] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [groupedItems, setGroupedItems] = useState<{ [key: string]: ShareItem[] }>({});
    const {user} = useUser();

    const {
        state: {workspaceMetadata},
        dispatch: homeDispatch,
        clearWorkspace
    } = useContext(HomeContext);

    const fetchData = async () => {
        if (user?.name) {
            try {
                const result = await getSharedItems(user.name);

                if (result.ok) {
                    const items = await result.json();
                    const mine = items.item.filter((item: { sharedBy: string; }) => {
                        return item.sharedBy === user.name;
                    });
                    const grouped = groupBy('note', items.item);
                    setGroupedItems(grouped);
                }

            } finally {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        const name = user?.name;

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
                includeFolders={true}/>

            <div className="flex flex-row w-full items-center p-3">
                <div className="w-full flex items-center p-3">
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
                <div className="w-full flex items-center p-3">
                    <button
                        className="text-sidebar flex w-full flex-shrink-0 cursor-pointer select-none items-center gap-3 rounded-md border dark:border-white/20 p-3 dark:text-white transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-gray-500/10"
                        onClick={() => {
                            if(confirm(`Are you sure you want to load a new workspace? This will clear your current workspace. If you have any unsaved changes, they will be lost.`)) {
                                clearWorkspace().then(()=> {
                                    let name = prompt("Please provide a name for the new workspace.");
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
                                <IconRocket size={18}/>
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