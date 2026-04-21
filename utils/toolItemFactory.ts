import React from 'react';
import { ToolItem } from '@/components/AssistantWorkflows/ToolSelectorModal';
import { OpDef } from '@/types/op';
import { AgentTool } from '@/types/agentTools';
import { getOperationIcon } from '@/utils/app/integrations';
import { IconBrain, IconCheck } from '@tabler/icons-react';

export interface ToolItemOptions {
  iconSize?: number;
  apiCategory?: string;
  agentCategory?: string;
  filterTerminate?: boolean;
  deduplicate?: boolean;
  idPrefix?: {
    api?: string;
    agent?: string;
  };
  uniqueIdGenerator?: (name: string, type: 'api' | 'agent') => string;
}

const DEFAULT_OPTIONS: Required<ToolItemOptions> = {
  iconSize: 20,
  apiCategory: 'API',
  agentCategory: 'Agent Tool',
  filterTerminate: true,
  deduplicate: false,
  idPrefix: {
    api: 'api-',
    agent: 'agent-'
  },
  uniqueIdGenerator: (name: string, type: 'api' | 'agent') => `${type}-${name}`
};

/**
 * Creates a ToolItem from an API definition
 */
export function createToolItemFromApi(
  api: OpDef, 
  options: Partial<ToolItemOptions> = {}
): ToolItem {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const IconComponent = getOperationIcon(api.name);
  
  return {
    id: opts.uniqueIdGenerator(api.name, 'api'),
    name: api.name,
    description: api.description || (opts.apiCategory === 'Custom APIs' ? 'No description available' : 'API integration'),
    icon: React.createElement(IconComponent, { size: opts.iconSize }),
    category: opts.apiCategory, // Use default API category
    tags: api.tags || [],
    parameters: api.parameters,
    type: 'api',
    originalTool: api
  };
}

/**
 * Creates a ToolItem from an agent tool
 */
export function createToolItemFromAgentTool(
  agentTool: AgentTool,
  toolName: string,
  options: Partial<ToolItemOptions> = {}
): ToolItem {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const IconComponent = getOperationIcon(agentTool.tool_name || toolName);
  
  return {
    id: opts.uniqueIdGenerator(agentTool.tool_name || toolName, 'agent'),
    name: agentTool.tool_name || toolName,
    description: agentTool.description || (opts.agentCategory === 'Agent Tools' ? 'No description available' : 'Built-in agent tool'),
    icon: React.createElement(IconComponent, { size: opts.iconSize }),
    category: opts.agentCategory,
    tags: agentTool.tags || [],
    parameters: agentTool.parameters,
    type: 'agent',
    originalTool: agentTool
  };
}

/**
 * Creates ToolItems from available APIs with deduplication support
 */
export function createToolItemsFromApis(
  availableApis: OpDef[] | null,
  options: Partial<ToolItemOptions> = {},
  seenTools?: Set<string>
): ToolItem[] {
  if (!availableApis) return [];
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const items: ToolItem[] = [];
  
  availableApis.forEach(api => {
    // Skip if deduplication is enabled and tool already seen
    if (opts.deduplicate && seenTools?.has(api.name)) {
      return;
    }
    
    // Skip terminate tool if filtering enabled
    if (opts.filterTerminate && api.name === 'terminate') {
      return;
    }
    
    seenTools?.add(api.name);
    items.push(createToolItemFromApi(api, options));
  });
  
  return items;
}

/**
 * Creates ToolItems from available agent tools with deduplication support
 */
export function createToolItemsFromAgentTools(
  availableAgentTools: Record<string, AgentTool> | null,
  options: Partial<ToolItemOptions> = {},
  seenTools?: Set<string>
): ToolItem[] {
  if (!availableAgentTools) return [];
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const items: ToolItem[] = [];
  
  Object.entries(availableAgentTools).forEach(([toolName, agentTool]) => {
    const name = agentTool.tool_name || toolName;
    
    // Skip if deduplication is enabled and tool already seen
    if (opts.deduplicate && seenTools?.has(name)) {
      return;
    }
    
    // Skip terminate tool if filtering enabled
    if (opts.filterTerminate && name === 'terminate') {
      return;
    }
    
    seenTools?.add(name);
    items.push(createToolItemFromAgentTool(agentTool, toolName, options));
  });
  
  return items;
}

/**
 * Creates all ToolItems from both APIs and agent tools
 */
