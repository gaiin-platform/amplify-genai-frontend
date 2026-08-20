/**
 * NewSidebar — the unified sidebar for the new Amplify UI.
 *
 * Replaces the old TabSidebar (3 tabs: Chats, Assistants, Settings).
 * One sidebar with all navigation, recents, pinned items, and account.
 *
 * Layout (3 flex regions in a flex column):
 *   1. Header (flex-shrink:0) — wordmark, collapse, search
 *   2. Nav (flex-shrink:0) — new chat, primary nav items
 *   3. Recents (flex:1 overflow-y:auto) — scrollable chat history
 *   4. Footer (flex-shrink:0) — account row
 *
 * Responsive:
 *   ≥1100px: fixed 310px
 *   760-1099px: collapsed icon rail (60px)  [TODO: Phase 4]
 *   <760px: off-canvas drawer               [TODO: Phase 4]
 */
import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  IconMessage2,
  IconSparkles,
  IconLayoutGridAdd,
  IconClock,
  IconPlus,
  IconArrowsSort,
  IconLayoutList,
  IconBooks,
  IconAdjustments,
  IconLayoutSidebarLeftExpand,
  IconPuzzle,
} from '@tabler/icons-react';

import HomeContext from '@/pages/api/home/home.context';
import { Conversation } from '@/types/chat';
import {
  saveConversations,
  deleteConversationCleanUp,
} from '@/utils/app/conversation';
import { deleteRemoteConversation } from '@/services/remoteConversationService';
import { getIsLocalStorageSelection } from '@/utils/app/conversationStorage';
import { getFullTimestamp, getDateName } from '@/utils/app/date';
import { getArchiveNumOfDays } from '@/utils/app/folders';
import { DefaultModels } from '@/types/model';
import { v4 as uuidv4 } from 'uuid';

import { SidebarHeader } from './SidebarHeader';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarSection } from './SidebarSection';
import { ConversationRow } from './ConversationRow';
import { AccountMenu } from './AccountMenu';
import { IconButton } from '@/components/NewUI/shared/IconButton';
import { NewSettingsModal } from '@/components/NewUI/settings/NewSettingsModal';
import {
  SidebarVisibility,
  DEFAULT_SIDEBAR_VISIBILITY,
  SIDEBAR_VISIBILITY_KEY,
} from '@/components/NewUI/shared/sidebarVisibility';

// sessionStorage key used to hand off an initial ScheduledTask (from ScheduledTaskButton
// elsewhere in the old UI) into the freshly-mounted NewScheduledTasksView — mirrors the
// Pending-Message Bridge Pattern used by NewHome → ConversationViewShell.
const PENDING_SCHEDULED_TASK_KEY = 'amplify_pending_scheduled_task';

// ── Sidebar resize constants ──────────────────────────────────────────────
// Drag handle on right edge lets users resize the sidebar between MIN and MAX.
// Width is persisted to localStorage so it survives reloads.
// Collapsed icon-rail mode (52px) ignores these values entirely.
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 310;
const SIDEBAR_WIDTH_KEY = 'amplify_sidebar_width';

interface NewSidebarProps {
  email?: string | null;
  name?: string | null;
  username?: string | null;
}

/**
 * Parse a date for bucketing, handling three cases:
 *
 * 1. Full ISO timestamp (conversation.date) — e.g. "2026-08-06T18:23:00.000Z"
 *    → parse normally, compare as local-midnight boundaries
 *
 * 2. ISO date-only string (folder.date from addDateAttribute) — e.g. "2026-08-06"
 *    → MUST be parsed as LOCAL midnight, NOT UTC midnight.
 *    new Date("2026-08-06") gives UTC midnight which is "yesterday" in UTC-5.
 *    Fix: split into parts and use new Date(year, month-1, day).
 *
 * 3. Human-readable folder name — e.g. "Aug 6, 2026"
 *    → new Date("Aug 6, 2026") parses as local time, which is correct.
 */
function parseDateForBucket(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Case 2: YYYY-MM-DD only (no time component)
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch.map(Number);
    return new Date(y, m - 1, d); // local midnight — correct
  }

  // Case 1 & 3: full ISO or human-readable — let the browser parse
  const p = new Date(dateStr);
  return isNaN(p.getTime()) ? null : p;
}

/** Returns today's local-midnight Date */
function localMidnight(offsetDays = 0): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + offsetDays);
  return d;
}

