import { FC, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import {WorkflowDefinition} from "@/types/workflow";
import ReactMarkdown from 'react-markdown';
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {CodeBlock} from "@/components/Markdown/CodeBlock";
import {MemoizedReactMarkdown} from "@/components/Markdown/MemoizedReactMarkdown";

interface Props {
    workflowDefinition: WorkflowDefinition;
    onClose: () => void;
    onUpdateWorkflowDefinition: (workflowDefinition: WorkflowDefinition) => void;
}

const Tag: FC<{tag: string}> = ({ tag }) => (
    <span
        className="inline-flex items-center bg-blue-200 rounded-full py-1 px-2 mt-2 mr-2 text-sm font-medium text-blue-800"
    >
        {tag}
    </span>
);

export const WorkflowDefinitionModal: FC<Props> = ({ workflowDefinition, onClose, onUpdateWorkflowDefinition }) => {
    const { t } = useTranslation('workflowDefinitionbar');
    const [name, setName] = useState(workflowDefinition.name);
    const [description, setDescription] = useState(workflowDefinition.description);
    const [code, setCode] = useState(workflowDefinition.code);
    const [tags, setTags] = useState(workflowDefinition.tags);
    const [inputs, setInputs] = useState(JSON.stringify(workflowDefinition.inputs, null, 2));
    const [outputs, setOutputs] = useState(JSON.stringify(workflowDefinition.outputs, null, 2));


    const modalRef = useRef<HTMLDivElement>(null);

    const handleEnter = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {

        }
    };

    const handleSave = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        const updatedWorkflowDefinition = {
            ...workflowDefinition,
            name,
            description,
            code: code.trim(),
            tags: tags.map(t => t.trim()),
            inputs: JSON.parse(inputs),
            outputs: JSON.parse(outputs),
        };
        onUpdateWorkflowDefinition(updatedWorkflowDefinition);
        onClose();
    }


    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onKeyDown={handleEnter}
        >
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div
                        className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true"
                    />

                    <div
                        ref={modalRef}
                        className="dark:border-netural-400 inline-block max-h-[400px] transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
                        role="dialog"
                    >
                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                            Name
                        </div>
                        <input
                            className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                            value={name} onChange={e => setName(e.target.value)} />


                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                            Description
                        </div>
                        <textarea
                            className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                            value={description} onChange={e => setDescription(e.target.value)} />

                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                            Tags
                        </div>
                        <input
                            className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                            value={tags.join(', ')} onChange={e => setTags(e.target.value.split(',').map(tag => tag.trim()))} />


                        <MemoizedReactMarkdown
                                className="mt-6 prose dark:prose-invert flex-1"
                                remarkPlugins={[remarkGfm, remarkMath]}
                                //rehypePlugins={[rehypeMathjax]}
                                components={{
                                    a({href, title, ...props}) {
                                        return <a href={href}>Button</a>
                                    },
                                    code({ node, inline, className, children, ...props }) {
                                        if (children.length) {
                                            if (children[0] == '▍') {
                                                return <span className="animate-pulse cursor-default mt-1">▍</span>
                                            }

                                            children[0] = (children[0] as string).replace("`▍`", "▍")
                                        }

                                        const match = /language-(\w+)/.exec(className || '');

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
                                    table({ children }) {
                                        return (
                                            <table className="border-collapse border border-black px-3 py-1 dark:border-white">
                                                {children}
                                            </table>
                                        );
                                    },
                                    th({ children }) {
                                        return (
                                            <th className="break-words border border-black bg-gray-500 px-3 py-1 text-white dark:border-white">
                                                {children}
                                            </th>
                                        );
                                    },
                                    td({ children }) {
                                        return (
                                            <td className="break-words border border-black px-3 py-1 dark:border-white">
                                                {children}
                                            </td>
                                        );
                                    },
                                }}
                            >
                                {`${"```javascript\n"+code+"```"}`}
                        </MemoizedReactMarkdown>

                    <div className="flex mt-6">
                        <button
                            type="button"
                            className="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                            onClick={() => {
                                // const updatedWorkflowDefinition = {
                                //     ...workflowDefinition,
                                //     name,
                                //     description,
                                //     code: code.trim(),
                                // };

                                // onShareWorkflowDefinition(updatedWorkflowDefinition);
                                onClose();
                            }}
                        >
                            {t('Cancel')}
                        </button>
                        <button
                            type="button"
                            className="w-full px-4 ml-2 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                            onClick={handleSave}
                        >
                            {t('Save')}
                        </button>
                    </div>

                    </div>
                </div>
            </div>
        </div>
    );
};