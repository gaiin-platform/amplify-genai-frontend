import React, {FC, useContext, useEffect, useState} from 'react';
import {ExportFormatV4, ShareItem} from "@/types/export";
import {
    IconCaretDown,
    IconCaretRight,
    IconHexagonLetterM,
    IconJetpack,
    IconPlanet,
    IconRocket,
    IconCheck,
    IconPencil,
    IconTrash,
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
import HomeContext from "@/pages/api/home/home.context";
import {ShareAnythingToMarketModal} from "@/components/Share/ShareAnythingToMarketModal";
import useStatsService from "@/services/eventService";

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

const SharedItemsList: FC<SharedItemsListProps> = () => {

    const {dispatch: homeDispatch} = useContext(HomeContext);
    const statsService = useStatsService();

    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isMarketModalOpen, setIsMarketModalOpen] = useState<boolean>(false);
    const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
    const [sharedBy, setSharedBy] = useState<string>("");
    const [selectedKey, setSelectedKey] = useState<string>("");
    const [selectedNote, setSelectedNote] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [groupedItems, setGroupedItems] = useState<{ [key: string]: ShareItem[] }>({});
    const {user} = useUser();

    useEffect(() => {
        const name = user?.name;

        statsService.openSharedItemsEvent();

        const fetchData = async () => {
            try {
                if (name) {
                    try {
                        const result = await getSharedItems(name);

                        if (result.ok) {
                            const items = await result.json();

                            console.log("items", items);

                            const grouped = groupBy('sharedBy', items.item);
                            setGroupedItems(grouped);
                        }

                    } finally {
                        setIsLoading(false);
                    }
                }
            } catch (e) {
               alert("Unable to fetch your shared items. Please check your Internet connection and try again later.")
            }
        };

        fetchData();

    }, [user]);

    const handleFetchShare = async (item: ShareItem) => {
        setSelectedKey(item.key);
        setSelectedNote(item.note);
        setImportModalOpen(true);
    }


    return (
        <div className={`border-t dark:border-white/20`}>

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

            <div className="flex flex-row items-center pt-3 pl-3 pr-3">
                <div className="flex items-center">
                    <button
                        className="text-sidebar flex w-full flex-shrink-0 cursor-pointer select-none items-center gap-3 rounded-md border dark:border-white/20 p-3 dark:text-white transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-gray-500/10"
                        onClick={() => {
                            setIsModalOpen(true);
                        }}
                    >
                        <IconShare size={16}/>
                        Share to Users
                    </button>
                </div>
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
            </div>

            <h3 className="text-lg border-b p-3 ml-3 mr-3">Shared with You</h3>

            {isLoading && (
                <div className="flex flex-row ml-6 mt-6">
                    <LoadingIcon/>
                    <span className="text-l font-bold ml-2">Loading...</span>
                </div>
            )}

            {Object.entries(groupedItems).map(([sharedBy, items]) => (
                <div key={sharedBy} className="sharedBy-group ml-3 mt-6 p-2">
                    <ExpansionComponent
                        title={sharedBy}
                        openWidget={<IconCaretDown size={18}/>}
                        closedWidget={<IconCaretRight size={18}/>}
                        content={items.map((item, index) => (
                            <button
                                key={index}
                                className="flex w-full cursor-pointer items-center gap-3 rounded-lg pb-2 pt-3 pr-2 text-sm transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-[#343541]/90"
                                onClick={() => {
                                    setSharedBy(item.sharedBy);
                                    handleFetchShare(item);
                                }}
                            >
                                <IconShare size={18}/>
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

export default SharedItemsList;