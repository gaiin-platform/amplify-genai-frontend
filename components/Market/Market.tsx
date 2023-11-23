import {
    IconClearAll,
    IconSettings,
    IconShare,
    IconRobot,
    IconApiApp,
    IconJetpack,
    IconRocket,
    IconRocketOff,
    IconTournament,
    IconDownload,
    IconTree
} from '@tabler/icons-react';
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

interface Props {
    items: MarketItem[];
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
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    //
    const [groupedItems, setGroupedItems] = useState<{ [key: string]: MarketItem[]; }>({});
    const [groupedMarketCategories, setGroupedMarketCategories] = useState<{ [key: string]: MarketCategory[]; }>({});
    const [marketCategories, setMarketCategories] = useState<MarketCategory[]>([
        {
            "id": "academic",
            "name": "Academic",
            "description": "Prompts and tasks related to academic assignments and topics.",
            "icon": "academic-icon.png",
            "tags": ["essay", "writing", "programming", "java", "math", "calculus"],
            "image": "https://www.vanderbilt.edu/wp-content/uploads/sites/3/2021/04/bronson-ingram.jpeg"
        },
        {
            "id": "computer-science",
            "name": "Computer Science",
            "description": "Prompts and tasks related to computer science and programming.",
            "icon": "cs-icon.png",
            "tags": ["programming", "java"],
            "image": "https://www.goodyclancy.com/wp-content/uploads/2023/06/Vanderbilt_Warren-and-Moore_exterior-1_Goody-Clancy.jpg"
        },
        {
            "id": "mathematics",
            "name": "Mathematics",
            "description": "Prompts and tasks related to mathematics and problem-solving.",
            "icon": "math-icon.png",
            "tags": ["math", "calculus"],
            "image": "https://cdn.vanderbilt.edu/vu-URL/wp-content/uploads/sites/97/2021/09/19231133/Local-Color-campus-shot.jpg"
        },
        {
            "id": "operational",
            "name": "Operational",
            "description": "Prompts and tasks related to operational aspects of a university.",
            "icon": "operational-icon.png",
            "tags": ["grants", "administration", "event", "planning", "advising", "lesson"],
            "image": "https://thecollegepost.com/wp-content/uploads/2018/08/ariel_kirkland.jpg"
        }
    ]);
    const [marketItems, setMarketItems] = useState<MarketItem[]>([
        {
            id: "1",
            name: "Essay Prompt",
            description: "A prompt for writing an essay on a given topic",
            author: "University Task Generator",
            lastUpdated: "2022-10-01",
            created: "2022-09-01",
            tags: ["essay", "writing", "university"],
            category: "Academic",
            sourceUrl: "https://example.com/essay-prompt",
            type: MarketItemType.PROMPT,
        },
        {
            id: "2",
            name: "Programming Assignment Prompt",
            description: "A prompt for a programming assignment in Java",
            author: "Computer Science Department",
            lastUpdated: "2022-10-02",
            created: "2022-09-02",
            tags: ["programming", "java", "university"],
            category: "Computer Science",
            sourceUrl: "https://example.com/programming-prompt",
            type: MarketItemType.ASSISTANT,
        },
        {
            id: "3",
            name: "Math Problem Prompt",
            description: "A prompt for solving a math problem related to calculus",
            author: "Mathematics Department",
            lastUpdated: "2022-10-03",
            created: "2022-09-03",
            tags: ["math", "calculus", "university"],
            category: "Mathematics",
            sourceUrl: "https://example.com/math-prompt",
            type: MarketItemType.PROMPT,
        },
        {
            id: "4",
            name: "Grants Administration Task",
            description: "A prompt for managing and administering grants",
            author: "Research Office",
            lastUpdated: "2022-09-20",
            created: "2022-08-10",
            tags: ["grants", "administration", "university"],
            category: "Operational",
            sourceUrl: "https://example.com/grants-task",
            type: MarketItemType.AUTOMATION,
        },
        {
            id: "5",
            name: "Event Planning Prompt",
            description: "A prompt for planning an upcoming university event",
            author: "Student Activities Department",
            lastUpdated: "2022-09-25",
            created: "2022-08-15",
            tags: ["event", "planning", "university"],
            category: "Operational",
            sourceUrl: "https://example.com/event-prompt",
            type: MarketItemType.ROOT,
        },
        {
            id: "6",
            name: "Academic Advising Task",
            description: "A prompt for advising students on their academic journey",
            author: "Academic Advising Office",
            lastUpdated: "2022-09-18",
            created: "2022-08-05",
            tags: ["advising", "academic", "university"],
            category: "Operational",
            sourceUrl: "https://example.com/advising-task",
            type: MarketItemType.COLLECTION,
        },
        {
            id: "7",
            name: "Lesson Planning Prompt",
            description: "A prompt for planning a lesson in a specific subject",
            author: "Education Department",
            lastUpdated: "2022-09-30",
            created: "2022-08-25",
            tags: ["lesson", "planning", "university"],
            category: "Operational",
            sourceUrl: "https://example.com/lesson-prompt",
            type: MarketItemType.PROMPT,
        },
        // Add more operational prompts...
    ]);

