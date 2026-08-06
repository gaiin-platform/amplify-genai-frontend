/**
 * AttachMenu — spec-compliant ⊕ attach/tools menu for the new UI composer.
 * Ref: attach-menu-spec.md
 *
 * Three groups, two dividers:
 *   GROUP 1 — Bring something in
 *     • Add files or photos  ⌘U  (featureFlags.uploadDocuments)
 *     • Add from library  ›       (featureFlags.dataSourceSelectorOnInput)
 *   GROUP 2 — Extend what's available
 *     • Skills  ›                 (featureFlags.skills + SKILLS plugin)
 *     • Connectors  ›             (featureFlags.integrations → settings)
 *   GROUP 3 — Mode toggles (stay open on activate)
 *     • Web search  ✓             (featureFlags.webSearch + WEB_SEARCH plugin)
 *
 * No Projects, no Deep Research, no Screenshots (excluded per product direction).
 *
 * Trigger: 30×30, ⊕ glyph, rotates 45° → × while open (spec §2).
 * Badge dot: shown when any toggle is active (web search on).
 * Panel: 246px, Floating UI, flips up/down based on available space (spec §3).
 * Active chips: shown in toolbar when toggles are on (spec §6).
 */
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  IconPaperclip,
  IconBooks,
  IconBrain,
  IconPlug,
  IconWorldSearch,
  IconCheck,
  IconChevronRight,
  IconX,
  IconPlus,
  IconRobot,
  IconSearch,
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
import { PluginID, Plugin } from '@/types/plugin';
import { getUserSkills } from '@/services/skillsService';
import { Skill } from '@/types/skill';
import { Assistant, DEFAULT_ASSISTANT } from '@/types/assistant';
import { LayeredAssistant } from '@/types/layeredAssistant';
import { isAssistant } from '@/utils/app/assistants';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AttachMenuProps {
  /** Whether the composer is on the landing (opens downward) vs docked (opens upward) */
  isNewChat?: boolean;
  /** Plugins currently active — used to gate web search */
  plugins: Plugin[];
  /** Called when user picks "Add files" */
  onAddFiles: () => void;
  /** Called when user picks "Add from library" */
  onAddFromLibrary: () => void;
  /** Current web search toggle state */
  webSearchEnabled: boolean;
  /** Called to toggle web search */
  onToggleWebSearch: () => void;
  /** Currently selected skill IDs */
  selectedSkillIds: string[];
  /** Called when skills selection changes */
  onSkillsChange: (ids: string[]) => void;
  /** chatEndpoint needed for skills service */
  chatEndpoint?: string;
  /** Ref to the composer — focus returned here after close */
  composerRef?: React.RefObject<{ focus: () => void }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MenuDivider
// ─────────────────────────────────────────────────────────────────────────────

const MenuDivider: React.FC = () => (
  <div
    style={{
      height: 1,
      background: 'var(--border-subtle)',
      margin: '5px 10px',
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// ActionRow — fires and closes menu
// ─────────────────────────────────────────────────────────────────────────────

const ActionRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
}> = ({ icon, label, shortcut, disabled, onClick }) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    onClick={onClick}
    className="w-full flex items-center gap-3 px-[10px] h-[35px] rounded-[8px] text-left transition-colors"
    style={{
      background: 'transparent',
      color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
      fontSize: 14,
      cursor: disabled ? 'default' : 'pointer',
    }}
    onMouseEnter={(e) => {
      if (!disabled)
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.background = 'transparent';
    }}
  >
    <span
      style={{
        width: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
      }}
    >
      {icon}
    </span>
    <span style={{ flex: 1 }}>{label}</span>
    {shortcut && (
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {shortcut}
      </span>
    )}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// SubmenuRow — shows chevron, stays filled while open
// ─────────────────────────────────────────────────────────────────────────────

const SubmenuRowEl = React.forwardRef<
  HTMLButtonElement,
  {
    icon: React.ReactNode;
    label: string;
    isOpen: boolean;
    disabled?: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
  }
>(({ icon, label, isOpen, disabled, onMouseEnter, onMouseLeave, onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    role="menuitem"
    aria-haspopup="menu"
    aria-expanded={isOpen}
    disabled={disabled}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    className="w-full flex items-center gap-3 px-[10px] h-[35px] rounded-[8px] text-left transition-colors"
    style={{
      background: isOpen ? 'var(--bg-active)' : 'transparent',
      color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
      fontSize: 14,
      cursor: disabled ? 'default' : 'pointer',
    }}
    onFocus={onMouseEnter}
    onBlur={onMouseLeave}
  >
    <span
      style={{
        width: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
      }}
    >
      {icon}
    </span>
    <span style={{ flex: 1 }}>{label}</span>
    <IconChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
  </button>
));
SubmenuRowEl.displayName = 'SubmenuRowEl';

// ─────────────────────────────────────────────────────────────────────────────
// ToggleRow — keeps menu open, shows check when active
// ─────────────────────────────────────────────────────────────────────────────

const ToggleRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
}> = ({ icon, label, checked, disabled, disabledReason, onClick }) => (
  <button
    type="button"
    role="menuitemcheckbox"
    aria-checked={checked}
    aria-disabled={disabled}
    title={disabled && disabledReason ? disabledReason : undefined}
    onClick={(e) => {
      e.stopPropagation(); // keep menu open
      if (!disabled) onClick();
    }}
    className="w-full flex items-center gap-3 px-[10px] h-[35px] rounded-[8px] text-left transition-colors"
    style={{
      background: 'transparent',
      color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
      fontSize: 14,
      cursor: disabled ? 'default' : 'pointer',
    }}
    onMouseEnter={(e) => {
      if (!disabled)
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.background = 'transparent';
    }}
  >
    <span
      style={{
        width: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
      }}
    >
      {icon}
    </span>
    <span style={{ flex: 1 }}>{label}</span>
    {checked && (
      <IconCheck size={16} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
    )}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Skills submenu panel
// ─────────────────────────────────────────────────────────────────────────────

const SkillsSubmenu: React.FC<{
  chatEndpoint: string;
  selectedSkillIds: string[];
  onToggle: (id: string) => void;
  onManage: () => void;
}> = ({ chatEndpoint, selectedSkillIds, onToggle, onManage }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getUserSkills(chatEndpoint)
      .then((r) => { if (r.success && r.data) setSkills(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chatEndpoint]);

  return (
    <div
      role="menu"
      aria-label="Skills"
      style={{
        width: 260,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '6px 0', maxHeight: 280, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            Loading…
          </div>
        )}
        {!loading && skills.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            No skills yet
          </div>
        )}
        {!loading && skills.map((skill) => {
          const isSelected = selectedSkillIds.includes(skill.id);
          return (
            <button
              key={skill.id}
              role="menuitemcheckbox"
              aria-checked={isSelected}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(skill.id);
              }}
              className="w-full flex items-center gap-3 px-[10px] h-[35px] rounded-[8px] text-left transition-colors"
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 14,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <IconBrain size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {skill.name}
              </span>
              {isSelected && (
                <IconCheck size={14} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <MenuDivider />
      <button
        onClick={onManage}
        className="w-full flex items-center gap-3 px-[10px] h-[35px] text-left transition-colors"
        style={{ fontSize: 14, color: 'var(--text-secondary)', background: 'transparent' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
        }}
      >
        Manage skills…
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Connectors submenu — links to settings
// ─────────────────────────────────────────────────────────────────────────────

const ConnectorsSubmenu: React.FC<{ onBrowse: () => void }> = ({ onBrowse }) => (
  <div
    role="menu"
    aria-label="Connectors"
    style={{
      width: 260,
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      boxShadow: '0 12px 32px rgba(0,0,0,.5)',
      overflow: 'hidden',
    }}
  >
    <div style={{ padding: '6px 0' }}>
      <div style={{ padding: '10px 14px 6px', fontSize: 13, color: 'var(--text-muted)' }}>
        Connect services to bring your data into conversations.
      </div>
    </div>
    <MenuDivider />
    <button
      onClick={onBrowse}
      className="w-full flex items-center gap-3 px-[10px] h-[35px] text-left transition-colors"
      style={{ fontSize: 14, color: 'var(--text-secondary)', background: 'transparent' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
      }}
    >
      Browse connectors…
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AssistantSubmenu — searchable list of available assistants
// ─────────────────────────────────────────────────────────────────────────────

const AssistantSubmenu: React.FC<{
  assistants: Assistant[];
  layeredAssistants: LayeredAssistant[];
  selectedAssistant: Assistant | null;
  onSelect: (assistant: Assistant) => void;
  onSelectLayered: (la: LayeredAssistant) => void;
  onClear: () => void;
}> = ({ assistants, layeredAssistants, selectedAssistant, onSelect, onSelectLayered, onClear }) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus search on open
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const term = search.toLowerCase();

  const filteredAssistants = assistants.filter(
    (a) =>
      a.definition.name.toLowerCase().includes(term) ||
      (a.definition.description ?? '').toLowerCase().includes(term),
  );

  const filteredLayered = layeredAssistants.filter(
    (la) =>
      la.name.toLowerCase().includes(term) ||
      (la.description ?? '').toLowerCase().includes(term),
  );

  const hasAny = filteredAssistants.length > 0 || filteredLayered.length > 0;
  const activeId = selectedAssistant?.id;
  const isDefaultSelected =
    !selectedAssistant || selectedAssistant.id === DEFAULT_ASSISTANT.id;

  const rowStyle = (isActive: boolean): React.CSSProperties => ({
    height: 35,
    padding: '0 12px',
    borderRadius: 8,
    background: isActive ? 'var(--bg-hover)' : 'transparent',
    color: 'var(--text-primary)',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
  });

  return (
    <div
      role="menu"
      aria-label="Add assistant"
      style={{
        width: 280,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        overflow: 'hidden',
      }}
    >
      {/* Search field */}
      <div style={{ padding: '8px 8px 4px', position: 'relative' }}>
        <IconSearch
          size={14}
          style={{
            position: 'absolute',
            left: 18,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
            marginTop: 4,
          }}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search assistants…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            height: 32,
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '0 10px 0 28px',
            fontSize: 13,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>

      {/* Scrollable list */}
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 6px' }}>
        {/* Default / no assistant option */}
        <button
          role="menuitemradio"
          aria-checked={isDefaultSelected}
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          style={rowStyle(isDefaultSelected)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isDefaultSelected ? 'var(--bg-hover)' : 'transparent'; }}
        >
          <IconRobot size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Standard conversation
          </span>
          {isDefaultSelected && (
            <IconCheck size={14} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
          )}
        </button>

        {/* Regular assistants */}
        {filteredAssistants.map((a) => {
          const isActive = activeId === a.id && !isDefaultSelected;
          return (
            <button
              key={a.id}
              role="menuitemradio"
              aria-checked={isActive}
              onClick={(e) => { e.stopPropagation(); onSelect(a); }}
              style={rowStyle(isActive)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isActive ? 'var(--bg-hover)' : 'transparent'; }}
            >
              <IconRobot size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>
                  {a.definition.name}
                </div>
                {a.definition.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.definition.description}
                  </div>
                )}
              </div>
              {isActive && (
                <IconCheck size={14} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
              )}
            </button>
          );
        })}

        {/* Layered / group assistants */}
        {filteredLayered.map((la) => {
          const isActive = activeId === la.assistantId;
          return (
            <button
              key={la.assistantId ?? la.name}
              role="menuitemradio"
              aria-checked={isActive}
              onClick={(e) => { e.stopPropagation(); onSelectLayered(la); }}
              style={rowStyle(isActive)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isActive ? 'var(--bg-hover)' : 'transparent'; }}
            >
              <IconRobot size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>
                  {la.name}
                </div>
                {la.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {la.description}
                  </div>
                )}
              </div>
              {isActive && (
                <IconCheck size={14} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
              )}
            </button>
          );
        })}

        {!hasAny && (
          <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
            No assistants found
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Active toggle chips — shown in toolbar when toggles are on (spec §6)
// ─────────────────────────────────────────────────────────────────────────────

export const AttachMenuChips: React.FC<{
  webSearchEnabled: boolean;
  onRemoveWebSearch: () => void;
  selectedSkillIds: string[];
  onRemoveSkills: () => void;
  assistantName?: string;
  onRemoveAssistant?: () => void;
}> = ({ webSearchEnabled, onRemoveWebSearch, selectedSkillIds, onRemoveSkills, assistantName, onRemoveAssistant }) => {
  const chips: React.ReactNode[] = [];

  if (webSearchEnabled) {
    chips.push(
      <div
        key="web-search"
        className="flex items-center gap-1 pl-2 rounded-[6px] text-[12.5px] flex-shrink-0"
        style={{
          height: 26,
          background: 'var(--bg-active)',
          color: 'var(--text-primary)',
        }}
      >
        <IconWorldSearch size={14} style={{ color: 'var(--text-secondary)' }} />
        <span>Web search</span>
        <button
          type="button"
          onClick={onRemoveWebSearch}
          className="flex items-center justify-center w-[22px] h-full rounded-r-[6px] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
          aria-label="Remove web search"
        >
          <IconX size={12} />
        </button>
      </div>
    );
  }

  if (selectedSkillIds.length > 0) {
    chips.push(
      <div
        key="skills"
        className="flex items-center gap-1 pl-2 rounded-[6px] text-[12.5px] flex-shrink-0"
        style={{
          height: 26,
          background: 'var(--bg-active)',
          color: 'var(--text-primary)',
        }}
      >
        <IconBrain size={14} style={{ color: 'var(--text-secondary)' }} />
        <span>{selectedSkillIds.length === 1 ? '1 skill' : `${selectedSkillIds.length} skills`}</span>
        <button
          type="button"
          onClick={onRemoveSkills}
          className="flex items-center justify-center w-[22px] h-full rounded-r-[6px] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
          aria-label="Remove skills"
        >
          <IconX size={12} />
        </button>
      </div>
    );
  }

  if (assistantName && onRemoveAssistant) {
    chips.push(
      <div
        key="assistant"
        className="flex items-center gap-1 pl-2 rounded-[6px] text-[12.5px] flex-shrink-0"
        style={{
          height: 26,
          background: 'var(--bg-active)',
          color: 'var(--text-primary)',
        }}
      >
        <IconRobot size={14} style={{ color: 'var(--text-secondary)' }} />
        <span className="max-w-[120px] truncate">{assistantName}</span>
        <button
          type="button"
          onClick={onRemoveAssistant}
          className="flex items-center justify-center w-[22px] h-full rounded-r-[6px] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          aria-label="Remove assistant"
        >
          <IconX size={12} />
        </button>
      </div>
    );
  }

  if (chips.length === 0) return null;

  return <>{chips}</>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const AttachMenu: React.FC<AttachMenuProps> = ({
  isNewChat = true,
  plugins,
  onAddFiles,
  onAddFromLibrary,
  webSearchEnabled,
  onToggleWebSearch,
  selectedSkillIds,
  onSkillsChange,
  chatEndpoint,
  composerRef,
}) => {
  const {
    state: { featureFlags, prompts, selectedAssistant, layeredAssistants, groups, availableModels, defaultModelId },
    dispatch,
    handleUpdateConversation,
  } = useContext(HomeContext);

  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [submenu, setSubmenu] = useState<'skills' | 'connectors' | 'library' | 'assistant' | null>(null);

  // Build assistant list from prompts (same as ChatInput)
  const availableAssistants: Assistant[] = (prompts ?? [])
    .filter(isAssistant)
    .map((p: any) => {
      const ast = p.data?.assistant;
      if (!ast) return null;
      if (p.groupId && !ast.definition?.groupId)
        return { ...ast, definition: { ...ast.definition, groupId: p.groupId } };
      return ast;
    })
    .filter(Boolean) as Assistant[];

  const allLayeredAssistants: LayeredAssistant[] = [
    ...(layeredAssistants ?? []),
    ...((groups ?? []) as any[]).flatMap((g: any) => g.layeredAssistants ?? []),
  ];

  const isDefaultAssistant = !selectedAssistant || selectedAssistant.id === DEFAULT_ASSISTANT.id;

  const handleAssistantSelect = (assistant: Assistant) => {
    dispatch({ field: 'selectedAssistant', value: assistant });
    // If assistant enforces a model, update the default for the next conversation
    const enforcedModelId = assistant?.definition?.data?.model;
    if (enforcedModelId && availableModels[enforcedModelId]) {
      // Store for sessionStorage pickup on conversation creation
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('amplify_pending_model_id', enforcedModelId);
      }
    }
    closeAll();
  };

  const handleLayeredAssistantSelect = (la: LayeredAssistant) => {
    const syntheticAssistant: Assistant = {
      id: la.assistantId!,
      definition: {
        name: la.name,
        description: la.description,
        assistantId: la.assistantId,
        instructions: '',
        tools: [],
        tags: [],
        fileKeys: [],
        dataSources: [],
        provider: 'amplify' as any,
        data: { isLayeredAssistant: true, ...(la.model ? { model: la.model } : {}) },
      },
    };
    dispatch({ field: 'selectedAssistant', value: syntheticAssistant });
    closeAll();
  };

  const handleClearAssistant = () => {
    dispatch({ field: 'selectedAssistant', value: DEFAULT_ASSISTANT });
    closeAll();
  };

  // Badge: any active toggle or non-default assistant
  const anyToggleActive = webSearchEnabled || selectedSkillIds.length > 0 || !isDefaultAssistant;

  // Feature gates
  const showFiles = featureFlags.uploadDocuments;
  const showLibrary = featureFlags.dataSourceSelectorOnInput;
  // Assistant selector: always show when there are assistants available
  const showAssistant = availableAssistants.length > 0 || allLayeredAssistants.length > 0;
  const showSkills =
    featureFlags.skills && plugins?.some((p) => p.id === PluginID.SKILLS) && !!chatEndpoint;
  const showConnectors = featureFlags.integrations;
  const showWebSearch =
    featureFlags.webSearch && plugins?.some((p) => p.id === PluginID.WEB_SEARCH);

  const hasGroup1 = showFiles || showLibrary || showAssistant;
  const hasGroup2 = showSkills || showConnectors;
  const hasGroup3 = showWebSearch;

  // Floating UI — same flip pattern as model picker
  const placement = isNewChat ? 'bottom-start' : 'top-start';

  const { refs, x, y, strategy, context } = useFloating({
    open: primaryOpen,
    onOpenChange: (o: boolean) => {
      setPrimaryOpen(o);
      if (!o) setSubmenu(null);
    },
    placement,
    middleware: [offset(6), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  } as any);

  const clickInteraction = useClick(context);
  const dismissInteraction = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([
    clickInteraction,
    dismissInteraction,
  ]);

  // Hover-intent for submenus
  const submenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openSubmenu = useCallback((which: typeof submenu) => {
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
  useEffect(() => () => { if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current); }, []);

  // Submenu position tracking
  const libraryRowRef = useRef<HTMLButtonElement>(null);
  const skillsRowRef = useRef<HTMLButtonElement>(null);
  const connectorsRowRef = useRef<HTMLButtonElement>(null);
  const assistantRowRef = useRef<HTMLButtonElement>(null);
  const primaryPanelRef = useRef<HTMLDivElement | null>(null);

  const [libraryTop, setLibraryTop] = useState(0);
  const [skillsTop, setSkillsTop] = useState(0);
  const [connectorsTop, setConnectorsTop] = useState(0);
  const [assistantTop, setAssistantTop] = useState(0);

  useEffect(() => {
    const getOffset = (rowRef: React.RefObject<HTMLButtonElement>) => {
      if (!rowRef.current || !primaryPanelRef.current) return 0;
      const panelRect = primaryPanelRef.current.getBoundingClientRect();
      const rowRect = rowRef.current.getBoundingClientRect();
      return rowRect.top - panelRect.top;
    };
    if (submenu === 'library') setLibraryTop(getOffset(libraryRowRef));
    if (submenu === 'skills') setSkillsTop(getOffset(skillsRowRef));
    if (submenu === 'connectors') setConnectorsTop(getOffset(connectorsRowRef));
    if (submenu === 'assistant') setAssistantTop(getOffset(assistantRowRef));
  }, [submenu]);

  const closeAll = useCallback(() => {
    setPrimaryOpen(false);
    setSubmenu(null);
    setTimeout(() => composerRef?.current?.focus(), 80);
  }, [composerRef]);

  // Open settings modal to a specific section
  const openSettings = (section: string) => {
    closeAll();
    window.dispatchEvent(new CustomEvent('openNewUISettingsSection', { detail: { section } }));
  };

  // Skills toggle handler
  const handleSkillToggle = (id: string) => {
    const next = selectedSkillIds.includes(id)
      ? selectedSkillIds.filter((s) => s !== id)
      : [...selectedSkillIds, id];
    onSkillsChange(next);
  };

  return (
    <>
      {/* ── Trigger ── */}
      <div className="relative flex-shrink-0">
        <button
          ref={refs.setReference}
          {...getReferenceProps()}
          type="button"
          aria-haspopup="menu"
          aria-expanded={primaryOpen}
          aria-label={`Add to chat${anyToggleActive ? '. Tools active.' : ''}`}
          className="w-[30px] h-[30px] flex items-center justify-center rounded-[8px] transition-all duration-[140ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]"
          style={{
            background: primaryOpen ? 'var(--bg-active)' : 'transparent',
            color: primaryOpen ? 'var(--text-primary)' : 'var(--text-muted)',
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
              el.style.color = 'var(--text-muted)';
            }
          }}
        >
          <IconPlus
            size={20}
            style={{
              transition: 'transform 140ms ease',
              transform: primaryOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            }}
          />
        </button>

        {/* Badge dot — any toggle active */}
        {anyToggleActive && !primaryOpen && (
          <span
            className="absolute top-0 right-0 w-[8px] h-[8px] rounded-full pointer-events-none"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 0 0 2px var(--bg-raised)',
              transform: 'translate(25%, -25%)',
            }}
          />
        )}
      </div>

      {/* ── Primary panel ── */}
      {primaryOpen && (
        <FloatingPortal>
          <div
            ref={(node) => {
              refs.setFloating(node);
              (primaryPanelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }}
            {...getFloatingProps()}
            role="menu"
            aria-label="Add to chat"
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
              zIndex: 9999,
              width: 246,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,.5)',
              padding: 6,
              transformOrigin: isNewChat ? 'top left' : 'bottom left',
              animation: 'attachMenuEnter 120ms ease forwards',
            }}
          >
            {/* ── Group 1: Bring something in ── */}
            {hasGroup1 && (
              <>
                {showFiles && (
                  <ActionRow
                    icon={<IconPaperclip size={18} />}
                    label="Add files or photos"
                    shortcut="⌘U"
                    onClick={() => { onAddFiles(); closeAll(); }}
                  />
                )}
                {showLibrary && (
                  <SubmenuRowEl
                    ref={libraryRowRef}
                    icon={<IconBooks size={18} />}
                    label="Add from library"
                    isOpen={submenu === 'library'}
                    onMouseEnter={() => openSubmenu('library')}
                    onMouseLeave={scheduleClose}
                    onClick={() => { onAddFromLibrary(); closeAll(); }}
                  />
                )}
                {showAssistant && (
                  <SubmenuRowEl
                    ref={assistantRowRef}
                    icon={<IconRobot size={18} />}
                    label="Add assistant"
                    isOpen={submenu === 'assistant'}
                    onMouseEnter={() => openSubmenu('assistant')}
                    onMouseLeave={scheduleClose}
                    onClick={() => setSubmenu(submenu === 'assistant' ? null : 'assistant')}
                  />
                )}
              </>
            )}

            {/* Divider 1 */}
            {hasGroup1 && hasGroup2 && <MenuDivider />}

            {/* ── Group 2: Extend what's available ── */}
            {hasGroup2 && (
              <>
                {showSkills && chatEndpoint && (
                  <SubmenuRowEl
                    ref={skillsRowRef}
                    icon={<IconBrain size={18} />}
                    label="Skills"
                    isOpen={submenu === 'skills'}
                    onMouseEnter={() => openSubmenu('skills')}
                    onMouseLeave={scheduleClose}
                    onClick={() => setSubmenu(submenu === 'skills' ? null : 'skills')}
                  />
                )}
                {showConnectors && (
                  <SubmenuRowEl
                    ref={connectorsRowRef}
                    icon={<IconPlug size={18} />}
                    label="Add connector"
                    isOpen={submenu === 'connectors'}
                    onMouseEnter={() => openSubmenu('connectors')}
                    onMouseLeave={scheduleClose}
                    onClick={() => setSubmenu(submenu === 'connectors' ? null : 'connectors')}
                  />
                )}
              </>
            )}

            {/* Divider 2 */}
            {(hasGroup1 || hasGroup2) && hasGroup3 && <MenuDivider />}

            {/* ── Group 3: Mode toggles ── */}
            {hasGroup3 && (
              <ToggleRow
                icon={<IconWorldSearch size={18} />}
                label="Web search"
                checked={webSearchEnabled}
                onClick={onToggleWebSearch}
              />
            )}

            {/* ── Skills submenu ── */}
            {submenu === 'skills' && chatEndpoint && (
              <div
                style={{
                  position: 'absolute',
                  top: skillsTop,
                  left: 'calc(100% + 6px)',
                  zIndex: 10000,
                  animation: 'attachMenuEnter 120ms ease forwards',
                  transformOrigin: 'left top',
                }}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <SkillsSubmenu
                  chatEndpoint={chatEndpoint}
                  selectedSkillIds={selectedSkillIds}
                  onToggle={handleSkillToggle}
                  onManage={() => { openSettings('skills'); }}
                />
              </div>
            )}

            {/* ── Connectors submenu ── */}
            {submenu === 'connectors' && (
              <div
                style={{
                  position: 'absolute',
                  top: connectorsTop,
                  left: 'calc(100% + 6px)',
                  zIndex: 10000,
                  animation: 'attachMenuEnter 120ms ease forwards',
                  transformOrigin: 'left top',
                }}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <ConnectorsSubmenu onBrowse={() => { openSettings('connectors'); }} />
              </div>
            )}

            {/* ── Assistant submenu ── */}
            {submenu === 'assistant' && (
              <div
                style={{
                  position: 'absolute',
                  top: assistantTop,
                  left: 'calc(100% + 6px)',
                  zIndex: 10000,
                  animation: 'attachMenuEnter 120ms ease forwards',
                  transformOrigin: 'left top',
                }}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <AssistantSubmenu
                  assistants={availableAssistants}
                  layeredAssistants={allLayeredAssistants}
                  selectedAssistant={selectedAssistant}
                  onSelect={handleAssistantSelect}
                  onSelectLayered={handleLayeredAssistantSelect}
                  onClear={handleClearAssistant}
                />
              </div>
            )}
          </div>
        </FloatingPortal>
      )}

      <style>{`
        @keyframes attachMenuEnter {
          from { opacity: 0; transform: translateY(4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
};

export default AttachMenu;
