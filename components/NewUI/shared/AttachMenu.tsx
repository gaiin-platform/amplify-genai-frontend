/**
 * AttachMenu — spec-compliant ⊕ attach/tools menu for the new UI composer.
 * Ref: attach-menu-spec.md
 *
 * Three groups, two dividers:
 *   GROUP 1 — Bring something in
 *     • Add files or photos  ⌘U  (featureFlags.uploadDocuments)
 *     • Add from library  ›       (featureFlags.dataSourceSelectorOnInput)
 *         → opens shared/DataSourceLibraryPicker, NOT the local file picker.
 *           These are two different intents: one uploads new bytes, the other
 *           attaches something already in S3.
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
import toast from 'react-hot-toast';
import HomeContext from '@/pages/api/home/home.context';
import { PluginID, Plugin } from '@/types/plugin';
import { getUserSkills } from '@/services/skillsService';
import { Skill } from '@/types/skill';
import { Assistant, DEFAULT_ASSISTANT } from '@/types/assistant';
import { isRealAssistant } from '@/components/NewUI/shared/useConversationAssistant';
import { LayeredAssistant } from '@/types/layeredAssistant';
import { Prompt } from '@/types/prompt';
import { isAssistant, isSystemAssistant } from '@/utils/app/assistants';
import { useIntegrationConnections, type IntegrationConnection } from './useIntegrationConnections';
import { integrationIcon } from './integrationIcon';
import { listIntegrationFiles, downloadIntegrationFile } from '@/services/oauthIntegrationsService';
import { IntegrationFileRecord } from '@/types/integrations';
import {
  COMPOSITE_FUNCTION_CATEGORIES,
  type CompositeFunction,
} from '@/utils/app/compositeFunctions';
import { getOpsForUser } from '@/services/opsService';
import { filterSupportedIntegrationOps } from '@/utils/app/ops';
import { isCompositeAvailable, resolveOps } from '@/components/NewUI/views/assistant/toolSelectionModel';
import type { OpDef } from '@/types/op';
import {
  InfoCardItalic,
  InfoCardMeta,
  InfoCardPill,
  InfoCardPills,
  InfoCardText,
  InfoCardTitle,
  InfoFloatCard,
  useInfoCardHover,
} from './InfoFloatCard';
import { SUBMENU_PLACEMENT, submenuMiddleware, submenuStyle } from './menuPositioning';
import {
  DataSourceLibraryPicker,
  type PickedLibraryFile,
} from './DataSourceLibraryPicker';

// ─────────────────────────────────────────────────────────────────────────────
// Integration display helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Known integration ids → human-readable display names. */
const CONNECTOR_DISPLAY_NAMES: Record<string, string> = {
  microsoft_drive:       'OneDrive',
  microsoft_sharepoint:  'SharePoint',
  microsoft_calendar:    'Outlook Calendar',
  microsoft_outlook:     'Outlook Mail',
  microsoft_exchange:    'Exchange',
  microsoft_excel:       'Excel Online',
  microsoft_onenote:     'OneNote',
  microsoft_planner:     'Planner',
  microsoft_teams:       'Teams',
  microsoft_contacts:    'Outlook Contacts',
  microsoft_word:        'Word Online',
  microsoft_user_groups: 'User Groups',
  google_drive:          'Google Drive',
  google_sheets:         'Google Sheets',
  google_docs:           'Google Docs',
  google_calendar:       'Google Calendar',
  google_gmail:          'Gmail',
  google_contacts:       'Google Contacts',
  google_forms:          'Google Forms',
};

/** Fallback descriptions used when the backend doesn't send one. */
const CONNECTOR_DESCRIPTIONS: Record<string, string> = {
  microsoft_drive:       'Browse and attach files from OneDrive.',
  microsoft_sharepoint:  'Browse and attach files from SharePoint sites.',
  microsoft_calendar:    'Gives AI access to your calendar events and scheduling.',
  microsoft_outlook:     'Gives AI access to your email, drafts, and folders.',
  microsoft_exchange:    'Gives AI access to your Exchange mailbox and contacts.',
  microsoft_excel:       'Browse and attach Excel workbooks from OneDrive.',
  microsoft_onenote:     'Gives AI access to your OneNote notebooks.',
  microsoft_planner:     'Gives AI access to your Planner tasks and plans.',
  microsoft_teams:       'Gives AI access to Teams channels and messages.',
  microsoft_contacts:    'Gives AI access to your Outlook contact list.',
  microsoft_word:        'Browse and attach Word documents from OneDrive.',
  microsoft_user_groups: 'Gives AI access to user group membership.',
  google_drive:          'Browse and attach files from Google Drive.',
  google_sheets:         'Browse and attach Google Sheets spreadsheets.',
  google_docs:           'Browse and attach Google Docs documents.',
  google_calendar:       'Gives AI access to your Google Calendar events.',
  google_gmail:          'Gives AI access to your Gmail messages.',
  google_contacts:       'Gives AI access to your Google contacts.',
  google_forms:          'Gives AI access to your Google Forms responses.',
};

