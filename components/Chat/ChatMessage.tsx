import {
    IconCheck,
    IconCopy,
    IconEdit,
    IconRobot,
    IconTrash,
    IconUser,
    IconZoomIn,
} from '@tabler/icons-react';
import {FiCommand} from "react-icons/fi";
import styled, {keyframes} from 'styled-components';
import {FC, memo, useContext, useEffect, useLayoutEffect, useRef, useState} from 'react';

import {useTranslation} from 'next-i18next';

import {updateConversation} from '@/utils/app/conversation';

import {ChatBody, Message, newMessage} from '@/types/chat';

import {useChatService} from "@/hooks/useChatService";

import HomeContext from '@/pages/api/home/home.context';

import {CodeBlock} from '../Markdown/CodeBlock';
import {MemoizedReactMarkdown} from '../Markdown/MemoizedReactMarkdown';
import ChatFollowups from './ChatFollowups';
//import rehypeMermaid from 'rehype-mermaidjs'
//import rehypeMathjax from 'rehype-mathjax';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import Workflow from "@/utils/workflow/workflow";
import mermaid from "mermaid";

const mermaidConfig = {
    startOnLoad: true,
    theme: "base",
    securityLevel: "loose",
    themeVariables: {
        fontSize: "18px",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\"",
        darkMode: true,
        background: "#282a36",
        mainBkg: "#282a36",

        lineColor: "#ff79c6",
    },
    // themeCSS: `
    //   g.classGroup rect {
    //     fill: #282a36;
    //     stroke: #6272a4;
    //   }
    //   g.classGroup text {
    //     fill: #f8f8f2;
    //   }
    //   g.classGroup line {
    //     stroke: #f8f8f2;
    //     stroke-width: 0.5;
    //   }
    //   .classLabel .box {
    //     stroke: #21222c;
    //     stroke-width: 3;
    //     fill: #21222c;
    //     opacity: 1;
    //   }
    //   .classLabel .label {
    //     fill: #f1fa8c;
    //   }
    //   .relation {
    //     stroke: #ff79c6;
    //     stroke-width: 1;
    //   }
    //   #compositionStart, #compositionEnd {
    //     fill: #bd93f9;
    //     stroke: #bd93f9;
    //     stroke-width: 1;
    //   }
    //   #aggregationEnd, #aggregationStart {
    //     fill: #21222c;
    //     stroke: #50fa7b;
    //     stroke-width: 1;
    //   }
    //   #dependencyStart, #dependencyEnd {
    //     fill: #00bcd4;
    //     stroke: #00bcd4;
    //     stroke-width: 1;
    //   }
    //   #extensionStart, #extensionEnd {
    //     fill: #f8f8f2;
    //     stroke: #f8f8f2;
    //     stroke-width: 1;
    //   }`,

};

mermaid.initialize(mermaidConfig);

interface MermaidProps {
    chart: string;
}

// export default class Mermaid extends React.Component {
//   componentDidMount() {
//     mermaid.contentLoaded();
//   }
//   render() {
//     //console.log(this.props.chart);
//     //@ts-ignore
//     return <div className="mermaid">{this.props.chart}</div>;
//   }
// }

