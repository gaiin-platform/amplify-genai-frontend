import React, { useState, useEffect } from 'react';
import {
  IconChevronDown,
  IconChevronRight,
  IconTool,
  IconChevronUp,
  IconAlertCircle,
  IconLoader2,
  IconPlugConnectedX,
} from '@tabler/icons-react';
import { translateIntegrationIcon } from '../Integrations/IntegrationsDialog';

import {
  COMPOSITE_FUNCTION_CATEGORIES,
  CompositeFunctionCategory,
  CompositeFunction,
} from '@/utils/app/compositeFunctions';
import Search from '../Search';
import { getOperationIcon } from '@/utils/app/integrations';
import { getConnectedIntegrations } from '@/services/oauthIntegrationsService';

interface CompositeActionsPanelProps {
  onSelect: (fn: CompositeFunction) => void;
  selectedId?: string | null;
  /** Live operations list from the backend — used to determine composite availability */
  allOperations: any[] | null;
}

const getIcon = (opName: string) => {
  const IconComponent = getOperationIcon(opName);
  return <IconComponent size={18} />;
};

const CompositeActionsPanel: React.FC<CompositeActionsPanelProps> = ({ onSelect, selectedId, allOperations }) => {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(COMPOSITE_FUNCTION_CATEGORIES.map((c) => [c.id, true]))
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [connectedIntegrationIds, setConnectedIntegrationIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchConnected = async () => {
      try {
        const integrationsResponse = await getConnectedIntegrations();

        if (cancelled) return;

        if (integrationsResponse?.success) {
          const connections: string[] = integrationsResponse.data || [];
          setConnectedIntegrationIds(new Set<string>(connections));
        } else {
          setConnectedIntegrationIds(new Set<string>());
        }
      } catch {
        if (!cancelled) {
          setConnectedIntegrationIds(new Set<string>());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchConnected();
    return () => { cancelled = true; };
  }, []);

  const isCategoryConnected = (cat: CompositeFunctionCategory): boolean => {
    if (!connectedIntegrationIds) return false;
    return cat.integrationIds.some((id) => connectedIntegrationIds.has(id));
  };

  // A composite is available if at least one of its ops exists in the live allOperations list.
  // This provides graceful degradation when some ops haven't been deployed yet.
  const isCompositeAvailable = (fn: CompositeFunction): boolean => {
    if (!allOperations || allOperations.length === 0) return false;
    const opNames = new Set(allOperations.map((op: any) => op.name));
    return fn.operations.some((opName) => opNames.has(opName));
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const filteredCategories: CompositeFunctionCategory[] = COMPOSITE_FUNCTION_CATEGORIES.map((cat) => ({
    ...cat,
    functions: cat.functions.filter(
      (fn) =>
        searchTerm === '' ||
        fn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fn.description.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter((cat) => cat.functions.length > 0);

  const allExpanded = filteredCategories.every((cat) => expandedCategories[cat.id]);

  const toggleAll = () => {
    const next = !allExpanded;
    setExpandedCategories(Object.fromEntries(COMPOSITE_FUNCTION_CATEGORIES.map((c) => [c.id, next])));
  };

  const connectedCategories = filteredCategories.filter((cat) => isCategoryConnected(cat));
  const disconnectedCategories = filteredCategories.filter((cat) => !isCategoryConnected(cat));

  const renderCard = (fn: CompositeFunction, connected: boolean) => {
    const isSelected = selectedId === fn.id;
    const available = connected && isCompositeAvailable(fn);

    // Use the first op name for the icon
    const firstOpName = fn.operations[0] ?? fn.id;

    return (
      <div
        key={fn.id}
        className={`api-item border transition-all duration-200 ease-in-out
          ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
          ${isSelected && available
            ? 'border-blue-400 dark:border-blue-500 bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100 dark:from-blue-900/40 dark:via-blue-800/30 dark:to-blue-900/40 shadow-lg'
            : 'border-gray-400 dark:border-gray-500 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 shadow-lg hover:shadow-xl'
          }`}
        style={{ padding: '10px', margin: '10px 0', borderRadius: '8px' }}
        onClick={() => available && onSelect(fn)}
      >
        <span className="flex flex-row gap-2 mt-[1px] font-bold text-gray-800 dark:text-gray-100">
          {getIcon(firstOpName)}
          {fn.name}
        </span>
      </div>
    );
  };

  const renderCategory = (cat: CompositeFunctionCategory, connected: boolean) => {
    const isExpanded = expandedCategories[cat.id];
    return (
      <div key={cat.id} className="mt-3">
        <button
          className="w-full flex items-center justify-between px-1 py-1 text-left transition-colors"
          onClick={() => toggleCategory(cat.id)}
        >
          <span className={`text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 ${
            connected
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}>
            {!connected
              ? <IconPlugConnectedX size={12} stroke={2} className="text-amber-500 dark:text-amber-400 flex-shrink-0" />
              : <span className="flex-shrink-0 w-3 h-3">{translateIntegrationIcon(cat.integrationIds[0])}</span>
            }
            {cat.label}
          </span>
          {isExpanded ? (
            <IconChevronDown size={13} stroke={2} className="text-gray-400 dark:text-gray-500" />
          ) : (
            <IconChevronRight size={13} stroke={2} className="text-gray-400 dark:text-gray-500" />
          )}
        </button>

        {isExpanded && (
          <div className="ml-3">
            {connected ? (
              cat.functions.map((fn) => renderCard(fn, true))
            ) : (
              <div className="flex items-start gap-2 mt-2 mb-3 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/40 text-xs text-amber-700 dark:text-amber-300">
                <IconAlertCircle size={14} stroke={2} className="flex-shrink-0 mt-0.5" />
                <span>
                  Integration not connected.{' '}
                  <span className="font-medium">Go to Integrations to enable this.</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
          <IconTool size={16} stroke={1.5} className="mr-2" />
          Available Actions
        </h3>
        <button
          onClick={toggleAll}
          className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-0.5"
        >
          {allExpanded ? (
            <><IconChevronUp size={13} stroke={2} /><span>Collapse All</span></>
          ) : (
            <><IconChevronDown size={13} stroke={2} /><span>Expand All</span></>
          )}
        </button>
      </div>

      <div className="mb-3">
        <Search
          placeholder="Search actions by name..."
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400 text-sm gap-2">
          <IconLoader2 size={16} className="animate-spin" />
          <span>Loading actions...</span>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No actions match your search
        </div>
      ) : (
        <div>
          {connectedCategories.length === 0 && disconnectedCategories.length > 0 && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700/40 text-xs text-blue-700 dark:text-blue-300">
              <IconAlertCircle size={14} stroke={2} className="flex-shrink-0 mt-0.5" />
              <span>
                No integrations are connected.{' '}
                <span className="font-medium">Go to Integrations to get started.</span>
              </span>
            </div>
          )}

          {connectedCategories.map((cat) => renderCategory(cat, true))}

          {disconnectedCategories.length > 0 && (
            <>
              {connectedCategories.length > 0 && (
                <div className="mt-4 mb-1 flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">Not connected</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>
              )}
              {disconnectedCategories.map((cat) => renderCategory(cat, false))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CompositeActionsPanel;
