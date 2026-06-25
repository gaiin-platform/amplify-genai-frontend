import React, { useContext, useState } from 'react';
import { IconChevronDown, IconChevronRight, IconPlus, IconHomeBolt } from '@tabler/icons-react';
import { ApiItemSelector } from './ApiSelector';
import { ExternalAPI } from './CustomAPIEditor';
import HomeContext from '@/pages/api/home/home.context';
import { PythonFunctionModal } from '../Operations/PythonFunctionModal';
import { createPortal } from 'react-dom';
import { OpBindingMode, OpDef } from '@/types/op';
import CompositeActionsPanel from '../Agent/CompositeActionsPanel';
import AgentToolsSelector from '../Agent/AgentToolsSelector';
import { COMPOSITE_FUNCTION_CATEGORIES } from '@/utils/app/compositeFunctions';

interface ApiIntegrationsPanelProps {
  availableApis: OpDef[] | null;

  selectedApis?: OpDef[];
  setSelectedApis?: (apis: OpDef[]) => void;
  onClickApiItem?: (api: OpDef) => void;

  apiInfo?: ExternalAPI[];
  setApiInfo?: React.Dispatch<React.SetStateAction<ExternalAPI[]>>;

  availableAgentTools?: Record<string, any> | null;
  builtInAgentTools?: string[];
  setBuiltInAgentTools?: (tools: string[]) => void;
  onClickAgentTool?: (tool: any) => void;

  pythonFunctionOnSave?: (fn: { name: string; code: string; schema: string; testJson: string }) => void;
  allowCreatePythonFunction?: boolean;

  hideApisPanel?: string[];
  disabled?: boolean;

  showDetails?: boolean;
  labelPrefix?: string;
  compactDisplay?: boolean;
  height?: string;
  allowConfiguration?: boolean;
  /** When true, skip the outer toggle button and "Browse individual tools" collapsible
   *  and render Agent Tools + Integration APIs directly (used in StepEditor). */
  flat?: boolean;
}

