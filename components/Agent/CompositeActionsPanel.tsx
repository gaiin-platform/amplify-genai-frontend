import React, { useState, useEffect } from 'react';
import {
  IconChevronDown,
  IconChevronRight,
  IconTool,
  IconChevronUp,
  IconAlertCircle,
  IconLoader2,
  IconPlugConnectedX,
  IconAdjustments,
  IconX,
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
import { Checkbox } from '@/components/ReusableComponents/CheckBox';
import ApiParameterBindingEditor from '../AssistantApi/ApiParameterBindingEditor';
import ActionButton from '../ReusableComponents/ActionButton';
import { OpBindingMode, OpDef } from '@/types/op';

interface CompositeActionsPanelProps {
  onSelect: (fn: CompositeFunction) => void;
  selectedId?: string | null;
  /** Live operations list from the backend — used to determine composite availability */
  allOperations: any[] | null;
  /** Optional: whether a composite is currently selected (for checkbox mode) */
  isSelected?: (fn: CompositeFunction) => boolean;
  /** Optional: called when the composite checkbox is toggled */
  onToggle?: (fn: CompositeFunction, checked: boolean) => void;
  /** Whether to show the ⚙ parameter configuration button */
  allowConfiguration?: boolean;
  /** Currently selected/configured ops (used to read existing bindings) */
  selectedApis?: OpDef[];
  /** Callback to update bindings on a specific op within this composite */
  onUpdateOpBindings?: (opId: string, modes: Record<string, OpBindingMode>, values: Record<string, string>) => void;
}

const getIcon = (opName: string) => {
  const IconComponent = getOperationIcon(opName);
  return <IconComponent size={18} />;
};

const CompositeActionsPanel: React.FC<CompositeActionsPanelProps> = ({
  onSelect,
  selectedId,
  allOperations,
  isSelected,
  onToggle,
  allowConfiguration = false,
  selectedApis = [],
  onUpdateOpBindings,
}) => {
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

  /**
   * Returns false if the category has prerequisite integrations that are not yet connected.
   * Hidden categories are not shown at all — not even in the "Not connected" section.
   */
  const isCategoryVisible = (cat: CompositeFunctionCategory): boolean => {
    if (!cat.requiresIntegrationIds || cat.requiresIntegrationIds.length === 0) return true;
    if (!connectedIntegrationIds) return false;
    return cat.requiresIntegrationIds.every((id) => connectedIntegrationIds.has(id));
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
        cat.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fn.description.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter((cat) => cat.functions.length > 0);

  const allExpanded = filteredCategories.every((cat) => expandedCategories[cat.id]);

  const toggleAll = () => {
    const next = !allExpanded;
    setExpandedCategories(Object.fromEntries(COMPOSITE_FUNCTION_CATEGORIES.map((c) => [c.id, next])));
  };

  const visibleCategories = filteredCategories.filter((cat) => isCategoryVisible(cat));
  const connectedCategories = visibleCategories.filter((cat) => isCategoryConnected(cat));
  const disconnectedCategories = visibleCategories.filter((cat) => !isCategoryConnected(cat));

  // Per-composite config state: map of compositeId -> { opName -> { modes, values } }
  const [configExpandedId, setConfigExpandedId] = useState<string | null>(null);
  const [compositeParamModes, setCompositeParamModes] = useState<Record<string, Record<string, Record<string, OpBindingMode>>>>({});
  const [compositeParamValues, setCompositeParamValues] = useState<Record<string, Record<string, Record<string, string>>>>({});

  const handleParamModeChange = (compositeId: string, opId: string, param: string, mode: OpBindingMode) => {
    setCompositeParamModes(prev => {
      const updated = {
        ...prev,
        [compositeId]: {
          ...prev[compositeId],
          [opId]: { ...(prev[compositeId]?.[opId] ?? {}), [param]: mode },
        },
      };
      if (onUpdateOpBindings) {
        onUpdateOpBindings(opId, updated[compositeId][opId], compositeParamValues[compositeId]?.[opId] ?? {});
      }
      return updated;
    });
  };

  const handleParamValueChange = (compositeId: string, opId: string, param: string, value: string) => {
    setCompositeParamValues(prev => {
      const updated = {
        ...prev,
        [compositeId]: {
          ...prev[compositeId],
          [opId]: { ...(prev[compositeId]?.[opId] ?? {}), [param]: value },
        },
      };
      if (onUpdateOpBindings) {
        onUpdateOpBindings(opId, compositeParamModes[compositeId]?.[opId] ?? {}, updated[compositeId][opId]);
      }
      return updated;
    });
  };

  const renderCard = (fn: CompositeFunction, connected: boolean) => {
    const isHighlighted = selectedId === fn.id;
    const available = connected && isCompositeAvailable(fn);
    const checked = isSelected ? isSelected(fn) : false;
    const hasCheckbox = !!onToggle;
    const isConfigOpen = configExpandedId === fn.id;

    // Resolved ops that exist in the live backend list
    const resolvedOps: OpDef[] = allOperations
      ? (fn.operations
          .map(opName => (allOperations as OpDef[]).find(op => op.name === opName))
          .filter(Boolean) as OpDef[])
      : [];

    const hasConfigurableOps = resolvedOps.some(
      op => op.parameters?.properties && Object.keys(op.parameters.properties).length > 0
    );

    // Use the first op name for the icon
    const firstOpName = fn.operations[0] ?? fn.id;

    return (
      <div
        key={fn.id}
        className={`api-item border transition-all duration-200 ease-in-out
          ${!available ? 'cursor-not-allowed opacity-60' : ''}
          ${isHighlighted && available
            ? 'border-blue-400 dark:border-blue-500 bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100 dark:from-blue-900/40 dark:via-blue-800/30 dark:to-blue-900/40 shadow-lg'
            : 'border-gray-400 dark:border-gray-500 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 shadow-lg hover:shadow-xl'
          }`}
        style={{ padding: '10px', margin: '10px 0', borderRadius: '8px' }}
        onClick={() => !hasCheckbox && available && onSelect(fn)}
      >
        {/* Card header row */}
        <div className="flex flex-row items-center">
          {hasCheckbox ? (
            <Checkbox
              id={`composite-${fn.id}`}
              label={fn.name}
              checked={checked}
              onChange={(c) => available && onToggle!(fn, c)}
              bold={true}
              disabled={!available}
            />
          ) : (
            <span className="flex flex-row gap-2 mt-[1px] font-bold text-gray-800 dark:text-gray-100 cursor-pointer">
              {getIcon(firstOpName)}
              {fn.name}
            </span>
          )}

          {/* ⚙ Config button */}
          {allowConfiguration && available && hasConfigurableOps && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfigExpandedId(isConfigOpen ? null : fn.id);
              }}
              className="ml-2 -mt-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
              title="Configure composite parameters"
            >
              <IconAdjustments size={18} />
            </button>
          )}
        </div>

        {/* Composite description */}
        {fn.description && (
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
            {fn.description}
          </p>
        )}

        {/* Per-op parameter configuration panel */}
        {allowConfiguration && isConfigOpen && resolvedOps.length > 0 && (
          <div
            className="relative py-3 mb-4 border-t border-b border-neutral-200 dark:border-neutral-600 bg-gray-100 dark:bg-gray-700 rounded-md mt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute right-2 top-2 z-10">
              <ActionButton
                title="Collapse Configurations"
                handleClick={(e) => {
                  e.stopPropagation();
                  setConfigExpandedId(null);
                }}
              >
                <IconX size={18} />
              </ActionButton>
            </div>

            {resolvedOps.map((op) => {
              const opHasParams = op.parameters?.properties && Object.keys(op.parameters.properties).length > 0;
              if (!opHasParams) return null;
              return (
                <div key={op.id} className="mb-4 px-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    {op.name}
                  </p>
                  <ApiParameterBindingEditor
                    paramSource={op.parameters}
                    paramModes={compositeParamModes[fn.id]?.[op.id] ?? {}}
                    paramValues={compositeParamValues[fn.id]?.[op.id] ?? {}}
                    onParamModeChange={(param, mode) => handleParamModeChange(fn.id, op.id, param, mode)}
                    onParamValueChange={(param, value) => handleParamValueChange(fn.id, op.id, param, value)}
                  />
                </div>
              );
            })}
          </div>
        )}
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
              : <span className="flex-shrink-0 w-3 h-3 inline-flex items-center justify-center">{translateIntegrationIcon(cat.integrationIds[0])}</span>
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
                  <button
                    className="font-medium underline hover:opacity-75 transition-opacity cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('openSettingsTrigger', { detail: { openToTab: 'Integrations' } }));
                    }}
                  >
                    Go to Integrations to enable this.
                  </button>
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
          Available Tools
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
          placeholder="Search tools by name..."
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
                <button
                  className="font-medium underline hover:opacity-75 transition-opacity cursor-pointer"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('openSettingsTrigger', { detail: { openToTab: 'Integrations' } }));
                  }}
                >
                  Go to Integrations to get started.
                </button>
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
