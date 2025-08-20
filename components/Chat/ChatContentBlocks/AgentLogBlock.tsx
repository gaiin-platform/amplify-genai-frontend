import { IconArrowRight, IconCircleCheck, IconCircleX, IconBrackets, IconRobot, IconTerminal2, IconUser, IconCurrencyDollar, IconBrain, IconBulb } from '@tabler/icons-react';
import React, { useEffect, useState } from "react";



import { Message } from "@/types/chat";



import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import { CodeBlock } from '@/components/Markdown/CodeBlock';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';



import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { AgentFileList, AgentFile } from '@/components/Chat/ChatContentBlocks/AgentFilesBlock';
import { getAgentLog } from '@/utils/app/agent';
// Response type from the server
interface AgentLogData {
  session: string;
  handled: boolean;
  result: any[];  // Could be more specific based on your needs
  files?: FileMap;
  changed_files?: string[];
}

interface AgentLog {
  data: AgentLogData;
  // Add other fields if needed
}

// File information types
interface FileVersion {
  version_file_id: string;
  timestamp: string;
  size: number;
  hash: string;
}

interface FileData {
  original_name: string;
  size: number;
  last_modified: string;
  versions?: FileVersion[];
}

interface FileMap {
  [fileId: string]: FileData;
}


type SupportedMimeType =
  | 'text/csv'
  | 'application/pdf'
  | 'image/png'
  | 'binary/octet-stream';

/**
 * Maps file extensions to their corresponding MIME types
 */
const mimeTypes: Record<string, SupportedMimeType> = {
  // Images
  'png': 'image/png',

  // Documents
  'csv': 'text/csv',
  'pdf': 'application/pdf',

  // Binary/Data files
  'bin': 'binary/octet-stream',
  'dat': 'binary/octet-stream',
  'exe': 'binary/octet-stream',
  'dll': 'binary/octet-stream'
};

/**
 * Guesses the MIME type of a file based on its extension.
 * @param fileName - The name of the file including extension
 * @returns The guessed MIME type or 'binary/octet-stream' if unknown
 */
export function guessMimeType(fileName: string): SupportedMimeType {
  // Extract the extension from the filename
  const extension = fileName.toLowerCase().split('.').pop() || '';

  // Return the MIME type if found, otherwise return binary/octet-stream
  return mimeTypes[extension] || 'binary/octet-stream';
}

function formatCost(cost: number) {
  return cost < 0.01 ? `$${cost.toPrecision(4)}` : `$${cost.toFixed(2)}`;
}


