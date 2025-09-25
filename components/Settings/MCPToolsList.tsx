/**
 * MCPToolsList Component
 *
 * Displays available MCP tools with filtering, grouping, and usage statistics.
 */

import React, { useState, useEffect } from 'react';
import {
  IconSearch,
  IconFilter,
  IconChevronDown,
  IconChevronRight,
  IconTool,
  IconClock,
  IconCheck,
  IconX,
  IconRefresh
} from '@tabler/icons-react';
import {
  MCPTool,
  MCPToolsListProps,
  MCP_TOOL_CATEGORIES
} from '@/types/mcp';
import { mcpService } from '@/services/mcpService';
import toast from 'react-hot-toast';

export const MCPToolsList: React.FC<MCPToolsListProps> = ({
  tools: initialTools = [],
  groupByServer = true,
  showUsageStats = false,
  onToolSelect,
  searchQuery: externalSearchQuery = '',
  selectedCategories: externalSelectedCategories = [],
}) => {
  const [tools, setTools] = useState<MCPTool[]>(initialTools);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(externalSelectedCategories);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (initialTools.length === 0) {
      loadTools();
    } else {
      setTools(initialTools);
      setLoading(false);
    }
  }, [initialTools]);

  const loadTools = async () => {
    try {
      setLoading(true);
      const discoveredTools = await mcpService.discoverTools();
      setTools(discoveredTools);
    } catch (error) {
      console.error('Failed to load tools:', error);
      toast.error('Failed to load MCP tools');
    } finally {
      setLoading(false);
    }
  };

  const filteredTools = tools.filter(tool => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.server.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    // Category filter
    if (selectedCategories.length > 0) {
      if (!tool.category || !selectedCategories.includes(tool.category)) {
        return false;
      }
    }

    return true;
  });

  const groupedTools = groupByServer
    ? filteredTools.reduce((groups, tool) => {
        const server = tool.server;
        if (!groups[server]) {
          groups[server] = [];
        }
        groups[server].push(tool);
        return groups;
      }, {} as Record<string, MCPTool[]>)
    : { 'All Tools': filteredTools };

  const toggleServerExpansion = (serverName: string) => {
    setExpandedServers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serverName)) {
        newSet.delete(serverName);
      } else {
        newSet.add(serverName);
      }
      return newSet;
    });
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const formatExecutionTime = (time?: number): string => {
    if (!time) return 'N/A';
    if (time < 1000) return `${Math.round(time)}ms`;
    return `${(time / 1000).toFixed(2)}s`;
  };

  const formatSuccessRate = (rate?: number): string => {
    if (rate === undefined) return 'N/A';
    return `${(rate * 100).toFixed(1)}%`;
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

  const availableCategories = [...new Set(tools.map(tool => tool.category).filter(Boolean))];

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center">
          <IconRefresh className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Loading MCP tools...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Available MCP Tools
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <IconFilter className="w-4 h-4 mr-1" />
              Filters
            </button>
            <button
              onClick={loadTools}
              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <IconRefresh className="w-4 h-4 mr-1" />
              Refresh
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools by name, description, or server..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categories
            </h4>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${
                    selectedCategories.includes(category)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {MCP_TOOL_CATEGORIES[category as keyof typeof MCP_TOOL_CATEGORIES] || category}
                </button>
              ))}
            </div>
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tools List */}
      <div className="p-4">
        {filteredTools.length === 0 ? (
          <div className="text-center py-8">
            <IconTool className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              {tools.length === 0 ? 'No MCP tools available' : 'No tools match your search criteria'}
            </p>
            {tools.length === 0 && (
              <button
                onClick={loadTools}
                className="text-blue-600 hover:text-blue-700"
              >
                Try refreshing the tools list
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedTools).map(([serverName, serverTools]) => (
              <div key={serverName} className="border border-gray-200 dark:border-gray-600 rounded-lg">
                {groupByServer && (
                  <div
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 cursor-pointer"
                    onClick={() => toggleServerExpansion(serverName)}
                  >
                    <div className="flex items-center">
                      {expandedServers.has(serverName) ? (
                        <IconChevronDown className="w-4 h-4 text-gray-500 mr-2" />
                      ) : (
                        <IconChevronRight className="w-4 h-4 text-gray-500 mr-2" />
                      )}
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {serverName}
                      </h4>
                      <span className="ml-2 px-2 py-1 bg-gray-200 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 rounded">
                        {serverTools.length} tools
                      </span>
                    </div>
                  </div>
                )}

                {(!groupByServer || expandedServers.has(serverName)) && (
                  <div className="divide-y divide-gray-200 dark:divide-gray-600">
                    {serverTools.map((tool) => (
                      <div
                        key={tool.qualified_name}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-900 ${
                          onToolSelect ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => onToolSelect?.(tool)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <span className="text-lg mr-2">{getToolIcon(tool)}</span>
                              <h5 className="font-medium text-gray-900 dark:text-white">
                                {tool.name}
                              </h5>
                              {tool.category && (
                                <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-xs font-medium text-blue-600 dark:text-blue-400 rounded">
                                  {MCP_TOOL_CATEGORIES[tool.category as keyof typeof MCP_TOOL_CATEGORIES] || tool.category}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {tool.description}
                            </p>
                            {showUsageStats && (
                              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                                <div className="flex items-center">
                                  <IconTool className="w-3 h-3 mr-1" />
                                  Used: {tool.usage_count || 0} times
                                </div>
                                <div className="flex items-center">
                                  <IconClock className="w-3 h-3 mr-1" />
                                  Avg: {formatExecutionTime(tool.average_execution_time)}
                                </div>
                                <div className="flex items-center">
                                  {(tool.success_rate || 0) >= 0.9 ? (
                                    <IconCheck className="w-3 h-3 mr-1 text-green-500" />
                                  ) : (
                                    <IconX className="w-3 h-3 mr-1 text-red-500" />
                                  )}
                                  Success: {formatSuccessRate(tool.success_rate)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {filteredTools.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredTools.length} of {tools.length} tools
          {groupByServer && ` from ${Object.keys(groupedTools).length} servers`}
        </div>
      )}
    </div>
  );
};