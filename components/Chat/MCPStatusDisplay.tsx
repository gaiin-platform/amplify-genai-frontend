/**
 * MCPStatusDisplay Component
 *
 * Real-time status display for MCP tool execution during chat responses.
 * Shows progress bars, execution time, and status updates.
 */

import React, { useEffect, useState } from 'react';
import {
  IconRefresh,
  IconCheck,
  IconX,
  IconClock,
  IconAlertTriangle,
  IconTool
} from '@tabler/icons-react';
import {
  MCPExecutionStatus,
  MCPStatusDisplayProps
} from '@/types/mcp';

export const MCPStatusDisplay: React.FC<MCPStatusDisplayProps> = ({
  status,
  compact = false,
  showProgressBars = true,
}) => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (status.length === 0) {
    return null;
  }

  const getStatusIcon = (execution: MCPExecutionStatus) => {
    switch (execution.status) {
      case 'pending':
        return <div className="w-3 h-3 bg-gray-400 rounded-full animate-pulse" />;
      case 'running':
        return <IconRefresh className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <IconCheck className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <IconX className="w-4 h-4 text-red-500" />;
      default:
        return <IconTool className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (execution: MCPExecutionStatus) => {
    switch (execution.status) {
      case 'pending':
        return 'text-gray-600 dark:text-gray-400';
      case 'running':
        return 'text-blue-600 dark:text-blue-400';
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getProgressBarColor = (execution: MCPExecutionStatus) => {
    switch (execution.status) {
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getElapsedTime = (execution: MCPExecutionStatus): string => {
    if (!execution.start_time) return '';

    const startTime = new Date(execution.start_time).getTime();
    const endTime = execution.end_time ? new Date(execution.end_time).getTime() : currentTime;
    const elapsed = endTime - startTime;

    if (elapsed < 1000) return `${elapsed}ms`;
    return `${(elapsed / 1000).toFixed(1)}s`;
  };

  const getProgress = (execution: MCPExecutionStatus): number => {
    if (execution.progress !== undefined) {
      return execution.progress;
    }

    switch (execution.status) {
      case 'pending':
        return 0;
      case 'running':
        return 50; // Indeterminate progress
      case 'completed':
        return 100;
      case 'failed':
        return 100;
      default:
        return 0;
    }
  };

  if (compact) {
    return (
      <div className="inline-flex items-center space-x-2 bg-gray-50 dark:bg-gray-800 rounded-full px-3 py-1 text-xs">
        <IconTool className="w-3 h-3 text-gray-500" />
        <span className="text-gray-600 dark:text-gray-400">
          {status.filter(s => s.status === 'completed').length}/{status.length} tools
        </span>
        {status.some(s => s.status === 'running') && (
          <IconRefresh className="w-3 h-3 text-blue-500 animate-spin" />
        )}
      </div>
    );
  }

  const runningTasks = status.filter(s => s.status === 'running');
  const completedTasks = status.filter(s => s.status === 'completed');
  const failedTasks = status.filter(s => s.status === 'failed');
  const pendingTasks = status.filter(s => s.status === 'pending');

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <IconTool className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900 dark:text-white text-sm">
            MCP Tool Execution
          </span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          {completedTasks.length > 0 && (
            <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
              <IconCheck className="w-3 h-3" />
              <span>{completedTasks.length}</span>
            </div>
          )}
          {runningTasks.length > 0 && (
            <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
              <IconRefresh className="w-3 h-3 animate-spin" />
              <span>{runningTasks.length}</span>
            </div>
          )}
          {failedTasks.length > 0 && (
            <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
              <IconX className="w-3 h-3" />
              <span>{failedTasks.length}</span>
            </div>
          )}
          {pendingTasks.length > 0 && (
            <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
              <div className="w-3 h-3 bg-gray-400 rounded-full animate-pulse" />
              <span>{pendingTasks.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status List */}
      <div className="space-y-2">
        {status.map((execution, index) => (
          <div key={`${execution.server}-${execution.tool_name}-${index}`} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-1">
                {getStatusIcon(execution)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium truncate ${getStatusColor(execution)}`}>
                      {execution.tool_name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {execution.server}
                    </span>
                  </div>
                  {execution.message && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {execution.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                {execution.start_time && (
                  <div className="flex items-center space-x-1">
                    <IconClock className="w-3 h-3" />
                    <span>{getElapsedTime(execution)}</span>
                  </div>
                )}
                {execution.status === 'failed' && (
                  <IconAlertTriangle className="w-3 h-3 text-red-500" />
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {showProgressBars && (execution.status === 'running' || execution.progress !== undefined) && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${getProgressBarColor(execution)} ${
                    execution.status === 'running' && execution.progress === undefined
                      ? 'animate-pulse'
                      : ''
                  }`}
                  style={{
                    width: `${getProgress(execution)}%`,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Overall Progress */}
      {showProgressBars && status.length > 1 && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Overall Progress</span>
            <span>{completedTasks.length + failedTasks.length}/{status.length}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
              style={{
                width: `${((completedTasks.length + failedTasks.length) / status.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Completion Message */}
      {status.length > 0 && status.every(s => s.status === 'completed' || s.status === 'failed') && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-xs">
            {failedTasks.length === 0 ? (
              <>
                <IconCheck className="w-3 h-3 text-green-500" />
                <span className="text-green-600 dark:text-green-400">
                  All tools executed successfully
                </span>
              </>
            ) : (
              <>
                <IconAlertTriangle className="w-3 h-3 text-yellow-500" />
                <span className="text-yellow-600 dark:text-yellow-400">
                  {completedTasks.length} completed, {failedTasks.length} failed
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};