/** Returns the human-readable name for a connector, preferring the backend name. */
const connectorDisplayName = (conn: IntegrationConnection): string =>
  conn.name ||
  CONNECTOR_DISPLAY_NAMES[conn.id] ||
  conn.id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Returns a short description for the connector, preferring the backend description. */
const connectorDescription = (conn: IntegrationConnection): string =>
  conn.description || CONNECTOR_DESCRIPTIONS[conn.id] || '';

/**
 * True for integrations that expose a file-system browser (drive, sharepoint,
 * google_drive, google_sheets, google_docs). Mirrors the rule used by
 * DataSourceSelector → getDriveFileIntegrationTypes plus document-type services.
 */
const isFileIntegration = (id: string): boolean =>
  id.includes('drive') ||
  id.includes('sharepoint') ||
  id.includes('excel') ||
  id.includes('sheets') ||
  id.includes('docs') ||
  id.includes('word');

/** Width/list height of the library submenu panel (spec §3 nested panel). */
const LIBRARY_PANEL_WIDTH = 380;
const LIBRARY_LIST_HEIGHT = 240;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A resolved connector action — a CompositeFunction with its ops ready to send. */
export interface SelectedAction {
  fnId: string;
  /** Human-readable composite function name (e.g. "Send Email") */
  name: string;
  /** Resolved configuredTools entries — one per op in the composite function. */
  ops: Array<{ name: string; operation: any }>;
}