// Group conversations by time bucket.
// Priority for date: conversation.date (ISO) → folder.date (YYYY-MM-DD) → folder.name parse
// archiveDays: conversations older than this many days are excluded (0 = show all)
function groupConversationsByTime(
  conversations: Conversation[],
  folders: { id: string; name: string; date?: string }[],
  archiveDays: number = 0,
): {
  today: Conversation[];
  yesterday: Conversation[];
  previous: Conversation[];
} {
  const todayStart = localMidnight(0);
  const yesterdayStart = localMidnight(-1);
  // Archive cutoff: anything before this date is hidden (unless archiveDays === 0)
  const archiveCutoff = archiveDays > 0 ? localMidnight(-archiveDays) : null;

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const previous: Conversation[] = [];

  // Sort newest first before grouping — use best available date for sort too
  const getConvTimestamp = (c: Conversation): number => {
    if (c.date) {
      const p = new Date(c.date);
      if (!isNaN(p.getTime())) return p.getTime();
    }
    if (c.folderId) {
      const folder = folders.find((f) => f.id === c.folderId);
      if (folder) {
        const dateStr = folder.date || folder.name;
        const p = parseDateForBucket(dateStr);
        if (p) return p.getTime();
      }
    }
    return 0;
  };

  const sorted = [...conversations].sort((a, b) => getConvTimestamp(b) - getConvTimestamp(a));

  for (const c of sorted) {
    let ts: Date | null = null;

    // 1. Conversation's own ISO timestamp (newest conversations always have this)
    if (c.date) {
      ts = parseDateForBucket(c.date);
    }

    // 2. Folder date (older conversations — folder.date set by addDateAttribute or folder.name)
    if (!ts && c.folderId) {
      const folder = folders.find((f) => f.id === c.folderId);
      if (folder) {
        // Prefer folder.date (already normalized YYYY-MM-DD by addDateAttribute)
        // Fall back to folder.name ("Aug 6, 2026" format)
        const dateStr = folder.date || folder.name;
        ts = parseDateForBucket(dateStr);
      }
    }

    if (!ts) {
      // No date at all — always show (can't determine age, don't hide)
      previous.push(c);
      continue;
    }

    // Apply archive cutoff — skip conversations older than N days
    if (archiveCutoff && ts < archiveCutoff) continue;

    if (ts >= todayStart) today.push(c);
    else if (ts >= yesterdayStart) yesterday.push(c);
    else previous.push(c);
  }

  return { today, yesterday, previous };
}

