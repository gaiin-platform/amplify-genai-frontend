import { IconArrowRight, IconCircleCheck, IconCircleX, IconBrackets, IconRobot, IconTerminal2, IconUser, IconCurrencyDollar, IconBrain, IconBulb, IconCode } from '@tabler/icons-react';
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


const SKIP_KEYS = new Set(['stdout', 'tool', 'tool_executed', 'id', 'timestamp']);

const renderValue = (value: any): React.ReactNode => {
  if (value === null || value === undefined) return null;
  // Array of objects — render each as a mini card
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400 italic text-sm">empty</span>;
    return (
      <div className="flex flex-col gap-1 mt-1 w-full">
        {value.map((item: any, i: number) => (
          <div key={i} className="border border-gray-200 dark:border-gray-600 rounded p-2">
            {typeof item === 'object' && item !== null
              ? Object.entries(item).filter(([k]) => !SKIP_KEYS.has(k) && item[k] !== null && item[k] !== undefined).map(([k, v]) => (
                  <div key={k} className="flex flex-row gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400 min-w-fit shrink-0">{k}:</span>
                    <span className="text-gray-800 dark:text-gray-200 break-words">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))
              : <span className="text-gray-800 dark:text-gray-200 text-sm">{String(item)}</span>
            }
          </div>
        ))}
      </div>
    );
  }
  // Plain object
  if (typeof value === 'object') return <span className="text-gray-700 dark:text-gray-300 text-sm">{JSON.stringify(value)}</span>;
  return <span className="text-gray-800 dark:text-gray-200 text-sm break-words">{String(value)}</span>;
};

