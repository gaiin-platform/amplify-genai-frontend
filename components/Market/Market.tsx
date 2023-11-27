import {
    IconClearAll,
    IconSettings,
    IconShare,
    IconRobot,
    IconArrowBack,
    IconApiApp,
    IconAlignBoxBottomCenter,
    IconJetpack,
    IconChartArcs3,
    IconRocket,
    IconHome,
    IconRocketOff,
    IconTournament,
    IconDownload,
    IconTree
} from '@tabler/icons-react';
import {
    handleStartConversationWithPrompt, parseEditableVariables
} from "@/utils/app/prompts";
import {
    MutableRefObject,
    memo,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import HomeContext from '@/pages/api/home/home.context';

import Spinner from '../Spinner';
import {v4 as uuidv4} from 'uuid';
import {AttachedDocument} from "@/types/attacheddocument";
import {TagsList} from "@/components/Chat/TagsList";
import {ShareAnythingModal} from "@/components/Share/ShareAnythingModal";
import {MarketCategory, MarketItem, MarketItemType} from "@/types/market";
import {ShareItem} from "@/types/export";
import {getCategory, getItem, getItemExamples} from "@/services/marketService";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {ImportAnythingModal, ImportFetcher} from "@/components/Share/ImportAnythingModal";
import {Conversation} from "@/types/chat";
import {FolderInterface} from "@/types/folder";
import {Prompt} from "@/types/prompt";
import {ExampleChat} from "@/components/Market/components/ExampleChat";

interface Props {
    items: MarketItem[];
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
  font-size: 4rem;
  animation: ${animate} 2s infinite;
`;

interface Example {
    name: string;
    description: string;
    task: string;
    conversation: Conversation;
    variables: { [key: string]: string };
}

interface ItemDetails {
    item: MarketItem;
    examples: Example[];
}

interface NavItem {
    name: string;
    nav: () => void;
}


export const Market = ({items}: Props) => {

    const {
        state: {
            selectedConversation,
            selectedAssistant,
            conversations,
            folders,
            models,
            apiKey,
            pluginKeys,
            serverSideApiKeyIsSet,
            messageIsStreaming,
            modelError,
            loading,
            prompts,
            defaultModelId,
            featureFlags,
            workspaceMetadata
        },
        handleNewConversation,
        dispatch: homeDispatch,
    } = useContext(HomeContext);


    const noOpImportFetcher: ImportFetcher = async () => {
        return {success: false, message: "No Op", data: null};
    }

    const [showExample, setShowExample] = useState<ItemDetails|null>(null);
    const [showMarketItemTryModal, setShowMarketItemTryModal] = useState<boolean>(false);
    const [showMarketItemInstallModal, setShowMarketItemInstallModal] = useState<boolean>(false);
    const [marketItemDescription, setMarketItemDescription] = useState<string>("");
    const [importFetcher, setImportFetcher] = useState<ImportFetcher>(noOpImportFetcher);
    const [groupedItems, setGroupedItems] = useState<{ [key: string]: MarketItem[]; }>({});
    const [groupedMarketCategories, setGroupedMarketCategories] = useState<{ [key: string]: MarketCategory[]; }>({});
    const [marketCategories, setMarketCategories] = useState<MarketCategory[]>([]);
    const [marketItems, setMarketItems] = useState<MarketItem[]>([]);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchStr, setSearchStr] = useState<string>("");
    const [searchCategory, setSearchCategory] = useState<string>("*");

    const [breadCrumbs, setBreadCrumbs] = useState<NavItem[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);


    const scrollToTop = useCallback(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({behavior: 'smooth'});
        }
    }, []);

    const handleNavCategory = async (path: string) => {
        setShowExample(null);
        setSearchCategory(path);
        setSearchStr("");
        updateNavItems(path);
    }


    const updateNavItems = (category:string) => {
        const parts = category.split("/");
        const navItems = parts.map((part, index) => {
           const path = parts.slice(0, index + 1).join("/");
              return {
                    name: part,
                    nav: () => {
                        handleNavCategory(path);
                    }
              };
        });

        setBreadCrumbs(navItems);
    }

    const groupBy = (array: any[], key: string | number) => {
        return array.reduce((result: { [x: string]: any[]; }, currentItem: { [x: string]: any; }) => {
            (result[currentItem[key]] = result[currentItem[key]] || []).push(currentItem);
            return result;
        }, {});
    };

    const completeSubCategories = async (category: MarketCategory) => {
        if (category.categories) {
            const promises = category.categories?.map((subCategory) => {

                return getCategory(subCategory.id).then((data) => {
                    return data.data;
                });
            });

            return await Promise.all(promises);

        } else {
            return [];
        }
    };

    useEffect(() => {

        const fetchCategory = (searchCategory && searchCategory !== "*") ? searchCategory : "/";

        setIsLoading(true);

        getCategory(fetchCategory).then((data) => {

            completeSubCategories(data.data).then((subCategories) => {

                setMarketCategories(subCategories);
                setIsLoading(false);
            });
        });

        const grouped = groupBy(marketItems, 'category');
        //const groupedCategories = groupBy(marketCategories, 'name');


        //setGroupedMarketCategories(groupedCategories);

        const results = search(searchStr, grouped);
        setGroupedItems(results);

        scrollToTop();
    }, [marketItems, searchStr, searchCategory]);

    useEffect(() => {
        scrollToTop();
    }, [showExample]);

    const search = (query: string, grouped: { [key: string]: MarketItem[]; }) => {
        if (query) {
            const filteredItems = Object.entries(grouped)
                .map(([note, items]) => {
                    const filtered = items.filter(item => {
                        return item.category.toLowerCase().includes(query.toLowerCase()) ||
                            item.description.toLowerCase().includes(query.toLowerCase()) ||
                            item.name.toLowerCase().includes(query.toLowerCase()) ||
                            item.tags.join(",").toLowerCase().includes(query.toLowerCase());
                    });
                    return [note, filtered];
                })
                .filter(([note, items]) => {
                    return items.length > 0;
                });

            return Object.fromEntries(filteredItems);
        } else {
            const filteredItems = Object.entries(grouped)
                .map(([note, items]) => {
                    return [note, searchCategory !== "*" ? items : items.slice(0, 3)];
                })
                .filter(([note, items], index) => {
                    return items.length > 0;
                });

            return Object.fromEntries(filteredItems);
        }
    }

    const handleGetItem = async (item: MarketItem) => {

        const marketItemFetcher: ImportFetcher = async () => {
            const response = await getItem(item.id);

            if (response.success) {
                const itemData = response.data.content;
                return {success: true, message: "Downloaded", data: itemData};
            } else {
                return response;
            }
        };


        setImportFetcher(() => marketItemFetcher);
        setMarketItemDescription(item.description);
        setShowMarketItemInstallModal(true);
    }

    const handleTryItem = async (item: MarketItem) => {

        const marketItemFetcher: ImportFetcher = async () => {
            const response = await getItem(item.id);

            if (response.success) {
                const itemData = response.data.content;
                return {success: true, message: "Downloaded", data: itemData};
            } else {
                return response;
            }
        };


        setImportFetcher(() => marketItemFetcher);
        setMarketItemDescription(item.description);
        setShowMarketItemTryModal(true);
    }

    function getSectionImage(index: number) {
        const sectionImages: string[] = [
            "https://www.vanderbilt.edu/wp-content/uploads/sites/3/2021/04/bronson-ingram.jpeg",
            "https://www.goodyclancy.com/wp-content/uploads/2023/06/Vanderbilt_Warren-and-Moore_exterior-1_Goody-Clancy.jpg",
            "https://cdn.vanderbilt.edu/vu-URL/wp-content/uploads/sites/97/2021/09/19231133/Local-Color-campus-shot.jpg",
            "https://cdn.vanderbilt.edu/vu-URL/wp-content/uploads/sites/97/2021/09/19231133/Local-Color-campus-shot.jpg",
        ];

        // use mod to safely lookup and return a seciton iamge
        return sectionImages[index % sectionImages.length];
    }

    function getRandomColor() {
        const colorNames = [
            "slate",
            "gray",
            "zinc",
            "neutral",
            "stone",
            "red",
            "orange",
            "amber",
            "yellow",
            "lime",
            "green",
            "emerald",
            "teal",
            "cyan",
            "sky",
            "blue",
            "indigo",
            "violet",
            "purple",
            "fuchsia",
            "pink",
            "neutral",
        ];

        const randomIndex = Math.floor(Math.random() * colorNames.length);
        return colorNames[randomIndex] + "-600";
    }

    const getTags = (item: MarketItem) => {
        return item.tags.length == 0 ?
            (<span
                key={"none"}
                className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium rounded border-2 m-1 dark:text-white text-gray-400"}
            >
                None
            </span>) :
            item.tags.map((tag) => (
            <span
                key={tag}
                className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium rounded border-2 m-1 dark:text-white text-gray-400"}
            >
                {tag}
            </span>
        ));
    }

    const getMarketItemIcon = (item: MarketItem, size = 36) => {
        switch (item.type) {
            case MarketItemType.ASSISTANT:
                return <IconRobot size={size}/>;
            case MarketItemType.AUTOMATION:
                return <IconApiApp size={size}/>;
            case MarketItemType.COLLECTION:
                return <IconTournament size={size}/>;
            case MarketItemType.PROMPT:
                return <IconRocket size={size}/>;
            case MarketItemType.ROOT:
                return <IconTree size={size}/>;
            default:
                return <IconRobot size={size}/>;
        }
    }



    const handleViewItemDetails = async (item: MarketItem) => {
        const category = item.category;
        const id = item.id;

        setIsLoading(true);

        getItemExamples(category, id).then((data) => {
            console.log(data.data);

            const itemAndDetails:ItemDetails = {
                item: item,
                examples: (data.success)? data.data.examples : []
            };

            setShowExample(itemAndDetails);

            updateNavItems(category);

            setIsLoading(false);
        });
    }

    const doTryItem = async (consersations: Conversation[], folders: FolderInterface[], itemPrompts: Prompt[]) => {
        if (itemPrompts.length > 0) {
            handleStartConversationWithPrompt(handleNewConversation, [...prompts, ...itemPrompts], itemPrompts[0]);
        } else {
            alert("There are no prompts to try in this market item.");
        }
    }

    const getNav = () => {
        return (<nav ref={scrollRef} className="pl-20 flex px-5 py-3 text-gray-700 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
                <li className="inline-flex items-center">
                    <a onClick={
                        (e) => {
                            handleNavCategory("");
                        }}
                       className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white">
                        <div className="flex flex-row items-center">
                            <div>
                                <IconHome size={18}/>
                            </div>
                            <div className="ml-2">
                                Home
                            </div>
                        </div>
                    </a>
                </li>
                {breadCrumbs.filter((crumb)=>crumb.name.trim().length > 0).map((crumb, index) => (
                    <li key={index}>
                        <div className="flex items-center">
                            <svg className="rtl:rotate-180 block w-3 h-3 mx-1 text-gray-400 " aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 9 4-4-4-4"/>
                            </svg>
                            <a href="#"
                               onClick={
                                   (e) => {
                                       e.stopPropagation();
                                       e.preventDefault();
                                       crumb.nav();
                                   }
                               }
                               className="ms-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ms-2 dark:text-gray-400 dark:hover:text-white">{crumb.name}</a>
                        </div>
                    </li>
                ))}
            </ol>
        </nav>);
    }

// @ts-ignore
    return showExample ? (
            <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">
                <>
                    <div
                        className="max-h-full overflow-x-hidden"
                    >
                        {getNav()}

                        <section className="bg-gray-50 dark:bg-gray-900">
                            <div
                                className="ml-8 py-8 px-4 mx-auto max-w-screen-xl lg:py-16 grid lg:grid-cols-2 gap-8 lg:gap-8">
                                <div className="flex flex-col justify-center">
                                    <h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-none text-gray-900 md:text-5xl lg:text-6xl dark:text-white">
                                        {getMarketItemIcon(showExample.item, 89)} {showExample.item.name}

                                    </h1>
                                    <p className="mb-6 text-lg font-normal text-gray-500 lg:text-xl dark:text-gray-400">

                                    </p>
                                    <div className="flex flex-col w-full">
                                    <div className="flex flex-row w-full">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleGetItem(showExample.item);
                                        }
                                        }
                                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                        <IconDownload/> Get
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleTryItem(showExample.item);
                                        }
                                        }
                                        className="ml-2 inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-neutral-700 rounded-lg hover:bg-neutral-800 focus:ring-4 focus:outline-none focus:ring-neutral-300 dark:bg-neutral-600 dark:hover:bg-neutral-700 dark:focus:ring-neutral-800">
                                        <IconRocket/> Try It
                                    </button>
                                    </div>
                                    <div className="flex flex-row w-full">
                                    <button
                                        onClick={(e) => {
                                            handleNavCategory("");
                                        }
                                        }
                                        className="mt-6 inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-neutral-700 rounded-lg hover:bg-neutral-800 focus:ring-4 focus:outline-none focus:ring-neutral-300 dark:bg-neutral-600 dark:hover:bg-neutral-700 dark:focus:ring-neutral-800">
                                        <IconHome/> Back Home
                                    </button>
                                    </div>
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <div
                                        className="w-full lg:max-w-xl pl-2 pr-6 py-6 space-y-8 sm:p-8 bg-white rounded-lg shadow-xl text-gray-900 dark:text-white dark:bg-gray-800">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                            About
                                        </h2>
                                        <div className="mt-8 space-y-6">
                                            {showExample.examples.length == 0 && showExample.item.description}
                                            {showExample.examples.length > 0 && (
                                                <div className="mt-8 space-y-6">
                                                    <b>AI Generated:</b>
                                                    {showExample.examples[0].description}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-gray-600 dark:text-white">
                                            Tags:
                                        </div>
                                        <div
                                            className="text-gray-600 dark:text-white grid grid-cols-2 grid-flow-row ">
                                            {getTags(showExample.item)}
                                        </div>
                                        <p className="mt-2 mb-3 font-normal text-gray-700 dark:text-gray-400">
                                            By: {showExample.item.author || "Anonymous"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </section>


                        <section
                            className="bg-center bg-no-repeat bg-[url('https://www.vanderbilt.edu/undergraduate-education/wp-content/uploads/sites/407/2023/11/1159c2beb1aa091607931130aa8bf659-1200x900-c-default.jpg')] bg-gray-700 bg-blend-multiply">
                            <div className="px-4 mx-auto max-w-screen-xl text-center py-24 lg:py-56">
                                <h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-none text-white md:text-5xl lg:text-6xl">
                                    Examples
                                </h1>
                                <p className="mb-8 text-lg font-normal text-gray-300 lg:text-xl sm:px-16 lg:px-48">
                                    These are AI-generated examples of what this market item can do. Each example has
                                    an AI-imagined usage scenario, parameters for the scenario, and then the actual output
                                    from using the market item with those parameters.
                                </p>
                                <div className="flex flex-col space-y-4 sm:flex-row sm:justify-center sm:space-y-0">
                                    {/*<a href="#"*/}
                                    {/*   className="inline-flex justify-center items-center py-3 px-5 text-base font-medium text-center text-white rounded-lg bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-900">*/}
                                    {/*    Get started*/}
                                    {/*    <svg className="w-3.5 h-3.5 ms-2 rtl:rotate-180" aria-hidden="true"*/}
                                    {/*         xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">*/}
                                    {/*        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"*/}
                                    {/*              stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>*/}
                                    {/*    </svg>*/}
                                    {/*</a>*/}
                                    {/*<a href="#"*/}
                                    {/*   className="inline-flex justify-center hover:text-gray-900 items-center py-3 px-5 sm:ms-4 text-base font-medium text-center text-white rounded-lg border border-white hover:bg-gray-100 focus:ring-4 focus:ring-gray-400">*/}
                                    {/*    Learn more*/}
                                    {/*</a>*/}
                                </div>
                            </div>
                        </section>

                        {showExample.examples.length == 0 && (
                            <div className="justify-center items-center px-8 py-4 flex flex-col w-full text-black bg-white dark:text-white dark:bg-[#202123]">
                                <div>
                                    <h1 className="justify-center mb-4 text-2xl font-extrabold tracking-tight leading-none text-gray-900 md:text-3xl lg:text-4xl dark:text-white">
                                        We don&apos;t have any examples of this item yet...
                                    </h1>
                                </div>
                            </div>
                        )}
                        {showExample.examples.map((example, index) => (
                            <>
                            <div>
                                <div className="px-8 py-4 flex flex-col w-full text-black bg-white dark:text-white dark:bg-[#202123]">
                                    <div>
                                        <h1 className="mb-4 text-3xl font-extrabold tracking-tight leading-none text-gray-900 md:text-5xl lg:text-6xl dark:text-white">
                                        Scenario #{index + 1}:
                                    </h1>
                                    </div>
                                    <blockquote className="px-8 text-xl italic font-semibold text-gray-900 dark:text-gray-200">
                                        <svg className="w-8 h-8 text-gray-400 dark:text-gray-600 mb-4"
                                             aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor"
                                             viewBox="0 0 18 14">
                                            <path
                                                d="M6 0H2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3H2a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Zm10 0h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v1a3 3 0 0 1-3 3h-1a1 1 0 0 0 0 2h1a5.006 5.006 0 0 0 5-5V2a2 2 0 0 0-2-2Z"/>
                                        </svg>
                                        <p className="dark:text-gray-400">
                                        {example.task}
                                        </p>
                                    </blockquote>
                                    <div>
                                    <h2 className="px-8 pt-8 text-2xl font-bold text-gray-900 dark:text-white">
                                        Prompt Options:
                                    </h2>
                                     </div>
                                    <div className="px-4 py-2 text-gray-600 dark:text-white text-lg">
                                        {Object.entries(example.variables).map(([k,v], index) => (
                                            <div className="py-1" key={index}>
                                                <div className="flex flex-row items-center">
                                                    <div className="p-3">
                                                        <IconAlignBoxBottomCenter/>
                                                    </div>
                                                    <div>
                                                        <h3 className="font-extrabold">{k}:</h3>
                                                    </div>
                                                </div>
                                                <div className="px-12">
                                                 {v}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                </div>
                            </div>
                            <div>
                                <div className="px-8 py-4 flex flex-col w-full text-gray-600 dark:text-white bg-white dark:bg-[#202123]">
                                    <div>
                                        <h1 className="mb-4 text-3xl font-extrabold tracking-tight leading-none text-gray-900 md:text-5xl lg:text-6xl dark:text-white">
                                        Output for Scenario #{index + 1}:
                                        </h1>
                                    </div>
                                </div>
                            </div>
                            <ExampleChat key={index} messages={example.conversation.messages.slice(1)}/>
                            </>
                        ))}
                    </div>
                </>
            </div>
        ) :
        (
            <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">
                <>
                    <div
                        className="max-h-full overflow-x-hidden"
                    >
                        <div>

                            {showMarketItemTryModal && (
                                <ImportAnythingModal
                                    title={"Try Market Item"}
                                    importButtonLabel={"Try"}
                                    onImport={
                                        () => {
                                            alert("Try market item.");
                                            setShowMarketItemTryModal(false);
                                        }
                                    }
                                    onCancel={
                                        () => {
                                            setShowMarketItemTryModal(false);
                                        }
                                    }
                                    customImportFn={async (conversations, folders, prompts) => {
                                        doTryItem(conversations, folders, prompts);
                                        setShowMarketItemTryModal(false);
                                    }}
                                    includeConversations={false}
                                    includePrompts={false}
                                    includeFolders={false}
                                    importKey={""}
                                    importFetcher={importFetcher}
                                    note={marketItemDescription}/>
                            )}

                            {showMarketItemInstallModal && (
                                <ImportAnythingModal
                                    title={"Install Market Item"}
                                    importButtonLabel={"Install"}
                                    onImport={
                                        () => {
                                            alert("Market item installed.");
                                            setShowMarketItemInstallModal(false);
                                        }
                                    }
                                    onCancel={
                                        () => {
                                            setShowMarketItemInstallModal(false);
                                        }
                                    }
                                    includeConversations={true}
                                    includePrompts={true}
                                    includeFolders={true}
                                    importKey={""}
                                    importFetcher={importFetcher}
                                    note={marketItemDescription}/>
                            )}

                            {/*{showSettings && (*/}
                            {/*    <div*/}
                            {/*        className="flex flex-col space-y-10 md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">*/}
                            {/*        <div*/}
                            {/*            className="flex h-full flex-col space-y-4 border-b border-neutral-200 p-4 dark:border-neutral-600 md:rounded-lg md:border">*/}
                            {/*            <ModelSelect/>*/}
                            {/*        </div>*/}
                            {/*    </div>*/}
                            {/*)}*/}

                            {getNav()}

                            <section className="bg-gray-50 dark:bg-gray-900">
                                <div
                                    className="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 grid lg:grid-cols-2 gap-8 lg:gap-16">
                                    <div className="flex flex-col justify-center">
                                        <h1 ref={scrollRef}  className="mb-4 text-4xl font-extrabold tracking-tight leading-none text-gray-900 md:text-5xl lg:text-6xl dark:text-white">
                                            <IconRocket size={89}/>Generative AI Market</h1>
                                        <p className="mb-6 text-lg font-normal text-gray-500 lg:text-xl dark:text-gray-400">
                                            Discover and share prompts, assistants, and automations with the community.
                                            Build
                                            on top of the prompt engineering of others to accelerate your own work.
                                        </p>
                                        <a href="#"
                                           className="text-blue-600 dark:text-blue-500 hover:underline font-medium text-lg inline-flex items-center">
                                            Take a quick tutorial

                                        </a>
                                    </div>
                                    <div>
                                        <div
                                            className="w-full lg:max-w-xl p-6 space-y-8 sm:p-8 bg-white rounded-lg shadow-xl dark:bg-gray-800">
                                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                                Search the Market
                                            </h2>
                                            <form className="mt-8 space-y-6" action="#">
                                                <div>
                                                    <label htmlFor="keywords"
                                                           className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Key
                                                        Words</label>
                                                    <input type="text" name="keywords" id="keywords"
                                                           value={searchStr}
                                                           onChange={(e) => setSearchStr(e.target.value)}
                                                           className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                                           placeholder="Enter your search terms..." required/>
                                                </div>
                                                <div>
                                                    <label htmlFor="category"
                                                           className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Category</label>
                                                    <select id="category" className="text-black text-xl rounded"
                                                            onChange={(e) => setSearchCategory(e.target.value)}
                                                            value={searchCategory}
                                                    >
                                                        <option key="all" value="*">All Categories</option>
                                                        {marketCategories.map((category) => (
                                                            <option key={category.id}
                                                                    value={category.id}>{category.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <button type="submit"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setSearchStr("");
                                                            setSearchCategory("*");
                                                        }}
                                                        className="w-full px-5 py-3 text-base font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 sm:w-auto dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                    Reset
                                                </button>

                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </section>


                            {/*{Object.entries(groupedItems)*/}
                            {/*    .filter(([category, items]) => {*/}
                            {/*        return searchCategory === "*" || searchCategory === category;*/}
                            {/*    }).length === 0 && (*/}
                            {/*    <section*/}
                            {/*        className={`bg-center bg-cover bg-no-repeat bg-[image:var(--image-url)] bg-gray-700 bg-blend-multiply`}>*/}
                            {/*        <div className="px-4 mx-auto max-w-screen-xl text-center py-18 lg:py-20">*/}
                            {/*            <h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-none text-white md:text-5xl lg:text-6xl">*/}
                            {/*                <div className="flex flex-row items-center justify-center">*/}
                            {/*                    <div className="flex">*/}
                            {/*                        <IconRocketOff size={89}/>*/}
                            {/*                    </div>*/}
                            {/*                    <div className="ml-3 flex">*/}
                            {/*                        No Matches*/}
                            {/*                    </div>*/}
                            {/*                </div>*/}
                            {/*            </h1>*/}
                            {/*        </div>*/}
                            {/*    </section>*/}
                            {/*    )*/}
                            {/*}*/}

                            {isLoading && (
                                <div className="flex flex-col w-full items-center justify-center mt-6">
                                    <LoadingIcon/>
                                    <h1 className="mb-4 mt-4 text-2xl font-extrabold tracking-tight leading-none text-white md:text-3xl lg:text-4xl">
                                        Loading...
                                    </h1>
                                </div>
                            )}

                            {!isLoading && (
                                marketCategories.map((category, index) => (
                                    <section
                                        key={category.id}
                                        style={{'--image-url': `url(${getSectionImage(index)})`} as React.CSSProperties}
                                        className={`bg-center bg-cover bg-no-repeat bg-[image:var(--image-url)] bg-gray-700 bg-blend-multiply`}>
                                        <div className="px-4 mx-auto max-w-screen-xl text-center py-24 lg:py-38">
                                            <h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-none text-white md:text-5xl lg:text-6xl">
                                                {category.name}
                                            </h1>
                                            <p className="mb-8 text-lg font-normal text-gray-300 lg:text-xl sm:px-16 lg:px-48">
                                                {category.description}
                                            </p>
                                            {category.items && category.items?.length > 0 && (
                                                <h2 className="w-full mt-10 mb-4 text-2xl font-extrabold tracking-tight leading-none text-white md:text-3xl lg:text-4xl">
                                                    Featured
                                                </h2>
                                            )}
                                            {(category.items
                                                    && category.items?.length === 0)
                                                && (category.categories &&
                                                    category.categories?.length === 0) && (
                                                    <h2 className="w-full mt-10 mb-4 text-2xl font-extrabold tracking-tight leading-none text-white md:text-3xl lg:text-4xl">
                                                        We don&apos;t have anything in this category yet. You should
                                                        publish somethign to it!
                                                    </h2>
                                                )}
                                            <div
                                                className="flex flex-col space-y-4 sm:flex-col sm:justify-center sm:space-y-0">


                                                <div className="grid grid-cols-3 gap-1 content-start">
                                                    {category.items?.map((item, index) => (
                                                        <div key={item.id}
                                                             className="m-3 max-w-sm bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
                                                            <div className="">

                                                            </div>
                                                            <div className="relative max-w-sm">
                                                                <div className="w-full h-full">
                                                                    <img className="rounded-t-lg"
                                                                         src="https://admissions.vanderbilt.edu/wp-content/uploads/sites/4/2021/06/20181108JR003-scaled.jpg"
                                                                         alt=""/>
                                                                </div>
                                                                <div
                                                                    className="m-3 absolute inset-x-0 bottom-0 left-0 h-12 w-12 p-1 rounded-full border-2">
                                                                    {getMarketItemIcon(item)}
                                                                </div>
                                                            </div>
                                                            <div className="p-5">
                                                                <a href="#" onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    handleViewItemDetails(item);
                                                                }
                                                                }>
                                                                    <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                                                                        {item.name}
                                                                    </h5>
                                                                </a>
                                                                <div
                                                                    className="mb-3 font-normal text-gray-700 dark:text-gray-400">
                                                                    {item.description.length > 300 ? item.description.substring(0, 250) + "..." : item.description}
                                                                </div>
                                                                <div className="text-gray-600 dark:text-white">
                                                                    Tags:
                                                                </div>
                                                                <div
                                                                    className="text-gray-600 dark:text-white grid grid-cols-2 grid-flow-row ">
                                                                    {getTags(item)}
                                                                </div>
                                                                <p className="mt-2 mb-3 font-normal text-gray-700 dark:text-gray-400">
                                                                    By: {item.author}
                                                                </p>

                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                        handleViewItemDetails(item);
                                                                    }
                                                                    }
                                                                    className="m-2 inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                                    <IconChartArcs3/> Details &amp; Examples
                                                                </button>

                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                        handleTryItem(item);
                                                                    }
                                                                    }
                                                                    className="m-2 inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-neutral-700 rounded-lg hover:bg-neutral-800 focus:ring-4 focus:outline-none focus:ring-neutral-300 dark:bg-neutral-600 dark:hover:bg-neutral-700 dark:focus:ring-neutral-800">
                                                                    <IconRocket/> Try It
                                                                </button>

                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                        handleGetItem(item);
                                                                    }
                                                                    }
                                                                    className="m-2 inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                                    <IconDownload/> Get
                                                                </button>

                                                            </div>
                                                        </div>

                                                    ))}
                                                </div>
                                                <div className="flex flex-col w-full">
                                                    {(category.categories
                                                        && category.categories?.length > 0) && (
                                                        <h2 className="w-full mt-10 mb-4 text-2xl font-extrabold tracking-tight leading-none text-white md:text-3xl lg:text-4xl">
                                                            Sub Categories
                                                        </h2>
                                                    )}
                                                    <div className="grid grid-cols-3 gap-1 content-center">
                                                        {category.categories?.map((item, index) => (
                                                            <div key={item.id}
                                                                 onClick={(e) => {
                                                                     e.preventDefault();
                                                                     setSearchCategory(item.id);
                                                                 }
                                                                 }
                                                                 className="m-3 max-w-sm bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
                                                                <div className="">

                                                                </div>

                                                                <div className="p-5">
                                                                    <a href="#">
                                                                        <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                                                                            {item.name}
                                                                        </h5>
                                                                    </a>
                                                                    <p className="mb-3 font-normal text-gray-700 dark:text-gray-400">
                                                                        {item.description}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-row items-center justify-center p-4 mt-3">
                                            {searchCategory !== "*" && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setSearchCategory("*");
                                                    }}
                                                    className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-7 py-2.5 me-2 mb-6 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800">
                                                    See All Categories
                                                </button>
                                            )}
                                            {/*{searchCategory === "*" && (*/}
                                            {/*    <button*/}
                                            {/*        onClick={(e) => {*/}
                                            {/*            e.preventDefault();*/}
                                            {/*            setSearchCategory(category.id);*/}
                                            {/*        }}*/}
                                            {/*        className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-7 py-2.5 me-2 mb-6 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800">*/}
                                            {/*        See All in {category.name}*/}
                                            {/*    </button>*/}
                                            {/*)}*/}
                                        </div>
                                    </section>
                                ))
                            )}

                            {Object.entries(groupedItems)
                                .filter(([category, items]) => {
                                    return searchCategory === "*" || searchCategory === category;
                                })
                                .filter(([category, items]) => {
                                    return groupedMarketCategories[category];
                                })
                                .map(([category, items], index) => (
                                    <section
                                        key={category}
                                        style={{'--image-url': `url(${getSectionImage(index)})`} as React.CSSProperties}
                                        className={`bg-center bg-cover bg-no-repeat bg-[image:var(--image-url)] bg-gray-700 bg-blend-multiply`}>
                                        <div className="px-4 mx-auto max-w-screen-xl text-center py-24 lg:py-38">
                                            <h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-none text-white md:text-5xl lg:text-6xl">
                                                {category}
                                            </h1>
                                            <p className="mb-8 text-lg font-normal text-gray-300 lg:text-xl sm:px-16 lg:px-48">
                                                {groupedMarketCategories[category][0].description}
                                            </p>
                                            <div
                                                className="flex flex-col space-y-4 sm:flex-row sm:justify-center sm:space-y-0">


                                                <div className="grid grid-cols-3 gap-1 content-start">
                                                    {items?.map((item, index) => (
                                                        <div key={item.id}
                                                             className="m-3 max-w-sm bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
                                                            <div className="">

                                                            </div>
                                                            <div className="relative max-w-sm">
                                                                <div className="w-full h-full">
                                                                    <img className="rounded-t-lg"
                                                                         src="https://admissions.vanderbilt.edu/wp-content/uploads/sites/4/2021/06/20181108JR003-scaled.jpg"
                                                                         alt=""/>
                                                                </div>
                                                                <div
                                                                    className="m-3 absolute inset-x-0 bottom-0 left-0 h-12 w-12 p-1 rounded-full border-2">
                                                                    {getMarketItemIcon(item)}
                                                                </div>
                                                            </div>
                                                            <div className="p-5">
                                                                <a href="#">
                                                                    <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                                                                        {item.name}
                                                                    </h5>
                                                                </a>
                                                                <p className="mb-3 font-normal text-gray-700 dark:text-gray-400">
                                                                    {item.description}
                                                                </p>
                                                                <div className="text-gray-600 dark:text-white">
                                                                    Tags: {getTags(item)}
                                                                </div>
                                                                <p className="mt-2 mb-3 font-normal text-gray-700 dark:text-gray-400">
                                                                    By: {item.author}
                                                                </p>
                                                                <a href="#"
                                                                   className="inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                                    <IconDownload/> Get
                                                                </a>
                                                            </div>
                                                        </div>

                                                    ))}
                                                </div>
                                            </div>

                                        </div>
                                        <div className="flex flex-row items-center justify-center p-4 mt-3">
                                            {searchCategory !== "*" && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setSearchCategory("*");
                                                    }}
                                                    className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-7 py-2.5 me-2 mb-6 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800">
                                                    See All Categories
                                                </button>
                                            )}
                                            {searchCategory === "*" && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setSearchCategory(category);
                                                    }}
                                                    className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-7 py-2.5 me-2 mb-6 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800">
                                                    See All in {category}
                                                </button>
                                            )}
                                        </div>
                                    </section>

                                ))}

                        </div>
                    </div>

                    {/*<ChatInput*/}
                    {/*    handleUpdateModel={handleUpdateModel}*/}
                    {/*    stopConversationRef={stopConversationRef}*/}
                    {/*    textareaRef={textareaRef}*/}
                    {/*    onSend={(message, plugin, documents: AttachedDocument[] | null) => {*/}
                    {/*        setCurrentMessage(message);*/}
                    {/*        //handleSend(message, 0, plugin);*/}
                    {/*        routeMessage(message, 0, plugin, documents);*/}
                    {/*    }}*/}
                    {/*    onScrollDownClick={handleScrollDown}*/}
                    {/*    onRegenerate={() => {*/}
                    {/*        if (currentMessage) {*/}
                    {/*            //handleSend(currentMessage, 2, null);*/}
                    {/*            routeMessage(currentMessage, 2, null, null);*/}
                    {/*        }*/}
                    {/*    }}*/}
                    {/*    showScrollDownButton={showScrollDownButton}*/}
                    {/*/>*/}
                </>

            </div>);
}

