import { IconArrowRight, IconCircleCheck, IconCircleX, IconBrackets, IconRobot, IconTerminal2, IconUser } from '@tabler/icons-react';
import React from "react";



import { Message } from "@/types/chat";



import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import { CodeBlock } from '@/components/Markdown/CodeBlock';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';



import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';


const getAgentLogItem = (msg: any) => {
  if (msg.role === 'assistant' && msg.content.tool === 'exec_code') {
    return (
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#444654] rounded p-2 my-1 max-w-full">
        <IconTerminal2 className="min-w-[20px] text-blue-600 dark:text-blue-400" />
        <div className="w-full overflow-hidden">
          <span className="font-medium text-blue-700 dark:text-blue-300">
            Execute Code:
          </span>
          <MemoizedReactMarkdown
            className="prose dark:prose-invert mt-1"
            remarkPlugins={[remarkGfm, remarkMath]}
            components={{
              code({ node, inline, className, children, ...props }) {
                if (!inline) {
                  return (
                    <CodeBlock
                      language="python"
                      value={String(children).replace(/\n$/, '')}
                      {...props}
                    />
                  );
                }
                return (
                  <CodeBlock
                    language="python"
                    value={String(children).replace(/\n$/, '')}
                    {...props}
                  />
                );
              },
            }}
          >
            {`\`\`\`python\n${msg.content.args.code}\n\`\`\``}
          </MemoizedReactMarkdown>
        </div>
      </div>
    );
  } else if (msg.role === 'assistant') {
    return (
      <div className="flex flex-col gap-2 bg-gray-50 dark:bg-[#444654] rounded p-2 my-1">
        <div className="flex items-center gap-2">
          <IconRobot className="min-w-[20px] text-blue-600 dark:text-blue-400" />
          <IconArrowRight className="min-w-[16px] text-blue-500 dark:text-blue-300" />
          <div>
            <span className="font-medium text-blue-700 dark:text-blue-300">
              Execute:
            </span>{' '}
            <span className="text-gray-600 dark:text-gray-300">
              {msg.content.tool}
            </span>
          </div>
        </div>
        <div className="ml-9">
          <div className="flex items-center gap-2 mb-1">
            <IconBrackets className="min-w-[16px] text-amber-500 dark:text-amber-400" />
            <span className="font-medium text-amber-600 dark:text-amber-300">
              Arguments:
            </span>
          </div>
          <MemoizedReactMarkdown
            className="prose dark:prose-invert"
            remarkPlugins={[remarkGfm, remarkMath]}
            components={{
              code({ node, inline, className, children, ...props }) {
                return (
                  <CodeBlock
                    language="json"
                    value={String(children).replace(/\n$/, '')}
                    {...props}
                  />
                );
              },
            }}
          >
            {`\`\`\`json\n${JSON.stringify(msg.content.args, null, 2)}\n\`\`\``}
          </MemoizedReactMarkdown>
        </div>
      </div>
    );
  } else if (msg.role === 'user') {
    return (
      <div className="flex items-center gap-2 bg-white dark:bg-[#343541] rounded p-2 my-1">
        <IconUser className="min-w-[20px] text-purple-600 dark:text-purple-400" />
        <div>
          <span className="font-medium text-purple-700 dark:text-purple-300">
            User Prompt:
          </span>{' '}
          <span className="text-gray-600 dark:text-gray-300">
            {msg.content}
          </span>
        </div>
      </div>
    );
  } else if (msg.role === 'environment') {
    const hasError = msg.content?.error;
    return (
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#444654] rounded p-2 my-1">
        <IconTerminal2 className="min-w-[20px] text-blue-600 dark:text-blue-400" />
        <div className="w-full">
          <div className="flex items-center gap-2 mb-1">
            {hasError ? (
              <IconCircleX className="min-w-[16px] text-red-600 dark:text-red-400" />
            ) : (
              <IconCircleCheck className="min-w-[16px] text-green-700 dark:text-green-300" />
            )}
            <span className={`font-medium ${hasError ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-300'}`}>
           Result:
         </span>
          </div>
          <MemoizedReactMarkdown
            className="prose dark:prose-invert mt-1"
            remarkPlugins={[remarkGfm, remarkMath]}
            components={{
              code({ node, inline, className, children, ...props }) {
                return (
                  <CodeBlock
                    language="json"
                    value={String(children).replace(/\n$/, '')}
                    {...props}
                  />
                );
              },
            }}
          >
            {`\`\`\`json\n${JSON.stringify(msg.content, null, 2)}\n\`\`\``}
          </MemoizedReactMarkdown>
        </div>
      </div>
    );
  }
};

interface Props {
  messageIsStreaming: boolean;
  message: Message;
}

const AgentLogBlock: React.FC<Props> = ({ message, messageIsStreaming }) => {
  if (
    !message ||
    !message.data ||
    !message.data.state ||
    !message.data.state.agentLog
  ) {
    return <></>;
  }

  let agentLog =
    message.data?.state && message.data?.state.agentLog
      ? message.data.state.agentLog
      : {};
  // console.log("ds",sources)
  console.log('Reasoning Log', agentLog);

  if (!agentLog.data.result) {
    return <></>;
  }

  agentLog = agentLog.data.result;

  return (
    <div className="mt-3" key={message.id}>
      <ExpansionComponent
        title="Reasoning / Action Log"
        content={agentLog.map((msg: any, idx: number) => (
          <div key={idx}>{getAgentLogItem(msg)}</div>
        ))}
      />
    </div>
  );
};

export default AgentLogBlock;