export function createAllToolItems(
  availableApis: OpDef[] | null,
  availableAgentTools: Record<string, AgentTool> | null,
  options: Partial<ToolItemOptions> = {}
): ToolItem[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const seenTools = opts.deduplicate ? new Set<string>() : undefined;
  
  const apiItems = createToolItemsFromApis(availableApis, options, seenTools);
  const agentItems = createToolItemsFromAgentTools(availableAgentTools, options, seenTools);
  
  return [...apiItems, ...agentItems];
}

/**
 * Specialized function for VisualWorkflowBuilder with built-in tools and unique IDs
 */
export function createToolItemsForVisualBuilder(
  availableApis: OpDef[] | null,
  availableAgentTools: Record<string, AgentTool> | null
): ToolItem[] {
  const items: ToolItem[] = [];
  const usedIds = new Set<string>();
  
  // Helper function to ensure unique IDs
  const getUniqueId = (baseId: string, type: string): string => {
    let uniqueId = baseId;
    let counter = 1;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${baseId}_${type}_${counter}`;
      counter++;
    }
    usedIds.add(uniqueId);
    return uniqueId;
  };
  
  // Built-in tools (these get priority for IDs)
  const builtinTools = [
    {
      id: 'builtin_think',
      name: 'think',
      description: 'Stop and think step by step',
      icon: React.createElement(IconBrain, { size: 20 }),
      category: 'Built-in',
      tags: ['reasoning', 'planning'],
      parameters: { properties: { what_to_think_about: { type: 'string' } } },
      type: 'builtin' as const
    },
    {
      id: 'builtin_terminate',
      name: 'terminate',
      description: 'End the workflow',
      icon: React.createElement(IconCheck, { size: 20 }),
      category: 'Built-in',
      tags: ['control'],
      parameters: { properties: { message: { type: 'string' } } },
      type: 'builtin' as const
    }
  ];
  
  builtinTools.forEach(tool => {
    usedIds.add(tool.id);
    items.push(tool);
  });
  
  // Add API tools with unique IDs
  if (availableApis) {
    availableApis.forEach(api => {
      // Skip if this is a duplicate of built-in tools
      if (api.name === 'think' || api.name === 'terminate') {
        return;
      }
      
      const IconComponent = getOperationIcon(api.name);
      items.push({
        id: getUniqueId(api.id || api.name, 'api'),
        name: api.name,
        description: api.description,
        icon: React.createElement(IconComponent, { size: 20 }),
        category: api.type === 'custom' ? 'Custom APIs' : 'Internal APIs',
        tags: api.tags || [],
        parameters: api.parameters,
        type: 'api',
        originalTool: api
      });
    });
  }
  
  // Add agent tools with unique IDs
  if (availableAgentTools) {
    Object.values(availableAgentTools).forEach(tool => {
      // Skip if this is a duplicate of built-in tools
      if (tool.tool_name === 'think' || tool.tool_name === 'terminate') {
        return;
      }
      
      const IconComponent = getOperationIcon(tool.tool_name);
      items.push({
        id: getUniqueId(tool.tool_name, 'agent'),
        name: tool.tool_name,
        description: tool.description,
        icon: React.createElement(IconComponent, { size: 20 }),
        category: 'Agent Tools',
        tags: tool.tags || [],
        parameters: tool.parameters || { properties: {} },
        type: 'agent',
        originalTool: tool
      });
    });
  }
  
  return items;
}

/**
 * Preset configurations for common use cases
 */
export const TOOL_ITEM_PRESETS = {
  // For WorkflowGeneratorModal - larger icons, simple categories
  WORKFLOW_GENERATOR: {
    iconSize: 20,
    apiCategory: 'API',
    agentCategory: 'Agent Tool',
    filterTerminate: true,
    deduplicate: false
  } as ToolItemOptions,
  
  // For StepEditor - smaller icons, different categories, deduplication, simple IDs
  STEP_EDITOR: {
    iconSize: 16,
    apiCategory: 'Custom APIs',
    agentCategory: 'Agent Tools',
    filterTerminate: true,
    deduplicate: true,
    uniqueIdGenerator: (name: string) => name // Simple IDs, just the name
  } as ToolItemOptions,
  
  // For VisualWorkflowBuilder - with unique ID generation
  VISUAL_BUILDER: {
    iconSize: 20,
    apiCategory: 'API',
    agentCategory: 'Agent Tool',
    filterTerminate: false, // VisualWorkflowBuilder handles filtering separately
    deduplicate: true
  } as ToolItemOptions
} as const;