const ApiIntegrationsPanel: React.FC<ApiIntegrationsPanelProps> = ({
  availableApis,
  selectedApis = [],
  setSelectedApis,
  apiInfo = [],
  setApiInfo,
  availableAgentTools,
  builtInAgentTools = [],
  setBuiltInAgentTools,
  pythonFunctionOnSave = () => {},
  allowCreatePythonFunction = true,
  onClickApiItem,
  onClickAgentTool,
  hideApisPanel = [],
  disabled = false,
  showDetails,
  labelPrefix = 'Manage',
  compactDisplay = false,
  height,
  allowConfiguration = false,
  flat = false,
}) => {
  const { state: { featureFlags, lightMode } } = useContext(HomeContext);

  // Top-level toggle — nothing shown unless this is open
  const [panelOpen, setPanelOpen] = useState(false);

  // Track which composite IDs are explicitly checked — independent of the ops list
  // so composites that share ops don't bleed checked state into each other.
  const [selectedCompositeIds, setSelectedCompositeIds] = useState<Set<string>>(new Set());

  // Sub-section disclosure states (inside the panel)
  const [agentToolsOpen, setAgentToolsOpen] = useState(true);
  const [integrationApisOpen, setIntegrationApisOpen] = useState(true);
  const [customApisOpen, setCustomApisOpen] = useState(true);
  const [rawActionsOpen, setRawActionsOpen] = useState(false);

  const [addFunctionOpen, setAddFunctionOpen] = useState(false);

  const showInternal = featureFlags.integrations && !hideApisPanel?.includes('internal');
  const showTools = featureFlags.agentTools && !hideApisPanel?.includes('tools');
  const showCustom = false; //DISABLE CUSTOM APIs FOR NOW //featureFlags.pythonFunctionApis && !hideApisPanel?.includes('custom');

  if (!showInternal && !showTools && !showCustom) return null;

  // In flat mode the inner content is always visible — no toggle, no collapsible.
  const innerContent = (
    <div className="flex flex-col gap-3">

          {/* ── Composite / task-based tools ── */}
          {showInternal && availableApis && setSelectedApis && (
            <CompositeActionsPanel
              selectedId={null}
              allOperations={availableApis}
              selectedApis={selectedApis}
              allowConfiguration={true}
              isSelected={(fn) => selectedCompositeIds.has(fn.id)}
              onToggle={(fn, checked) => {
                if (disabled) return;
                // Update the independent composite-ID set
                setSelectedCompositeIds(prev => {
                  const next = new Set(prev);
                  if (checked) next.add(fn.id); else next.delete(fn.id);
                  return next;
                });
                // Also sync the flat ops list
                const opNames = new Set(fn.operations);
                const ops = availableApis.filter(a => opNames.has(a.name));
                if (checked) {
                  const existingNames = new Set(selectedApis.map(a => a.name));
                  const toAdd = ops.filter(op => !existingNames.has(op.name));
                  if (toAdd.length > 0) setSelectedApis([...selectedApis, ...toAdd]);
                } else {
                  // Only remove ops that are NOT used by any other still-checked composite
                  const otherCheckedOps = new Set(
                    Array.from(selectedCompositeIds)
                      .filter(id => id !== fn.id)
                      .flatMap(id => {
                        const cat = ([] as any[]).concat(
                          ...COMPOSITE_FUNCTION_CATEGORIES.map(c => c.functions)
                        ).find((f: any) => f.id === id);
                        return cat ? cat.operations : [];
                      })
                  );
                  setSelectedApis(selectedApis.filter(a => !opNames.has(a.name) || otherCheckedOps.has(a.name)));
                }
              }}
              onUpdateOpBindings={(opId, modes, values) => {
                // Update bindings on the matching selected op
                const updatedApis = selectedApis.map(a => {
                  if (a.id !== opId) return a;
                  const bindings: Record<string, { value: string; mode: OpBindingMode }> = {};
                  if (a.parameters?.properties) {
                    Object.keys(a.parameters.properties).forEach(param => {
                      const mode = modes[param] || 'ai';
                      const value = values[param] || '';
                      if (value || mode === 'manual') {
                        bindings[param] = { value, mode };
                      }
                    });
                  }
                  return { ...a, bindings };
                });
                setSelectedApis(updatedApis);
              }}
              onSelect={(fn) => {
                // Fallback click handler (used when no checkbox mode)
                if (disabled) return;
                const opNames = new Set(fn.operations);
                const ops = availableApis.filter(a => opNames.has(a.name));
                const existingNames = new Set(selectedApis.map(a => a.name));
                const toAdd = ops.filter(op => !existingNames.has(op.name));
                if (toAdd.length > 0) setSelectedApis([...selectedApis, ...toAdd]);
              }}
            />
          )}

          {/* ── Browse individual tools ── */}
          <div className={flat ? '' : 'border-t border-neutral-300 dark:border-neutral-600 pt-2'}>
            {!flat && (
              <button
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors select-none mb-2"
                onClick={() => setRawActionsOpen(v => !v)}
              >
                {rawActionsOpen
                  ? <IconChevronDown size={13} stroke={2} />
                  : <IconChevronRight size={13} stroke={2} />}
                Browse individual tools
              </button>
            )}

            {(flat || rawActionsOpen) && (
              <div className={`flex flex-col gap-3 ${flat ? '' : 'pl-2'}`}>

                {/* Agent Tools */}
                {showTools && availableAgentTools && Object.keys(availableAgentTools).length > 0 && (
                  <div>
                    <button
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none mb-1"
                      onClick={() => setAgentToolsOpen(v => !v)}
                    >
                      {agentToolsOpen
                        ? <IconChevronDown size={12} stroke={2} />
                        : <IconChevronRight size={12} stroke={2} />}
                      Agent Tools
                    </button>
                    {agentToolsOpen && (
                      <AgentToolsSelector
                        availableTools={availableAgentTools}
                        selectedTools={builtInAgentTools}
                        onToolSelectionChange={setBuiltInAgentTools ?? (() => {})}
                        onClickAgentTool={onClickAgentTool}
                        disableSelection={!setBuiltInAgentTools || disabled}
                        showDetails={true}
                      />
                    )}
                  </div>
                )}

                {/* Integrations */}
                {showInternal && availableApis && (
                  <div>
                    <button
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none mb-1"
                      onClick={() => setIntegrationApisOpen(v => !v)}
                    >
                      {integrationApisOpen
                        ? <IconChevronDown size={12} stroke={2} />
                        : <IconChevronRight size={12} stroke={2} />}
                      Integrations
                    </button>
                    {integrationApisOpen && (
                      <ApiItemSelector
                        availableApis={availableApis}
                        selectedApis={selectedApis}
                        setSelectedApis={setSelectedApis ?? (() => {})}
                        apiFilter={apis => apis.filter(api => api.type !== 'custom')}
                        onClickApiItem={onClickApiItem}
                        disableSelection={!setSelectedApis || disabled}
                        showDetails={true}
                        allowConfiguration={true}
                      />
                    )}
                  </div>
                )}

                {/* Custom APIs */}
                {showCustom && availableApis && (
                  <div>
                    <button
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none mb-1"
                      onClick={() => setCustomApisOpen(v => !v)}
                    >
                      {customApisOpen
                        ? <IconChevronDown size={12} stroke={2} />
                        : <IconChevronRight size={12} stroke={2} />}
                      Custom APIs
                    </button>
                    {customApisOpen && (
                      <>
                        {allowCreatePythonFunction && featureFlags.createPythonFunctionApis && !disabled && (
                          <button
                            className="mb-2 flex items-center gap-2 rounded border border-neutral-500 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            onClick={() => setAddFunctionOpen(true)}
                          >
                            <IconPlus size={16} />
                            Add Custom API
                          </button>
                        )}
                        <ApiItemSelector
                          availableApis={availableApis}
                          selectedApis={selectedApis}
                          setSelectedApis={setSelectedApis ?? (() => {})}
                          apiFilter={apis => apis.filter(api => api.type === 'custom')}
                          onClickApiItem={onClickApiItem}
                          disableSelection={!setSelectedApis || disabled}
                          showDetails={true}
                          allowConfiguration={true}
                        />
                      </>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

        </div>
  );

  return (
    <div className="text-black dark:text-neutral-100">
      {flat ? (
        innerContent
      ) : (
        <>
          {/* ── Toggle button ── */}
          <button
            className="flex items-center gap-2 rounded border border-neutral-500 px-4 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            onClick={() => setPanelOpen(v => !v)}
            disabled={disabled}
          >
            <IconHomeBolt size={18} className="flex-shrink-0" />
            Add Tools
            {panelOpen
              ? <IconChevronDown size={14} stroke={2} />
              : <IconChevronRight size={14} stroke={2} />}
          </button>

          {/* ── Panel contents — only shown when open ── */}
          {panelOpen && (
            <div className="mt-3">
              {innerContent}
            </div>
          )}
        </>
      )}

      {addFunctionOpen && createPortal(
        <div className={lightMode}>
          <PythonFunctionModal
            onCancel={() => setAddFunctionOpen(false)}
            onSave={pythonFunctionOnSave}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default ApiIntegrationsPanel;
