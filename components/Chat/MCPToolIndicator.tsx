/**
 * MCPToolIndicator Component
 *
 * Shows MCP tools being used in chat responses with execution status
 * and detailed information about tool calls.
 */

import React, { useState } from 'react';
import {
  IconTool,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconCheck,
  IconX,
  IconRefresh,
  IconServer
} from '@tabler/icons-react';
import {
  MCPTool,
  MCPExecutionStatus,
  MCPToolIndicatorProps,
  MCP_TOOL_CATEGORIES
} from '@/types/mcp';

export const MCPToolIndicator: React.FC<MCPToolIndicatorProps> = ({
  tools,
  executionStatus = [],
  showDetails = false,
  onToolClick,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (tools.length === 0) {
    return null;
  }

  const getStatusIcon = (status: MCPExecutionStatus) => {
    switch (status.status) {
      case 'pending':
        return <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />;
      case 'running':
        return <IconRefresh className="w-3 h-3 text-blue-500 animate-spin" />;
      case 'completed':
        return <IconCheck className="w-3 h-3 text-green-500" />;
      case 'failed':
        return <IconX className="w-3 h-3 text-red-500" />;
      default:
        return <div className="w-2 h-2 bg-gray-300 rounded-full" />;
    }
  };

  const getToolIcon = (tool: MCPTool) => {
    switch (tool.category) {
      case 'file_operations':
        return '📁';
      case 'data_analysis':
        return '📊';
      case 'web_search':
        return '🔍';
      case 'code_analysis':
        return '💻';
      case 'database_query':
        return '🗄️';
      case 'memory_management':
        return '🧠';
      case 'communication':
        return '💬';
      default:
        return '🔧';
    }
  };

  const formatExecutionTime = (startTime?: string, endTime?: string): string => {
    if (!startTime || !endTime) return '';
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const duration = end - start;

    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const getStatusForTool = (toolName: string, server: string): MCPExecutionStatus | undefined => {
    return executionStatus.find(s => s.tool_name === toolName && s.server === server);
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 my-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <IconTool className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            MCP Tools Used ({tools.length})
          </span>
        </div>
        {showDetails && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded"
          >
            {expanded ? (
              <IconChevronDown className="w-4 h-4" />
            ) : (
              <IconChevronRight className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Tool Pills */}
      <div className="flex flex-wrap gap-2 mt-2">
        {tools.map((tool, index) => {
          const status = getStatusForTool(tool.name, tool.server);
          return (
            <div
              key={`${tool.server}-${tool.name}-${index}`}
              onClick={() => onToolClick?.(tool)}
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                onToolClick
                  ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/50'
                  : ''
              } ${
                status?.status === 'completed'
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                  : status?.status === 'failed'
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                  : status?.status === 'running'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              <span className="mr-1">{getToolIcon(tool)}</span>
              <span>{tool.name}</span>
              {status && (
                <span className="ml-1">
                  {getStatusIcon(status)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed Information */}
      {expanded && showDetails && (
        <div className="mt-3 space-y-2">
          {tools.map((tool, index) => {
            const status = getStatusForTool(tool.name, tool.server);
            return (
              <div
                key={`${tool.server}-${tool.name}-detail-${index}`}
                className="bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-base">{getToolIcon(tool)}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {tool.name}
                      </span>
                      <div className="flex items-center space-x-1">
                        <IconServer className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {tool.server}
                        </span>
                      </div>
                      {tool.category && (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 rounded">
                          {MCP_TOOL_CATEGORIES[tool.category as keyof typeof MCP_TOOL_CATEGORIES] || tool.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {tool.description}
                    </p>
                    {status && (
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          <span>Status:</span>
                          {getStatusIcon(status)}
                          <span className="capitalize">{status.status}</span>
                        </div>
                        {status.start_time && status.end_time && (
                          <div className="flex items-center space-x-1">
                            <IconClock className="w-3 h-3" />
                            <span>{formatExecutionTime(status.start_time, status.end_time)}</span>
                          </div>
                        )}
                        {status.progress !== undefined && status.status === 'running' && (
                          <div className="flex items-center space-x-1">
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                              <div
                                className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                                style={{ width: `${status.progress}%` }}
                              />
                            </div>
                            <span>{status.progress}%</span>
                          </div>
                        )}
                      </div>
                    )}
                    {status?.message && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400">
                        {status.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {executionStatus.length > 0 && (
        <div className="mt-2 flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
          <div className="flex items-center space-x-3">
            <span>
              ✅ {executionStatus.filter(s => s.status === 'completed').length} completed
            </span>
            <span>
              ⏳ {executionStatus.filter(s => s.status === 'running').length} running
            </span>
            {executionStatus.filter(s => s.status === 'failed').length > 0 && (
              <span>
                ❌ {executionStatus.filter(s => s.status === 'failed').length} failed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};