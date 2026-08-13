/**
 * ModelPicker — spec v2 compliant model + effort selector.
 * Ref: model-picker-spec2.md
 *
 * TWO STATES (keyed to whether the conversation has begun):
 *
 *   EXPANDED  (isNewChat = true)  — 280px, opens downward, full recommended slate
 *             Shows one model per family: Opus, Sonnet, Haiku (newest of each,
 *             ordered capability-descending). If none of these families are in
 *             availableModels, falls back to showing up to 3 filtered models.
 *
 *   COLLAPSED (isNewChat = false) — 220px, opens upward, current model only (1 row)
 *
 * PRIMARY MENU STRUCTURE (both states):
 *   [model block rows]
 *   ──────────────────   (divider)
 *   Effort  High ›       (only when model supports reasoning)
 *   ──────────────────   (divider)
 *   More models ›
 *
 * EFFORT SUBMENU: Consequence header + Low / Medium / High / Off
 * MORE MODELS SUBMENU: All models, alphabetically sorted, check on active
 *
 * Effort levels: existing REASONING_LEVELS ('low' | 'medium' | 'high' | 'off')
 * Positioning: Floating UI for primary, absolute for nested submenus.
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  IconCamera,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconInfoCircle,
} from '@tabler/icons-react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import HomeContext from '@/pages/api/home/home.context';
import { Model } from '@/types/model';
import { filterModels } from '@/utils/app/models';
import { getSettings } from '@/utils/app/settings';

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

export type EffortLevel = 'low' | 'medium' | 'high' | 'off';

const EFFORT_OPTIONS: {
  id: EffortLevel;
  label: string;
  isDefault: boolean;
  info: string;
}[] = [
  { id: 'low',    label: 'Low',    isDefault: false, info: 'Fastest responses. Best for simple questions and quick lookups.' },
  { id: 'medium', label: 'Medium', isDefault: true,  info: 'Balanced accuracy and speed. Good for everyday tasks.' },
  { id: 'high',   label: 'High',   isDefault: false, info: 'More thorough reasoning. Takes longer and uses limits faster.' },
  { id: 'off',    label: 'Off',    isDefault: false, info: 'Reasoning disabled. Fastest option, no extended thinking.' },
];

const EFFORT_CONSEQUENCE =
  'Higher effort means more thorough responses, but takes longer and uses your limits faster.';

/**
 * Model family matching — order is capability-descending per spec §3.1.
 * We match by name substring (case-insensitive) so the logic works regardless
 * of how the backend names models (e.g. "Claude Opus 4", "claude-opus-4", etc.)
 */
const FAMILY_TIERS: { family: string; tier: number; defaultDesc: string }[] = [
  { family: 'opus',   tier: 1, defaultDesc: 'For complex tasks' },
  { family: 'sonnet', tier: 2, defaultDesc: 'Most efficient for everyday tasks' },
  { family: 'haiku',  tier: 3, defaultDesc: 'Fastest for quick answers' },
];

/** Pick the best (highest outputTokenLimit as proxy for "newest/most capable") model per family */
function pickFamilyRepresentatives(models: Model[]): Model[] {
  const picked: Model[] = [];

  for (const { family } of FAMILY_TIERS) {
    const matches = models.filter((m) =>
      m.name.toLowerCase().includes(family) || m.id.toLowerCase().includes(family)
    );
    if (matches.length === 0) continue;

    // "Newest/most capable" heuristic: highest outputTokenLimit, tiebreak by name desc
    const best = matches.sort((a, b) => {
      if (b.outputTokenLimit !== a.outputTokenLimit)
        return b.outputTokenLimit - a.outputTokenLimit;
      return b.name.localeCompare(a.name);
    })[0];

    picked.push(best);
  }

  // If none of our known families matched (different model names), fall back to first 3
  if (picked.length === 0) return models.slice(0, 3);

  return picked;
}

/**
 * Get the short use-case description for display.
 * Known families always use the spec copy (brief, never truncated).
 * Unknown models fall back to model.description from the API.
 */
