import React, {FC, useContext, useEffect, useRef, useState} from 'react';
import {ShareItem, SharedItem} from "@/types/export";
import {
    IconCaretDown,
    IconCaretRight,
    IconJetpack,
    IconRocket,
    IconShare,
    IconRefresh,
    IconCheck,
    IconX,
} from '@tabler/icons-react';
import {deleteYouSharedItem, getSharedItems, getYouSharedItems} from "@/services/shareService";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {ImportAnythingModal} from "@/components/Share/ImportAnythingModal";
import HomeContext from "@/pages/api/home/home.context";
import {ShareAnythingToMarketModal} from "@/components/Share/ShareAnythingToMarketModal";
import {useSession} from "next-auth/react";
//import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import { fetchData } from 'next-auth/client/_utils';
import { Tab, TabSidebar } from '../TabSidebar/TabSidebar';
import { isAssistantById } from '@/utils/app/assistants';
import ActionButton from '../ReusableComponents/ActionButton';

type SharedItemsListProps = {};

function groupBy(key: string, array: ShareItem[]): { [key: string]: ShareItem[] } {
    return array.reduce((result: { [key: string]: ShareItem[] }, currentItem) => {
        (result[currentItem[key as keyof ShareItem]] = result[currentItem[key as keyof ShareItem]] || []).push(currentItem);
        return result;
    }, {});
}