const EnvironmentResultBlock: React.FC<{ msg: any; hasError: boolean }> = ({ msg, hasError }) => {
  const [showRaw, setShowRaw] = useState(false);

  const tool = msg.content?.tool ?? '';
  const result = msg.content?.result ?? msg.content;
  const errorMsg = msg.content?.error;

  const renderFriendly = () => {
    if (errorMsg) {
      return <p className="text-red-500 dark:text-red-400 text-sm">{String(errorMsg)}</p>;
    }
    if (!result || typeof result !== 'object') {
      return <p className="text-sm text-gray-700 dark:text-gray-300">{String(result ?? '')}</p>;
    }
    // Array at top level
    if (Array.isArray(result)) {
      const rendered = renderValue(result);
      return rendered ?? <p className="text-sm text-gray-500 dark:text-gray-400 italic">No result data</p>;
    }
    const entries = Object.entries(result).filter(([k, v]) => !SKIP_KEYS.has(k) && v !== null && v !== undefined);
    if (entries.length === 0) {
      return <p className="text-sm text-gray-500 dark:text-gray-400 italic">No result data</p>;
    }
    return (
      <div className="flex flex-col gap-1 mt-1 w-full">
        {entries.map(([key, value]) => (
          <div key={key} className="flex flex-row gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400 min-w-fit shrink-0">{key}:</span>
            <div className="flex-1 min-w-0">
              {/* Render strings that look like prose via markdown, others inline */}
              {typeof value === 'string' && value.length > 60
                ? <MemoizedReactMarkdown
                    className="prose dark:prose-invert text-sm max-w-full"
                    remarkPlugins={[remarkGfm, remarkMath]}
                  >{value}</MemoizedReactMarkdown>
                : renderValue(value)
              }
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex items-start gap-2 bg-gray-50 dark:bg-[#444654] rounded p-2 my-1">
      <IconTerminal2 className="min-w-[20px] mt-0.5 text-blue-600 dark:text-blue-400" />
      <div className="w-full overflow-x-auto">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            {hasError ? (
              <IconCircleX className="min-w-[16px] text-red-600 dark:text-red-400" />
            ) : (
              <IconCircleCheck className="min-w-[16px] text-green-700 dark:text-green-300" />
            )}
            <span className={`font-medium ${hasError ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-300'}`}>
              Result{tool ? `: ${tool}` : ''}
            </span>
          </div>
          <button
            onClick={() => setShowRaw(r => !r)}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <IconCode size={12} />
            {showRaw ? 'Friendly' : 'Raw'}
          </button>
        </div>
        {showRaw ? (
          <MemoizedReactMarkdown
            className="prose dark:prose-invert mt-1 break-words w-full max-w-full"
            remarkPlugins={[remarkGfm, remarkMath]}
            components={{
              code({ node, inline, className, children, ...props }) {
                return <CodeBlock language="json" value={String(children).replace(/\n$/, '')} {...props} />;
              },
            }}
          >
            {`\`\`\`json\n${JSON.stringify(msg.content, null, 2)}\n\`\`\``}
          </MemoizedReactMarkdown>
        ) : (
          renderFriendly()
        )}
      </div>
    </div>
  );
};

const AssistantActionBlock: React.FC<{ msg: any }> = ({ msg }) => {
  const [showRaw, setShowRaw] = useState(false);
  const args = msg.content?.args;
  const isSkipped = msg.content?.skipped;

  const renderFriendlyArgs = () => {
    if (!args || typeof args !== 'object' || Object.keys(args).length === 0) return null;
    return (
      <div className="flex flex-col gap-1">
        {Object.entries(args).map(([key, value]) => (
          <div key={key} className="flex flex-row gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400 min-w-fit shrink-0">{key}:</span>
            <div className="flex-1 min-w-0">
              {typeof value === 'string' && value.length > 60
                ? <MemoizedReactMarkdown
                    className="prose dark:prose-invert text-sm max-w-full"
                    remarkPlugins={[remarkGfm, remarkMath]}
                  >{value}</MemoizedReactMarkdown>
                : <span className="text-gray-800 dark:text-gray-200 break-words">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
              }
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2 bg-gray-50 dark:bg-[#444654] rounded p-2 my-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconRobot className="min-w-[20px] text-blue-600 dark:text-blue-400" />
          <IconArrowRight className="min-w-[16px] text-blue-500 dark:text-blue-300" />
          {isSkipped
            ? <span className="font-medium text-lg text-red-700 dark:text-red-500">Skipped: </span>
            : <div className="flex flex-row items-center gap-1">
                {msg.content?.advanced_reasoning && <span title="Advanced Reasoning Model Used"><IconBrain size={18}/></span>}
                <span className="font-medium text-blue-700 dark:text-blue-300">Execute: </span>
              </div>
          }
          <span className="text-gray-600 dark:text-gray-300">{msg.content?.tool ?? ''}</span>
        </div>
        {!isSkipped && args && Object.keys(args).length > 0 && (
          <button
            onClick={() => setShowRaw(r => !r)}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <IconCode size={12} />
            {showRaw ? 'Friendly' : 'Raw'}
          </button>
        )}
      </div>
      <div className="ml-9">
        {isSkipped ? (
          <MemoizedReactMarkdown
            className="prose dark:prose-invert w-full max-w-full"
            remarkPlugins={[remarkGfm, remarkMath]}
          >{msg.content?.skipped ?? ''}</MemoizedReactMarkdown>
        ) : (
          <>
            {args && Object.keys(args).length > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <IconBrackets className="min-w-[16px] text-amber-500 dark:text-amber-400" />
                <span className="font-medium text-amber-600 dark:text-amber-300">Arguments:</span>
              </div>
            )}
            {showRaw
              ? <MemoizedReactMarkdown
                  className="prose dark:prose-invert w-full max-w-full"
                  remarkPlugins={[remarkGfm, remarkMath]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      return <CodeBlock language="json" value={String(children).replace(/\n$/, '')} {...props} />;
                    },
                  }}
                >
                  {`\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\``}
                </MemoizedReactMarkdown>
              : renderFriendlyArgs()
            }
          </>
        )}
      </div>
    </div>
  );
};

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
    return <AssistantActionBlock msg={msg} />;
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
    return <EnvironmentResultBlock msg={msg} hasError={hasError} />;
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
