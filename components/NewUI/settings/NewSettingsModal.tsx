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

import { useSession } from 'next-auth/react';
import HomeContext from '@/components/Home/home.context';
import { useStableFeatureFlags } from '@/components/NewUI/shared/useStableFeatureFlags';
import { UserCostBreakdownContent } from '@/components/Layout/UserCostBreakdownModal';
import { getSettings, saveSettings } from '@/utils/app/settings';
import { ConfirmDialog } from '@/components/NewUI/shared/ConfirmDialog';
import { InfoTooltip } from '@/components/NewUI/shared/InfoTooltip';
import { handleStorageSelection, saveStorageSettings } from '@/utils/app/conversationStorage';
import { ConversationStorage } from '@/types/conversationStorage';
import { saveConversations } from '@/utils/app/conversation';
import toast from 'react-hot-toast';
import { SkillsLibrary } from '@/components/Skills/SkillsLibrary';
import { NewMcpServersSection } from '@/components/NewUI/settings/NewMcpServersSection';
import { NewApiKeysSection } from '@/components/NewUI/settings/NewApiKeysSection';
import type { LeaveGuard } from '@/components/NewUI/settings/leaveGuard';
import { getAccounts } from '@/services/accountService';
import { noCoaAccount } from '@/types/accounts';
import { Account } from '@/types/accounts';
import { NewAdminModal } from '@/components/NewUI/settings/NewAdminModal';
import { NewAccountSection } from '@/components/NewUI/settings/NewAccountSection';
import { NewStorageSection } from '@/components/NewUI/settings/NewStorageSection';
import { NewConnectorsSection } from '@/components/NewUI/settings/NewConnectorsSection';
import { PromptTemplatesSection } from '@/components/NewUI/settings/PromptTemplatesSection';
import { SidebarItemsSection } from '@/components/NewUI/settings/SidebarItemsSection';
import { CustomInstructionsSection } from '@/components/NewUI/settings/CustomInstructionsSection';
import { filterModels } from '@/utils/app/models';
import { getUserDefaultModelId, setUserDefaultModelId } from '@/components/NewUI/shared/userDefaultModel';
import { getUserDefaultEffort, setUserDefaultEffort } from '@/components/NewUI/shared/userDefaultEffort';
import { EFFORT_OPTIONS, ModelCardBody } from '@/components/NewUI/shared/ModelPicker';
import { InfoFloatCard, useInfoCardHover } from '@/components/NewUI/shared/InfoFloatCard';
import type { Model } from '@/types/model';
import type { EffortLevel } from '@/components/NewUI/shared/ModelPicker';
import { DEFAULT_STORAGE_SELECTION, getChatFont, saveDisplayPrefsToServer } from '@/components/NewUI/shared/userDisplayPrefs';
import { getUserWebSearchEnabled, setUserWebSearchEnabled, WEB_SEARCH_LEVEL3_INFO } from '@/components/NewUI/shared/userWebSearch';
import { getDeploymentFeatureAvailability } from '@/components/NewUI/shared/deploymentFeaturePolicy';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { isHalloweenSeason } from '@/components/NewUI/home/HalloweenHero';
import {
  getHalloweenPartEnabled,
  setHalloweenPartEnabled,
  USER_HALLOWEEN_EFFECTS_CHANGED_EVENT,
} from '@/components/NewUI/shared/userHalloweenEffects';
import { useTrack } from '@/components/NewUI/shared/UiAnalytics';
import {
  NewUILoadingStatus,
  NewUILegacyLoadingAdapter,
} from '@/components/NewUI/shared/NewUILoadingStatus';

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
    state: { lightMode, storageSelection, storageProcessing, conversations, selectedConversation, folders, statsService, availableModels, defaultModelId, advancedModelId },
  } = useContext(HomeContext);
  const featureFlags = useStableFeatureFlags();
  const settings = getSettings(featureFlags);

  // ── Default model ─────────────────────────────────────────────────────
  const allModels = filterModels(availableModels, settings.hiddenModelIds);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [userDefaultModelId, setUserDefaultModelIdState] = useState<string>(
    () => getUserDefaultModelId() ?? '',
  );

  // Same hover-preview card the chat model picker shows (250ms in / 200ms out).
  const modelCard = useInfoCardHover<Model>();
  useEffect(() => {
    if (!modelDropdownOpen) modelCard.hideNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelDropdownOpen]);

  const handleDefaultModelChange = (id: string) => {
    modelCard.hideNow();
    setUserDefaultModelIdState(id);
    setUserDefaultModelId(id || null);
    setModelDropdownOpen(false);
    statsService.trackEvent('Default Model Changed', { 'Model Id': id || 'system-default' });
    // Persist server-side so the choice roams. `null` is an explicit clear
    // ("System default"), which must propagate to other devices too.
    void saveDisplayPrefsToServer({ userDefaultModelId: id || null });
  };

  const selectedModelName = allModels.find((m) => m.id === userDefaultModelId)?.name ?? 'System default';

  // ── Default effort ────────────────────────────────────────────────────
  const [effortDropdownOpen, setEffortDropdownOpen] = useState(false);
  const [userDefaultEffortId, setUserDefaultEffortIdState] = useState<EffortLevel | ''>(
    () => getUserDefaultEffort() ?? '',
  );

  const handleDefaultEffortChange = (id: EffortLevel | '') => {
    setUserDefaultEffortIdState(id);
    setUserDefaultEffort(id || null);
    setEffortDropdownOpen(false);
    statsService.trackEvent('Default Effort Changed', { 'Effort': id || 'system-default' });
    // Persist server-side so the choice roams. `null` is an explicit clear
    // ("Medium (default)"), which must propagate to other devices too.
    void saveDisplayPrefsToServer({ userDefaultEffort: id || null });
  };

  const selectedEffortLabel = EFFORT_OPTIONS.find((e) => e.id === userDefaultEffortId)?.label ?? 'Medium (default)';

  // ── Web search (default ON; the user's off-switch for Level 3 data) ───
  const webSearchAvailable = getDeploymentFeatureAvailability(featureFlags).webSearch;
  const [webSearchEnabled, setWebSearchEnabledState] = useState<boolean>(() => getUserWebSearchEnabled());

  const handleWebSearchChange = (enabled: boolean) => {
    setWebSearchEnabledState(enabled);
    setUserWebSearchEnabled(enabled);
    statsService.trackEvent('Web Search Setting Changed', { 'Enabled': enabled });
    // Always publish the explicit boolean (including `true`) so turning it back
    // on clears an "off" held by other devices.
    void saveDisplayPrefsToServer({ webSearchEnabled: enabled });
  };

  // ── Halloween effects (rows only shown when the `halloween` feature flag is on) ──
  const showHalloweenToggle = isHalloweenSeason(featureFlags);
  const [halloweenEnabled, setHalloweenEnabledState] = useState<boolean>(() => getHalloweenPartEnabled('theme'));
  const [batSwarmEnabled, setBatSwarmEnabledState] = useState<boolean>(() => getHalloweenPartEnabled('swarm'));
  // Stay in sync with the corner control on the home page.
  useEffect(() => {
    const sync = () => {
      setHalloweenEnabledState(getHalloweenPartEnabled('theme'));
      setBatSwarmEnabledState(getHalloweenPartEnabled('swarm'));
    };
    window.addEventListener(USER_HALLOWEEN_EFFECTS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(USER_HALLOWEEN_EFFECTS_CHANGED_EVENT, sync);
  }, []);

  // ── Appearance (system / light / dark) ───────────────────────────────
  // The theme actually applied (`lightMode`, kept current by every writer incl. the
  // account menu, classic UI and UserPrefsSync) is the source of truth for the
  // highlighted option. `amplify_appearance_mode` is only a *preference* and goes
  // stale (never written by classic UI; absent for new users, where a 'dark'
  // fallback contradicted the real theme), so it is honoured only for 'system',
  // and only while the applied theme still matches the OS.
  const [systemSelected, setSystemSelected] = useState<boolean>(() =>
    typeof window !== 'undefined' && localStorage.getItem('amplify_appearance_mode') === 'system',
  );
  const osPrefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const appearanceMode: AppearanceMode =
    systemSelected && (osPrefersDark ? 'dark' : 'light') === lightMode ? 'system' : lightMode;

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
    statsService.setThemeEvent(value);
    setSystemSelected(value === 'system');
    localStorage.setItem('amplify_appearance_mode', value);
    if (value === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    } else {
      applyTheme(value);
    }
  };

  // ── Chat font (serif / sans) ──────────────────────────────────────────
  // getChatFont() checks: dedicated localStorage key → settings blob → DEFAULT_CHAT_FONT ('sans')
  const [chatFont, setChatFont] = useState<'serif' | 'sans'>(() => {
    if (typeof window === 'undefined') return 'sans';
    return getChatFont();
  });
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [storageDropdownOpen, setStorageDropdownOpen] = useState(false);
  const [pendingStorageSelection, setPendingStorageSelection] = useState<ConversationStorage | null>(null);
  const [storageSaving, setStorageSaving] = useState(false);

  // Refs for storage async closures (same pattern as NewStorageSection)
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const foldersRef = useRef(folders);
  useEffect(() => { foldersRef.current = folders; }, [folders]);

  const handleStorageChange = (selection: ConversationStorage) => {
    setStorageDropdownOpen(false);
    if (selection === storageSelection || storageSaving) return;
    setPendingStorageSelection(selection);
  };

  const cancelStorageChange = () => {
    setPendingStorageSelection(null);
  };

  const confirmStorageChange = async () => {
    const selection = pendingStorageSelection;
    setPendingStorageSelection(null);
    if (!selection) return;

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
      // Persist to server so the preference roams across devices / browsers
      void saveDisplayPrefsToServer({ storageSelection: selection });
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
    // Save to server so the preference roams across devices / browsers
    void saveDisplayPrefsToServer({ chatFont: value });
  };

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

        {/* Default model row */}
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
          <div>
            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Default model</span>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Pre-selected when you start a new conversation.
            </p>
          </div>

          {/* Chromeless dropdown trigger — same pattern as chat font */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setModelDropdownOpen((o) => !o)}
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
              <span style={{ fontSize: '14px', color: 'var(--text-primary)', maxWidth: '18ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedModelName}
              </span>
              <IconChevronDown size={12} stroke={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>

            {modelDropdownOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setModelDropdownOpen(false)}
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
                    minWidth: '260px',
                    maxHeight: 'min(380px, 50dvh)',
                    overflowY: 'auto',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  }}
                >
                  {/* "System default" clears the personal choice */}
                  {(() => {
                    const isActive = !userDefaultModelId;
                    return (
                      <button
                        onClick={() => handleDefaultModelChange('')}
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
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: isActive ? 500 : 400 }}>
                            System default
                          </span>
                          {isActive && <span style={{ color: 'var(--accent)', fontSize: '14px', lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Uses the admin-configured default model
                        </span>
                      </button>
                    );
                  })()}

                  {/* Divider */}
                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 6px' }} />

                  {allModels.map((model) => {
                    const isActive = userDefaultModelId === model.id;
                    const roleLabel =
                      advancedModelId === model.id ? 'Advanced tasks' :
                      defaultModelId === model.id ? 'System default' : null;
                    return (
                      <button
                        key={model.id}
                        onClick={() => handleDefaultModelChange(model.id)}
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
                          modelCard.show(model, e.currentTarget);
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                          modelCard.hide();
                        }}
                        onFocus={(e) => modelCard.show(model, e.currentTarget)}
                        onBlur={() => modelCard.hide()}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                          <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: isActive ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {model.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {roleLabel && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-active)', padding: '1px 6px', borderRadius: '4px' }}>
                                {roleLabel}
                              </span>
                            )}
                            {isActive && <span style={{ color: 'var(--accent)', fontSize: '14px', lineHeight: 1 }}>✓</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Hover-preview card — portalled, so the scroll container can't clip it */}
                {modelCard.item && (
                  <InfoFloatCard anchor={modelCard.anchor} onMouseEnter={modelCard.cancelHide} onMouseLeave={modelCard.hide}>
                    <ModelCardBody model={modelCard.item} />
                  </InfoFloatCard>
                )}
              </>
            )}
          </div>
        </div>

        {/* Default effort row */}
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
          <div>
            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Default reasoning effort</span>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Pre-selected effort level for new conversations.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setEffortDropdownOpen((o) => !o)}
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
              <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                {selectedEffortLabel}
              </span>
              <IconChevronDown size={12} stroke={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>

            {effortDropdownOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setEffortDropdownOpen(false)}
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
                    minWidth: '200px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  }}
                >
                  {/* "Medium (default)" clears the personal choice */}
                  {(() => {
                    const isActive = !userDefaultEffortId;
                    return (
                      <button
                        onClick={() => handleDefaultEffortChange('')}
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
                          transition: 'background 80ms ease',
                        }}
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: isActive ? 500 : 400 }}>
                          Medium (default)
                        </span>
                        {isActive && <span style={{ color: 'var(--accent)', fontSize: '14px', lineHeight: 1 }}>✓</span>}
                      </button>
                    );
                  })()}

                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 6px' }} />

                  {EFFORT_OPTIONS.map((opt) => {
                    const isActive = userDefaultEffortId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleDefaultEffortChange(opt.id)}
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
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div>
                            <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: isActive ? 500 : 400 }}>
                              {opt.label}
                            </span>
                            {opt.isDefault && !userDefaultEffortId && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>system default</span>
                            )}
                          </div>
                          {isActive && <span style={{ color: 'var(--accent)', fontSize: '14px', lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {opt.info}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Web search row */}
        {webSearchAvailable && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '14px',
            }}
          >
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span id="settings-web-search-label" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                  Web search
                </span>
                <InfoTooltip
                  ariaLabel="About web search and Level 3 data"
                  maxWidth={320}
                  text={WEB_SEARCH_LEVEL3_INFO}
                />
              </span>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Turn off when working with Level 3 data.
              </p>
            </div>
            <ToggleSwitch
              checked={webSearchEnabled}
              onChange={handleWebSearchChange}
              aria-labelledby="settings-web-search-label"
            />
          </div>
        )}

        {/* Halloween effects row (seasonal) */}
        {showHalloweenToggle && (
          <>
            {[
              {
                part: 'theme' as const,
                id: 'settings-halloween-label',
                label: 'Halloween theme 🎃',
                hint: 'Spooky home page: pumpkin, bats, cobweb and fog.',
                checked: halloweenEnabled,
                disabled: false,
              },
              {
                part: 'swarm' as const,
                id: 'settings-bat-swarm-label',
                label: 'Bat swarm on send 🦇',
                hint: 'Bats fly across the screen when you send from the home page.',
                checked: halloweenEnabled && batSwarmEnabled,
                disabled: !halloweenEnabled,
              },
            ].map(({ part, id, label, hint, checked, disabled }) => (
              <div
                key={part}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  paddingBottom: '14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '14px',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <div>
                  <span id={id} style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                    {label}
                  </span>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{hint}</p>
                </div>
                <ToggleSwitch
                  checked={checked}
                  disabled={disabled}
                  onChange={(v) => setHalloweenPartEnabled(part, v)}
                  aria-labelledby={id}
                />
              </div>
            ))}
          </>
        )}

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
                  : STORAGE_OPTIONS.find((o) => o.id === (storageSelection || DEFAULT_STORAGE_SELECTION))?.label ?? 'Select…'}
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
                    const isActive = (storageSelection || DEFAULT_STORAGE_SELECTION) === opt.id;
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

      <ConfirmDialog
        isOpen={pendingStorageSelection !== null}
        title="Change conversation storage?"
        message={pendingStorageSelection ? STORAGE_CONFIRM[pendingStorageSelection] : ''}
        confirmLabel="Change storage"
        variant="warning"
        onConfirm={confirmStorageChange}
        onCancel={cancelStorageChange}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Account Section — delegates to NewAccountSection (new-UI styled)