const Mermaid: React.FC<MermaidProps> = ({chart}) => {
    const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [height, setHeight] = useState<number>(500);

    const {
        state: {messageIsStreaming},
    } = useContext(HomeContext);

    useEffect(() => {
        if (typeof window !== 'undefined') {

            const showLoading = () => {
                if (!messageIsStreaming) {
                    setSvgDataUrl("data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"200\"><text x=\"50\" y=\"100\" font-size=\"16\">Loading...</text></svg>")
                }
            };

            if (!messageIsStreaming) {
                try {
                    mermaid.parse(chart).then((result) => {
                        mermaid.render('graphDiv', chart).then(
                            (svgContent) => {
                                if (svgContent) {
                                    // @ts-ignore
                                    const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(svgContent.svg)}`;
                                    setSvgDataUrl(svgDataUrl);
                                } else {
                                    showLoading();
                                }
                            }
                        ).catch(() => {
                            showLoading();
                        });
                    }).catch(() => {
                        showLoading();
                    });

                } catch (err) {
                    showLoading();
                }
            }
        }
    }, [chart]);

    // @ts-ignore
    return error ?
        <div>{error}</div> :
        <div style={{maxHeight:"450px"}}>
            <div className="flex items-center space-x-4">
            <IconZoomIn/>
            <input
                type="range"
                min="250"
                max="4000"
                value={height}
                onChange={(e)=>{ // @ts-ignore
                    setHeight(e.target.value)}}
            />
            </div>
            <div style={{height: `${height + 20}px`, width: `${2 * height}px`, overflow:"auto"}}>
                <img  style={{height: `${height}px`}} src={svgDataUrl|| "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"80\"><text x=\"50\" y=\"30\" font-size=\"18\" font-family='sans-serif' font-weight=\"bold\" fill=\"white\">Loading...</text></svg>"} alt="Loading"/>
             </div>
        </div>;
};


// function remarkMermaid(): (tree: Node) => void {
//   function transformer(tree: Node) {
//     visit(tree, 'code', (node: any) => {
//       const { lang, value } = node;
//       if (lang === 'mermaid') {
//         node.type = 'code';
//         node.value = `<Mermaid>{\`${value}\`}</Mermaid>`;
//       }
//     });
//   }
//   return transformer;
// }

export interface Props {
    message: Message;
    messageIndex: number;
    onEdit?: (editedMessage: Message) => void,
    onSend: (message: Message[]) => void,
    handleWorkflow: (messages: Message[]) => void,
    handleRunWorkflow: (workflow: Workflow) => void,
    handleCustomLinkClick: (href: string) => void,
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

export const ChatMessage: FC<Props> = memo(({
                                                message, messageIndex, onEdit, onSend, handleCustomLinkClick,
                                                handleWorkflow, handleRunWorkflow
                                            }) => {
    const {t} = useTranslation('chat');

    const {
        state: {selectedConversation, conversations, currentMessage, messageIsStreaming},
        dispatch: homeDispatch,
        handleAddMessages: handleAddMessages
    } = useContext(HomeContext);

    const {sendChatRequest} = useChatService();

    const userFollowupButtonsConfig = [
        {
            title: 'Suggest Prompt Improvements', handler: () => {
                onSend([newMessage({
                    role: "user", content: "Given the prompt: " +
                        "---------------------------------\n" +
                        "" + message.content +
                        "\n---------------------------------\n" +
                        "Suggest an enhanced version of it.\n" +
                        "1. Start with clear, precise instructions placed at the beginning of the prompt.\n" +
                        "2. Include specific details about the desired context, outcome, length, format, and style.\n" +
                        "3. Provide examples of the desired output format, if possible.\n" +
                        "4. Use appropriate leading words or phrases to guide the desired output, especially if code generation is involved.\n" +
                        "5. Avoid any vague or imprecise language. \n" +
                        "6. Rather than only stating what not to do, provide guidance on what should be done instead.\n" +
                        "\n" +
                        "Remember to ensure the revised prompt remains true to the user's original intent. At the end, ask me if you should respond to this prompt."
                })])

            }
        },
    ];

    const followUpButtonsConfig = [
        {
            title: 'Follow-up Prompts',
            handler: () => onSend([newMessage({
                role: "user",
                content: "Act as an expert prompt engineer. Suggest really five really innovative, creative, follow-up prompts that would generate concrete outputs or analyses that would help me do something related to this content. Be very very specific with the wording of your suggestions and all of them should include building a step by step plan as part of the prompt. All of them should include a persona."
            })])
        },
        {
            title: 'Follow-up Questions',
            handler: () => onSend([newMessage({role: "user", content: "What are follow-up questions I should ask?"})])
        },
        {
            title: 'Fact List',
            handler: () => onSend([newMessage({role: "user", content: "Create a bulleted list of facts related to this content that should be checked to determine its veracity."})])
        },
    ];

    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [messageContent, setMessageContent] = useState(message.content);
    const [messagedCopied, setMessageCopied] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const toggleEditing = () => {
        setIsEditing(!isEditing);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessageContent(event.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const handleEditMessage = () => {
        if (message.content != messageContent) {
            if (selectedConversation && onEdit) {
                onEdit({...message, content: messageContent});
            }
        }
        setIsEditing(false);
    };

    const handleDeleteMessage = () => {
        if (!selectedConversation) return;

        const {messages} = selectedConversation;
        const findIndex = messages.findIndex((elm) => elm === message);

        if (findIndex < 0) return;

        if (
            findIndex < messages.length - 1 &&
            messages[findIndex + 1].role === 'assistant'
        ) {
            messages.splice(findIndex, 2);
        } else {
            messages.splice(findIndex, 1);
        }
        const updatedConversation = {
            ...selectedConversation,
            messages,
        };

        const {single, all} = updateConversation(
            updatedConversation,
            conversations,
        );
        homeDispatch({field: 'selectedConversation', value: single});
        homeDispatch({field: 'conversations', value: all});
    };

    const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
            e.preventDefault();
            handleEditMessage();
        }
    };

    const copyOnClick = () => {
        if (!navigator.clipboard) return;

        navigator.clipboard.writeText(message.content).then(() => {
            setMessageCopied(true);
            setTimeout(() => {
                setMessageCopied(false);
            }, 2000);
        });
    };

    useEffect(() => {
        setMessageContent(message.content);
    }, [message.content]);


    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing]);

    useEffect(() => {
        mermaid.initialize(mermaidConfig);
    }, []);

    // Trigger mermaid to render all diagrams
    useEffect(() => {
        mermaid.init(mermaidConfig);
    }, [message.content]);

    // @ts-ignore
    return (
        <div
            className={`group md:px-4 ${
                message.role === 'assistant'
                    ? 'border-b border-black/10 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100'
                    : 'border-b border-black/10 bg-white text-gray-800 dark:border-gray-900/50 dark:bg-[#343541] dark:text-gray-100'
            }`}
            style={{overflowWrap: 'anywhere'}}
        >
            <div
                className="relative m-auto flex p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
                <div className="min-w-[40px] text-right font-bold">
                    {message.role === 'assistant' ? (
                        <IconRobot size={30}/>
                    ) : (
                        <IconUser size={30}/>
                    )}
                </div>

                <div className="prose mt-[-2px] w-full dark:prose-invert">
                    {message.role === 'user' ? (
                        <div className="flex w-full">
                            {isEditing ? (
                                <div className="flex w-full flex-col">
                  <textarea
                      ref={textareaRef}
                      className="w-full resize-none whitespace-pre-wrap border-none dark:bg-[#343541]"
                      value={messageContent}
                      onChange={handleInputChange}
                      onKeyDown={handlePressEnter}
                      onCompositionStart={() => setIsTyping(true)}
                      onCompositionEnd={() => setIsTyping(false)}
                      style={{
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          lineHeight: 'inherit',
                          padding: '0',
                          margin: '0',
                          overflow: 'hidden',
                      }}
                  />

                                    <div className="mt-10 flex justify-center space-x-4">
                                        <button
                                            className="h-[40px] rounded-md bg-blue-500 px-4 py-1 text-sm font-medium text-white enabled:hover:bg-blue-600 disabled:opacity-50"
                                            onClick={handleEditMessage}
                                            disabled={messageContent.trim().length <= 0}
                                        >
                                            {t('Save & Submit')}
                                        </button>
                                        <button
                                            className="h-[40px] rounded-md border border-neutral-300 px-4 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                            onClick={() => {
                                                setMessageContent(message.content);
                                                setIsEditing(false);
                                            }}
                                        >
                                            {t('Cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    <div className="flex flex-row">
                                        <div className="prose whitespace-pre-wrap dark:prose-invert flex-1">
                                            {message.content}
                                        </div>
                                    </div>
                                    <div className="flex flex-row">
                                        {(isEditing || messageIsStreaming) ? null : (
                                            <ChatFollowups buttonsConfig={userFollowupButtonsConfig}/>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!isEditing && (
                                <div
                                    className="md:-mr-8 ml-1 md:ml-0 flex flex-col md:flex-row gap-4 md:gap-1 items-center md:items-start justify-end md:justify-start">
                                    <button
                                        className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                        onClick={toggleEditing}
                                    >
                                        <IconEdit size={20}/>
                                    </button>
                                    <button
                                        className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                        onClick={handleDeleteMessage}
                                    >
                                        <IconTrash size={20}/>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="flex flex-row">
                                <MemoizedReactMarkdown
                                    className="prose dark:prose-invert flex-1"
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    // @ts-ignore
                                    //rehypePlugins={[rehypeRaw]}
                                    //rehypePlugins={[rehypeMathjax]}
                                    components={{
                                        // @ts-ignore
                                        Mermaid,
                                        a({href, title, children, ...props}) {
                                            return (
                                                (href && href.startsWith("#")) ?
                                                    <button
                                                        className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-green-600"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            handleCustomLinkClick(href || "#");
                                                        }}>
                                                        {children}
                                                    </button> :
                                                    <a href={href} onClick={(e) => {
                                                        e.preventDefault();
                                                        handleCustomLinkClick(href || "/");
                                                    }}>
                                                        {children}
                                                    </a>
                                            );
                                        },
                                        code({node, inline, className, children, ...props}) {
                                            if (children.length) {
                                                if (children[0] == '▍') {
                                                    return <span className="animate-pulse cursor-default mt-1">▍</span>
                                                }

                                                children[0] = (children[0] as string).replace("`▍`", "▍")
                                            }

                                            const match = /language-(\w+)/.exec(className || '');


                                            if (!inline && match && match[1] === 'mermaid') {
                                                console.log("mermaid")
                                                //@ts-ignore
                                                return (<Mermaid chart={String(children)}/>);
                                            }

                                            return !inline ? (
                                                <CodeBlock
                                                    key={Math.random()}
                                                    language={(match && match[1]) || ''}
                                                    value={String(children).replace(/\n$/, '')}
                                                    {...props}
                                                />
                                            ) : (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            );
                                        },
                                        table({children}) {
                                            return (
                                                <table
                                                    className="border-collapse border border-black px-3 py-1 dark:border-white">
                                                    {children}
                                                </table>
                                            );
                                        },
                                        th({children}) {
                                            return (
                                                <th className="break-words border border-black bg-gray-500 px-3 py-1 text-white dark:border-white">
                                                    {children}
                                                </th>
                                            );
                                        },
                                        td({children}) {
                                            return (
                                                <td className="break-words border border-black px-3 py-1 dark:border-white">
                                                    {children}
                                                </td>
                                            );
                                        },
                                    }}
                                >
                                    {`${message.content}${
                                        messageIsStreaming && messageIndex == (selectedConversation?.messages.length ?? 0) - 1 ? '`▍`' : ''
                                    }`}
                                </MemoizedReactMarkdown>

                                <div
                                    className="md:-mr-8 ml-1 md:ml-0 flex flex-col md:flex-row gap-4 md:gap-1 items-center md:items-start justify-end md:justify-start">
                                    {messagedCopied ? (
                                        <IconCheck
                                            size={20}
                                            className="text-green-500 dark:text-green-400"
                                        />
                                    ) : (
                                        <button
                                            className="invisible group-hover:visible focus:visible text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                            onClick={copyOnClick}
                                        >
                                            <IconCopy size={20}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                            {(messageIsStreaming) ? null : (
                                <ChatFollowups buttonsConfig={followUpButtonsConfig}/>
                            )}
                            {(messageIsStreaming && messageIndex == (selectedConversation?.messages.length ?? 0) - 1) ?
                                <LoadingIcon/> : null}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
});
ChatMessage.displayName = 'ChatMessage';
