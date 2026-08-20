import React, {
  FC,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  IconSettings,
  IconUser,
  IconChartBar,
  IconPuzzle,
  IconPlug,
  IconDatabase,
  IconKey,
  IconExternalLink,
  IconX,
  IconSearch,
  IconShield,
  IconServer,
  IconNotes,
  IconTemplate,
  IconLayoutSidebar,
  IconDeviceDesktop,
  IconSun,
  IconMoon,
  IconChevronDown,
} from '@tabler/icons-react';

import HomeContext from '@/pages/api/home/home.context';
import { getSettings, saveSettings, featureOptionFlags } from '@/utils/app/settings';
import { Flag } from '@/components/ReusableComponents/FlagsMap';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { handleStorageSelection, saveStorageSettings } from '@/utils/app/conversationStorage';
import { ConversationStorage } from '@/types/conversationStorage';
import { saveConversations } from '@/utils/app/conversation';
import toast from 'react-hot-toast';
import { SkillsLibrary } from '@/components/Skills/SkillsLibrary';
import { MCPServersTab } from '@/components/Settings/MCPServersTab';
import { ApiKeys } from '@/components/Settings/AccountComponents/ApiKeys';
import { noCoaAccount } from '@/types/accounts';
import { Account } from '@/types/accounts';
import { NewAdminModal } from '@/components/NewUI/settings/NewAdminModal';
import { NewAccountSection } from '@/components/NewUI/settings/NewAccountSection';
import { NewStorageSection } from '@/components/NewUI/settings/NewStorageSection';
import { NewConnectorsSection } from '@/components/NewUI/settings/NewConnectorsSection';
import { PromptTemplatesSection } from '@/components/NewUI/settings/PromptTemplatesSection';
import { SidebarItemsSection } from '@/components/NewUI/settings/SidebarItemsSection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NewSettingsModalProps {
  onClose: () => void;
  openToSection?: string;
}

interface NavItem {
  id: string;
  label: string;
  Icon: React.FC<{ size?: number; stroke?: number; className?: string }>;
  external?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Nav definition (base — admin group added dynamically in modal based on featureFlags)
// ---------------------------------------------------------------------------

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Settings',
    items: [
      { id: 'general', label: 'General', Icon: IconSettings },
      { id: 'account', label: 'Account', Icon: IconUser },
      { id: 'usage', label: 'Usage', Icon: IconChartBar },
      { id: 'apikeys', label: 'API Access', Icon: IconKey },
    ],
  },
  {
    heading: 'Customize',
    items: [
      { id: 'promptTemplates', label: 'Prompt Templates', Icon: IconTemplate },
      { id: 'customInstructions', label: 'Custom Instructions', Icon: IconNotes },
      { id: 'skills', label: 'Skills', Icon: IconPuzzle },
      { id: 'connectors', label: 'Connectors', Icon: IconPlug },
      { id: 'mcp', label: 'MCP Servers', Icon: IconServer },
      { id: 'sidebarItems', label: 'Sidebar Items', Icon: IconLayoutSidebar },
    ],
  },
];

// Note: NAV_GROUPS and ALL_NAV_ITEMS removed — the dynamic navGroups / allNavItems
// computed inside the modal component replace them (they include the admin entry
// only when featureFlags.adminInterface is true).

// ---------------------------------------------------------------------------
// General Section
// ---------------------------------------------------------------------------

// ── Appearance option data ────────────────────────────────────────────────
type AppearanceMode = 'system' | 'light' | 'dark';

const APPEARANCE_OPTIONS: { value: AppearanceMode; Icon: React.FC<{ size?: number; stroke?: number }>; title: string }[] = [
  { value: 'system', Icon: IconDeviceDesktop, title: 'System' },
  { value: 'light',  Icon: IconSun,           title: 'Light'  },
  { value: 'dark',   Icon: IconMoon,          title: 'Dark'   },
];

// ── Chat font option data ─────────────────────────────────────────────────
const FONT_OPTIONS = [
  { value: 'serif' as const, label: 'Newsreader', fontFamily: 'Newsreader, Georgia, serif' },
  { value: 'sans'  as const, label: 'Inter',      fontFamily: 'Inter, sans-serif'           },
];

