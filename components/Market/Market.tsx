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
    handleStartConversationWithPrompt, parseEditableVariables, savePrompts
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
import {MarketCategory, MarketItem, MarketItemType} from "@/types/market";
import {deleteItem, getCategory, getItem, getItemExamples} from "@/services/marketService";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {ImportAnythingModal, ImportFetcher} from "@/components/Share/ImportAnythingModal";
import {Conversation, MessageType} from "@/types/chat";
import {FolderInterface} from "@/types/folder";
import {Prompt} from "@/types/prompt";
import {ExampleChat} from "@/components/Market/components/ExampleChat";
import {saveFolders} from "@/utils/app/folders";
import React from 'react';

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
            folders,
            prompts,
            statsService,
            featureFlags: {marketItemDelete},
        },
        handleNewConversation,
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const promptsRef = useRef(prompts);

    useEffect(() => {
        promptsRef.current = prompts;
      }, [prompts]);


    const foldersRef = useRef(folders);

    useEffect(() => {
        foldersRef.current = folders;
    }, [folders]);

    const { startConversationEvent, tryMarketItemEvent } = statsService;

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
        scrollToTop();

        const fetchCategory = (searchCategory && searchCategory !== "*") ? searchCategory : "/";

        setIsLoading(true);

        updateNavItems(fetchCategory);

        getCategory(fetchCategory).then((data) => {

            console.log("Fetched Category: ", data.data);

            completeSubCategories(data.data).then((subCategories) => {

                console.log("Fetched Sub Categories: ", subCategories);

                if(!subCategories || subCategories.length === 0) {
                    subCategories = [
                        data.data
                    ]
                }

                setMarketCategories(subCategories);
                setIsLoading(false);
            });
        });

        const grouped = groupBy(marketItems, 'category');
        //const groupedCategories = groupBy(marketCategories, 'name');


        //setGroupedMarketCategories(groupedCategories);

        const results = search(searchStr, grouped);
        setGroupedItems(results);

        // setTimeout(() => {
        //     scrollToTop();
        // }, 500);
    }, [marketItems, searchStr, searchCategory]);

    // useEffect(() => {
    //     scrollToTop();
    // }, [showExample]);

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

        statsService.installMarketItemEvent(item);

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

        statsService.tryMarketItemEvent(item);

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

    const startTutorial = () => {
        const rootPromptContent = `Act as a intelligent guide helping the user to figure out "Amplify", which is a new interface to Generative AI. The tool is open source and maintained at Vanderbilt by Jules White, Allen Karns, and Max Moundas in the Chancellor's Office. Amplify is based on the fantastic open source Chatbot UI created by Mckay Wrigley. Please direct any questions or issues with the tool to amplify@vanderbilt.edu.

In general, you should not open Amplify in multiple browser tabs. If you would like to open it in different browser tabs, do it in separate "private browsing" or "incognito tabs". 

Most of your work is saved locally in your browser until you save it to a workspace. If you clear your browser's history and have not saved the workspace, you will lose any changes.

The tool has the following features:

1. On the left-hand side is the "left panel". The left panel has a series of tabs along the top with icons that can be used to navigate between its pages.  Its pages are:

   a. Chats: The list of chats that you have created. This has a chat balloon icon. It is the first tab in the list. You can see your chats, start new chats, and organize them in folders here. The icon of the folder with the + at the top right of this page is how you create a new folder. You can drag and drop chats between folders to reorganize them. Every day, a folder will be created with the date and new chats will automatically be added to this folder. You can reorganize the chats in this folder by dragging them to other folders that you create.

  b. Sharing: The share icon has a central dot with two lines extending to two other dots. It is the second tab in the list. A page with the list of things that have been shared with you. You can share chats, folders, and prompt templates (which are on the "right-panel") with other users from the organization. You can't share outside of the organization. The application contains a market and you can access it here by clicking "Open Marketplace". You can share things to either other users or to the Marketplace. The "Shared with You" shows which users have shared items with you. If it is empty, no one has shared anything with you yet. You can expand a user's name to see the items they have shared with you and clicking on one of them will give you the option to import their share into your workspace. Shared items are not linked and any changes that you make will not affect the other user. However, you can share the same item back with them and then the changes WILL overwrite their changes if they accept. You can use this feature for rudimentary sharing of changes.

c. Workspaces: This is the list of your workspaces. It is the third tab and has an icon showing a series of dots that look like a sports tournament bracket. You can create, save, and load workspaces here. Each workspace can have a separate set of chats, folders, and prompts. Your workspaces also show up as shared items with yourself. You can have separate workspaces that have folders related to different projects.  Each time you save a workspace, it will automatically create a new version of it. You can see all versions of a workspace underneath it and load any historical version at any time. 

d. Settings: The fourth tab is the settings. You can change the theme here and export all of the chat data from your current workspace to save it outside of the tool. You can also load exported data here.

On the "right panel" is your list of prompt templates, assistants, and automations. These items are organized into folders like the chats. 

a. Prompt Template: A prompt template is a template for a prompt. It can have placeholders that you fill in. For example, if you wanted to create a template for a formal letter, you could say "Dear \\{\\{Name\\}\\}," (note: I have escaped the braces, but they are not escaped in real templates) and it will ask you for the name and automatically fill in the "Dear " and the "," after the name. Templates are powerful building blocks in the tool for capturing reusable prompts. A template can add "tags" to a new chat that help categorize it. This is important for follow-up buttons. 

b. Assistants / Custom Instructions: Each chat can have a set of "custom instructions" that guide it. These are ground rules that will be included in every single prompt and never forgotten. You can use these instructions to create "assistants" that can perform a particular purpose. For example, if you wanted to create a skeptical assistant, you could create custom instructions like "Act as a skeptic of everything I say." If you start a new chat with these custom instructions, no matter what you type into the conversation, the assistant will respond skeptically. A prompt template can also refer to a set of custom instructions that are automatically included when you use it. 

c. Follow-up Buttons. A follow-up button is a special template that shows up when you mouse over a response. These buttons make it easier to create actions that are designed for specific types of conversations. The follow-up button has a "tag" that must be on the conversation for it to show up. Only chats with these tags will display the follow-up button. So, if you want to have a "Lesson Planner" application, you can have a starting "Create Lesson Plan" prompt that adds a "lesson-planner" tag to the chat. Then, you can create follow-up buttons that are based on the "lesson-planner" tag. For example, you could have a "Create Quiz" follow-up button that is a prompt template to create a quiz based on the lesson plan. 

d. Automations. These are advanced templates that execute Javascript to perform more complex capabilities. This is similar to ChatGPT Advanced Data Analysis or Code Interpreter. You may use automations that are given to you. To create your own automations, you must request access to the features from the team.

The center pane will either display the Marketplace or the Chat pane. If you create a new chat, it will show up here. 

Chats are the main focus of the tool. You can type in a message in the bottom bar and hit the arrow button to sent it to a Generative AI model. Currently, the OpenAI models are supported, but Anthropic Claude will be added soon. 

You can attach documents to your chats with the "+" button. For normal chats, the documents must be smaller than the size of the context window for the model that you are using (e.g., usually 2-3 pages of text or less). Documents that you submit are uploaded to the server. Any document that you submit is converted into plain text. The tool will not work with PDFs that are images and other formats that can't be represented as text. The documents are uploaded to the server. In the future, you will be able to upload documents once and then chat with them over and over using Retrieval Augmented Generation, which is coming soon.

You can add tags to the chat at the top of the conversation. These tags will enable any follow-up buttons associated with them.

You can mouse over any message and see copy and edit buttons. The copy button will copy the contents of the message to your clipboard. The edit button will allow you to edit the response. You can edit BOTH user and Generative AI responses. 

The tool can generate a number of diagrams and visualizations. To try this out, ask it "Please generate a random flow chart and a random visualization". It doesn't always get things right, so if you see "Loading..." after it finishes providing its response, it means it made a mistake. You should ask it to try again and tell it that there was an error in the diagram or visualization.

You want to go through the features of Amplify with the user one by one. Go slow and explain things based on where the user will see them in the interface. This tutorial that you are giving them is taking place in a Chat. If you tell them to go open the Marketplace, make sure and tell them how to get back to this chat to continue the tutorial. Ask questions to make sure the user is understanding what you are telling them (it shouldn't be a quiz or burdensome, just quick check-ins). Try to make each answer 2-3 paragraphs or less. Don't generate long outlines for an entire panel at once. Instead, do something like tell them about the "left panel" and then say, when you are ready, I will tell you about the first feature in this panel. Go through things one small item at a time.
If people need help with prompt engineering, which is how you converse effectively with these types of tools, they can take a free course: Prompt Engineering for ChatGPT https://coursera.org/learn/prompt-engineering. 
`;

        const rootPrompt = {
            id: "__amplify_tutorial_root",
            name: "Amplify Tutorial",
            description: "This is a tutorial that walks you through the features of Amplify.",
            content: rootPromptContent,
            tags: ["amplify-tutorial"],
            type: MessageType.ROOT,
            folderId:"__amplify_tutorial",
        }

        const startTutorialPrompt = {
            id: "__amplify_tutorial_start",
            name: "Start Amplify Tutorial",
            description: "This is a prompt that starts the Amplify tutorial.",
            content: "Please give me a tutorial of Amplify and start by telling me about what it is, who develops it, and how to get help outside of this tutorial.",
            type: MessageType.PROMPT,
            data: {
                rootPromptId: rootPrompt.id,
            },
            folderId:"__amplify_tutorial",
        }

        const tutorialFolder = {
            id: "__amplify_tutorial",
            name: "Amplify Tutorial",
            description: "This is a folder that contains the Amplify tutorial.",
            type: "prompt",
        }

        const updatedFolders = [...foldersRef.current].filter(f => f.id !== tutorialFolder.id);

        homeDispatch({ field: 'folders', value: updatedFolders });

        saveFolders(updatedFolders);

        const updatedPrompts = [...promptsRef.current].filter(p => p.id !== rootPrompt.id && p.id !== startTutorialPrompt.id);
        updatedPrompts.push(rootPrompt);
        updatedPrompts.push(startTutorialPrompt);

        //homeDispatch({ field: 'prompts', value: updatedPrompts });

        //savePrompts(updatedPrompts);
        startConversationEvent(startTutorialPrompt);
        handleStartConversationWithPrompt(handleNewConversation, updatedPrompts, startTutorialPrompt);
    }


    const handleMarketItemDelete = async(item:MarketItem) => {
        if(marketItemDelete){
            deleteItem(item.id).then((data)=> {
                if(data.success) {
                    alert("Market item deleted.");
                    const updatedItems = [...marketItems].filter((i) => i.id !== item.id);
                    setMarketItems(updatedItems);
                } else {
                    alert("There was an error deleting the market item.");
                }
            });
        }
    }

    const handleViewItemDetails = async (item: MarketItem) => {
        const category = item.category;
        const id = item.id;

        statsService.viewMarketItemEvent(item);

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
            startConversationEvent(itemPrompts[0]);
            handleStartConversationWithPrompt(handleNewConversation, [...promptsRef.current, ...itemPrompts], itemPrompts[0]);
        } else {
            alert("There are no prompts to try in this market item.");
        }
    }

    function formatCategoryName(input: string): string {
        return input
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    const getNav = () => {
        return (<nav ref={scrollRef} className="sticky top-0 z-50 pl-20 flex px-5 py-3 text-gray-700 border border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700" aria-label="Breadcrumb">
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
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
                            </svg>
                            <a href="#"
                               onClick={
                                   (e) => {
                                       e.stopPropagation();
                                       e.preventDefault();
                                       crumb.nav();
                                   }
                               }
                               className="ms-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ms-2 dark:text-gray-400 dark:hover:text-white">
                                {formatCategoryName(crumb.name)}
                            </a>
                        </div>
                    </li>
                ))}
            </ol>
        </nav>);
    }