    const [searchStr, setSearchStr] = useState<string>("");
    const [searchCategory, setSearchCategory] = useState<string>("*");


    const groupBy = (array: any[], key: string | number) => {
        return array.reduce((result: { [x: string]: any[]; }, currentItem: { [x: string]: any; }) => {
            (result[currentItem[key]] = result[currentItem[key]] || []).push(currentItem);
            return result;
        }, {});
    };

    useEffect(() => {
        const grouped = groupBy(marketItems, 'category');
        const groupedCategories = groupBy(marketCategories, 'name');
        setGroupedMarketCategories(groupedCategories);

        const results = search(searchStr, grouped);
        setGroupedItems(results);
    }, [marketItems, searchStr]);

    const search = (query:string, grouped:{ [key: string]: MarketItem[]; }) => {
        if(query) {
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
        }else{
            return grouped;
        }
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
        return item.tags.map((tag) => (
            <span
                key={tag}
                className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium rounded border-2 m-1 dark:text-white text-gray-400"}
            >
                {tag}
            </span>
        ));
    }

    const getMarketItemIcon = (item: MarketItem) => {
        switch (item.type) {
            case MarketItemType.ASSISTANT:
                return <IconRobot size={36}/>;
            case MarketItemType.AUTOMATION:
                return <IconApiApp size={36}/>;
            case MarketItemType.COLLECTION:
                return <IconTournament size={36}/>;
            case MarketItemType.PROMPT:
                return <IconRocket size={36}/>;
            case MarketItemType.ROOT:
                return <IconTree size={36}/>;
            default:
                return <IconRobot size={36}/>;
        }
    }

    useEffect(() => {

    });

// @ts-ignore
    return (
        <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">
            <>
                <div
                    className="max-h-full overflow-x-hidden"
                >
                    <div>

                        {/*{showSettings && (*/}
                        {/*    <div*/}
                        {/*        className="flex flex-col space-y-10 md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">*/}
                        {/*        <div*/}
                        {/*            className="flex h-full flex-col space-y-4 border-b border-neutral-200 p-4 dark:border-neutral-600 md:rounded-lg md:border">*/}
                        {/*            <ModelSelect/>*/}
                        {/*        </div>*/}
                        {/*    </div>*/}
                        {/*)}*/}



                        <section className="bg-gray-50 dark:bg-gray-900">
                            <div
                                className="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 grid lg:grid-cols-2 gap-8 lg:gap-16">
                                <div className="flex flex-col justify-center">
                                    <h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-none text-gray-900 md:text-5xl lg:text-6xl dark:text-white">
                                       <IconRocket size={89}/> Launch Your Generative AI</h1>
                                    <p className="mb-6 text-lg font-normal text-gray-500 lg:text-xl dark:text-gray-400">
                                    Discover and share prompts, assistants, and automations with the community. Build
                                    on top of the prompt engineering of others to accelerate your own work.
                                    </p>
                                    <a href="#"
                                       className="text-blue-600 dark:text-blue-500 hover:underline font-medium text-lg inline-flex items-center">
                                        Take a quick tutorial
                                        <svg className="w-3.5 h-3.5 ms-2 rtl:rotate-180" aria-hidden="true"
                                             xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
                                                  stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                                        </svg>
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
                                                       className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Key Words</label>
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
                                                    {Object.entries(groupedItems).map(([category, items]) => (
                                                        <option key={category} value={category}>{category}</option>
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


                        {Object.entries(groupedItems)
                            .filter(([category, items]) => {
                                return searchCategory === "*" || searchCategory === category;
                            }).length === 0 && (
                            <section
                                className={`bg-center bg-cover bg-no-repeat bg-[image:var(--image-url)] bg-gray-700 bg-blend-multiply`}>
                                <div className="px-4 mx-auto max-w-screen-xl text-center py-18 lg:py-20">
                                    <h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-none text-white md:text-5xl lg:text-6xl">
                                        <div className="flex flex-row items-center justify-center">
                                            <div className="flex">
                                                <IconRocketOff size={89}/>
                                            </div>
                                            <div className="ml-3 flex">
                                                No Matches
                                            </div>
                                        </div>
                                    </h1>
                                </div>
                            </section>
                            )
                        }

                        {Object.entries(groupedItems)
                            .filter(([category, items]) => {
                              return searchCategory === "*" || searchCategory === category;
                            })
                            .map(([category, items]) => (
                                <section
                                    key={category}
                                    style={{'--image-url': `url(${groupedMarketCategories[category][0].image})`} as React.CSSProperties}
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