// ---------------------------------------------------------------------------

const AccountSection: FC<{
  active: boolean;
  onUnsavedChange: (unsaved: boolean) => void;
}> = ({ active, onUnsavedChange }) => {
  if (!active) return null;
  return <NewAccountSection onUnsavedChange={onUnsavedChange} />;
};

// ---------------------------------------------------------------------------
// Skills Section
// ---------------------------------------------------------------------------

const SkillsSection: FC = () => {
  const { state: { chatEndpoint } } = useContext(HomeContext);
  const wrapperRef = useRef<HTMLDivElement>(null);

  if (!chatEndpoint) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '20px' }}>
        Skills require a connected endpoint. Please check your configuration.
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="new-ui-skills-override relative" data-new-ui-settings-skills="true">
      <SkillsLibrary chatEndpoint={chatEndpoint} />
      <NewUILegacyLoadingAdapter
        wrapperRef={wrapperRef}
        selector=".h-64 > .text-center:has(> svg.animate-spin)"
        matchText="Loading skills..."
        message="Loading skills…"
      />
    </div>
  );
};

const MCPServersSection: FC<{
  onLeaveGuardChange: (guard: LeaveGuard | null) => void;
}> = ({ onLeaveGuardChange }) => <NewMcpServersSection onLeaveGuardChange={onLeaveGuardChange} />;

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