const getAgentLogItem = (msg: any) => {
  if (msg.role === 'assistant' && msg.content && msg.content.tool === 'exec_code') {
    return (
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#444654] rounded p-2 my-1 max-w-full">
        <IconTerminal2 className="min-w-[20px] text-blue-600 dark:text-blue-400" />
        <div className="w-full overflow-x-auto">
          <span className="font-medium text-blue-700 dark:text-blue-300">
            Execute Code:
          </span>
          <MemoizedReactMarkdown
            className="prose dark:prose-invert mt-1 break-words w-full max-w-full"
            remarkPlugins={[remarkGfm, remarkMath]}
            components={{
              code({ node, inline, className, children, ...props }) {
                if (!inline) {
                  return (
                    <div className="overflow-x-auto">
                      <CodeBlock
                        language="python"
                        value={String(children).replace(/\n$/, '')}
                        {...props}
                      />
                    </div>
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
            {`\`\`\`python\n${(msg && msg.content && msg.content.args && msg.content.args.code) ? msg.content.args.code : ""}\n\`\`\``}
          </MemoizedReactMarkdown>
        </div>
      </div>
    );
  }
  else if (msg.role === 'environment' && msg.content && msg.content.tool === 'think') {
    return (
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#444654] rounded p-2 my-1 max-w-full">
        <IconBulb size={26} className="min-w-[28px] text-amber-400 dark:text-amber-300" />
        <div className="w-full overflow-hidden">
          <span className="font-medium text-blue-700 dark:text-blue-300">
            Thinking:
          </span>
          <MemoizedReactMarkdown
            className="prose dark:prose-invert mt-1 w-full max-w-full"
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
            {msg.content.result}
          </MemoizedReactMarkdown>
        </div>
      </div>
    );
  }

  else if (msg.role === 'assistant') {
    return (
      <div className="flex flex-col gap-2 bg-gray-50 dark:bg-[#444654] rounded p-2 my-1">
        <div className="flex items-center gap-2">
          <IconRobot className="min-w-[20px] text-blue-600 dark:text-blue-400" />
          <IconArrowRight className="min-w-[16px] text-blue-500 dark:text-blue-300" />
          <div className="flex flex-row gap-2">
            {msg.content?.skipped ?
            <span className="font-medium text-lg text-red-700 dark:text-red-500">
              {"Skipped: "}
            </span> :
            <div className="flex flex-row items-center gap-1 text-blue-700 dark:text-blue-300">
              {msg.content?.advanced_reasoning && 
              <span title="Advanced Reasoning Model Used"><IconBrain size={18}/></span> }
              <span className="font-medium text-blue-700 dark:text-blue-300">{"Execute: "} </span>
            </div>}
            <span className="text-gray-600 dark:text-gray-300">
              {msg.content && msg.content.tool ? msg.content.tool : ""}
            </span>
          </div>
        </div>
        <div className="ml-9">
          <div className="flex items-center gap-2 mb-1">
            {!msg.content?.skipped && <IconBrackets className="min-w-[16px] text-amber-500 dark:text-amber-400" />}
            <span className="font-medium text-amber-600 dark:text-amber-300">
              {msg.content?.skipped ? "Reasoning: " : "Arguments: "}
            </span>
          </div>
          <MemoizedReactMarkdown
            className="prose dark:prose-invert w-full max-w-full"
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
            {msg.content && msg.content.args ? `\`\`\`json\n${JSON.stringify(msg.content.args, null, 2)}\n\`\`\`` : msg.content?.skipped ?? ""}
          </MemoizedReactMarkdown>
        </div> 
      </div>
    );
  } else if (msg.role === 'user') {
    
    return (
      <div className="flex items-center gap-2 bg-white dark:bg-[#343541] rounded p-2 my-1 mr-2">
        <IconUser className="min-w-[20px] text-purple-600 dark:text-purple-400" />
        <div>
          <span className="font-medium text-purple-700 dark:text-purple-300">
            User Prompt:
          </span>{' '}
          <MemoizedReactMarkdown
            className="prose dark:prose-invert w-full max-w-full"
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
            {msg.content}
          </MemoizedReactMarkdown>
        </div>
      </div>
    );
  } else if (msg.role === 'environment') {
    if (msg.content?.total_token_cost) {
      return (
      <div className="mt-4 flex items-center gap-2 bg-white dark:bg-[#343541] rounded p-2 my-1 mr-2">
        <IconCurrencyDollar className="min-w-[20px] text-green-500" />
        <div>
          <span className="font-medium text-lg">
            {`Total Token Cost: ${formatCost(msg.content.total_token_cost)}`}            
          </span>
        </div>
      </div>
      );
    }
    const hasError = msg.content?.error;
    return (
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#444654] rounded p-2 my-1">
        <IconTerminal2 className="min-w-[20px] text-blue-600 dark:text-blue-400" />
        <div className="w-full overflow-x-auto">
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
          <div className="overflow-x-auto">
            <MemoizedReactMarkdown
              className="prose dark:prose-invert mt-1 break-words w-full max-w-full"
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
      </div>
    );
  }
};


interface Props {
  messageIsStreaming: boolean;
  message: Message;
  conversationId: string;
  width?: () => number;
}

const AgentLogBlock: React.FC<Props> = ({conversationId, message, messageIsStreaming, width }) => {

  const getChatContainerWidth = () => {
    if (width) return width();
    const container = document.querySelector(".chatcontainer");
    if (container) {
      return `${container.getBoundingClientRect().width * 0.68}px`;
    }
    return '80%';
  };

  const [chatContainerWidth, setChatContainerWidth] = useState(getChatContainerWidth());

  useEffect(() => {
    const updateInnerWindow = () => setChatContainerWidth(getChatContainerWidth())
    // Listen to window resize to update the size
    window.addEventListener('resize', updateInnerWindow);
    return () => {
      window.removeEventListener('resize', updateInnerWindow);
    };
  }, []);

  if (
    !message ||
    !message.data ||
    !message.data.state ||
    !message.data.state.agentLog
  ) {
    return <></>;
  }

  let agentLog = getAgentLog(message) ?? {};

  // console.log('Reasoning Log', agentLog);

  if (!agentLog || !agentLog.data || !agentLog.data.result) {
    return <></>;
  }

  let files: AgentFile[] = [];
  if (agentLog.data.files) {
    const fileData: FileMap = agentLog.data.files;
    const changedFiles: string[] = agentLog.data.changed_files || [];

    files = Object.entries(fileData)
      .filter(([_, file]) => changedFiles.includes(file.original_name))
      .map(([fileId, file]) => {
        const fileInfo: AgentFile = {
          type: guessMimeType(file.original_name),
          values: {
            fileId: fileId,
            fileName: file.original_name,
            sessionId: conversationId,
            size: file.size,
            lastModified: file.last_modified,
            ...(file.versions && {
              versions: file.versions.map((version: FileVersion) => ({
                timestamp: version.timestamp,
                size: version.size,
                hash: version.hash,
                version_file_id: version.version_file_id
              }))
            })
          }
        };
        return fileInfo;
      });
  }
  agentLog = agentLog.data.result;

  return (
    <div className="mt-3 pointer-events-none" key={message.id} style={{width: (chatContainerWidth)}}>
      <div className="pointer-events-auto">
        <AgentFileList files={files} />
      </div>
      <div className="pointer-events-auto max-w-full overflow-hidden">
        <ExpansionComponent
          title="Reasoning / Actions"
          content={agentLog.map((msg: any, idx: number) => (
            <div key={idx} className="max-w-full overflow-hidden">{getAgentLogItem(msg)}</div>
          ))}
        />
      </div>
    </div>
  );
};

export default AgentLogBlock;
