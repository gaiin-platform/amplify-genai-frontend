/**
 * ChatsListView — full-pane "Chats and tasks" view.
 * Opened by clicking the expand arrow next to "Recents" in the sidebar.
 * Matches the Claude reference screenshot: title row, search, filter, scrollable table.
 *
 * Reusable via: dispatch({ field: 'page', value: 'chats' })
 */
import React, { useContext, useState, useMemo, useRef, useEffect } from 'react';
import { IconSearch, IconFilter, IconMessage2, IconPlus } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { Conversation } from '@/types/chat';

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeDate(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── component ─────────────────────────────────────────────────────────────────

export const ChatsListView: React.FC = () => {
  const {
    state: { conversations, selectedConversation, folders },
    dispatch,
    handleSelectConversation,
    handleNewConversation,
  } = useContext(HomeContext);

  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-focus the search box when the view opens
  useEffect(() => {
    const t = setTimeout(() => {
      searchRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, []);

  // Sort newest first, then filter by search
  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
  }, [conversations]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((c) => c.name.toLowerCase().includes(q));
  }, [sorted, search]);

  const handleOpen = (c: Conversation) => {
    handleSelectConversation(c);
    dispatch({ field: 'page', value: 'chat' });
  };

  return (
    <div
      className="flex-1 flex flex-col bg-[--bg-app] overflow-hidden"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* Page header */}
      <div className="flex items-center justify-between px-8 pt-10 pb-6 flex-shrink-0">
        <h1
          className="text-[28px] text-[--text-primary] font-normal leading-none tracking-[-0.01em]"
          style={{ fontFamily: '"Newsreader", "Georgia", serif' }}
        >
          Chats and tasks
        </h1>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <IconSearch
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted] pointer-events-none"
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className={`
                h-[34px] pl-9 pr-3 rounded-[8px] text-[13px]
                bg-[--bg-raised] border border-[--border-subtle]
                text-[--text-primary] placeholder:text-[--text-muted]
                focus:outline-none focus:border-[--bg-active]
                transition-colors w-[200px]
              `}
            />
          </div>

          {/* Filter */}
          <button className="flex items-center gap-1.5 h-[34px] px-3 rounded-[8px] text-[13px] bg-[--bg-raised] border border-[--border-subtle] text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] transition-colors">
            <IconFilter size={14} />
            Filter by
            <span className="text-[--text-primary] font-medium">All</span>
          </button>

          {/* New chat */}
          <button
            onClick={() => handleNewConversation({})}
            className="flex items-center gap-1.5 h-[34px] px-4 rounded-[8px] text-[13px] font-medium bg-[--text-primary] text-[--bg-app] hover:opacity-90 transition-opacity"
          >
            <IconPlus size={14} />
            New
          </button>
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[--text-muted]">
            <IconMessage2 size={32} className="mb-3 opacity-40" />
            <p className="text-[14px]">
              {search ? 'No chats match your search' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((c) => {
              const isSelected = selectedConversation?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleOpen(c)}
                  className={`
                    w-full flex items-center gap-3 px-3 h-[48px] rounded-[8px]
                    text-left transition-colors duration-100
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--text-secondary]
                    ${isSelected ? 'bg-[--bg-active]' : 'hover:bg-[--bg-hover]'}
                  `}
                >
                  <IconMessage2
                    size={16}
                    className="flex-shrink-0 text-[--text-muted]"
                  />
                  <span className="flex-1 text-[14px] text-[--text-primary] truncate">
                    {c.name || 'New Conversation'}
                  </span>
                  <span className="flex-shrink-0 text-[13px] text-[--text-muted]">
                    {relativeDate(c.date)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatsListView;
