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

            <div className="p-4 border-b border-neutral-200 dark:border-neutral-600">
                <div className="flex items-center justify-between gap-3">
                    <button
                        id="shareWithOtherUsers"
                        className="flex-1 group relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                        onClick={() => {
                            setIsModalOpen(true);
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center justify-center gap-2">
                            <IconShare size={18} className="text-white group-hover:scale-110 transition-transform duration-200"/>
                            <span className="text-sm">Share with Others</span>
                        </div>
                    </button>
                    
                    <button
                        title='Refresh shared items'
                        id="refreshButton"
                        disabled={isLoading}
                        className={`group relative overflow-hidden bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-600 hover:border-blue-300 dark:hover:border-blue-600 text-neutral-700 dark:text-neutral-300 font-medium py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 ${!isLoading ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                        onClick={async () => {
                        if (user?.email && !isLoading) {
                           setIsLoading(true);
                           await fetchSWYData(user?.email);
                        }}
                        }
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center justify-center">
                            <IconRefresh 
                                size={18} 
                                className={`text-neutral-600 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all duration-200 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`}
                            />
                        </div>
                    </button>
                </div>
            </div>

            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-neutral-50 to-blue-50/30 dark:from-neutral-800 dark:to-blue-900/10"></div>
                <div className="relative px-4 py-4 border-b border-neutral-200 dark:border-neutral-600">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
                            <IconShare size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Shared With You</h3>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Items shared with you, newest first</p>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-12 h-12 border-4 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <span className="mt-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">Loading shared items...</span>
                </div>
            ) : (
                <div className="p-4 space-y-3">
                    {allItems.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                                <IconShare size={24} className="text-neutral-400 dark:text-neutral-500" />
                            </div>
                            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">No shared items yet</h3>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                                When someone shares conversations or prompts with you, they&apos;ll appear here
                            </p>
                        </div>
                    ) : (
                        allItems.map((item, index) => (
                            <div
                                key={index}
                                className="group relative overflow-hidden bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-sm hover:shadow-lg transition-all duration-300"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-emerald-50/50 dark:from-blue-900/10 dark:to-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                
                                <button

                                    onMouseEnter={() => {
                                        setHoveredItem(item)
                                        setIsButtonHover(true)
                                    }}
                                    onMouseLeave={() => {
                                        setDeletingItem(null); 
                                        setHoveredItem(null)
                                    }}
                                    className="relative w-full flex cursor-pointer items-center gap-4 p-4 text-left transition-all duration-200"
                                    onClick={() => {
                                        setSharedBy(item.sharedBy);
                                        handleFetchShare(item);
                                    }}
                                >
                                    <div className="flex-shrink-0">
                                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-100 to-blue-100 dark:from-emerald-900/30 dark:to-blue-900/30 rounded-xl group-hover:scale-110 transition-transform duration-200">
                                            <IconShare size={20} className="text-emerald-600 dark:text-emerald-400 group-hover:rotate-12 transition-transform duration-200"/>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-200">
                                                    {item.sharedBy.includes('@') ? item.sharedBy.split("@")[0] : item.sharedBy}
                                                </h4>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                                                    {item.note}
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0 ml-3">
                                                <div className="flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-700/50 rounded-lg">
                                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                                    <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                                        {new Date(item.sharedAt).toLocaleString(undefined, {
                                                            month: 'short', 
                                                            day: 'numeric',
                                                            hour: 'numeric', 
                                                            minute: '2-digit',
                                                            hour12: true
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-lg">
                                                Click to import
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                                            </div>
                                        </div>
                                    </div>

                                    {hoveredItem === item && ( 
                                        <div className="ml-2 flex-shrink-0 flex flex-row items-center bg-neutral-200 dark:bg-[#343541]/90 rounded-lg p-1"
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
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default SharedItemsList;