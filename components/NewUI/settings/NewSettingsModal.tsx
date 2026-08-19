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
} from '@tabler/icons-react';

import HomeContext from '@/pages/api/home/home.context';
import { getSettings, saveSettings, featureOptionFlags } from '@/utils/app/settings';
import { FlagsMap, Flag } from '@/components/ReusableComponents/FlagsMap';
import { SkillsLibrary } from '@/components/Skills/SkillsLibrary';
import { MCPServersTab } from '@/components/Settings/MCPServersTab';
import { ApiKeys } from '@/components/Settings/AccountComponents/ApiKeys';
import { noCoaAccount } from '@/types/accounts';
import { Account } from '@/types/accounts';
import { NewAdminModal } from '@/components/NewUI/settings/NewAdminModal';
import { NewAccountSection } from '@/components/NewUI/settings/NewAccountSection';
import { NewStorageSection } from '@/components/NewUI/settings/NewStorageSection';
import { NewConnectorsSection } from '@/components/NewUI/settings/NewConnectorsSection';

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
      { id: 'storage', label: 'Storage', Icon: IconDatabase },
      { id: 'apikeys', label: 'API Access', Icon: IconKey },
    ],
  },
  {
    heading: 'Customize',
    items: [
      { id: 'customInstructions', label: 'Custom Instructions', Icon: IconNotes },
      { id: 'skills', label: 'Skills', Icon: IconPuzzle },
      { id: 'connectors', label: 'Connectors', Icon: IconPlug },
      { id: 'mcp', label: 'MCP Servers', Icon: IconServer },
    ],
  },
];

// Note: NAV_GROUPS and ALL_NAV_ITEMS removed — the dynamic navGroups / allNavItems
// computed inside the modal component replace them (they include the admin entry
// only when featureFlags.adminInterface is true).

// ---------------------------------------------------------------------------
// General Section
// ---------------------------------------------------------------------------

const GeneralSection: FC = () => {
  const {
    dispatch: homeDispatch,
    state: { featureFlags, lightMode },
  } = useContext(HomeContext);

  const settings = getSettings(featureFlags);
  const [featureOptions, setFeatureOptions] = useState<{ [key: string]: boolean }>(
    settings.featureOptions,
  );

  // Chat font preference (§6)
  const [chatFont, setChatFont] = useState<'serif' | 'sans'>(() => {
    if (typeof window === 'undefined') return 'serif';
    return (localStorage.getItem('amplify_chat_font') as 'serif' | 'sans') ?? 'serif';
  });

  const handleChatFontChange = (value: 'serif' | 'sans') => {
    setChatFont(value);
    localStorage.setItem('amplify_chat_font', value);
    // Notify ConversationViewShell to update data-body-face
    window.dispatchEvent(new Event('amplifyChatFontChanged'));
  };

  const handleThemeChange = (value: 'light' | 'dark') => {
    homeDispatch({ field: 'lightMode', value });
    localStorage.setItem('lightMode', value);
    if (value === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const current = getSettings(featureFlags);
    saveSettings({ ...current, theme: value });
  };

  const handleFlagChange = (key: string, value: boolean) => {
    const updated = { ...featureOptions, [key]: value };
    setFeatureOptions(updated);
    const current = getSettings(featureFlags);
    saveSettings({ ...current, featureOptions: updated });
    window.dispatchEvent(new Event('updateFeatureSettings'));
  };

  const visibleFlags: Flag[] = featureOptionFlags.filter((f: Flag) =>
    Object.prototype.hasOwnProperty.call(featureOptions, f.key),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Theme */}
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
            marginBottom: '4px',
          }}
        >
          Theme
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Choose your preferred visual theme
        </p>
        <div className="flex gap-3">
          {(['dark', 'light'] as const).map((t) => (
            <label
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            >
              <input
                type="radio"
                name="theme"
                value={t}
                checked={lightMode === t}
                onChange={() => handleThemeChange(t)}
                style={{ accentColor: 'var(--accent)' }}
              />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </label>
          ))}
        </div>
      </div>

      {/* Chat font (§6 — Preferences) */}
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
            marginBottom: '4px',
          }}
        >
          Chat font
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Choose the typeface for assistant responses
        </p>
        <div className="flex gap-4">
          {([
            { value: 'serif', label: 'Serif', desc: 'Newsreader (default)' },
            { value: 'sans', label: 'Sans', desc: 'Inter' },
          ] as const).map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: '14px',
              }}
            >
              <input
                type="radio"
                name="chatFont"
                value={opt.value}
                checked={chatFont === opt.value}
                onChange={() => handleChatFontChange(opt.value)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span>
                {opt.label}
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '4px' }}>
                  {opt.desc}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Feature flags */}
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
              marginBottom: '4px',
            }}
          >
            Features
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
            Enable or disable features
          </p>
          <FlagsMap
            id="new-settings-features"
            flags={visibleFlags}
            state={featureOptions}
            flagChanged={handleFlagChange}
          />
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
    case 'storage':
      return <StorageSection active={true} />;
    case 'apikeys':
      return <ApiKeysSection active={true} />;
    case 'customInstructions':
      return <CustomInstructionsSection />;
    case 'skills':
      return <SkillsSection />;
    case 'connectors':
      return <NewConnectorsSection />;
    case 'mcp':
      return <MCPServersTab open={true} />;
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
  }, [onClose]);

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
          maxWidth: '1040px',
          height: 'min(780px, 88dvh)',   /* fixed, not max-height, so children can fill and scroll */
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
            Right Content Pane — overflowY:auto + height:100% lets it scroll
        ---------------------------------------------------------------- */}
        <div
          ref={contentRef}
          style={{
            padding: '20px 32px 40px',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            position: 'relative',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Close button — sticky top-right */}
          <div
            style={{
              position: 'sticky',
              top: '20px',
              display: 'flex',
              justifyContent: 'flex-end',
              zIndex: 10,
              marginBottom: '-20px',
              pointerEvents: 'none',
            }}
          >
            <button
              onClick={onClose}
              aria-label="Close settings"
              style={{
                pointerEvents: 'auto',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-raised)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-raised)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
              }}
            >
              <IconX size={16} stroke={2} />
            </button>
          </div>

          {/* Section heading — id used by aria-labelledby on the dialog panel */}
          <h2
            id="settings-modal-heading"
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '20px',
              marginTop: '0',
              paddingRight: '44px',
            }}
          >
            {activeItem?.label ?? activeSection}
          </h2>

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

      {/* Admin Panel — new-UI two-column panel, rendered above the settings modal */}
      {showAdminUI && featureFlags.adminInterface && (
        <NewAdminModal
          onClose={() => {
            setShowAdminUI(false);
            setActiveSection('general');
          }}
        />
      )}
    </div>
  );
};

export default NewSettingsModal;
