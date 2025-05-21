import React, {FC, useContext, useEffect, useRef, useState} from 'react';
import {ShareItem, SharedItem} from "@/types/export";
import {
    IconShare,
    IconRefresh,
    IconCheck,
    IconX,
} from '@tabler/icons-react';
import {deleteYouSharedItem, getSharedItems, getYouSharedItems} from "@/services/shareService";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {ImportAnythingModal} from "@/components/Share/ImportAnythingModal";
import HomeContext from "@/pages/api/home/home.context";
import {useSession} from "next-auth/react";
import ActionButton from '../ReusableComponents/ActionButton';

const SharedItemsList: FC<{}> = () => {

    const {dispatch: homeDispatch, state:{statsService, featureFlags, prompts}} = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);

    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
    const [sharedBy, setSharedBy] = useState<string>("");
    const [selectedKey, setSelectedKey] = useState<string>("");
    const [selectedNote, setSelectedNote] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [allItems, setAllItems] = useState<ShareItem[]>([]);
    const [deletingItem, setDeletingItem] = useState<ShareItem | null>(null);
    const [hoveredItem, setHoveredItem] = useState<ShareItem | null>(null);
    const [isButtonHover, setIsButtonHover] = useState<boolean>(false);

    const { data: session } = useSession();
    const user = session?.user;

    useEffect( () => {
        const name = user?.email;
        if (name) {
            statsService.openSharedItemsEvent();
            if (allItems.length === 0) fetchSWYData(name);
        }

    }, [user]);

    const fetchSWYData = async (name: string) => {
            if (name) {
                try {
                    const result = await getSharedItems();
                    if (result.success) {
                        const shared = result.items.filter((item: { sharedBy: string; }) => {
                            return item.sharedBy !== user?.email;
                        });
                        // Sort by sharedAt timestamp, newest first
                        const sortedItems = shared.sort((a: ShareItem, b: ShareItem) => {
                            return new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime();
                        });
                        setAllItems(sortedItems);
                    }

                } catch (e) {
                   alert("Unable to fetch your shared items. Please check your Internet connection and try again later.")
                } finally {
                    setIsLoading(false);
                }
            }
    };

    const handleFetchShare = async (item: ShareItem) => {
        setSelectedKey(item.key);
        setSelectedNote(item.note);
        setImportModalOpen(true);
    }

    const handleSWYDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (deletingItem) {
            alert("Not ready yet, in progess - karely ")
            // if (confirm("If you have imported this item, you will no longer have access to this item. \n\nWould you like to continue?")) await deleteShareItem(deletingItem);
            // Remove from local starage and dispatch!! 
            // pull data to see items that need to be removed 
            setDeletingItem(null);
        }
    };

    const handleCancelDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setDeletingItem(null); 
    };

    const handleOpenDeleteModal = (item: ShareItem, e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setDeletingItem(item); 
    };

    return (
        <div className={`border-t dark:border-white/20 overflow-x-hidden`}>

            {importModalOpen && (
                <ImportAnythingModal
                    onImport={(sharedData) => {
                        statsService.sharedItemAcceptedEvent(sharedBy, selectedNote, sharedData);
                        setImportModalOpen(false);
                    }}
                    onCancel={() => {
                        setImportModalOpen(false);
                    }}
                    importKey={selectedKey}
                    note={selectedNote}
                />
            )}

            <ShareAnythingModal
                open={isModalOpen}
                onShare={() => {
                    setIsModalOpen(false)
                }}
                onCancel={() => {
                    setIsModalOpen(false)
                }}
                includeConversations={true}
                includePrompts={true}
                includeFolders={true}/>

            <div className="flex flex-row items-center pt-3 pl-2 pr-3">
                <div className="mb-4 flex items-center space-x-2">
                    <button
                        id="shareWithOtherUsers"
                        className="text-sidebar flex flex-grow flex-shrink flex-shrink-0 cursor-pointer select-none items-center gap-3 rounded-md border dark:border-white/20 p-3 dark:text-white transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-gray-500/10"
                        onClick={() => {
                            setIsModalOpen(true);
                        }}
                    >
                        <IconShare size={16}/>
                        Share with Other Users
                    </button>
                    <button
                        title='Refresh'
                        id="refreshButton"
                        disabled={isLoading}
                        className={`text-sidebar flex flex-grow flex-shrink-0 select-none items-center gap-3 rounded-md border dark:border-white/20 p-3 dark:text-white transition-colors duration-200 ${!isLoading ? "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" : ""}`}
                        onClick={async () => {
                        if (user?.email) {
                           setIsLoading(true);
                           await fetchSWYData(user?.email);
                        }}
                        }
                    >
                        <IconRefresh size={16}/>
                    </button>
                </div>
            </div>

            <div className="px-2 py-3 border-b dark:border-white/20">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Shared With You</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Items shared with you, newest first</p>
            </div>

            {isLoading ? (
                <div className="flex flex-row ml-6 mt-6">
                    <LoadingIcon/>
                    <span className="text-l font-bold ml-2">Loading...</span>
                </div>
            ) : (
                <div className="p-2">
                    {allItems.length === 0 ? (
                        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                            No items shared with you yet
                        </div>
                    ) : (
                        allItems.map((item, index) => (
                            <button
                                key={index}
                                onMouseEnter={() => {
                                    setHoveredItem(item)
                                    setIsButtonHover(true)
                                }}
                                onMouseLeave={() => {
                                    setDeletingItem(null); 
                                    setHoveredItem(null)
                                }}
                                className={`w-full flex cursor-pointer items-center gap-3 rounded-lg p-3 mb-2 text-sm transition-colors duration-200 border border-neutral-200 dark:border-neutral-600 ${isButtonHover ? "hover:bg-neutral-100 dark:hover:bg-[#343541]/90": ""}`}
                                onClick={() => {
                                    setSharedBy(item.sharedBy);
                                    handleFetchShare(item);
                                }}
                            >
                                <IconShare size={18} className="flex-shrink-0 text-green-600 dark:text-green-400"/>
                                <div className="flex-1 text-left">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                            {item.sharedBy.includes('@') ? item.sharedBy.split("@")[0] : item.sharedBy}
                                        </div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                            {new Date(item.sharedAt).toLocaleString(undefined, {
                                                month: 'short', 
                                                day: 'numeric',
                                                hour: 'numeric', 
                                                minute: '2-digit',
                                                hour12: true
                                            })}
                                        </div>
                                    </div>
                                    <div className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
                                        {item.note}
                                    </div>
                                </div>
                                {hoveredItem === item && ( 
                                    <div className="ml-2 flex-shrink-0 flex flex-row items-center bg-neutral-200 dark:bg-[#343541]/90 rounded"
                                        onMouseEnter={() => {
                                            setHoveredItem(item)
                                            setIsButtonHover(false)
                                        }}
                                        onMouseLeave={() => setIsButtonHover(true)}>
                                        {!deletingItem && ( <></>
                                            // <ActionButton handleClick={(e) => handleOpenDeleteModal(item, e)} title="Delete Shared Item">
                                            //     <IconTrash size={18} />
                                            // </ActionButton>
                                        )}

                                        {deletingItem && (
                                            <>
                                                <ActionButton handleClick={handleSWYDelete} title="Confirm">
                                                    <IconCheck size={18} />
                                                </ActionButton>

                                                <ActionButton handleClick={handleCancelDelete} title="Cancel">
                                                    <IconX size={18} />
                                                </ActionButton>
                                            </>
                                        )}
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default SharedItemsList;