const ApiKeysSection: FC<{
  active: boolean;
  onLeaveGuardChange: (guard: LeaveGuard | null) => void;
}> = ({ active, onLeaveGuardChange }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [defaultAccount, setDefaultAccount] = useState<Account>(noCoaAccount);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!active) return;

    const currentRequest = ++requestId.current;
    setIsLoadingAccounts(true);
    setAccountsError(false);

    getAccounts()
      .then((result) => {
        if (requestId.current !== currentRequest) return;
        if (!result.success || !result.data) {
          setAccountsError(true);
          return;
        }

        const loadedAccounts: Account[] = result.data;
        setAccounts(loadedAccounts);
        setDefaultAccount(
          loadedAccounts.find((account) => account.isDefault) ?? loadedAccounts[0] ?? noCoaAccount,
        );
      })
      .catch(() => {
        if (requestId.current === currentRequest) setAccountsError(true);
      })
      .finally(() => {
        if (requestId.current === currentRequest) setIsLoadingAccounts(false);
      });

    return () => {
      if (requestId.current === currentRequest) requestId.current += 1;
    };
  }, [active, loadAttempt]);

  if (isLoadingAccounts || !active) {
    return (
      <NewUILoadingStatus open message="Loading billing accounts…" variant="inline" />
    );
  }

  if (accountsError) {
    return (
      <div style={{ padding: '20px', color: 'var(--text-error)' }}>
        <p>Unable to load billing accounts.</p>
        <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
          Try again
        </button>
      </div>
    );
  }

  // The legacy `ApiKeys` list queued edits for a `settingsSave` event this modal never fires,
  // so edits were silently dropped. NewApiKeysSection saves per card.
  return (
    <div className="text-neutral-900 dark:text-white relative">
      <NewApiKeysSection
        key={loadAttempt}
        accounts={accounts}
        defaultAccount={defaultAccount}
        onLeaveGuardChange={onLeaveGuardChange}
      />
    </div>
  );
};

