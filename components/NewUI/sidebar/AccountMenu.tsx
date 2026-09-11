/**
 * AccountMenu — bottom row of the new sidebar.
 * Shows avatar + name + org, opens an upward popover on click.
 *
 * Menu items:
 *   Settings (⌘,)
 *   Appearance (Light / Dark)
 *   Documentation (external link)
 *   Switch to Classic UI
 *   ──
 *   Log out
 */
import React, { useState, useContext, useRef, useEffect } from 'react';
import {
  IconChevronUp,
  IconSettings,
  IconSun,
  IconMoon,
  IconLogout,
  IconExternalLink,
  IconDeviceDesktop,
  IconShield,
} from '@tabler/icons-react';
import { signOut } from 'next-auth/react';
import HomeContext from '@/pages/api/home/home.context';
import { setUIPreference } from '@/components/NewUI/UIPreferenceBanner';

const DOCS_URL = 'https://www.vanderbilt.edu/agi/platforms/resources/';

interface AccountMenuProps {
  name?: string | null;
  email?: string | null;
  org?: string | null;
  onOpenSettings?: () => void;
  /** When true, renders as a compact 36×36 icon button with the popover opening to the right */
  collapsed?: boolean;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({
  name,
  email,
  org,
  onOpenSettings,
  collapsed = false,
}) => {
  const { state: { lightMode, featureFlags }, dispatch } = useContext(HomeContext);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  // Focus first menu item on open; close on Escape (return focus to trigger)
  useEffect(() => {
    if (!open) return;
    // Focus the first focusable item in the menu when it opens
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    firstItem?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const initials = name
    ? name.split(' ').map((p) => p[0]?.toUpperCase()).slice(0, 2).join('')
    : email?.[0]?.toUpperCase() ?? '?';

  const displayName = name || email?.split('@')[0] || 'User';

  const setTheme = (mode: 'light' | 'dark') => {
    dispatch({ field: 'lightMode', value: mode });
    localStorage.setItem('lightMode', mode);
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setOpen(false);
  };

  const handleSwitchToClassic = () => {
    setOpen(false);
    // Persist then reload — server save is fire-and-forget before the reload
    setUIPreference('classic')
      .catch(() => {})
      .finally(() => window.location.reload());
  };

  // Shared menu item style
  const menuItem =
    'w-full flex items-center gap-2.5 px-3 h-[34px] text-[14px] rounded-[8px] ' +
    'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] transition-colors';

  return (
    <div className="relative">
      {/* ── Popover — opens upward (expanded) or to the right (collapsed) ── */}
      {open && (
        <div
          ref={menuRef}
          id="account-menu"
          role="menu"
          className={`
            fixed z-50 w-[288px]
            bg-[--bg-raised] border border-[--border-subtle]
            rounded-[14px] shadow-[0_16px_40px_rgba(0,0,0,0.4)]
            py-[6px] animate-fade-in
            ${collapsed
              ? 'bottom-[8px] left-[60px]'
              : 'bottom-[64px] left-[8px]'}
          `}
          style={{ transformOrigin: collapsed ? 'bottom left' : 'bottom left' }}
        >
          {/* Identity header */}
          <div className="px-3 pt-2 pb-2">
            <div className="text-[13px] text-[--text-secondary] leading-snug truncate">{email}</div>
            {org && (
              <div className="text-[12px] text-[--text-muted] mt-0.5 leading-none">{org}</div>
            )}
          </div>
          <div className="h-px bg-[--border-subtle] mx-2 my-1" />

          {/* Settings */}
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onOpenSettings?.(); }}
            className={menuItem}
          >
            <IconSettings size={15} />
            Settings
            <span className="ml-auto text-[11px] text-[--text-muted]">⌘,</span>
          </button>

          {/* Admin Panel — only shown when featureFlags.adminInterface is true */}
          {featureFlags.adminInterface && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onOpenSettings?.(); /* caller wires to admin section */ window.dispatchEvent(new CustomEvent('openNewUIAdminPanel')); }}
              className={menuItem}
            >
              <IconShield size={15} />
              Admin Panel
            </button>
          )}

          {/* Appearance */}
          <div className="px-3 py-1">
            <div className="text-[11px] text-[--text-muted] mb-1.5 mt-1">Appearance</div>
            <div className="flex gap-1">
              {(
                [
                  { id: 'light', icon: <IconSun size={13} />, label: 'Light' },
                  { id: 'dark',  icon: <IconMoon size={13} />, label: 'Dark'  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-1 h-[28px]
                    rounded-[6px] text-[12px] transition-colors
                    ${lightMode === opt.id
                      ? 'bg-[--bg-active] text-[--text-primary]'
                      : 'text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary]'}
                  `}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-[--border-subtle] mx-2 my-1" />

          {/* Documentation */}
          <a
            role="menuitem"
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={`${menuItem} no-underline`}
          >
            <IconExternalLink size={15} />
            Documentation
          </a>

          {/* Switch to Classic UI */}
          <button
            role="menuitem"
            onClick={handleSwitchToClassic}
            className={menuItem}
          >
            <IconDeviceDesktop size={15} />
            Switch to Classic UI
          </button>

          <div className="h-px bg-[--border-subtle] mx-2 my-1" />

          {/* Log out */}
          <button
            role="menuitem"
            onClick={() => signOut()}
            className={menuItem}
          >
            <IconLogout size={15} />
            Log out
          </button>
        </div>
      )}

      {/* ── Trigger ── */}
      {collapsed ? (
        /* Compact: 36×36 avatar button, centred in the icon rail */
        <div className="flex items-center justify-center pb-3">
          <button
            ref={triggerRef}
            onClick={() => setOpen((p) => !p)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls="account-menu"
            title={displayName}
            className="
              w-9 h-9 flex items-center justify-center rounded-full
              bg-[--bg-active] text-[12px] font-medium text-[--text-primary]
              hover:ring-2 hover:ring-[--border-subtle] transition-all
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]
            "
          >
            {initials}
          </button>
        </div>
      ) : (
        /* Full-width trigger row */
        <button
          ref={triggerRef}
          onClick={() => setOpen((p) => !p)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="account-menu"
          className="
            w-full flex items-center gap-2 h-[56px] px-3
            border-t border-[--border-subtle]
            hover:bg-[--bg-hover] transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary] focus-visible:ring-inset
          "
        >
          {/* Avatar */}
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[--bg-active] flex items-center justify-center text-[12px] font-medium text-[--text-primary]">
            {initials}
          </div>

          {/* Name block */}
          <div className="flex-1 min-w-0 text-left">
            <span className="text-[14px] font-medium text-[--text-primary] truncate block leading-none">
              {displayName}
              {org && (
                <span className="font-normal text-[--text-muted]"> · {org}</span>
              )}
            </span>
          </div>

          {/* Chevron */}
          <IconChevronUp
            size={14}
            className={`flex-shrink-0 text-[--text-muted] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
};

export default AccountMenu;