function modelDescription(model: Model): string {
  const family = FAMILY_TIERS.find(
    (f) =>
      model.name.toLowerCase().includes(f.family) ||
      model.id.toLowerCase().includes(f.family)
  );
  if (family) return family.defaultDesc;
  return (model.description && model.description.trim()) ? model.description : 'General purpose model';
}

export interface ModelPickerProps {
  selectedModelId: string | undefined;
  selectedEffort: EffortLevel;
  onModelChange: (modelId: string) => void;
  onEffortChange: (effort: EffortLevel) => void;
  /** true = new chat (expanded state, full slate, opens downward) */
  isNewChat?: boolean;
  /** Ref to the composer — focus returned here after selection */
  composerRef?: React.RefObject<{ focus: () => void }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoTooltip
// ─────────────────────────────────────────────────────────────────────────────

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex items-center ml-1 flex-shrink-0">
      <button
        type="button"
        aria-describedby={show ? id : undefined}
        className="inline-flex items-center justify-center focus:outline-none rounded"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
      >
        <IconInfoCircle size={14} />
      </button>
      {show && (
        <div
          id={id}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 220,
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '8px 12px',
            pointerEvents: 'none',
            zIndex: 300,
            boxShadow: '0 8px 24px rgba(0,0,0,.35)',
            fontSize: 12.5,
            lineHeight: 1.45,
            color: 'var(--text-secondary)',
            whiteSpace: 'normal',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────────────────────────────────────

const MenuDivider: React.FC = () => (
  <div
    style={{
      height: 1,
      background: 'var(--border-subtle)',
      margin: '5px 0',
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// EffortMenu
// ─────────────────────────────────────────────────────────────────────────────

const EffortMenu: React.FC<{
  selected: EffortLevel;
  onSelect: (e: EffortLevel) => void;
}> = ({ selected, onSelect }) => (
  <div
    role="menu"
    aria-label="Reasoning effort"
    style={{
      width: 320,
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      boxShadow: '0 12px 32px rgba(0,0,0,.5)',
      overflow: 'hidden',
    }}
  >
    {/* Consequence header */}
    <div
      style={{
        padding: '12px 14px 10px',
        fontSize: 12.5,
        lineHeight: 1.5,
        color: 'var(--text-muted)',
      }}
    >
      {EFFORT_CONSEQUENCE}
    </div>

    <div style={{ paddingBottom: 6 }}>
      {EFFORT_OPTIONS.map((opt) => {
        const isSelected = selected === opt.id;
        return (
          <button
            key={opt.id}
            role="menuitemradio"
            aria-checked={isSelected}
            onClick={() => onSelect(opt.id)}
            className="w-full flex items-center text-left transition-colors"
            style={{
              height: 35,
              padding: '0 14px',
              borderRadius: 8,
              background: isSelected ? 'var(--bg-hover)' : 'transparent',
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                isSelected ? 'var(--bg-hover)' : 'transparent';
            }}
          >
            <span style={{ flex: 1 }}>{opt.label}</span>
            {opt.isDefault && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'var(--bg-active)',
                  color: 'var(--text-secondary)',
                  marginRight: 6,
                  flexShrink: 0,
                }}
              >
                Default
              </span>
            )}
            <InfoTooltip text={opt.info} />
            {isSelected && (
              <IconCheck
                size={15}
                className="ml-2 flex-shrink-0"
                style={{ color: 'var(--text-primary)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MoreModelsMenu
// ─────────────────────────────────────────────────────────────────────────────

const MoreModelsMenu: React.FC<{
  models: Model[];
  selectedId: string | undefined;
  defaultModelId: string | undefined;
  onSelect: (id: string) => void;
}> = ({ models, selectedId, defaultModelId, onSelect }) => {
  const sorted = [...models].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div
      role="menu"
      aria-label="All models"
      style={{
        width: 260,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        overflow: 'hidden',
        maxHeight: 'min(420px, 60dvh)',
      }}
    >
      <div style={{ overflowY: 'auto', maxHeight: 'min(420px, 60dvh)', padding: '6px 0' }}>
        {sorted.map((model) => {
          const isSelected = model.id === selectedId;
          return (
            <button
              key={model.id}
              role="menuitemradio"
              aria-checked={isSelected}
              onClick={() => onSelect(model.id)}
              className="w-full flex items-center text-left transition-colors"
              style={{
                height: 35,
                padding: '0 12px',
                background: isSelected ? 'var(--bg-hover)' : 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13.5,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  isSelected ? 'var(--bg-hover)' : 'transparent';
              }}
            >
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {model.name}
              </span>
              {model.supportsImages && (
                <span title="Supports images in prompts" style={{ flexShrink: 0, marginLeft: 6, opacity: 0.7, display: 'flex' }}>
                  <IconCamera size={14} style={{ color: 'var(--text-muted)' }} />
                </span>
              )}
              {model.id === defaultModelId && !isSelected && (
                <span
                  style={{ fontSize: 11, color: '#60a5fa', flexShrink: 0, marginLeft: 8 }}
                >
                  Default
                </span>
              )}
              {isSelected && (
                <IconCheck
                  size={14}
                  className="ml-2 flex-shrink-0"
                  style={{ color: 'var(--text-primary)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SubmenuRow — "Effort ›" and "More models ›" rows
// ─────────────────────────────────────────────────────────────────────────────

const SubmenuRow = React.forwardRef<
  HTMLButtonElement,
  {
    label: string;
    value?: string;
    isOpen: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
  }
>(({ label, value, isOpen, onMouseEnter, onMouseLeave, onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    role="menuitem"
    aria-haspopup="menu"
    aria-expanded={isOpen}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onFocus={onMouseEnter}
    onBlur={onMouseLeave}
    className="w-full flex items-center text-left transition-colors"
    style={{
      height: 38,
      padding: '0 10px',
      borderRadius: 8,
      background: isOpen ? 'var(--bg-active)' : 'transparent',
      color: 'var(--text-primary)',
      fontSize: 14,
    }}
  >
    <span style={{ flex: 1 }}>{label}</span>
    {value && (
      <span style={{ fontSize: 13.5, color: 'var(--text-muted)', marginRight: 4, flexShrink: 0 }}>
        {value}
      </span>
    )}
    <IconChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
  </button>
));
SubmenuRow.displayName = 'SubmenuRow';

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const ModelPicker: React.FC<ModelPickerProps> = ({
  selectedModelId,
  selectedEffort,
  onModelChange,
  onEffortChange,
  isNewChat = true,
  composerRef,
}) => {
  const {
    state: { availableModels, defaultModelId, featureFlags },
  } = useContext(HomeContext);

  const allModels: Model[] = filterModels(
    availableModels,
    getSettings(featureFlags).hiddenModelIds,
  );

  const activeModel: Model | undefined =
    allModels.find((m) => m.id === selectedModelId) ??
    allModels.find((m) => m.id === defaultModelId) ??
    allModels[0];

  const activeEffortOption =
    EFFORT_OPTIONS.find((e) => e.id === selectedEffort) ?? EFFORT_OPTIONS[1];

  // ── Build recommended slate ───────────────────────────────────────────────
  // Expanded: one per family (Opus > Sonnet > Haiku), plus current model if not in set
  // Collapsed: just the current model
  const recommendedModels: Model[] = (() => {
    if (!isNewChat) {
      return activeModel ? [activeModel] : [];
    }

    const familyReps = pickFamilyRepresentatives(allModels);

    // Ensure current/active model is in the list (insert at tier position if missing)
    if (activeModel && !familyReps.find((m) => m.id === activeModel.id)) {
      familyReps.push(activeModel);
    }

    // Sort capability-descending: match FAMILY_TIERS order, unknowns go last
    return familyReps.sort((a, b) => {
      const tierA = FAMILY_TIERS.find(
        (f) =>
          a.name.toLowerCase().includes(f.family) ||
          a.id.toLowerCase().includes(f.family)
      )?.tier ?? 99;
      const tierB = FAMILY_TIERS.find(
        (f) =>
          b.name.toLowerCase().includes(f.family) ||
          b.id.toLowerCase().includes(f.family)
      )?.tier ?? 99;
      return tierA - tierB;
    });
  })();

  // ── Primary menu state ────────────────────────────────────────────────────
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [submenu, setSubmenu] = useState<'effort' | 'models' | null>(null);

  // Spec §3: expanded opens downward (new chat), collapsed opens upward (conversation)
  const placement = isNewChat ? 'bottom-end' : 'top-end';
  const panelWidth = isNewChat ? 280 : 220;

  const { refs, x, y, strategy, context } = useFloating({
    open: primaryOpen,
    onOpenChange: (o: boolean) => {
      setPrimaryOpen(o);
      if (!o) setSubmenu(null);
    },
    placement,
    middleware: [offset(7), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  } as any);

  const clickInteraction = useClick(context);
  const dismissInteraction = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([
    clickInteraction,
    dismissInteraction,
  ]);

  // ── Hover-intent for submenus (150ms open, 300ms close) ───────────────────
  const submenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSubmenu = useCallback((which: 'effort' | 'models') => {
    if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
    submenuTimerRef.current = setTimeout(() => setSubmenu(which), 150);
  }, []);

  const scheduleClose = useCallback(() => {
    if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
    submenuTimerRef.current = setTimeout(() => setSubmenu(null), 300);
  }, []);

  const cancelClose = useCallback(() => {
    if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
  }, []);

  useEffect(
    () => () => { if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current); },
    [],
  );

  // ── Submenu position refs ─────────────────────────────────────────────────
  const effortRowRef = useRef<HTMLButtonElement>(null);
  const modelsRowRef = useRef<HTMLButtonElement>(null);
  const primaryPanelRef = useRef<HTMLDivElement | null>(null);

  const [effortTopOffset, setEffortTopOffset] = useState(0);
  const [modelsTopOffset, setModelsTopOffset] = useState(0);

  useEffect(() => {
    if (submenu === 'effort' && effortRowRef.current && primaryPanelRef.current) {
      const panelRect = primaryPanelRef.current.getBoundingClientRect();
      const rowRect = effortRowRef.current.getBoundingClientRect();
      setEffortTopOffset(rowRect.top - panelRect.top);
    }
    if (submenu === 'models' && modelsRowRef.current && primaryPanelRef.current) {
      const panelRect = primaryPanelRef.current.getBoundingClientRect();
      const rowRect = modelsRowRef.current.getBoundingClientRect();
      setModelsTopOffset(rowRect.top - panelRect.top);
    }
  }, [submenu]);

  // ── Close all + return focus ──────────────────────────────────────────────
  const closeAll = useCallback(() => {
    setPrimaryOpen(false);
    setSubmenu(null);
    setTimeout(() => composerRef?.current?.focus(), 80);
  }, [composerRef]);

  const handleModelSelect = (id: string) => {
    onModelChange(id);
    closeAll();
  };

  const handleEffortSelect = (e: EffortLevel) => {
    onEffortChange(e);
    closeAll();
  };

  // ── Trigger label ─────────────────────────────────────────────────────────
  const modelName = activeModel?.name ?? 'Select model';
  const showEffort = activeModel?.supportsReasoning && selectedEffort !== 'off';
  const effortLabel = activeEffortOption.label;

  return (
    <>
      {/* ── Trigger ── */}
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        aria-haspopup="menu"
        aria-expanded={primaryOpen}
        aria-label={`Model: ${modelName}${showEffort ? `, effort ${effortLabel}` : ''}. Change model`}
        className="flex items-center gap-[6px] h-[30px] px-[8px] rounded-[8px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]"
        style={{
          background: primaryOpen ? 'var(--bg-active)' : 'transparent',
          color: primaryOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          if (!primaryOpen) {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'var(--bg-hover)';
            el.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!primaryOpen) {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'transparent';
            el.style.color = 'var(--text-secondary)';
          }
        }}
      >
        <span
          className="text-[13.5px] font-[500] flex-shrink-0"
          style={{
            maxWidth: '18ch',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {modelName}
        </span>
        {showEffort && (
          <span
            className="text-[13.5px] font-[400] flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {effortLabel}
          </span>
        )}
        <IconChevronDown
          size={14}
          className="flex-shrink-0 transition-transform duration-150"
          style={{
            color: 'var(--text-muted)',
            transform: primaryOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* ── Primary menu ── */}
      {primaryOpen && (
        <FloatingPortal>
          <div
            ref={(node) => {
              refs.setFloating(node);
              (primaryPanelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }}
            {...getFloatingProps()}
            role="menu"
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
              zIndex: 9999,
              width: panelWidth,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,.5)',
              padding: 6,
              transformOrigin: isNewChat ? 'top right' : 'bottom right',
              animation: 'modelPickerEnter 120ms ease forwards',
            }}
          >
            {/* ── Model block rows ── */}
            {recommendedModels.map((model) => {
              const isActive = model.id === activeModel?.id;
              return (
                <button
                  key={model.id}
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => handleModelSelect(model.id)}
                  className="w-full flex items-start text-left transition-colors"
                  style={{
                    height: 48,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: isActive ? 'var(--bg-hover)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      isActive ? 'var(--bg-hover)' : 'transparent';
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {model.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text-muted)',
                        lineHeight: 1.3,
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {modelDescription(model)}
                    </div>
                  </div>
                  {model.supportsImages && (
                    <span title="Supports images in prompts" style={{ flexShrink: 0, marginTop: 2, marginLeft: 6, opacity: 0.7, display: 'flex' }}>
                      <IconCamera size={15} style={{ color: 'var(--text-muted)' }} />
                    </span>
                  )}
                  {isActive && (
                    <IconCheck
                      size={16}
                      className="flex-shrink-0 mt-[2px] ml-2"
                      style={{ color: 'var(--text-primary)' }}
                    />
                  )}
                </button>
              );
            })}

            {/* Spec §3.2: two dividers when Effort row is present, one when absent */}
            {activeModel?.supportsReasoning ? (
              <>
                {/* Divider 1 — model block → Effort */}
                <MenuDivider />
                <SubmenuRow
                  ref={effortRowRef}
                  label="Effort"
                  value={effortLabel}
                  isOpen={submenu === 'effort'}
                  onMouseEnter={() => openSubmenu('effort')}
                  onMouseLeave={scheduleClose}
                  onClick={() => setSubmenu(submenu === 'effort' ? null : 'effort')}
                />
                {/* Divider 2 — Effort → More models */}
                <MenuDivider />
              </>
            ) : (
              /* No effort row — single divider before More models */
              <MenuDivider />
            )}

            {/* ── More models row ── */}
            <SubmenuRow
              ref={modelsRowRef}
              label="More models"
              isOpen={submenu === 'models'}
              onMouseEnter={() => openSubmenu('models')}
              onMouseLeave={scheduleClose}
              onClick={() => setSubmenu(submenu === 'models' ? null : 'models')}
            />

            {/* ── Effort submenu (absolutely positioned relative to primary panel) ── */}
            {submenu === 'effort' && (
              <div
                style={{
                  position: 'absolute',
                  top: effortTopOffset,
                  left: 'calc(100% + 6px)',
                  zIndex: 10000,
                  animation: 'modelPickerEnter 120ms ease forwards',
                  transformOrigin: 'left top',
                }}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <EffortMenu selected={selectedEffort} onSelect={handleEffortSelect} />
              </div>
            )}

            {/* ── More models submenu ── */}
            {submenu === 'models' && (
              <div
                style={{
                  position: 'absolute',
                  top: modelsTopOffset,
                  left: 'calc(100% + 6px)',
                  zIndex: 10000,
                  animation: 'modelPickerEnter 120ms ease forwards',
                  transformOrigin: 'left top',
                }}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <MoreModelsMenu
                  models={allModels}
                  selectedId={activeModel?.id}
                  defaultModelId={defaultModelId}
                  onSelect={handleModelSelect}
                />
              </div>
            )}
          </div>
        </FloatingPortal>
      )}

      <style>{`
        @keyframes modelPickerEnter {
          from { opacity: 0; transform: translateY(4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </>
  );
};

export default ModelPicker;