export interface AttachMenuProps {
  /** Whether the composer is on the landing (opens downward) vs docked (opens upward) */
  isNewChat?: boolean;
  /** Plugins currently active — used to gate web search */
  plugins: Plugin[];
  /** Called when user picks "Add files" — opens the local file picker */
  onAddFiles: () => void;
  /**
   * Called with the files the user committed in the "Add from library" panel.
   * These are ALREADY UPLOADED — the receiver must attach them by key and must
   * not push them back through the upload pipeline.
   */
  onAddFromLibrary: (files: PickedLibraryFile[]) => void;
  /**
   * Ids already sitting in the composer's rail. Those rows render as "Added" so
   * the same file can't be attached twice.
   */
  attachedLibraryIds?: string[];
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
  /**
   * Called when the user picks a file from a connected integration (e.g. OneDrive).
   * The file is already downloaded — pass it to the composer's attachment intake.
   */
  onAddIntegrationFile?: (file: File) => void;
  /**
   * Currently selected connector actions (for display in chips and check marks).
   */
  selectedActions?: SelectedAction[];
  /**
   * Called when the user toggles a connector action on/off.
   * Receives the full updated list (caller may replace state directly).
   */
  onActionsChange?: (actions: SelectedAction[]) => void;
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
      <div style={{ padding: '6px 0', maxHeight: 280, overflowY: 'auto' }} aria-live="polite" aria-busy={loading}>
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
// ConnectorFilePicker — lightweight file browser for one connected integration
// ─────────────────────────────────────────────────────────────────────────────

/** /folder|directory|site|library/i — same rule as DataSourcesTableScrollingIntegrations */
const isFolderRecord = (r: IntegrationFileRecord): boolean =>
  /folder|directory|site|library/i.test(r.mimeType ?? '');

const ConnectorFilePicker: React.FC<{
  integration: IntegrationConnection;
  onBack: () => void;
  onFileSelect?: (file: File) => void;
}> = ({ integration, onBack, onFileSelect }) => {
  const integrationId = integration.id;
  const [records, setRecords] = useState<IntegrationFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folderTrail, setFolderTrail] = useState<{ id: string; name: string }[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  const currentFolderId = folderTrail.length > 0
    ? folderTrail[folderTrail.length - 1].id
    : undefined;

  // Re-armed per guide §16 so StrictMode's simulated unmount doesn't latch false.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!alive.current) return;
    setLoading(true);
    setError(null);
    listIntegrationFiles({
      integration: integrationId,
      ...(currentFolderId ? { folder_id: currentFolderId } : {}),
    })
      .then((result) => {
        if (!alive.current) return;
        if (result?.success) {
          setRecords(result.data ?? []);
        } else {
          setError('Unable to load files.');
        }
      })
      .catch(() => { if (alive.current) setError('Unable to load files.'); })
      .finally(() => { if (alive.current) setLoading(false); });
  }, [integrationId, currentFolderId]);

  const handleItemClick = async (record: IntegrationFileRecord) => {
    if (isFolderRecord(record)) {
      setFolderTrail((prev) => [...prev, { id: record.id, name: record.name }]);
      return;
    }
    if (!onFileSelect) return;

    setDownloading(record.id);
    try {
      const dlResult = await downloadIntegrationFile({
        integration: integrationId,
        file_id: record.id,
        direct_download: false,
      });
      if (!dlResult?.success || !dlResult.data) {
        toast.error('Could not download the file.');
        return;
      }
      const response = await fetch(dlResult.data as string);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const file = new File([blob], record.name, {
        type: blob.type || 'application/octet-stream',
        lastModified: Date.now(),
      });
      onFileSelect(file);
    } catch {
      toast.error('Could not download the file. Please try again.');
    } finally {
      if (alive.current) setDownloading(null);
    }
  };

  const handleBack = () => {
    if (folderTrail.length > 0) {
      setFolderTrail((prev) => prev.slice(0, -1));
    } else {
      onBack();
    }
  };

  const displayName = connectorDisplayName(integration);
  const title = folderTrail.length > 0
    ? folderTrail[folderTrail.length - 1].name
    : displayName;

  return (
    <div
      role="menu"
      aria-label={`Browse ${displayName}`}
      style={{
        width: 300,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px 6px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors flex-shrink-0"
          style={{ color: 'var(--text-muted)', background: 'transparent' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          <IconChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </div>

      {/* File list */}
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 6px' }}>
        {loading && (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            Loading…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-error)' }}>
            {error}
          </div>
        )}
        {!loading && !error && records.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            No files here
          </div>
        )}
        {!loading && !error && records.map((record) => {
          const isDir = isFolderRecord(record);
          const isDownloading = downloading === record.id;
          return (
            <button
              key={record.id}
              role="menuitem"
              onClick={() => !isDownloading && handleItemClick(record)}
              disabled={isDownloading}
              className="w-full flex items-center gap-3 px-[10px] h-[35px] rounded-[8px] text-left transition-colors"
              style={{
                background: 'transparent',
                color: isDownloading ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 13,
                cursor: isDownloading ? 'wait' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isDownloading)
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span
                style={{
                  width: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--text-secondary)',
                }}
              >
                {isDownloading ? (
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      border: '2px solid var(--accent)',
                      borderTopColor: 'transparent',
                      display: 'inline-block',
                      animation: 'connectorFileSpin 0.7s linear infinite',
                    }}
                  />
                ) : isDir ? (
                  <IconBooks size={15} />
                ) : (
                  <IconPaperclip size={14} />
                )}
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {record.name}
              </span>
              {isDir && (
                <IconChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>
      <style>{`
        @keyframes connectorFileSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Connectors submenu — shows connected integrations; falls back to "connect" prompt
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ConnectorActionsPanel — selectable composite functions for an integration
// ─────────────────────────────────────────────────────────────────────────────

/** Build a configuredTools entry from one op — same shape as ChatInput.addedActions */
const opToConfiguredTool = (op: OpDef) => ({
  name: op.name,
  operation: {
    tool_name: op.name,
    name: op.name,
    description: op.description,
    id: op.name,
    type: op.type ?? '',
    parameters: op.parameters,
    tags: op.tags ?? [],
    bindings: op.bindings,
    method: op.method,
  },
});

const ConnectorActionsPanel: React.FC<{
  integration: IntegrationConnection;
  selectedActions: SelectedAction[];
  onActionsChange: (actions: SelectedAction[]) => void;
  onBack: () => void;
  onManage: () => void;
}> = ({ integration, selectedActions, onActionsChange, onBack, onManage }) => {
  const [availableOps, setAvailableOps] = useState<OpDef[] | null>(null);
  const [loadingOps, setLoadingOps] = useState(true);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Categories for this integration
  const categories = COMPOSITE_FUNCTION_CATEGORIES.filter((cat) =>
    cat.integrationIds.includes(integration.id),
  );
  const allFunctions: CompositeFunction[] = categories.flatMap((cat) => cat.functions);

  // Load available ops to check which functions are actually enabled on the backend
  useEffect(() => {
    if (allFunctions.length === 0) { setLoadingOps(false); return; }
    getOpsForUser()
      .then(async (result) => {
        if (!alive.current) return;
        if (result.success) {
          const filtered = await filterSupportedIntegrationOps(result.data);
          if (alive.current) setAvailableOps((filtered ?? []) as OpDef[]);
        } else {
          if (alive.current) setAvailableOps([]);
        }
      })
      .catch(() => { if (alive.current) setAvailableOps([]); })
      .finally(() => { if (alive.current) setLoadingOps(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration.id]);

  if (allFunctions.length === 0) {
    // No composite categories for this integration — render info panel instead
    return (
      <ConnectorInfoPanel
        integration={integration}
        onBack={onBack}
        onManage={onManage}
      />
    );
  }

  const selectedIds = new Set(selectedActions.map((a) => a.fnId));

  const handleToggle = (fn: CompositeFunction) => {
    if (selectedIds.has(fn.id)) {
      // Remove
      onActionsChange(selectedActions.filter((a) => a.fnId !== fn.id));
    } else {
      // Add — resolve ops immediately so they're ready when the message fires
      const ops = availableOps ? resolveOps(fn, availableOps).map(opToConfiguredTool) : [];
      onActionsChange([...selectedActions, { fnId: fn.id, name: fn.name, ops }]);
    }
  };

  const name = connectorDisplayName(integration);

  return (
    <div
      role="menu"
      aria-label={name}
      style={{
        width: 300,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px 6px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors flex-shrink-0"
          style={{ color: 'var(--text-muted)', background: 'transparent' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          <IconChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          {integrationIcon(integration.id, 16)}
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
        </span>
      </div>

      {/* Action list */}
      <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 6px' }}>
        {loadingOps && (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            Loading actions…
          </div>
        )}
        {!loadingOps && allFunctions.map((fn) => {
          const available = availableOps === null || isCompositeAvailable(fn, availableOps);
          const checked = selectedIds.has(fn.id);
          return (
            <button
              key={fn.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              aria-disabled={!available}
              onClick={(e) => {
                e.stopPropagation();
                if (available) handleToggle(fn);
              }}
              className="w-full flex items-start gap-2 px-[10px] py-[7px] rounded-[8px] text-left transition-colors"
              style={{
                background: 'transparent',
                color: available ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 13,
                cursor: available ? 'pointer' : 'default',
                minHeight: 35,
              }}
              onMouseEnter={(e) => {
                if (available)
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {/* Checkbox slot */}
              <span
                style={{
                  width: 16,
                  height: 16,
                  marginTop: 1,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  border: checked ? 'none' : '1.5px solid var(--border-subtle)',
                  background: checked ? 'var(--accent)' : 'transparent',
                  color: 'var(--accent-fg)',
                }}
              >
                {checked && <IconCheck size={10} strokeWidth={3} />}
              </span>

              {/* Text */}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 500 }}>{fn.name}</span>
                {fn.description && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginTop: 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {fn.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

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
        Manage connector…
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ConnectorInfoPanel — shown for non-file integrations (calendar, mail, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const ConnectorInfoPanel: React.FC<{
  integration: IntegrationConnection;
  onBack: () => void;
  onManage: () => void;
}> = ({ integration, onBack, onManage }) => {
  const name = connectorDisplayName(integration);
  const desc = connectorDescription(integration);

  return (
    <div
      role="dialog"
      aria-label={name}
      style={{
        width: 280,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px 6px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors flex-shrink-0"
          style={{ color: 'var(--text-muted)', background: 'transparent' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          <IconChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          {integrationIcon(integration.id, 16)}
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--bg-card)',
            margin: '0 auto 10px',
          }}
        >
          {integrationIcon(integration.id, 24)}
        </div>

        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {desc || `${name} is connected and available to AI tools in this conversation.`}
        </p>
      </div>

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
        Manage connector…
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Connectors submenu — shows connected integrations; falls back to "connect" prompt
// ─────────────────────────────────────────────────────────────────────────────

const ConnectorsSubmenu: React.FC<{
  onBrowse: () => void;
  onFileSelect?: (file: File) => void;
  onClose: () => void;
  selectedActions: SelectedAction[];
  onActionsChange: (actions: SelectedAction[]) => void;
}> = ({ onBrowse, onFileSelect, onClose, selectedActions, onActionsChange }) => {
  const { supported, connected, loading } = useIntegrationConnections();
  const [activeConn, setActiveConn] = useState<IntegrationConnection | null>(null);

  // Full connection objects for connected integrations
  const connectedItems: IntegrationConnection[] = supported.filter((s) =>
    connected.includes(s.id),
  );

  if (activeConn) {
    if (isFileIntegration(activeConn.id)) {
      return (
        <ConnectorFilePicker
          integration={activeConn}
          onBack={() => setActiveConn(null)}
          onFileSelect={
            onFileSelect
              ? (file) => {
                  onFileSelect(file);
                  onClose();
                }
              : undefined
          }
        />
      );
    }
    // Check if there are composite categories for this integration
    const hasCategories = COMPOSITE_FUNCTION_CATEGORIES.some((cat) =>
      cat.integrationIds.includes(activeConn.id),
    );
    if (hasCategories) {
      return (
        <ConnectorActionsPanel
          integration={activeConn}
          selectedActions={selectedActions}
          onActionsChange={onActionsChange}
          onBack={() => setActiveConn(null)}
          onManage={() => {
            setActiveConn(null);
            onBrowse();
          }}
        />
      );
    }
    return (
      <ConnectorInfoPanel
        integration={activeConn}
        onBack={() => setActiveConn(null)}
        onManage={() => {
          setActiveConn(null);
          onBrowse();
        }}
      />
    );
  }

  return (
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
        {loading && (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
            Loading…
          </div>
        )}

        {!loading && connectedItems.length === 0 && (
          <div style={{ padding: '10px 14px 6px', fontSize: 13, color: 'var(--text-muted)' }}>
            Connect services to bring your data into conversations.
          </div>
        )}

        {!loading && connectedItems.map((conn) => (
          <button
            key={conn.id}
            type="button"
            role="menuitem"
            onClick={() => setActiveConn(conn)}
            className="w-full flex items-center gap-3 px-[10px] h-[35px] rounded-[8px] text-left transition-colors"
            style={{ background: 'transparent', color: 'var(--text-primary)', fontSize: 14 }}
            onMouseEnter={(e) => {
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
              }}
            >
              {integrationIcon(conn.id, 16)}
            </span>
            <span style={{ flex: 1 }}>{connectorDisplayName(conn)}</span>
            <IconChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        ))}
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
        {connectedItems.length > 0 ? 'Manage connectors…' : 'Browse connectors…'}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Assistant hover-preview card (Phase 48 / Fix 1)
//
// Normalised so regular assistants and layered assistants render one card shape.
// Card shell + positioning live in ./InfoFloatCard — this is only the content.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TAG_PILLS = 3;

interface AssistantCardInfo {
  name: string;
  /** Derived from astPath / groupId — see assistantCardInfo() */
  access: 'Private' | 'Shared' | 'Group';
  /** Extra kind pill, e.g. "Layered" */
  kind?: string;
  description?: string;
  instructions?: string;
  tags: string[];
  toolCount: number;
  modelName?: string;
}

/** astPath = published at a URL → "Shared"; groupId = team-owned → "Group". */
const accessLabel = (astPath?: string, groupId?: string): AssistantCardInfo['access'] =>
  groupId ? 'Group' : astPath ? 'Shared' : 'Private';

const normalizeCardText = (raw?: string): string | undefined => {
  const flat = (raw ?? '').replace(/\s+/g, ' ').trim();
  return flat || undefined;
};

const assistantCardInfo = (
  a: Assistant,
  resolveModelName: (id?: string) => string | undefined,
): AssistantCardInfo => {
  const def = a.definition ?? ({} as Assistant['definition']);
  return {
    name: def.name || 'Untitled assistant',
    access: accessLabel(def.astPath, def.groupId),
    description: (def.description ?? '').trim() || undefined,
    instructions: normalizeCardText(def.instructions),
    tags: (def.tags ?? []).filter(Boolean),
    toolCount: (def.tools ?? []).length,
    modelName: resolveModelName(def.data?.model),
  };
};

const layeredCardInfo = (
  la: LayeredAssistant,
  resolveModelName: (id?: string) => string | undefined,
): AssistantCardInfo => ({
  name: la.name || 'Untitled assistant',
  access: accessLabel(la.astPath, la.groupId),
  kind: 'Layered',
  description: (la.description ?? '').trim() || undefined,
  instructions: normalizeCardText(la.rootNode?.instructions),
  tags: [],
  toolCount: 0,
  modelName: resolveModelName(la.model),
});

const AssistantCardBody: React.FC<{ info: AssistantCardInfo }> = ({ info }) => (
  <>
    <InfoCardTitle>{info.name}</InfoCardTitle>

    <InfoCardPills>
      <InfoCardPill>{info.access}</InfoCardPill>
      {info.kind && <InfoCardPill>{info.kind}</InfoCardPill>}
    </InfoCardPills>

    {info.modelName && <InfoCardMeta>Uses: {info.modelName}</InfoCardMeta>}

    {info.toolCount > 0 && (
      <InfoCardMeta>{info.toolCount === 1 ? '1 tool' : `${info.toolCount} tools`}</InfoCardMeta>
    )}

    {info.tags.length > 0 && (
      <InfoCardPills>
        {info.tags.slice(0, MAX_TAG_PILLS).map((t) => (
          <InfoCardPill key={t} muted>
            {t}
          </InfoCardPill>
        ))}
      </InfoCardPills>
    )}

    {info.description && <InfoCardText>{info.description}</InfoCardText>}

    {/* One interpolated string — InfoCardItalic clamps by character count, so it
        types its children as `string` and cannot take a split child array. */}
    {info.instructions && <InfoCardItalic>{`Instructions: ${info.instructions}`}</InfoCardItalic>}
  </>
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
  /** Maps an enforced model id → display name for the hover card */
  resolveModelName: (id?: string) => string | undefined;
}> = ({
  assistants,
  layeredAssistants,
  selectedAssistant,
  onSelect,
  onSelectLayered,
  onClear,
  resolveModelName,
}) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Hover-preview card — 250ms in / 200ms out, positioned right of the row
  // (auto-flips left near the viewport edge). Never shown for the
  // "Standard conversation" row or the empty state.
  const card = useInfoCardHover<AssistantCardInfo>();

  useEffect(() => {
    // Focus search on open
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const term = search.toLowerCase();

  // Rows move as the list filters — drop any open preview immediately.
  useEffect(() => { card.hideNow(); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // isRealAssistant, not an id comparison: placeholder look-alikes ("default",
  // old-UI "Standard Conversation") carry ids that are not DEFAULT_ASSISTANT.id
  // and would otherwise leave this list with nothing checked.
  const isDefaultSelected = !isRealAssistant(selectedAssistant);

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
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            card.hideNow(); // no preview for the "no assistant" row
          }}
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
              onClick={(e) => { e.stopPropagation(); card.hideNow(); onSelect(a); }}
              style={rowStyle(isActive)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                card.show(assistantCardInfo(a, resolveModelName), e.currentTarget);
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = isActive ? 'var(--bg-hover)' : 'transparent';
                card.hide();
              }}
              onFocus={(e) => card.show(assistantCardInfo(a, resolveModelName), e.currentTarget)}
              onBlur={card.hide}
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
              onClick={(e) => { e.stopPropagation(); card.hideNow(); onSelectLayered(la); }}
              style={rowStyle(isActive)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                card.show(layeredCardInfo(la, resolveModelName), e.currentTarget);
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = isActive ? 'var(--bg-hover)' : 'transparent';
                card.hide();
              }}
              onFocus={(e) => card.show(layeredCardInfo(la, resolveModelName), e.currentTarget)}
              onBlur={card.hide}
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

      {/* Hover-preview card — portalled out so the panel's overflow can't clip it */}
      {card.item && (
        <InfoFloatCard anchor={card.anchor} onMouseEnter={card.cancelHide} onMouseLeave={card.hide}>
          <AssistantCardBody info={card.item} />
        </InfoFloatCard>
      )}
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
  selectedActions?: SelectedAction[];
  onRemoveActions?: () => void;
}> = ({ webSearchEnabled, onRemoveWebSearch, selectedSkillIds, onRemoveSkills, assistantName, onRemoveAssistant, selectedActions, onRemoveActions }) => {
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
    // Accent-tinted, unlike the neutral toggle chips: this one stays put for the
    // whole conversation (see useConversationAssistant) and marks *who* is
    // answering, so it should read as a tag on the chat rather than a filter.
    chips.push(
      <div
        key="assistant"
        className="flex items-center gap-1 pl-2 rounded-[6px] text-[12.5px] flex-shrink-0"
        style={{
          height: 26,
          background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-active))',
          color: 'var(--text-primary)',
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 34%, transparent)',
        }}
        title={`Replies in this chat come from the “${assistantName}” assistant`}
      >
        <IconRobot size={14} style={{ color: 'var(--accent)' }} />
        <span className="max-w-[120px] truncate">{assistantName}</span>
        <button
          type="button"
          onClick={onRemoveAssistant}
          className="flex items-center justify-center w-[22px] h-full rounded-r-[6px] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          aria-label={`Remove assistant ${assistantName}`}
        >
          <IconX size={12} />
        </button>
      </div>
    );
  }

  if (selectedActions && selectedActions.length > 0 && onRemoveActions) {
    chips.push(
      <div
        key="connector-actions"
        className="flex items-center gap-1 pl-2 rounded-[6px] text-[12.5px] flex-shrink-0"
        style={{
          height: 26,
          background: 'var(--bg-active)',
          color: 'var(--text-primary)',
        }}
      >
        <IconPlug size={14} style={{ color: 'var(--text-secondary)' }} />
        <span>
          {selectedActions.length === 1
            ? selectedActions[0].name
            : `${selectedActions.length} actions`}
        </span>
        <button
          type="button"
          onClick={onRemoveActions}
          className="flex items-center justify-center w-[22px] h-full rounded-r-[6px] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          aria-label="Remove connector actions"
        >
          <IconX size={12} />
        </button>
      </div>,
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
  attachedLibraryIds = [],
  webSearchEnabled,
  onToggleWebSearch,
  selectedSkillIds,
  onSkillsChange,
  chatEndpoint,
  composerRef,
  onAddIntegrationFile,
  selectedActions = [],
  onActionsChange,
}) => {
  const {
    state: { featureFlags, prompts, selectedAssistant, layeredAssistants, groups, availableModels, defaultModelId },
    dispatch,
    handleUpdateConversation,
  } = useContext(HomeContext);

  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [submenu, setSubmenu] = useState<'skills' | 'connectors' | 'library' | 'assistant' | null>(null);

  // Build assistant list from prompts (same as ChatInput).
  // Mirrors Promptbar.tsx's visiblePrompts filter: hide prompts marked data.hidden
  // unless featureFlags.overrideInvisiblePrompts is set.
  const SYSTEM_TAG = 'amplify:system';
  const availableAssistants: Assistant[] = (prompts ?? [])
    .filter(isAssistant)
    .filter((p: Prompt) => {
      // Check both locations where the system tag may live:
      // definition.tags (local amplifyAssistants objects) and
      // prompt.data.tags (server-fetched assistants spread via assistant.data)
      const defTags: string[] = p.data?.assistant?.definition?.tags ?? [];
      const dataTags: string[] = p.data?.tags ?? [];
      return !defTags.includes(SYSTEM_TAG) && !dataTags.includes(SYSTEM_TAG);
    })
    .filter((p: Prompt) => featureFlags.overrideInvisiblePrompts || !p.data?.hidden)
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

  const isDefaultAssistant = !isRealAssistant(selectedAssistant);

  /**
   * Enforced-model id → human name, for the assistant hover card.
   * Falls back to the raw id so an unavailable/hidden model still reads sensibly.
   */
  const resolveModelName = useCallback(
    (modelId?: string): string | undefined => {
      if (!modelId) return undefined;
      return availableModels?.[modelId]?.name ?? modelId;
    },
    [availableModels],
  );

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

  // Badge: any active toggle, non-default assistant, or connector actions
  const anyToggleActive = webSearchEnabled || selectedSkillIds.length > 0 || !isDefaultAssistant || selectedActions.length > 0;

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

  // ── Submenu trigger rows ──────────────────────────────────────────────────
  const libraryRowRef = useRef<HTMLButtonElement>(null);
  const skillsRowRef = useRef<HTMLButtonElement>(null);
  const connectorsRowRef = useRef<HTMLButtonElement>(null);
  const assistantRowRef = useRef<HTMLButtonElement>(null);
  const primaryPanelRef = useRef<HTMLDivElement | null>(null);

  // ── Submenu positioning (Phase 48 / Fix 3) ────────────────────────────────
  // Was: `position: absolute` + a measured `top` offset + `left: calc(100% + 6px)`,
  // which had no idea where the viewport edges were and clipped on small windows.
  // Now: one Floating UI instance per panel with flip + shift.
  // See ./menuPositioning for the middleware stack and why strategy stays
  // 'absolute' (useDismiss containment — the Skills checkboxes depend on it).
  const libraryFloating = useFloating({
    open: submenu === 'library',
    placement: SUBMENU_PLACEMENT,
    middleware: submenuMiddleware(),
    whileElementsMounted: autoUpdate,
  } as any);

  const skillsFloating = useFloating({
    open: submenu === 'skills',
    placement: SUBMENU_PLACEMENT,
    middleware: submenuMiddleware(),
    whileElementsMounted: autoUpdate,
  } as any);

  const connectorsFloating = useFloating({
    open: submenu === 'connectors',
    placement: SUBMENU_PLACEMENT,
    middleware: submenuMiddleware(),
    whileElementsMounted: autoUpdate,
  } as any);

  const assistantFloating = useFloating({
    open: submenu === 'assistant',
    placement: SUBMENU_PLACEMENT,
    middleware: submenuMiddleware(),
    whileElementsMounted: autoUpdate,
  } as any);

  // Bind each submenu's reference to its trigger row when that submenu opens.
  // Done in an effect rather than an inline callback ref: an inline ref would be
  // invoked with (null, node) on every render and thrash setReference's state.
  useEffect(() => {
    if (submenu === 'library') libraryFloating.refs.setReference(libraryRowRef.current);
    if (submenu === 'skills') skillsFloating.refs.setReference(skillsRowRef.current);
    if (submenu === 'connectors') connectorsFloating.refs.setReference(connectorsRowRef.current);
    if (submenu === 'assistant') assistantFloating.refs.setReference(assistantRowRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        {/* Badge dot — any toggle active (decorative; state already in aria-label on the trigger) */}
        {anyToggleActive && !primaryOpen && (
          <span
            aria-hidden="true"
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
            data-new-ui-shell="true"
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
                    // cancelClose, NOT scheduleClose: this panel holds a search
                    // field and a multi-select the user commits with a button, so
                    // a 300ms hover-out timer would throw their selection away
                    // mid-task. Clearing the timer still cancels a *pending* open
                    // if they leave before the 150ms hover-intent fires.
                    onMouseLeave={cancelClose}
                    onClick={() => setSubmenu(submenu === 'library' ? null : 'library')}
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

            {/* ── Library submenu ──
                Stays a DOM child of the primary panel (see menuPositioning) so
                useDismiss treats clicks inside it as inside the menu — the row
                checkboxes and the search field depend on that. */}
            {submenu === 'library' && (
              <div
                ref={libraryFloating.refs.setFloating}
                style={submenuStyle(libraryFloating, 'attachMenuEnter')}
                onMouseEnter={cancelClose}
              >
                <DataSourceLibraryPicker
                  surface="floating"
                  width={LIBRARY_PANEL_WIDTH}
                  listHeight={LIBRARY_LIST_HEIGHT}
                  attachedIds={attachedLibraryIds}
                  onSelect={(picked) => {
                    onAddFromLibrary(picked);
                    closeAll();
                  }}
                  onClose={() => setSubmenu(null)}
                />
              </div>
            )}

            {/* ── Skills submenu ── */}
            {submenu === 'skills' && chatEndpoint && (
              <div
                ref={skillsFloating.refs.setFloating}
                style={submenuStyle(skillsFloating, 'attachMenuEnter')}
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
                ref={connectorsFloating.refs.setFloating}
                style={submenuStyle(connectorsFloating, 'attachMenuEnter')}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <ConnectorsSubmenu
                  onBrowse={() => { openSettings('connectors'); }}
                  onFileSelect={onAddIntegrationFile}
                  onClose={closeAll}
                  selectedActions={selectedActions}
                  onActionsChange={onActionsChange ?? (() => {})}
                />
              </div>
            )}

            {/* ── Assistant submenu ── */}
            {submenu === 'assistant' && (
              <div
                ref={assistantFloating.refs.setFloating}
                style={submenuStyle(assistantFloating, 'attachMenuEnter')}
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
                  resolveModelName={resolveModelName}
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