// @ts-ignore
    return (
            <div className="relative flex-1 overflow-hidden bg-neutral-100 dark:bg-[#343541]">
                <>
                    <div
                        className="max-h-full overflow-x-hidden"
                    >
                        {getNav()}
{/* 
                        {showMarketItemTryModal && (
                            <ImportAnythingModal
                                title={"Try Market Item"}
                                importButtonLabel={"Try"}
                                onImport={
                                    () => {
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
                        )} */}

                        {/* {showMarketItemInstallModal && (
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
                        )} */}

                        {showExample  && (
                        <>
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
                        </>)}

                        {!showExample && (
                            <>
                            <section className="bg-gray-50 dark:bg-gray-900">
                                <div
                                    className="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 grid lg:grid-cols-2 gap-8 lg:gap-16">
                                    <div className="flex flex-col items-center">
                                        <div className="mb-4 flex items-center justify-center text-4xl font-extrabold tracking-tight leading-none text-gray-900 md:text-5xl lg:text-6xl dark:text-white text-center">
                                          <IconRocket size={89} />
                                        </div>
                                        <h1 ref={scrollRef} className="text-4xl font-extrabold tracking-tight leading-none text-gray-900 md:text-5xl lg:text-6xl dark:text-white text-center">
                                          Generative AI Market
                                        </h1>
                                        <br />

                                        <p className="mb-6 text-lg font-normal text-gray-500 lg:text-xl dark:text-gray-400">
                                            Discover and share prompts, assistants, and automations with the community.
                                            Build
                                            on top of the prompt engineering of others to accelerate your own work.
                                        </p>
                                        <button
                                            className="w-full px-5 py-3 text-base font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 sm:w-auto dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                                            onClick={(e) => {
                                               e.stopPropagation();
                                               e.preventDefault();
                                               startTutorial();
                                           }
                                           }
                                            >
                                            Take a quick tutorial

                                        </button>

                                        <a href="#"
                                           onClick={(e) => {
                                               e.stopPropagation();
                                               e.preventDefault();
                                               window.open("https://coursera.org/learn/prompt-engineering");

                                           }
                                           }
                                           className="mt-4 text-blue-600 dark:text-blue-500 hover:underline font-medium text-lg inline-flex items-center">
                                            Learn more about writing great prompts
                                        </a>

                                    </div>
                                    <div>
                                        <div
                                            className="w-full lg:max-w-xl p-6 space-y-8 sm:p-8 bg-white rounded-lg shadow-xl dark:bg-gray-800">
                                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
                                                AI-Generated Prompts & Tools for Vanderbilt
                                            </h2>
                                            <div>
                                                <h4 className="mb-6 text-lg font-normal text-gray-500 lg:text-xl dark:text-gray-400">
                                                    We asked GPT-4 to think of prompts that would be helpful to Vanderbilt
                                                    faculty and staff.</h4>
                                            </div>
                                            <div>
                                            <h4 className="mb-6 text-lg font-normal text-gray-500 lg:text-xl dark:text-gray-400">
                                                We then taught GPT-4 how to write reusable prompt
                                                templates for Amplify. Most of what you see in the market is GPT-4&apos;s
                                                prompts to help you. We hope you find them useful.</h4>
                                            </div>
                                            {/*<h2 className="text-2xl font-bold text-gray-900 dark:text-white">*/}
                                            {/*    Search this Category*/}
                                            {/*</h2>*/}
                                            <form className="mt-8 space-y-6" action="#">
                                                {/*<div>*/}
                                                {/*    <label htmlFor="keywords"*/}
                                                {/*           className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Key*/}
                                                {/*        Words</label>*/}
                                                {/*    <input type="text" name="keywords" id="keywords"*/}
                                                {/*           value={searchStr}*/}
                                                {/*           onChange={(e) => setSearchStr(e.target.value)}*/}
                                                {/*           className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"*/}
                                                {/*           placeholder="Enter your search terms..." required/>*/}
                                                {/*</div>*/}
                                                {/*<div>*/}
                                                {/*    <label htmlFor="category"*/}
                                                {/*           className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Category</label>*/}
                                                {/*    <select id="category" className="text-black text-xl rounded"*/}
                                                {/*            onChange={(e) => setSearchCategory(e.target.value)}*/}
                                                {/*            value={searchCategory}*/}
                                                {/*    >*/}
                                                {/*        <option key="all" value="*">All Categories</option>*/}
                                                {/*        {marketCategories.map((category) => (*/}
                                                {/*            <option key={category.id}*/}
                                                {/*                    value={category.id}>{category.name}</option>*/}
                                                {/*        ))}*/}
                                                {/*    </select>*/}
                                                {/*</div>*/}

                                                <div>
                                                <a href="mailto:jules.white@vanderbilt.edu?subject=AI-Generated%40Prompts"
                                                        className="w-full px-5 py-3 text-base font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 sm:w-auto dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                    Send Feedback
                                                </a>
                                                </div>
                                                <div>
                                                <a href="mailto:jules.white@vanderbilt.edu?subject=AI-Generated%40Prompts"
                                                   className="w-full px-5 py-3 text-base font-medium text-center text-white bg-purple-700 rounded-lg hover:bg-purple-800 focus:ring-4 focus:ring-purple-300 sm:w-auto dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-800">
                                                    Request a New Category
                                                </a>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </section>

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
                                            {category.items && category.items?.length > 0 && (
                                                <h2 className="w-full mt-10 mb-4 text-2xl font-extrabold tracking-tight leading-none text-white md:text-3xl lg:text-4xl">
                                                    Featured Prompt Templates
                                                </h2>
                                            )}
                                            {(category.items
                                                    && category.items?.length === 0)
                                                && (category.categories &&
                                                    category.categories?.length === 0) && (
                                                    <h2 className="w-full mt-10 mb-4 text-2xl font-extrabold tracking-tight leading-none text-white md:text-3xl lg:text-4xl">
                                                        We don&apos;t have anything in this category yet. You should
                                                        publish something to it!
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

                                                                {marketItemDelete && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            handleMarketItemDelete(item);
                                                                        }
                                                                        }
                                                                        className="m-2 inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                                        Delete
                                                                    </button>
                                                                    )}

                                                            </div>
                                                        </div>

                                                    ))}
                                                </div>

                                            </div>
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
                            </>)}
                        </div>
                </>

            </div>);
}

