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
 * Positioning: Floating UI throughout — primary panel AND both submenus
 *   (submenus use the shared flip/shift stack in ./menuPositioning, so they
 *   never clip against a viewport edge). See NEW_UI_DOCS.md Phase 48.
 * Hover previews: "More models" rows show a model detail card (./InfoFloatCard).
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
import {
  InfoCardMeta,
  InfoCardPill,
  InfoCardPills,
  InfoCardText,
  InfoCardTitle,
  InfoFloatCard,
  useInfoCardHover,
} from './InfoFloatCard';
import { SUBMENU_PLACEMENT, submenuMiddleware, submenuStyle } from './menuPositioning';

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

/**
 * Was `position: absolute; bottom: calc(100% + 6px)` inside the row — which the
 * EffortMenu panel's `overflow: hidden` clipped, so any part of the text that
 * hung outside the 320px panel was simply cut off.
 *
 * Now portalled + positioned by Floating UI, so the full text is always visible:
 * prefers above the ⓘ, falls back to below/right/left, and shifts to stay inside
 * the viewport. Still `pointer-events: none` so it can't trip the menu's
 * useDismiss or swallow a click on the row underneath.
 */
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  const id = useId();

  const { refs, x, y, strategy } = useFloating({
    open: show,
    placement: 'top',
    strategy: 'fixed',
    middleware: [
      offset(6),
      flip({ fallbackPlacements: ['bottom', 'right', 'left'] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  } as any);

  return (
    <span className="relative inline-flex items-center ml-1 flex-shrink-0">
      <button
        ref={refs.setReference}
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
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            id={id}
            role="tooltip"
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
              visibility: x == null ? 'hidden' : 'visible',
              width: 220,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '8px 12px',
              pointerEvents: 'none',
              // Above the effort submenu (10000) and the hover cards (10001)
              zIndex: 10002,
              boxShadow: '0 8px 24px rgba(0,0,0,.35)',
              fontSize: 12.5,
              lineHeight: 1.45,
              color: 'var(--text-secondary)',
              whiteSpace: 'normal',
            }}
          >
            {text}
          </div>
        </FloatingPortal>
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
// Model hover-preview card (Phase 48 / Fix 2)
//
// Card shell + positioning live in ./InfoFloatCard — this is only the content.
// Everything shown is read straight off the `Model` object (types/model.ts);
// there is no static per-model metadata table in the codebase to consult.
// ─────────────────────────────────────────────────────────────────────────────

/** Context windows at or above this read as "Large context". */
const LARGE_CONTEXT_THRESHOLD = 128_000;

/** 200000 → "200K", 1000000 → "1M". */
function formatTokenCount(n: number): string {
  if (n >= 1_000_000) {
    const millions = n / 1_000_000;
    return `${Number.isInteger(millions) ? millions : Math.round(millions * 10) / 10}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * Deliberately NOT shown (product decision, Phase 48b): the raw model id and the
 * provider/vendor. The display name carries enough, and both extras made the card
 * read as debug output. Don't re-add them without asking.
 */
const ModelCardBody: React.FC<{ model: Model }> = ({ model }) => {
  const capabilities: string[] = [];
  if (model.supportsImages) capabilities.push('Vision');
  if (model.supportsReasoning) capabilities.push('Reasoning');
  if (model.inputContextWindow >= LARGE_CONTEXT_THRESHOLD) capabilities.push('Large context');

  const description = (model.description ?? '').trim();

  return (
    <>
      <InfoCardTitle>{model.name}</InfoCardTitle>

      {description && <InfoCardText lines={2}>{description}</InfoCardText>}

      {capabilities.length > 0 && (
        <InfoCardPills>
          {capabilities.map((c) => (
            <InfoCardPill key={c}>{c}</InfoCardPill>
          ))}
        </InfoCardPills>
      )}

      {/* Skipped entirely when the backend didn't send a context window */}
      {model.inputContextWindow > 0 && (
        <InfoCardMeta>Context: {formatTokenCount(model.inputContextWindow)} tokens</InfoCardMeta>
      )}
    </>
  );
};

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

  // Hover-preview card — 250ms in / 200ms out, right of the row, flips left when
  // the viewport has no room. Unmounts with this submenu, so no cleanup needed.
  const card = useInfoCardHover<Model>();

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
              onClick={() => { card.hideNow(); onSelect(model.id); }}
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
                card.show(model, e.currentTarget);
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  isSelected ? 'var(--bg-hover)' : 'transparent';
                card.hide();
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

      {/* Hover-preview card — portalled out so the scroll container can't clip it */}
      {card.item && (
        <InfoFloatCard anchor={card.anchor}>
          <ModelCardBody model={card.item} />
        </InfoFloatCard>
      )}
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

  // Hover-preview card for the recommended slate (the Opus/Sonnet/Haiku rows in
  // the primary panel). Same card the "More models" submenu rows use — the
  // recommended rows are still models, so they get the same detail treatment.
  // Lives here rather than in a submenu component, so it must be dismissed
  // explicitly when the panel closes or a submenu opens (see below).
  const primaryCard = useInfoCardHover<Model>();

  // Spec §3: expanded opens downward (new chat), collapsed opens upward (conversation)
  const placement = isNewChat ? 'bottom-end' : 'top-end';
  const panelWidth = isNewChat ? 280 : 220;

  const { refs, x, y, strategy, context } = useFloating({
    open: primaryOpen,
    onOpenChange: (o: boolean) => {
      setPrimaryOpen(o);
      if (!o) {
        setSubmenu(null);
        // Otherwise `item` stays set and the card reappears on next open
        primaryCard.hideNow();
      }
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
    // A submenu panel opens over the space the card occupies — drop it first.
    primaryCard.hideNow();
    submenuTimerRef.current = setTimeout(() => setSubmenu(which), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Submenu positioning (Phase 48 / Fix 3) ────────────────────────────────
  // Was: `position: absolute` + a measured `top` offset + `left: calc(100% + 6px)`,
  // which was blind to the viewport and clipped on small windows / near edges.
  // Now: one Floating UI instance per submenu with flip + shift.
  // See ./menuPositioning for the middleware stack and the strategy rationale.
  const effortRowRef = useRef<HTMLButtonElement>(null);
  const modelsRowRef = useRef<HTMLButtonElement>(null);
  const primaryPanelRef = useRef<HTMLDivElement | null>(null);

  const effortFloating = useFloating({
    open: submenu === 'effort',
    placement: SUBMENU_PLACEMENT,
    middleware: submenuMiddleware(),
    whileElementsMounted: autoUpdate,
  } as any);

  const modelsFloating = useFloating({
    open: submenu === 'models',
    placement: SUBMENU_PLACEMENT,
    middleware: submenuMiddleware(),
    whileElementsMounted: autoUpdate,
  } as any);

  // Bind each submenu's reference to its trigger row when that submenu opens.
  // Done in an effect rather than an inline callback ref: an inline ref would be
  // invoked with (null, node) on every render and thrash setReference's state.
  useEffect(() => {
    if (submenu === 'effort') effortFloating.refs.setReference(effortRowRef.current);
    if (submenu === 'models') modelsFloating.refs.setReference(modelsRowRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submenu]);

  // ── Close all + return focus ──────────────────────────────────────────────
  const closeAll = useCallback(() => {
    setPrimaryOpen(false);
    setSubmenu(null);
    primaryCard.hideNow();
    setTimeout(() => composerRef?.current?.focus(), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            aria-label="Select model"
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
                    primaryCard.show(model, e.currentTarget);
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      isActive ? 'var(--bg-hover)' : 'transparent';
                    primaryCard.hide();
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

            {/* ── Effort submenu (Floating UI: right-start, flips left/below) ── */}
            {submenu === 'effort' && (
              <div
                ref={effortFloating.refs.setFloating}
                style={submenuStyle(effortFloating, 'modelPickerEnter')}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <EffortMenu selected={selectedEffort} onSelect={handleEffortSelect} />
              </div>
            )}

            {/* ── More models submenu ── */}
            {submenu === 'models' && (
              <div
                ref={modelsFloating.refs.setFloating}
                style={submenuStyle(modelsFloating, 'modelPickerEnter')}
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

            {/* Hover-preview card for the recommended model rows */}
            {primaryCard.item && (
              <InfoFloatCard anchor={primaryCard.anchor}>
                <ModelCardBody model={primaryCard.item} />
              </InfoFloatCard>
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
