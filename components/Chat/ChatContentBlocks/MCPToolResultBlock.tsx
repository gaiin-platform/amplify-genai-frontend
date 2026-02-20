/**
 * MCP Tool Result Block Component
 *
 * Displays results from MCP tool executions in a rich, interactive format.
 * Supports different result types like code execution, images, errors, etc.
 */

import React, { FC, useState, memo } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import {
  IconTool,
  IconCheck,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconClipboard,
  IconPhoto,
  IconCode,
  IconBrandPython,
  IconFileSpreadsheet,
  IconDatabase,
} from '@tabler/icons-react';

export interface MCPToolContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

export interface MCPToolResultData {
  toolName: string;
  serverName?: string;
  content: MCPToolContent[];
  isError?: boolean;
  executionTime?: number;
}

interface MCPToolResultBlockProps {
  result: MCPToolResultData;
  onCopyContent?: (content: string) => void;
}

// Get icon for tool type
const getToolIcon = (toolName: string) => {
  if (toolName.includes('execute_code') || toolName.includes('python')) {
    return <IconBrandPython size={18} />;
  }
  if (toolName.includes('notebook') || toolName.includes('jupyter')) {
    return <IconCode size={18} />;
  }
  if (toolName.includes('database') || toolName.includes('sql')) {
    return <IconDatabase size={18} />;
  }
  if (toolName.includes('csv') || toolName.includes('data')) {
    return <IconFileSpreadsheet size={18} />;
  }
  return <IconTool size={18} />;
};

// Get friendly tool name
const getToolDisplayName = (toolName: string) => {
  // Remove mcp_ prefix and server ID
  const parts = toolName.split('_');
  if (parts[0] === 'mcp' && parts.length > 2) {
    return parts.slice(2).join('_').replace(/_/g, ' ');
  }
  return toolName.replace(/_/g, ' ');
};

const TextContent: FC<{ text: string; isError?: boolean }> = memo(({ text, isError }) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const lines = text.split('\n');
  const isLong = lines.length > 20 || text.length > 2000;

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if this looks like code output
  const looksLikeCode = text.includes('def ') || text.includes('class ') ||
                        text.includes('import ') || text.includes('>>>');

  // Check if this looks like a DataFrame
  const looksLikeDataFrame = text.includes('|') && text.split('\n').length > 2;

  return (
    <div className={`rounded-lg ${isError ? 'bg-red-500/10 border border-red-500/30' : 'bg-neutral-800'}`}>
      {isLong && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-700">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white"
          >
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            {expanded ? 'Collapse output' : `Expand (${lines.length} lines)`}
          </button>
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white"
            title="Copy output"
          >
            {copied ? <IconCheck size={14} /> : <IconClipboard size={14} />}
          </button>
        </div>
      )}
      <div className={`p-3 ${!expanded ? 'max-h-60 overflow-hidden' : ''}`}>
        {looksLikeCode ? (
          <SyntaxHighlighter
            language="python"
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: 0,
              background: 'transparent',
              fontSize: '13px',
            }}
          >
            {text}
          </SyntaxHighlighter>
        ) : looksLikeDataFrame ? (
          <pre className="text-sm font-mono text-neutral-300 whitespace-pre overflow-x-auto">
            {text}
          </pre>
        ) : (
          <pre className={`text-sm font-mono whitespace-pre-wrap ${isError ? 'text-red-400' : 'text-neutral-300'}`}>
            {text}
          </pre>
        )}
      </div>
    </div>
  );
});
TextContent.displayName = 'TextContent';

// Helper to validate and create image src URL
const createImageSrc = (data: string, mimeType?: string): string | null => {
  if (!data) {
    return null;
  }
  // If data is already a data URL, trust it as-is
  if (data.startsWith('data:')) {
    return data;
  }
  // Validate that the data is valid base64
  try {
    atob(data);
  } catch {
    return null;
  }
  return `data:${mimeType || 'image/png'};base64,${data}`;
};

const ImageContent: FC<{ data: string; mimeType?: string }> = memo(({ data, mimeType }) => {
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState(false);

  const src = createImageSrc(data, mimeType);

  if (error || !src) {
    return (
      <div className="p-4 bg-neutral-800 rounded-lg text-center text-neutral-500">
        <IconPhoto size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Failed to load image</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-700">
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-800 border-b border-neutral-700">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <IconPhoto size={14} />
          <span>Image Output</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white"
        >
          {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </button>
      </div>
      {expanded && (
        <div className="p-3 flex justify-center">
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <img
            src={src}
            alt="Tool output"
            className="max-w-full h-auto rounded"
            style={{ maxHeight: '500px' }}
            onError={() => setError(true)}
            role="img"
          />
        </div>
      )}
    </div>
  );
});
ImageContent.displayName = 'ImageContent';

export const MCPToolResultBlock: FC<MCPToolResultBlockProps> = memo(({ result, onCopyContent }) => {
  const [collapsed, setCollapsed] = useState(false);
  const displayName = getToolDisplayName(result.toolName);
  const icon = getToolIcon(result.toolName);

  return (
    <div className={`my-4 rounded-xl overflow-hidden border ${
      result.isError
        ? 'border-red-500/30 bg-red-900/10'
        : 'border-green-500/30 bg-neutral-900'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        result.isError
          ? 'bg-red-900/20 border-red-500/30'
          : 'bg-gradient-to-r from-green-900/30 to-teal-900/20 border-green-500/20'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${result.isError ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
            {result.isError ? <IconX size={18} /> : icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white capitalize">{displayName}</h3>
              {result.isError ? (
                <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">Error</span>
              ) : (
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded flex items-center gap-1">
                  <IconCheck size={12} /> Success
                </span>
              )}
            </div>
            {result.serverName && (
              <p className="text-xs text-neutral-500">
                via {result.serverName}
                {result.executionTime && ` | ${result.executionTime}ms`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`p-2 rounded-lg hover:bg-neutral-700/50 ${
            result.isError ? 'text-red-400' : 'text-green-400'
          } transition-colors`}
        >
          {collapsed ? <IconChevronRight size={20} /> : <IconChevronDown size={20} />}
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="p-4 space-y-3">
          {result.content.map((item, idx) => {
            if (item.type === 'text' && item.text) {
              return (
                <TextContent
                  key={idx}
                  text={item.text}
                  isError={result.isError}
                />
              );
            }
            if (item.type === 'image' && item.data) {
              return (
                <ImageContent
                  key={idx}
                  data={item.data}
                  mimeType={item.mimeType}
                />
              );
            }
            if (item.type === 'resource' && item.uri) {
              return (
                <div key={idx} className="p-3 bg-neutral-800 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-neutral-400">
                    <IconDatabase size={16} />
                    <span>Resource: {item.uri}</span>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
});

MCPToolResultBlock.displayName = 'MCPToolResultBlock';

export default MCPToolResultBlock;