// ── Storage option data ───────────────────────────────────────────────────
const STORAGE_OPTIONS: { id: ConversationStorage; label: string; description: string }[] = [
  { id: 'local-only',    label: 'Local only',             description: 'All conversations stored in your browser. No cloud sync.' },
  { id: 'future-local',  label: 'Local going forward',    description: 'New conversations saved locally. Existing stay where they are.' },
  { id: 'cloud-only',    label: 'Cloud only',             description: 'All conversations synced to cloud. Access from any device.' },
  { id: 'future-cloud',  label: 'Cloud going forward',    description: 'New conversations synced to cloud. Existing stay where they are.' },
];

const STORAGE_CONFIRM: Record<ConversationStorage, string> = {
  'local-only':   'Any conversations stored in the cloud will be moved locally. All future conversations will be stored locally.',
  'cloud-only':   'Any conversations stored locally will be moved to the cloud. All future conversations will be uploaded to the cloud.',
  'future-local': 'Only new conversations will be stored locally. Existing conversations remain where they are.',
  'future-cloud': 'Only new conversations will be uploaded to the cloud. Existing conversations remain where they are.',
};

// ── GeneralSection ────────────────────────────────────────────────────────
const GeneralSection: FC = () => {
  const {
    dispatch: homeDispatch,
    state: { featureFlags, storageSelection, storageProcessing, conversations, selectedConversation, folders, statsService },
  } = useContext(HomeContext);

  const settings = getSettings(featureFlags);
  const [featureOptions, setFeatureOptions] = useState<{ [key: string]: boolean }>(
    settings.featureOptions,
  );

  // ── Appearance (system / light / dark) ───────────────────────────────
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('amplify_appearance_mode') as AppearanceMode | null;
    if (stored === 'system' || stored === 'light' || stored === 'dark') return stored;
    const lm = localStorage.getItem('lightMode');
    return lm === 'light' ? 'light' : 'dark';
  });

  const applyTheme = (resolved: 'light' | 'dark') => {
    homeDispatch({ field: 'lightMode', value: resolved });
    localStorage.setItem('lightMode', resolved);
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveSettings({ ...getSettings(featureFlags), theme: resolved });
  };

  const handleAppearanceChange = (value: AppearanceMode) => {
    setAppearanceMode(value);
    localStorage.setItem('amplify_appearance_mode', value);
    if (value === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    } else {
      applyTheme(value);
    }
  };

  // ── Chat font (serif / sans) ──────────────────────────────────────────
  const [chatFont, setChatFont] = useState<'serif' | 'sans'>(() => {
    if (typeof window === 'undefined') return 'serif';
    return (localStorage.getItem('amplify_chat_font') as 'serif' | 'sans') ?? 'serif';
  });
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [storageDropdownOpen, setStorageDropdownOpen] = useState(false);
  const [storageSaving, setStorageSaving] = useState(false);

  // Refs for storage async closures (same pattern as NewStorageSection)
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const foldersRef = useRef(folders);
  useEffect(() => { foldersRef.current = folders; }, [folders]);

  const handleStorageChange = async (selection: ConversationStorage) => {
    setStorageDropdownOpen(false);
    if (selection === storageSelection) return;
    const confirmed = window.confirm(STORAGE_CONFIRM[selection]);
    if (!confirmed) return;

    setStorageSaving(true);
    const isAllOption = selection === 'local-only' || selection === 'cloud-only';
    if (isAllOption) {
      homeDispatch({
        field: 'storageProcessing',
        value: { isProcessing: true, message: selection === 'local-only' ? 'Moving conversations to local storage…' : 'Moving conversations to cloud…', progress: 0, total: 0 },
      });
      await new Promise((r) => setTimeout(r, 100));
    }
    try {
      saveStorageSettings(selection);
      homeDispatch({ field: 'storageSelection', value: selection });
      const updated = await handleStorageSelection(
        selection,
        conversationsRef.current,
        foldersRef.current,
        statsService,
        (current, total) => homeDispatch({ field: 'storageProcessing', value: { isProcessing: true, message: selection === 'local-only' ? 'Moving conversations to local storage…' : 'Moving conversations to cloud…', progress: current, total } }),
      );
      if (updated) {
        homeDispatch({ field: 'conversations', value: updated });
        saveConversations(updated);
        if (selectedConversation) {
          homeDispatch({ field: 'selectedConversation', value: updated.find((c) => c.id === selectedConversation.id) });
        }
      }
      toast('Storage settings saved');
    } catch {
      toast.error('Failed to save storage settings');
    } finally {
      homeDispatch({ field: 'storageProcessing', value: { isProcessing: false, message: '', progress: 0, total: 0 } });
      setStorageSaving(false);
    }
  };

  const handleChatFontChange = (value: 'serif' | 'sans') => {
    setChatFont(value);
    localStorage.setItem('amplify_chat_font', value);
    window.dispatchEvent(new Event('amplifyChatFontChanged'));
  };

  // ── Feature flags ─────────────────────────────────────────────────────
  const handleFlagChange = (key: string, value: boolean) => {
    const updated = { ...featureOptions, [key]: value };
    setFeatureOptions(updated);
    saveSettings({ ...getSettings(featureFlags), featureOptions: updated });
    window.dispatchEvent(new Event('updateFeatureSettings'));
  };

  const visibleFlags: Flag[] = featureOptionFlags.filter((f: Flag) =>
    Object.prototype.hasOwnProperty.call(featureOptions, f.key),
  );

  const currentFontOpt = FONT_OPTIONS.find((f) => f.value === chatFont) ?? FONT_OPTIONS[0];

  return (
    <div className="flex flex-col gap-6">

      {/* ── Appearance + Chat font card ──────────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-panel, 12px)',
          padding: '20px',
        }}
      >
        {/* Appearance row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '14px',
          }}
        >
          <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Appearance</span>

          {/* Icon segmented control — system / light / dark */}
          <div
            style={{
              display: 'flex',
              gap: '2px',
              padding: '3px',
              background: 'var(--bg-app)',
              borderRadius: '9px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {APPEARANCE_OPTIONS.map(({ value, Icon, title }) => {
              const isSelected = appearanceMode === value;
              return (
                <button
                  key={value}
                  onClick={() => handleAppearanceChange(value)}
                  title={title}
                  aria-label={title}
                  aria-pressed={isSelected}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '34px',
                    height: '28px',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid var(--border-subtle)' : '1px solid transparent',
                    background: isSelected ? 'var(--bg-raised)' : 'transparent',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'background 100ms ease, color 100ms ease, border-color 100ms ease',
                    padding: 0,
                  }}
                >
                  <Icon size={16} stroke={1.5} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat font row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '14px',
          }}
        >
          <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Chat font</span>

          {/* Chromeless dropdown trigger */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setFontDropdownOpen((o) => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 0',
                color: 'var(--text-primary)',
              }}
            >
              <span
                style={{
                  fontFamily: currentFontOpt.fontFamily,
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                }}
              >
                {currentFontOpt.label}
              </span>
              <IconChevronDown
                size={12}
                stroke={2}
                style={{ color: 'var(--text-muted)', flexShrink: 0 }}
              />
            </button>

            {fontDropdownOpen && (
              <>
                {/* Click-away backdrop */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setFontDropdownOpen(false)}
                />
                {/* Dropdown panel */}
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 100,
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '4px',
                    minWidth: '160px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  }}
                >
                  {FONT_OPTIONS.map((opt) => {
                    const isActive = chatFont === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          handleChatFontChange(opt.value);
                          setFontDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '7px',
                          border: 'none',
                          background: isActive ? 'var(--bg-active)' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: 'var(--text-primary)',
                          transition: 'background 80ms ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        <span style={{ fontFamily: opt.fontFamily, fontSize: '14px' }}>
                          {opt.label}
                        </span>
                        {isActive && (
                          <span style={{ color: 'var(--accent)', fontSize: '14px', lineHeight: 1 }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Storage row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
            Conversation storage
          </span>

          {/* Chromeless storage dropdown — same pattern as chat font */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setStorageDropdownOpen((o) => !o)}
              disabled={storageSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'none',
                border: 'none',
                cursor: storageSaving ? 'not-allowed' : 'pointer',
                padding: '2px 0',
                color: 'var(--text-primary)',
                opacity: storageSaving ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                {storageSaving
                  ? 'Saving…'
                  : STORAGE_OPTIONS.find((o) => o.id === storageSelection)?.label ?? 'Select…'}
              </span>
              <IconChevronDown size={12} stroke={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>

            {storageDropdownOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setStorageDropdownOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 100,
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '4px',
                    minWidth: '240px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  }}
                >
                  {STORAGE_OPTIONS.map((opt) => {
                    const isActive = storageSelection === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleStorageChange(opt.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '7px',
                          border: 'none',
                          background: isActive ? 'var(--bg-active)' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 80ms ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: isActive ? 500 : 400 }}>
                            {opt.label}
                          </span>
                          {isActive && <span style={{ color: 'var(--accent)', fontSize: '14px', lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {opt.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Migration progress (only visible during a bulk move) */}
        {storageProcessing?.isProcessing && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ height: '3px', background: 'var(--bg-active)', borderRadius: '2px', overflow: 'hidden', marginBottom: '5px' }}>
              <div style={{
                height: '100%',
                background: 'var(--accent)',
                width: storageProcessing.total > 0
                  ? `${Math.min(100, (storageProcessing.progress / storageProcessing.total) * 100)}%`
                  : '60%',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              {storageProcessing.message}
            </p>
          </div>
        )}
      </div>

      {/* ── Feature flags card ────────────────────────────────────────────── */}
      {visibleFlags.length > 0 && (
        <div
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-panel, 12px)',
            padding: '20px',
          }}
        >
          <h3
            style={{
              color: 'var(--text-primary)',
              fontSize: '15px',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            Features
          </h3>

          {visibleFlags.map((flag, index) => {
            const isLast = index === visibleFlags.length - 1;
            return (
              <div
                key={flag.key}
                style={{
                  paddingTop: index === 0 ? 0 : '12px',
                  paddingBottom: isLast ? 0 : '12px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                {/* Label + toggle row — clicking label also toggles */}
                <div
                  onClick={() => handleFlagChange(flag.key, !featureOptions[flag.key])}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                    {flag.label}
                  </span>
                  <ToggleSwitch
                    checked={!!featureOptions[flag.key]}
                    onChange={(val) => handleFlagChange(flag.key, val)}
                    aria-label={flag.label}
                  />
                </div>

                {/* Optional description */}
                {flag.description && (
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      lineHeight: '1.55',
                    }}
                  >
                    {flag.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Account Section — delegates to NewAccountSection (new-UI styled)
// ---------------------------------------------------------------------------

const AccountSection: FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;
  return <NewAccountSection />;
};

// ---------------------------------------------------------------------------
// Skills Section
// ---------------------------------------------------------------------------

const SkillsSection: FC = () => {
  const { state: { chatEndpoint } } = useContext(HomeContext);

  if (!chatEndpoint) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '20px' }}>
        Skills require a connected endpoint. Please check your configuration.
      </div>
    );
  }

  return <SkillsLibrary chatEndpoint={chatEndpoint} />;
};

// ---------------------------------------------------------------------------
// Storage Section — delegates to NewStorageSection (new-UI styled)
// ---------------------------------------------------------------------------

const StorageSection: FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;
  return <NewStorageSection />;
};

// ---------------------------------------------------------------------------
// API Keys Section
// ---------------------------------------------------------------------------

const ApiKeysSection: FC<{ active: boolean }> = ({ active }) => {
  const [unsaved, setUnsaved] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [defaultAccount, setDefaultAccount] = useState<Account>(noCoaAccount);

  return (
    <ApiKeys
      open={active}
      setUnsavedChanges={setUnsaved}
      accounts={accounts}
      defaultAccount={defaultAccount}
      onClose={() => {}}
    />
  );
};

// AdminSection is intentionally empty — the main NewSettingsModal handles
// rendering AdminUI as a peer modal when activeSection === 'admin'.
// This placeholder is never actually rendered because the modal short-circuits.
const AdminSection: FC = () => null;

// ---------------------------------------------------------------------------
// Placeholder Section
// ---------------------------------------------------------------------------

const PlaceholderSection: FC<{ title: string }> = ({ title }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '200px',
      color: 'var(--text-muted)',
      fontSize: '14px',
      gap: '8px',
    }}
  >
    <span style={{ fontSize: '28px' }}>🚧</span>
    <span>
      <strong style={{ color: 'var(--text-secondary)' }}>{title}</strong> — Coming soon
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Custom Instructions Section
// ---------------------------------------------------------------------------

const CustomInstructionsSection: FC = () => {
  const STORAGE_KEY = 'amplify_custom_instructions';
  const MAX_CHARS = 4000;

  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEY) ?? '';
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setValue('');
    localStorage.removeItem(STORAGE_KEY);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-panel, 12px)', padding: '20px' }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
          Custom Instructions
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Add context and preferences that Amplify will consider in every conversation. You can describe your role, working style, or any standing instructions.
        </p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
          placeholder="e.g. 'I am a software engineer working on React and TypeScript. Prefer concise explanations with code examples. Always use TypeScript syntax.'"
          rows={8}
          style={{
            width: '100%',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '14px',
            color: 'var(--text-primary)',
            lineHeight: '1.6',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'Inter, sans-serif',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {value.length} / {MAX_CHARS}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleClear}
              style={{
                height: '32px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
            <button
              onClick={handleSave}
              style={{
                height: '32px',
                padding: '0 16px',
                borderRadius: '8px',
                border: 'none',
                background: saved ? 'var(--bg-active)' : 'var(--accent)',
                color: saved ? 'var(--text-primary)' : '#fff',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-panel, 12px)', padding: '20px' }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
          How it works
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.7' }}>
          Custom instructions are added to the system prompt of every new conversation. They help Amplify understand your context and preferences without repeating them each time.
        </p>
        <ul style={{ margin: '12px 0 0', paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.8' }}>
          <li>Instructions apply to all new conversations going forward</li>
          <li>You can always override them by editing the system prompt in a specific conversation</li>
          <li>Instructions are stored locally in your browser</li>
        </ul>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

const SectionContent: FC<{ sectionId: string }> = ({ sectionId }) => {
  switch (sectionId) {
    case 'general':
      return <GeneralSection />;
    case 'account':
      return <AccountSection active={true} />;
    case 'usage':
      return <PlaceholderSection title="Usage" />;
    case 'apikeys':
      return <ApiKeysSection active={true} />;
    case 'promptTemplates':
      return <PromptTemplatesSection />;
    case 'customInstructions':
      return <CustomInstructionsSection />;
    case 'skills':
      return <div className="new-ui-skills-override"><SkillsSection /></div>;
    case 'connectors':
      return <NewConnectorsSection />;
    case 'mcp':
      return <div className="new-ui-skills-override"><MCPServersTab open={true} /></div>;
    case 'sidebarItems':
      return <SidebarItemsSection />;
    case 'admin':
      return <AdminSection />;
    default:
      return <PlaceholderSection title={sectionId} />;
  }
};

// ---------------------------------------------------------------------------
// Left Rail Nav Row
// ---------------------------------------------------------------------------

interface NavRowProps {
  item: NavItem;
  isSelected: boolean;
  onClick: () => void;
}

const NavRow: FC<NavRowProps> = ({ item, isSelected, onClick }) => {
  const { Icon } = item;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '100%',
        height: '36px',
        padding: '0 8px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: isSelected ? 500 : 400,
        background: isSelected ? 'var(--bg-active)' : 'transparent',
        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
        textAlign: 'left',
        transition: 'background 0.1s, color 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
        }
      }}
    >
      <Icon size={18} stroke={1.5} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.external && <IconExternalLink size={12} stroke={1.5} style={{ opacity: 0.5 }} />}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

export const NewSettingsModal: FC<NewSettingsModalProps> = ({ onClose, openToSection }) => {
  const { state: { featureFlags } } = useContext(HomeContext);
  const [activeSection, setActiveSection] = useState<string>(openToSection ?? 'general');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdminUI, setShowAdminUI] = useState(openToSection === 'admin');
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Build nav groups dynamically — admin group only shown to admins
  const navGroups: NavGroup[] = [
    ...BASE_NAV_GROUPS,
    ...(featureFlags.adminInterface
      ? [
          {
            heading: 'Admin',
            items: [
              { id: 'admin', label: 'Admin Panel', Icon: IconShield },
            ],
          } as NavGroup,
        ]
      : []),
  ];

  // Flat item list (includes admin when applicable)
  const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

  // Focus trap + Escape to close
  useEffect(() => {
    // While the admin panel is open this modal is not rendered at all — NewAdminModal
    // owns focus and the keyboard. Registering our Escape handler here would double-fire
    // alongside admin's own handler and close BOTH modals, silently discarding admin's
    // unsaved-changes confirm (its "Cancel" would be ignored).
    if (showAdminUI) return;

    // Move focus into the modal on open
    panelRef.current?.focus();

    const FOCUSABLE = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest('[aria-hidden="true"]'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, showAdminUI]);

  // Scroll content pane to top when section changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeSection]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // Filter nav groups by search
  const filteredGroups: NavGroup[] = searchQuery.trim()
    ? navGroups.map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      })).filter((group) => group.items.length > 0)
    : navGroups;

  // Active item label for the heading
  const activeItem = allNavItems.find((i) => i.id === activeSection);

  // ---------------------------------------------------------------------------
  // Admin panel REPLACES the settings modal (it is not stacked on top of it).
  //
  // This early return must stay below every hook above. Rendering NewAdminModal
  // *instead of* the settings frame means there is no settings overlay/panel left
  // visible behind the admin panel. `onClose` is handed straight through to the
  // parent (NewSidebar / home.tsx), all of which unmount NewSettingsModal — so
  // closing the admin panel returns you to the app, not to the settings modal.
  //
  // This also covers the direct entry points (sidebar "Admin", AccountMenu
  // "Admin Panel"), which mount this component with openToSection='admin' and so
  // hit this branch on first render, never painting the settings frame at all.
  // ---------------------------------------------------------------------------
  if (showAdminUI && featureFlags.adminInterface) {
    return <NewAdminModal onClose={onClose} />;
  }

  return (
    /* Overlay */
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Panel — fixed height so both panes can independently scroll */}
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: '1100px',            /* standardized with NewAdminModal */
          height: 'min(820px, 90dvh)',   /* fixed, not max-height, so children can fill and scroll */
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '210px 1fr',
          gridTemplateRows: '100%',       /* single row fills height */
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          outline: 'none',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-heading"
      >
        {/* ----------------------------------------------------------------
            Left Rail
        ---------------------------------------------------------------- */}
        <div
          style={{
            background: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-subtle)',
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Search */}
          <div
            style={{
              position: 'relative',
              marginBottom: '8px',
            }}
          >
            <IconSearch
              size={14}
              style={{
                position: 'absolute',
                left: '9px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search settings"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '34px',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0 10px 0 28px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Nav groups */}
          {filteredGroups.map((group) => (
            <div key={group.heading} style={{ marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0 8px',
                  marginBottom: '4px',
                }}
              >
                {group.heading}
              </div>
              {group.items.map((item) => (
                <NavRow
                  key={item.id}
                  item={item}
                  isSelected={activeSection === item.id}
                  onClick={() => {
                    if (item.id === 'admin') {
                      setShowAdminUI(true);
                    } else {
                      setActiveSection(item.id);
                      setShowAdminUI(false);
                      setSearchQuery('');
                    }
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* ----------------------------------------------------------------
            Right Pane — flex column: fixed header row + scrollable content
        ---------------------------------------------------------------- */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Header row — [Section Title .............. ×]
              flexShrink:0 keeps it fixed while the content below scrolls. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px 16px 24px',
              flexShrink: 0,
            }}
          >
            {/* Section heading — id used by aria-labelledby on the dialog panel */}
            <h2
              id="settings-modal-heading"
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {activeItem?.label ?? activeSection}
            </h2>

            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                flexShrink: 0,
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
              }}
            >
              <IconX size={20} stroke={2} />
            </button>
          </div>

          {/* Scrollable content area — sits below the fixed header row */}
          <div
            ref={contentRef}
            style={{
              flex: 1,
              minHeight: 0,
              padding: '0 24px 40px',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            {/* Section content — error boundary per section */}
            <React.Suspense
              fallback={
                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</div>
              }
            >
              <SectionContent sectionId={activeSection} />
            </React.Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewSettingsModal;