const SharedItemsList: FC<SharedItemsListProps> = () => {

    const {dispatch: homeDispatch, state:{statsService, featureFlags, prompts}} = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);

    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isMarketModalOpen, setIsMarketModalOpen] = useState<boolean>(false);
    const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
    const [sharedBy, setSharedBy] = useState<string>("");
    const [selectedKey, setSelectedKey] = useState<string>("");
    const [selectedNote, setSelectedNote] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [groupedItems, setGroupedItems] = useState<{ [key: string]: ShareItem[] } | null>(null);
    const [YSItems, setYSItems] = useState< SharedItem[] | null>(null);
    const [deletingItem, setDeletingItem] = useState<ShareItem | null>(null);
    const [hoveredItem, setHoveredItem] = useState<ShareItem | null>(null);
    const [isButtonHover, setIsButtonHover] = useState<boolean>(false);

    const [activeTab, setActiveTab] = useState<string>('SWY');

    const { data: session } = useSession();
    const user = session?.user;

    useEffect( () => {
        const name = user?.email;
        if (name) {
            statsService.openSharedItemsEvent();
            if (!groupedItems) fetchSWYData(name);
            // if (!YSItems) fetchYSData(name);
        }

    }, [user]);

    const fetchSWYData = async (name: string) => {
            if (name) {
                try {
                    const result = await getSharedItems();
                    if (result.success) {
                        const grouped = groupBy('sharedBy', result.items);
                        setGroupedItems(grouped);
                    }

                } catch (e) {
                   alert("Unable to fetch your shared items. Please check your Internet connection and try again later.")
                } finally {
                    if (activeTab === "SWY") setIsLoading(false);
                }
            }
    };

    const fetchYSData = async (name: string) => {
        try {
            if (name) {
                try {
                    const result = await getYouSharedItems(name);

                    if (result.ok) {
                        const items = null//await result.json();
                        
                        setYSItems(items);
                    }

                } finally {
                    if (activeTab === "YS") setIsLoading(false);
                }
            }
        } catch (e) {
           alert("Unable to fetch items you shared. Please check your Internet connection and try again later.")
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

    const handleYSDelete = async (e: React.MouseEvent<HTMLButtonElement>, id: string, user_data: any) => {
        e.stopPropagation();
        if (deletingItem) {
            await deleteYouSharedItem({'id': id, 'shared_users':[user_data]});
            console.log("Deleting item:", deletingItem);
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
                    includeConversations={true}
                    includePrompts={true}
                    includeFolders={true}
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

            {featureFlags.enableMarket && (
                <ShareAnythingToMarketModal
                    open={isMarketModalOpen}
                    onShare={() => {
                        setIsMarketModalOpen(false);
                    }}
                    onCancel={() => {
                        setIsMarketModalOpen(false);
                    }}
                    includeConversations={true}
                    includePrompts={true}
                    includeFolders={true}/>
            )}

            {featureFlags.enableMarket && (
            <div className="flex flex-row items-center pt-3 pl-3 pr-3">
                <div className="flex w-full items-center">
                    <button
                        className="text-sidebar flex w-full flex-shrink-0 cursor-pointer select-none items-center gap-3 rounded-md border dark:border-white/20 p-3 dark:text-white transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-gray-500/10"
                        onClick={() => {
                            statsService.openMarketEvent();
                            homeDispatch({field: 'page', value: 'market'})
                        }}
                    >
                        <IconJetpack size={16}/>
                        Open Marketplace
                    </button>
                </div>
            </div>
            )}

            <div className="flex flex-row items-center pt-3 pl-2 pr-3">
                <div className="mb-4 flex items-center space-x-2">
                    <button
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
                        disabled={isLoading}
                        className={`text-sidebar flex flex-grow flex-shrink-0 select-none items-center gap-3 rounded-md border dark:border-white/20 p-3 dark:text-white transition-colors duration-200 ${!isLoading ? "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" : ""}`}
                        onClick={async () => {
                        if (user?.email) {
                           setIsLoading(true);
                           if (activeTab === "SWY") await fetchSWYData(user?.email);
                           if (activeTab === "YS") await fetchYSData(user?.email);
                           setIsLoading(false);

                        }}
                        }
                    >
                        <IconRefresh size={16}/>
                    </button>
                </div>
                {featureFlags.enableMarket && (
                <div className="flex items-center pl-2">
                    <button
                        className="text-sidebar flex w-full flex-shrink-0 cursor-pointer select-none items-center gap-3 rounded-md border dark:border-white/20 p-3 dark:text-white transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-gray-500/10"
                        onClick={() => {
                            setIsMarketModalOpen(true);
                        }}
                    >
                        <IconRocket size={16}/>
                        Publish to Market
                    </button>
                </div>
                )}

            </div>

            <div className="flex flex-row gap-1 bg-neutral-100 dark:bg-[#202123] rounded-t border-b dark:border-white/20">
                        <button
                            key={"sharedWithYou"}
                            disabled={isLoading}
                            onClick={() => setActiveTab("SWY")}
                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "SWY" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                            <h3 className="text-lg">Shared With You</h3> 
                        </button>
                        {/* <button
                            key={"youShared"}
                            disabled={isLoading}
                            onClick={() => setActiveTab("YS")}
                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === "YS" ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                            <h3 className="text-lg">You Shared</h3> 
                        </button> */}
            </div>
           

            {isLoading ? (
                <div className="flex flex-row ml-6 mt-6">
                    <LoadingIcon/>
                    <span className="text-l font-bold ml-2">Loading...</span>
                </div>
            ) :  activeTab === "SWY" && groupedItems? (Object.entries(groupedItems).map(([sharedBy, items]) => (
                <div key={sharedBy} className="sharedBy-group ml-3 mt-4 p-2">
                    <ExpansionComponent
                        title={sharedBy.includes('@')? sharedBy.split("@")[0] : sharedBy}
                        openWidget={<IconCaretDown size={18}/>}
                        closedWidget={<IconCaretRight size={18}/>}
                        content={items.map((item, index) => (
                            <button
                            onMouseEnter={() => {
                                setHoveredItem(item)
                                setIsButtonHover(true)
                            }}
                            onMouseLeave={() => {
                                setDeletingItem(null); 
                                setHoveredItem(null)
                            }
                            }
                                key={index}
                                className={`w-full flex cursor-pointer items-center gap-2 rounded-lg pb-2 pt-3 pr-2 text-sm transition-colors duration-200 ${isButtonHover ? "hover:bg-neutral-200 dark:hover:bg-[#343541]/90": ""}`}
                                onClick={() => {
                                    setSharedBy(item.sharedBy);
                                    handleFetchShare(item);
                                }}
                            >
                                <IconShare size={18} className="ml-2 flex-shrink-0"/>
                                <div className="truncate text-left text-[12.5px] leading-3 pr-1">
                                    <div className="mb-1 text-gray-500">{new Date(item.sharedAt).toLocaleString()}</div>
                                    <div
                                        className="relative max-w-5 truncate text-left text-[12.5px] leading-3 pr-1 "
                                        style={{wordWrap: "break-word"}} // Added word wrap style
                                    >
                                        {item.note}
                                    </div>
                                </div>
                                {hoveredItem === item && ( 
                                    <div className="ml-auto relative right-0 flex-shrink-0 flex flex-row items-center space-y-0 bg-neutral-200 dark:bg-[#343541]/90 rounded"
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
                            
                        ))}
                    />
                </div>
            ))) : <></>
            // YSItems && //active tab is set to YS
            // (   (YSItems.map((item: SharedItem) => (
            //         <div key={item.note} className=" ml-4 mt-4 p-2"
            //             // onMouseEnter={() => {
            //             //                     setHoveredItem(item);
            //             //                     setIsButtonHover(true);
            //             //                 }}
            //             // onMouseLeave={() => {
            //             //     setDeletingItem(null); 
            //             //     setHoveredItem(null);
            //             // }
            //             // }
            //             >

            //             <ExpansionComponent
            //                 title={item.note}
            //                 openWidget={<IconCaretDown size={18}/>}
            //                 closedWidget={<IconCaretRight size={18}/>}
            //                 content={[ 
            //                     <div>
            //                         <div className="mt-2 flex items-center justify-center text-sm text-black dark:text-neutral-200 border-b  border-gray-500">
            //                             {'Shared Items'}
            //                         </div>
                                    
            //                         {item.objects.map((object: any) => {
            //                             return (<label
            //                             className="ml-4 flex w-full items-center gap-3 rounded-lg p-2 text-sm">
            //                             {object.type === 'prompt' && isAssistantById(object.id, promptsRef.current) ? <IconRobot size={20} /> : <IconMessage size={18} />}
            //                                 <div
            //                                     className="relative max-h-5 flex-1 overflow-hidden text-ellipsis whitespace-nowrap break-all text-left text-[12.5px] leading-4">
            //                                     {object.name}
            //                                 </div>
            //                             </label>)   
            //                             })}
            //                     </div>
            //                     ,


            //                     // <ExpansionComponent
            //                     //     title={'Shared Items'}
            //                     //     openWidget={<IconCaretDown size={18}/>}
            //                     //     closedWidget={<IconCaretRight size={18}/>}
            //                     //     content={item.objects.map((object: any) => {
            //                     //         return (<label
            //                     //         className="ml-2 flex w-full items-center gap-3 rounded-lg p-2 text-sm">
            //                     //         {object.type === 'prompt' && isAssistantById(object.id) ? <IconRobot size={20} /> : <IconMessage size={18} />}
            //                     //             <div
            //                     //                 className="relative max-h-5 flex-1 overflow-hidden text-ellipsis whitespace-nowrap break-all text-left text-[12.5px] leading-4">
            //                     //                 {object.name}
            //                     //             </div>
            //                     //         </label>)   
            //                     //         })}
            //                     //     />
                                
                            
            //                     ,
            //                     <div className="mt-2 flex items-center justify-center text-sm text-black dark:text-neutral-200 border-b  border-gray-500">
            //                         {'People You Shared With'}
            //                     </div>
            //                     ,
            //                     ...item.shared_with.map((user_item: any, index: number) => (
            //                         <label
            //                             onMouseEnter={() => {
            //                                 setHoveredItem(user_item)
            //                                 setIsButtonHover(true)
            //                             }}
            //                             onMouseLeave={() => {
            //                                 setDeletingItem(null); 
            //                                 setHoveredItem(null)
            //                             }
            //                             }
            //                             key={index}
            //                             className="ml-6 flex flex-row w-full cursor-pointer items-center gap-3 rounded-lg pb-2 pt-3 pr-2 text-sm"
            //                         >
            //                             <IconUser size={18} className="flex-shrink-0"/>
            //                             <div
            //                                 className="relative max-w-5 truncate text-left text-[12.5px] leading-3 pr-1 "
            //                                 style={{wordWrap: "break-word"}} >
            //                                 {user_item.user.includes('@')? user_item.user.split("@")[0] : user_item.user}
            //                             </div>
            //                             {hoveredItem === user_item && ( 
            //                                 <div className="ml-auto mr-4 right-0 flex-shrink-0 flex flex-row items-center space-y-0 bg-neutral-200 dark:bg-[#343541]/90 rounded"
            //                                 onMouseEnter={() => {
            //                                     setHoveredItem(user_item)
            //                                     setIsButtonHover(false)
            //                                 }}
            //                                 onMouseLeave={() => setIsButtonHover(true)}>
            //                                 {!deletingItem && (
            //                                     <ActionButton handleClick={(e) => handleOpenDeleteModal(user_item, e)} title="Delete Shared Item">
            //                                         <IconTrash size={18} />
            //                                     </ActionButton>
            //                                 )}
        
            //                                 {deletingItem && (
            //                                     <>
            //                                         {/* different handledelete */}
            //                                         <ActionButton handleClick={(e) => handleYSDelete(e, item.id, user_item)} title="Confirm">
            //                                             <IconCheck size={18} />
            //                                         </ActionButton>
        
            //                                         <ActionButton handleClick={handleCancelDelete} title="Cancel">
            //                                             <IconX size={18} />
            //                                         </ActionButton>
            //                                     </>
            //                                 )}
            //                             </div>
            //                             )}
            //                         </label>
                                
            //                     ))
            //                 ]
            //                 }
            //             />
                        

            //         </div>
            //     )))
            // ) 
        }
        </div>
    );
};

export default SharedItemsList;



// {hoveredItem === item && ( <div className="absolute right-1 z-10 flex bg-neutral-200 dark:bg-[#343541]/90 rounded">
                        
//                                             <div className="ml-auto mr-4 absolute right-0 flex-shrink-0 flex flex-row items-center space-y-0 bg-neutral-200 dark:bg-[#343541]/90 rounded"
//                                             onMouseEnter={() => {
//                                                 setHoveredItem(item)
//                                                 setIsButtonHover(false)
//                                             }}
//                                             onMouseLeave={() => setIsButtonHover(true)}>
//                                             {!deletingItem && (
//                                                 <ActionButton handleClick={(e) => handleOpenDeleteModal(item, e)} title="Delete Shared Item">
//                                                     <IconTrash size={18} />
//                                                 </ActionButton>
//                                             )}
        
//                                             {deletingItem && (
//                                                 <>
//                                                     {/* different handledelete */}
//                                                     <ActionButton handleClick={handleDelete} title="Confirm">
//                                                         <IconCheck size={18} />
//                                                     </ActionButton>
        
//                                                     <ActionButton handleClick={handleCancelDelete} title="Cancel">
//                                                         <IconX size={18} />
//                                                     </ActionButton>
//                                                 </>
//                                             )}
//                                         </div>    
//                         </div>)}