/**
 * SidebarItemsSection — Settings → Customize → Sidebar Items
 *
 * A self-contained settings section for controlling which items appear in the sidebar.
 * Reads/writes localStorage key `amplify_sidebar_items_visible` and dispatches
 * `amplifySidebarVisibilityChanged` so NewSidebar re-reads visibility without a page reload.
 *
 * Toggle rows auto-save on change — no Save button needed.
 *
 * Always-visible (no toggle): New Chat, Customize, Recent conversations.
 */

import React, { useEffect, useId, useState } from 'react';
import {
  IconMessageCircle,
  IconSparkles,
  IconBooks,
  IconPuzzle,
  IconClock,
  IconLayoutGridAdd,
} from '@tabler/icons-react';
import {
  SidebarVisibility,
  DEFAULT_SIDEBAR_VISIBILITY,
  SIDEBAR_VISIBILITY_KEY,
} from '@/components/NewUI/shared/sidebarVisibility';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { useStableFeatureFlags } from '@/components/NewUI/shared/useStableFeatureFlags';

// ── Toggle row component ──────────────────────────────────────────────────────

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  toggleId: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isLast?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  icon,
  label,
  toggleId,
  checked,
  onChange,
  isLast,
}) => (
  <div
    // Clicking the whole row (including label) toggles the switch
    onClick={() => onChange(!checked)}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '11px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
      cursor: 'pointer',
      userSelect: 'none',
    }}
  >
    {/* Icon badge */}
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        color: 'var(--text-muted)',
        backgroundColor: 'var(--bg-app)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {icon}
    </div>

    {/* Label — id referenced by ToggleSwitch aria-labelledby */}
    <span
      id={toggleId + '-label'}
      style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.4 }}
    >
      {label}
    </span>

    {/* Toggle switch — stopPropagation is handled inside ToggleSwitch so row onClick doesn't double-fire */}
    <ToggleSwitch
      checked={checked}
      onChange={onChange}
      aria-labelledby={toggleId + '-label'}
    />
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const readStoredVisibility = (): SidebarVisibility => {
  try {
    const stored = localStorage.getItem(SIDEBAR_VISIBILITY_KEY);
    return stored
      ? { ...DEFAULT_SIDEBAR_VISIBILITY, ...JSON.parse(stored) }
      : DEFAULT_SIDEBAR_VISIBILITY;
  } catch {
    return DEFAULT_SIDEBAR_VISIBILITY;
  }
};

const SidebarItemsSection: React.FC = () => {
  // Cached flags rather than state.featureFlags directly: the raw state is `{}` until
  // the /feature_flags fetch resolves (and stays `{}` if it fails), which used to make
  // the Workflows / Scheduled Tasks / Notebook rows missing here — so a user who had
  // just hidden one of them had no control left to turn it back on.
  const featureFlags = useStableFeatureFlags();

  const uid = useId();

  const [visibility, setVisibility] = useState<SidebarVisibility>(readStoredVisibility);

  // Stay in sync with writes from anywhere else (another tab, or a second mount of
  // this panel) instead of showing a snapshot taken when the modal opened.
  useEffect(() => {
    const handler = () => setVisibility(readStoredVisibility());
    window.addEventListener('amplifySidebarVisibilityChanged', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('amplifySidebarVisibilityChanged', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const handleChange = (key: keyof SidebarVisibility, value: boolean) => {
    const updated = { ...visibility, [key]: value };
    setVisibility(updated);
    try {
      localStorage.setItem(SIDEBAR_VISIBILITY_KEY, JSON.stringify(updated));
    } catch {
      // localStorage write failed — silently ignore (private browsing, storage full)
    }
    window.dispatchEvent(new CustomEvent('amplifySidebarVisibilityChanged'));
  };

  type ToggleItem = {
    key: keyof SidebarVisibility;
    icon: React.ReactNode;
    label: string;
  };

  const items: ToggleItem[] = [
    {
      key: 'chats',
      icon: <IconMessageCircle size={16} />,
      label: 'Chats list',
    },
    {
      key: 'assistants',
      icon: <IconSparkles size={16} />,
      label: 'Assistants',
    },
    {
      key: 'library',
      icon: <IconBooks size={16} />,
      label: 'Library',
    },
    // Feature-flagged items — only included when the corresponding flag is on
    ...(featureFlags.createAssistantWorkflows
      ? [
          {
            key: 'workflows' as keyof SidebarVisibility,
            icon: <IconPuzzle size={16} />,
            label: 'Workflows',
          },
        ]
      : []),
    ...(featureFlags.scheduledTasks
      ? [
          {
            key: 'scheduled' as keyof SidebarVisibility,
            icon: <IconClock size={16} />,
            label: 'Scheduled Tasks',
          },
        ]
      : []),
    ...(featureFlags.notebook
      ? [
          {
            key: 'notebook' as keyof SidebarVisibility,
            icon: <IconLayoutGridAdd size={16} />,
            label: 'Notebook',
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 text-neutral-900 dark:text-white">
      {/* Main card */}
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
          Sidebar Items
        </h3>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            marginBottom: '16px',
            lineHeight: '1.5',
          }}
        >
          Choose which items appear in your sidebar.{' '}
          <span style={{ color: 'var(--text-muted)' }}>
            New Chat, Customize, and Recent conversations are always visible.
          </span>
        </p>

        {/* Toggle rows */}
        <div>
          {items.map((item, index) => (
            <ToggleRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              toggleId={`${uid}-${item.key}`}
              checked={visibility[item.key]}
              onChange={(val) => handleChange(item.key, val)}
              isLast={index === items.length - 1}
            />
          ))}
        </div>
      </div>

    </div>
  );
};

export default SidebarItemsSection;
export { SidebarItemsSection };