export const NewSidebar: React.FC<NewSidebarProps> = ({ email, name, username }) => {
  const {
    state: {
      conversations,
      selectedConversation,
      page,
      featureFlags,
      storageSelection,
      statsService,
      folders,
      syncingConversations,
    },
    dispatch,
    handleNewConversation,
    handleSelectConversation,
    handleUpdateConversation,
    getDefaultModel,
  } = useContext(HomeContext);

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('showChatbar');
    return stored !== null ? stored === 'true' : true;
  });
  // settingsSection: null = closed, 'general' = open to General, 'skills' = open to Customize
  const [settingsSection, setSettingsSection] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Sidebar item visibility ───────────────────────────────────────────────
  // Reads from localStorage on mount. Spread over DEFAULT_SIDEBAR_VISIBILITY so
  // any newly-added keys default to true even for users with an older stored value.
  const [sidebarVisibility, setSidebarVisibility] = useState<SidebarVisibility>(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_VISIBILITY_KEY);
      return stored
        ? { ...DEFAULT_SIDEBAR_VISIBILITY, ...JSON.parse(stored) }
        : DEFAULT_SIDEBAR_VISIBILITY;
    } catch {
      return DEFAULT_SIDEBAR_VISIBILITY;
    }
  });

  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // ── Sidebar drag-resize ───────────────────────────────────────────────────
  // sidebarWidth: committed React state — read from localStorage on mount,
  // persisted to localStorage on mouseup. Collapsed mode ignores this entirely.
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH;
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) {
        return Math.min(Math.max(parsed, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
      }
    }
    return SIDEBAR_DEFAULT_WIDTH;
  });
  // displayWidthRef tracks the "live" width so that any React re-render triggered
  // by other state changes (e.g. conversation list polling) during a drag applies
  // the correct in-progress width via style.width instead of snapping back to the
  // stale sidebarWidth state value.
  const displayWidthRef = useRef(sidebarWidth);
  // sidebarRef: direct handle to the sidebar DOM element for imperative width
  // updates during drag — bypasses React state to avoid re-render per pixel.
  const sidebarRef = useRef<HTMLDivElement>(null);
  // isHandleHovered: drives the subtle hover highlight on the drag handle
  const [isHandleHovered, setIsHandleHovered] = useState(false);

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = displayWidthRef.current;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(
        Math.max(startWidth + (moveEvent.clientX - startX), SIDEBAR_MIN_WIDTH),
        SIDEBAR_MAX_WIDTH,
      );
      displayWidthRef.current = newWidth;
      if (sidebarRef.current) {
        sidebarRef.current.style.width = newWidth + 'px';
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const finalWidth = displayWidthRef.current;
      setSidebarWidth(finalWidth);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(finalWidth));
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Listen for admin panel open event (dispatched by AccountMenu admin button)
  useEffect(() => {
    const handler = () => setSettingsSection('admin');
    window.addEventListener('openNewUIAdminPanel', handler);
    return () => window.removeEventListener('openNewUIAdminPanel', handler);
  }, []);

  // Listen for sidebar visibility changes (dispatched by SidebarItemsSection in settings)
  useEffect(() => {
    const handler = () => {
      try {
        const stored = localStorage.getItem(SIDEBAR_VISIBILITY_KEY);
        setSidebarVisibility(
          stored
            ? { ...DEFAULT_SIDEBAR_VISIBILITY, ...JSON.parse(stored) }
            : DEFAULT_SIDEBAR_VISIBILITY,
        );
      } catch {
        setSidebarVisibility(DEFAULT_SIDEBAR_VISIBILITY);
      }
    };
    window.addEventListener('amplifySidebarVisibilityChanged', handler);
    return () => window.removeEventListener('amplifySidebarVisibilityChanged', handler);
  }, []);

  // Listen for settings section open event (dispatched by AttachMenu submenus)
  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent).detail?.section;
      if (section) setSettingsSection(section);
    };
    window.addEventListener('openNewUISettingsSection', handler);
    return () => window.removeEventListener('openNewUISettingsSection', handler);
  }, []);

  // Listen for scheduled tasks open event (dispatched by ScheduledTaskButton elsewhere in
  // the old UI, e.g. from assistant modals). Hands the pre-filled task off to
  // NewScheduledTasksView via sessionStorage, then navigates to the full-pane view.
  useEffect(() => {
    const handler = (e: Event) => {
      const scheduledTask = (e as CustomEvent).detail?.scheduledTask;
      if (typeof window !== 'undefined') {
        if (scheduledTask) sessionStorage.setItem(PENDING_SCHEDULED_TASK_KEY, JSON.stringify(scheduledTask));
        else sessionStorage.removeItem(PENDING_SCHEDULED_TASK_KEY);
      }
      dispatch({ field: 'page', value: 'scheduledTasks' as any });
    };
    window.addEventListener('openScheduledTasksTrigger', handler);
    return () => window.removeEventListener('openScheduledTasksTrigger', handler);
  }, [dispatch]);

  // Archive cutoff — mirrors ChatFolders' archiveConversationPastNumOfDays logic.
  // 0 = show all; positive = hide folders older than N days.
  const [archiveDays, setArchiveDays] = useState(() => getArchiveNumOfDays());
  useEffect(() => {
    const handler = (e: Event) => setArchiveDays((e as CustomEvent).detail?.threshold ?? 0);
    window.addEventListener('updateArchiveThreshold', handler as EventListener);
    return () => window.removeEventListener('updateArchiveThreshold', handler as EventListener);
  }, []);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    dispatch({ field: 'showChatbar', value: next });
    localStorage.setItem('showChatbar', JSON.stringify(next));
  };

  const handleDeleteConversation = useCallback((conversation: Conversation) => {
    deleteConversationCleanUp(conversation);
    const updated = conversationsRef.current.filter((c) => c.id !== conversation.id);

    statsService.deleteConversationEvent(conversation);

    if (updated.length === 0) {
      const defaultModel = getDefaultModel(DefaultModels.DEFAULT);
      const newConversation: Conversation = {
        id: uuidv4(),
        name: 'New Conversation',
        messages: [],
        model: defaultModel,
        prompt: '',
        temperature: 0.5,
        folderId: null,
      } as any;
      updated.push(newConversation);
      dispatch({ field: 'selectedConversation', value: newConversation });
    } else if (selectedConversation?.id === conversation.id) {
      dispatch({ field: 'selectedConversation', value: updated[updated.length - 1] });
    }

    saveConversations(updated);
    dispatch({ field: 'conversations', value: updated });

    if (!getIsLocalStorageSelection(storageSelection)) {
      deleteRemoteConversation(conversation.id).catch(() => {});
    }
  }, [conversations, selectedConversation, storageSelection, statsService]);

  // Only pass chat-type folders to the grouping function (never 'prompt' or 'workflow' folders)
  const chatFolders = folders.filter((f: any) => !f.type || f.type === 'chat');

  // Filter conversations by search — show ALL conversations (they all have date-based folderIds)
  const filteredConversations = searchTerm
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : conversations;

  const { today, yesterday, previous } = groupConversationsByTime(filteredConversations, chatFolders, archiveDays);

  // Pinned conversations — check both data.pinned (new storage) and top-level cast (legacy).
  // TODO: once `pinned?: boolean` is added to the Conversation type, simplify to c.pinned.
  const isPinnedConv = (c: Conversation) => !!(c.data?.pinned) || !!(c as any).pinned;
  const pinned = filteredConversations.filter(isPinnedConv);
  const unpinned_today = today.filter((c) => !isPinnedConv(c));
  const unpinned_yesterday = yesterday.filter((c) => !isPinnedConv(c));
  const unpinned_previous = previous.filter((c) => !isPinnedConv(c));

  const navItems = [
    {
      icon: <IconMessage2 size={18} />,
      label: 'Chats',
      id: 'chats',
      visible: sidebarVisibility.chats,
      action: () => dispatch({ field: 'page', value: 'chats' as any }),
    },
    {
      icon: <IconSparkles size={18} />,
      label: 'Assistants',
      id: 'assistants',
      visible: sidebarVisibility.assistants,
      action: () => dispatch({ field: 'page', value: 'assistantGallery' }),
    },
    {
      icon: <IconBooks size={18} />,
      label: 'Library',
      id: 'library',
      visible: sidebarVisibility.library,
      action: () => dispatch({ field: 'page', value: 'library' as any }),
    },
    {
      icon: <IconAdjustments size={18} />,
      label: 'Customize',
      id: 'customize',
      visible: true, // always shown — removing it would lock users out of settings
      action: () => setSettingsSection('promptTemplates'),
    },
    ...(featureFlags.createAssistantWorkflows ? [{
      icon: <IconPuzzle size={18} />,
      label: 'Workflows',
      id: 'workflows',
      visible: sidebarVisibility.workflows,
      action: () => dispatch({ field: 'page', value: 'workflows' as any }),
    }] : []),
    ...(featureFlags.notebook ? [{
      icon: <IconLayoutGridAdd size={18} />,
      label: 'Notebook',
      id: 'notebook',
      visible: sidebarVisibility.notebook,
      action: () => dispatch({ field: 'page', value: 'notebook' }),
    }] : []),
    ...(featureFlags.scheduledTasks ? [{
      icon: <IconClock size={18} />,
      label: 'Scheduled',
      id: 'scheduled',
      visible: sidebarVisibility.scheduled,
      action: () => {
        if (typeof window !== 'undefined') sessionStorage.removeItem(PENDING_SCHEDULED_TASK_KEY);
        dispatch({ field: 'page', value: 'scheduledTasks' as any });
      },
    }] : []),
  ].filter(item => item.visible);

  const currentNavId: string | null =
    settingsSection !== null ? 'customize'
    : page === 'assistantGallery' ? 'assistants'
    : (page as any) === 'library' ? 'library'
    : page === 'notebook' ? 'notebook'
    : (page as any) === 'chats' ? 'chats'
    : (page as any) === 'scheduledTasks' ? 'scheduled'
    : (page as any) === 'workflows' ? 'workflows'
    : null; // home/chat view — nothing highlighted

  const renderConversationGroup = (convs: Conversation[], label?: string) => {
    if (convs.length === 0) return null;
    return (
      <div key={label}>
        {label && <SidebarSection label={label} />}
        <div className="flex flex-col gap-[2px] px-[10px]">
          {convs.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              isSelected={selectedConversation?.id === c.id}
              onSelect={() => handleSelectConversation(c)}
              onDelete={() => handleDeleteConversation(c)}
            />
          ))}
        </div>
      </div>
    );
  };

  // Collapsed state — icon rail with the specified buttons
  if (!isOpen) {
    const iconBtn = (onClick: () => void, title: string, icon: React.ReactNode, isActive = false) => (
      <button
        onClick={onClick}
        title={title}
        className={`
          w-9 h-9 flex items-center justify-center rounded-[8px] transition-colors
          ${isActive
            ? 'bg-[--bg-active] text-[--text-primary]'
            : 'text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover]'}
        `}
      >
        {icon}
      </button>
    );

    return (
      <>
        <div className="flex flex-col items-center w-[52px] py-3 border-r border-[--border-subtle] bg-[--bg-sidebar] flex-shrink-0 h-screen">
          {/* Expand sidebar */}
          {iconBtn(handleToggle, 'Expand sidebar', <IconLayoutSidebarLeftExpand size={18} />)}

          {/* Small gap */}
          <div className="h-3" />

          {/* New chat */}
          {iconBtn(
            () => {
              window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false } }));
              handleNewConversation({});
            },
            'New chat (⌘N)',
            <IconPlus size={18} />,
          )}

          {/* Chats and tasks */}
          {sidebarVisibility.chats && iconBtn(
            () => dispatch({ field: 'page', value: 'chats' as any }),
            'Chats and tasks',
            <IconMessage2 size={18} />,
            currentNavId === 'chats',
          )}

          {/* Assistants */}
          {sidebarVisibility.assistants && iconBtn(
            () => dispatch({ field: 'page', value: 'assistantGallery' }),
            'Assistants',
            <IconSparkles size={18} />,
            currentNavId === 'assistants',
          )}

          {/* Customize — always shown, opens to Prompt Templates (first item in Customize group) */}
          {iconBtn(
            () => setSettingsSection('promptTemplates'),
            'Customize',
            <IconAdjustments size={18} />,
            currentNavId === 'customize',
          )}

          {/* Scheduled tasks */}
          {featureFlags.scheduledTasks && sidebarVisibility.scheduled && iconBtn(
            () => {
              if (typeof window !== 'undefined') sessionStorage.removeItem(PENDING_SCHEDULED_TASK_KEY);
              dispatch({ field: 'page', value: 'scheduledTasks' as any });
            },
            'Scheduled',
            <IconClock size={18} />,
            currentNavId === 'scheduled',
          )}

          {/* Workflows */}
          {featureFlags.createAssistantWorkflows && sidebarVisibility.workflows && iconBtn(
            () => dispatch({ field: 'page', value: 'workflows' as any }),
            'Workflows',
            <IconPuzzle size={18} />,
            currentNavId === 'workflows',
          )}

          {/* Spacer — pushes account to bottom */}
          <div className="flex-1" />

          {/* Account */}
          <AccountMenu
            name={name}
            email={email}
            collapsed
            onOpenSettings={() => setSettingsSection('general')}
          />
        </div>

        {/* Settings modal still renders outside the rail */}
        {settingsSection !== null && (
          <NewSettingsModal
            openToSection={settingsSection}
            onClose={() => setSettingsSection(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        ref={sidebarRef}
        className="relative flex flex-col flex-shrink-0 bg-[--bg-sidebar] border-r border-[--border-subtle] h-screen transition-colors duration-200"
        style={{ fontFamily: 'Inter, sans-serif', width: displayWidthRef.current + 'px' }}
      >
        {/* 1. Header */}
        <SidebarHeader
          onCollapse={handleToggle}
          onSearch={() => dispatch({ field: 'page', value: 'chats' as any })}
        />

        {/* 2. Nav actions */}
        <div className="flex flex-col gap-[2px] px-[10px] pb-2 flex-shrink-0">
          {/* New Chat button */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false }}));
              handleNewConversation({});
            }}
            className={`
              group w-full flex items-center gap-[10px] h-[36px] px-[10px]
              rounded-[8px]
              text-[14px] font-normal text-[--text-secondary]
              hover:bg-[--bg-hover] hover:text-[--text-primary]
              transition-colors duration-100
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]
            `}
          >
            <IconPlus size={16} className="flex-shrink-0" />
            <span className="flex-1 text-left">New chat</span>
            <span className="text-[11px] text-[--text-muted] opacity-0 group-hover:opacity-100 transition-opacity">
              ⌘N
            </span>
          </button>

          {/* Primary nav items */}
          <div className="flex flex-col gap-[2px]">
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={currentNavId !== null && currentNavId === item.id}
                onClick={item.action}
              />
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-[--border-subtle] mx-[10px] mb-1 flex-shrink-0" />

        {/* 3. Scrollable Recents */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0, #000 8px, #000 calc(100% - 16px), transparent 100%)',
          }}
        >
          {/* Pinned section — only rendered when at least one conversation is pinned */}
          {pinned.length > 0 && (
            <SidebarSection
              label="Pinned"
              isCollapsible
              storageKey="amplify_sidebar_pinned_collapsed"
            >
              <div className="flex flex-col gap-[2px] px-[10px]">
                {pinned.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    isSelected={selectedConversation?.id === c.id}
                    onSelect={() => handleSelectConversation(c)}
                    onDelete={() => handleDeleteConversation(c)}
                  />
                ))}
              </div>
            </SidebarSection>
          )}

          {/* Recents section — always visible, collapsible, persisted to localStorage */}
          <SidebarSection
            label="Recents"
            isCollapsible
            storageKey="amplify_sidebar_recents_collapsed"
            rightSlot={
              <div className="flex items-center gap-1">
                <IconButton size="sm" title="Sort conversations">
                  <IconArrowsSort size={13} />
                </IconButton>
                <IconButton
                  size="sm"
                  title="View all chats"
                  onClick={() => dispatch({ field: 'page', value: 'chats' as any })}
                >
                  <IconLayoutList size={13} />
                </IconButton>
              </div>
            }
          >
            {/* Skeleton rows while loading */}
            {syncingConversations && (unpinned_today.length + unpinned_yesterday.length + unpinned_previous.length) === 0 && (
              <div className="flex flex-col gap-[4px] px-[10px] pt-2">
                {[80, 65, 75, 55, 70].map((w, i) => (
                  <div
                    key={i}
                    className="h-[32px] rounded-[8px] bg-[--bg-hover] animate-pulse"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            )}

            {/* Today — hide "New Conversation" entries that have no messages (placeholder convs) */}
            {renderConversationGroup(
              unpinned_today.filter(c => c.name !== 'New Conversation' || c.messages?.length > 0),
              unpinned_today.filter(c => c.name !== 'New Conversation' || c.messages?.length > 0).length > 0 &&
              (unpinned_yesterday.length > 0 || unpinned_previous.length > 0) ? 'Today' : undefined
            )}

            {/* Yesterday */}
            {renderConversationGroup(unpinned_yesterday, 'Yesterday')}

            {/* Previous N days — label matches the archive window */}
            {renderConversationGroup(
              unpinned_previous,
              unpinned_previous.length > 0
                ? (archiveDays > 0 ? `Previous ${archiveDays} days` : 'Older')
                : undefined
            )}

            {/* Empty state — only when not loading and nothing visible after archive filter */}
            {!syncingConversations && (unpinned_today.length + unpinned_yesterday.length + unpinned_previous.length + pinned.length) === 0 && (
              <div className="px-[10px] py-8 text-center text-[13px] text-[--text-muted]">
                No conversations yet
              </div>
            )}
          </SidebarSection>

          {/* Bottom padding for scroll */}
          <div className="h-4" />
        </div>

        {/* 4. Footer — Account */}
        <AccountMenu
          name={name}
          email={email}
          onOpenSettings={() => setSettingsSection('general')}
        />

        {/* Drag-resize handle — 5px strip on the right edge.
            Only rendered in expanded mode. Collapsed rail uses a fixed 52px and
            is a completely separate render path — this handle is never in that tree.
            Uses direct DOM updates during drag (no React state per pixel); commits
            to state + localStorage on mouseup only. */}
        <div
          onMouseDown={handleDragMouseDown}
          onMouseEnter={() => setIsHandleHovered(true)}
          onMouseLeave={() => setIsHandleHovered(false)}
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '5px',
            cursor: 'col-resize',
            zIndex: 10,
            backgroundColor: isHandleHovered ? 'var(--border-subtle)' : 'transparent',
            transition: 'background-color 150ms ease',
          }}
        />
      </div>

      {/* New Settings Modal — two-column per spec */}
      {settingsSection !== null && (
        <NewSettingsModal
          openToSection={settingsSection}
          onClose={() => setSettingsSection(null)}
        />
      )}
    </>
  );
};

export default NewSidebar;