// AdminSection is intentionally empty — the main NewSettingsModal handles
// rendering AdminUI as a peer modal when activeSection === 'admin'.
// This placeholder is never actually rendered because the modal short-circuits.
const AdminSection: FC = () => null;

// ---------------------------------------------------------------------------
// Usage Section — inline MTD cost breakdown, gated by featureFlags.mtdCost
// ---------------------------------------------------------------------------

const UsageSection: FC = () => {
  const { data: session } = useSession();
  const email = session?.user?.email ?? '';
  return <UserCostBreakdownContent email={email} />;
};

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

// CustomInstructionsSection is imported from ./CustomInstructionsSection

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

const SectionContent: FC<{
  sectionId: string;
  onAccountUnsavedChange: (unsaved: boolean) => void;
  onLeaveGuardChange: (guard: LeaveGuard | null) => void;
}> = ({ sectionId, onAccountUnsavedChange, onLeaveGuardChange }) => {
  switch (sectionId) {
    case 'general':
      return <GeneralSection />;
    case 'account':
      return <AccountSection active={true} onUnsavedChange={onAccountUnsavedChange} />;
    case 'usage':
      return <UsageSection />;
    case 'apikeys':
      return <ApiKeysSection active={true} onLeaveGuardChange={onLeaveGuardChange} />;
    case 'promptTemplates':
      return <PromptTemplatesSection />;
    case 'customInstructions':
      return <CustomInstructionsSection />;
    case 'skills':
      return <SkillsSection />;
    case 'connectors':
      return <NewConnectorsSection />;
    case 'mcp':
      return <MCPServersSection onLeaveGuardChange={onLeaveGuardChange} />;
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
  // Stable flags (NEW_UI_GUIDE §12): bare state.featureFlags is `{}` until /feature_flags
  // lands, which would hide gated rows (Skills, Usage, Admin) and bounce the user off them.
  const featureFlags = useStableFeatureFlags();
  const [requestedSection, setActiveSection] = useState<string>(openToSection ?? 'general');
  // A section can be requested (openToSection / openNewUISettingsSection) that the flags
  // don't allow — e.g. Skills with `skills` off. Never render it; fall back to General.
  const activeSection = requestedSection === 'skills' && !featureFlags.skills ? 'general' : requestedSection;
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdminUI, setShowAdminUI] = useState(openToSection === 'admin');
  const track = useTrack();
  // Opened once per mount (the modal only mounts while open).
  useEffect(() => {
    track('Settings Opened', { 'Section': openToSection ?? 'general' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Every section the user lands on, including the one it opened to.
  useEffect(() => {
    track('Settings Section Viewed', { 'Section': showAdminUI ? 'admin' : activeSection });
  }, [activeSection, showAdminUI, track]);
  const [accountHasUnsavedChanges, setAccountHasUnsavedChanges] = useState(false);
  // A section other than Account can also hold something worth confirming before leaving
  // (API Access: an uncopied one-time key, or unsaved key edits).
  const [sectionGuard, setSectionGuard] = useState<LeaveGuard | null>(null);
  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const requestLeave = useCallback((action: () => void) => {
    if (!accountHasUnsavedChanges && !sectionGuard) {
      action();
      return;
    }
    setPendingLeaveAction(() => action);
  }, [accountHasUnsavedChanges, sectionGuard]);

  // Section requests are events rather than prop changes: the same destination
  // may be requested repeatedly while Settings remains mounted.
  useEffect(() => {
    const handleOpenSection = (event: Event) => {
      const section = (event as CustomEvent<{ section?: string }>).detail?.section;
      if (!section || section === activeSection) return;
      requestLeave(() => {
        setActiveSection(section);
        setShowAdminUI(section === 'admin');
        setSearchQuery('');
      });
    };
    window.addEventListener('openNewUISettingsSection', handleOpenSection);
    return () => window.removeEventListener('openNewUISettingsSection', handleOpenSection);
  }, [activeSection, requestLeave]);

  const confirmLeave = useCallback(() => {
    const action = pendingLeaveAction;
    setPendingLeaveAction(null);
    setAccountHasUnsavedChanges(false);
    action?.();
  }, [pendingLeaveAction]);

  useEffect(() => {
    if (!accountHasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [accountHasUnsavedChanges]);

  // Build nav groups dynamically — usage hidden when mtdCost flag is off, admin only shown to admins
  const navGroups: NavGroup[] = [
    ...BASE_NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item =>
        (item.id !== 'usage' || !!featureFlags.mtdCost) &&
        (item.id !== 'skills' || !!featureFlags.skills),
      ),
    })),
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
        requestLeave(onClose);
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
  }, [onClose, requestLeave, showAdminUI]);

  // Scroll content pane to top when section changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeSection]);

  // Allow child sections (e.g. PromptTemplatesSection) to close this modal
  // by dispatching window.dispatchEvent(new Event('closeNewUISettings')).
  useEffect(() => {
    const handler = () => requestLeave(onClose);
    window.addEventListener('closeNewUISettings', handler);
    return () => window.removeEventListener('closeNewUISettings', handler);
  }, [onClose, requestLeave]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) requestLeave(onClose);
    },
    [onClose, requestLeave],
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

  const leaveGuard: LeaveGuard | null = accountHasUnsavedChanges
    ? {
        title: 'Unsaved account changes',
        message:
          'You have unsaved account changes. Save them before leaving to keep your updates, or leave without saving to discard them.',
        confirmLabel: 'Leave without saving',
        cancelLabel: 'Keep editing',
        variant: 'danger',
      }
    : sectionGuard;
  // A pending leave whose guard has since cleared is stale; drop it so it can't fire later.
  const hasLeaveGuard = leaveGuard !== null;
  useEffect(() => {
    if (pendingLeaveAction && !hasLeaveGuard) setPendingLeaveAction(null);
  }, [pendingLeaveAction, hasLeaveGuard]);
  const unsavedChangesDialog = (
    <ConfirmDialog
      isOpen={pendingLeaveAction !== null && leaveGuard !== null}
      title={leaveGuard?.title ?? ''}
      message={leaveGuard?.message ?? ''}
      confirmLabel={leaveGuard?.confirmLabel}
      cancelLabel={leaveGuard?.cancelLabel}
      variant={leaveGuard?.variant ?? 'danger'}
      onConfirm={confirmLeave}
      onCancel={() => setPendingLeaveAction(null)}
    />
  );

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
    return <>{unsavedChangesDialog}<NewAdminModal onClose={onClose} /></>;
  }

  return (
    <>
      {unsavedChangesDialog}
      {/* Overlay */}
      <div
        className="new-ui-settings-modal-overlay"
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
        padding: '8px',
        boxSizing: 'border-box',
      }}
    >
      {/* Panel — fixed height so both panes can independently scroll */}
      <div
        className="new-ui-settings-modal-panel"
        ref={panelRef}
        tabIndex={-1}
        style={{
          width: 'calc(100vw - 16px)',
          maxWidth: 'none',
          height: 'calc(100dvh - 16px)',
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '210px 1fr',
          gridTemplateRows: '100%',       /* single row fills height */
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-heading"
      >
        {/* ----------------------------------------------------------------
            Left Rail
        ---------------------------------------------------------------- */}
        <div
          className="new-ui-settings-modal-rail"
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
                    if (item.id === activeSection && !showAdminUI) return;
                    requestLeave(() => {
                      if (item.id === 'admin') {
                        setShowAdminUI(true);
                      } else {
                        setActiveSection(item.id);
                        setShowAdminUI(false);
                        setSearchQuery('');
                      }
                    });
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
          className="new-ui-settings-modal-content"
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              {activeSection === 'connectors' && (
                <InfoTooltip
                  ariaLabel="About connectors"
                  maxWidth={360}
                  text="Connecting a service lets you attach its related actions and tools to your chats. It does not let Amplify use the service however it wants; only the actions you attach are available to the AI."
                />
              )}
              {activeSection === 'skills' && (
                <InfoTooltip
                  ariaLabel="About skills"
                  maxWidth={360}
                  text="Skills are reusable instruction sets that guide the AI for specific tasks. Manage your skills here, then choose up to three from the + menu for each conversation. The AI uses the selected skills as relevant to that chat."
                />
              )}
              {activeSection === 'mcp' && (
                <InfoTooltip
                  ariaLabel="About MCP servers"
                  maxWidth={360}
                  text="MCP servers give the AI extra tools from external services. You don’t attach them to individual conversations: enabled servers are available in every chat, and the AI calls their tools automatically when your prompt calls for it. Client-side servers are called from your browser, so backend refresh and OAuth are unavailable. Trusting a server lets Amplify’s backend call it instead, which turns those features on."
                />
              )}
              {activeSection === 'sidebarItems' && (
                <InfoTooltip
                  ariaLabel="About sidebar items"
                  maxWidth={360}
                  text="Choose which items appear in your sidebar. New Chat, Customize, and Recent conversations are always visible."
                />
              )}
              {activeSection === 'customInstructions' && (
                <InfoTooltip
                  ariaLabel="About custom instructions"
                  maxWidth={360}
                  text="Custom instructions are added to the system prompt for new standard, template, and assistant conversations to tailor responses to your preferences. Select None to turn them off."
                />
              )}
              {activeSection === 'usage' && (
                <InfoTooltip
                  ariaLabel="About usage"
                  maxWidth={360}
                  text="This page helps you understand your AI token usage. You are not charged or billed for usage accumulated through the Amplify interface; only API usage is billed."
                />
              )}
              {activeSection === 'promptTemplates' && (
                <InfoTooltip
                  ariaLabel="About prompt templates"
                  maxWidth={360}
                  text="Prompt templates help streamline repetitive prompting scenarios. To use one, click its template from this menu, fill in any requested details, and submit it to start a conversation."
                />
              )}
            </div>

            <button
              onClick={() => requestLeave(onClose)}
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
              <SectionContent
                sectionId={activeSection}
                onAccountUnsavedChange={setAccountHasUnsavedChanges}
                onLeaveGuardChange={setSectionGuard}
              />
            </React.Suspense>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default NewSettingsModal;
