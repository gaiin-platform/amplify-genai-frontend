import { IconCheck, IconChevronLeft, IconLoader2 } from '@tabler/icons-react';
import { type ReactNode, useEffect, useState } from 'react';

import { useConversationContextLoader } from '@/hooks/useConversationContextLoader';

import { getAllArtifacts } from '@/services/artifactsService';

import { isLocalConversation } from '@/utils/app/conversation';

import type { Conversation } from '@/types/chat';

import { buildArtifactLibraryItems } from './artifactLibraryModel';
import { artifactAttachmentKey } from './savedChatContext';
import type { SavedChatContextControls } from './useSavedChatContext';

const buttonStyle = { color: 'var(--accent)' };
const rowClass =
  'flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-[var(--bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]';

function PickerPanel({
  title,
  search,
  onSearch,
  onClose,
  children,
}: {
  title: string;
  search?: string;
  onSearch?: (value: string) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-xl border text-[13px]"
      style={{
        width: 'min(336px, calc(100vw - 16px))',
        background: 'var(--bg-raised)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-primary)',
        boxShadow: '0 12px 32px rgba(0,0,0,.45)',
      }}
    >
      <div
        className="border-b p-2.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <button type="button" onClick={onClose} style={buttonStyle}>
            Done
          </button>
        </div>
        {onSearch && (
          <input
            type="search"
            aria-label={`Search ${title.toLowerCase()}`}
            placeholder={`Search ${title.toLowerCase()}…`}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            className="mt-2 w-full rounded-lg border px-2 py-1.5"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--bg-app)',
            }}
          />
        )}
      </div>
      <div
        className="overflow-y-auto p-1.5"
        style={{ maxHeight: 'min(300px, calc(100dvh - 126px))' }}
      >
        {children}
      </div>
    </section>
  );
}

export function ArtifactLibraryPicker({
  controls,
  onClose,
}: {
  controls: SavedChatContextControls;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [attempt, retryList] = useState(0);
  const [list, setList] = useState<{
    items: ReturnType<typeof buildArtifactLibraryItems>;
    status: 'loading' | 'ready' | 'error';
  }>({ items: [], status: 'loading' });

  useEffect(() => {
    let active = true;
    setList({ items: [], status: 'loading' });
    const load = async () => {
      try {
        const result = await getAllArtifacts();
        if (!result.success) throw new Error('Library unavailable');
        if (active)
          setList({
            items: buildArtifactLibraryItems(result.data),
            status: 'ready',
          });
      } catch {
        if (active) setList({ items: [], status: 'error' });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [attempt]);

  const items = list.items.filter((item) =>
    item.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const selected = new Map(
    controls.artifactChips.map((chip) => [chip.key, chip]),
  );

  return (
    <PickerPanel
      title="Saved artifacts"
      search={search}
      onSearch={setSearch}
      onClose={onClose}
    >
      {list.status === 'loading' && (
        <p role="status" className="p-2">
          Loading saved artifacts…
        </p>
      )}
      {list.status === 'error' && (
        <div className="p-2">
          <p role="alert">Could not load saved artifacts.</p>
          <button
            type="button"
            onClick={() => retryList(attempt + 1)}
            style={buttonStyle}
          >
            Retry
          </button>
        </div>
      )}
      {list.status === 'ready' && !items.length && (
        <p className="p-2">
          {search.trim() ? 'No matching artifacts.' : 'No saved artifacts yet.'}
        </p>
      )}
      {items.map((item) => {
        const key = artifactAttachmentKey(item);
        const chip = selected.get(key);
        const active = chip?.status === 'ready' || chip?.status === 'loading';
        return (
          <button
            type="button"
            key={key}
            className={rowClass}
            aria-pressed={active}
            aria-label={
              chip?.status === 'error' ? `Retry ${item.name}` : item.name
            }
            onClick={() =>
              active
                ? controls.removeArtifact(key)
                : void controls.attachArtifact(item)
            }
          >
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {chip?.status === 'ready' && (
              <IconCheck size={16} aria-hidden="true" style={buttonStyle} />
            )}
            {chip?.status === 'loading' && (
              <IconLoader2
                size={16}
                aria-label="Loading"
                className="animate-spin"
              />
            )}
            {chip?.status === 'error' && <span style={buttonStyle}>Retry</span>}
          </button>
        );
      })}
    </PickerPanel>
  );
}

export function ConversationContextPicker({
  controls,
  conversations,
  currentId,
  onClose,
}: {
  controls: SavedChatContextControls;
  conversations: Conversation[];
  currentId?: string;
  onClose: () => void;
}) {
  const { loadedStates, loadConversation } = useConversationContextLoader();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const matches = conversations.filter(
    (conversation) =>
      conversation.id !== currentId &&
      conversation.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const openChat = conversations.find(
    (conversation) =>
      conversation.id === openId && conversation.id !== currentId,
  );
  const loaded = openChat && loadedStates[openChat.id];
  const messages = loaded?.status === 'loaded' ? loaded.messages : [];
  const matchingIds = messages
    .filter((message) => selectedIds.includes(message.id))
    .map((message) => message.id);

  return (
    <PickerPanel
      title="Previous chats"
      search={search}
      onSearch={openChat ? undefined : setSearch}
      onClose={onClose}
    >
      {openChat ? (
        <div className="space-y-2 p-2">
          <button
            type="button"
            onClick={() => setOpenId(undefined)}
            className="flex items-center gap-1"
            style={buttonStyle}
          >
            <IconChevronLeft size={14} aria-hidden="true" /> All chats
          </button>
          <h4 className="break-words font-medium">{openChat.name}</h4>
          {(!loaded || loaded.status === 'loading') && (
            <p role="status">Loading chat messages…</p>
          )}
          {loaded?.status === 'error' && (
            <div>
              <p role="alert">Could not load this chat.</p>
              <button
                type="button"
                onClick={() =>
                  void loadConversation(openChat, conversations, true)
                }
                style={buttonStyle}
              >
                Retry
              </button>
            </div>
          )}
          {loaded?.status === 'loaded' && !messages.length && (
            <p>This chat has no text messages to attach.</p>
          )}
          {messages.length > 0 && (
            <>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => {
                    controls.attachConversation({
                      conversationId: openChat.id,
                      mode: 'all',
                    });
                    setOpenId(undefined);
                  }}
                >
                  Attach entire chat
                </button>
                <button
                  type="button"
                  className="disabled:opacity-50"
                  style={buttonStyle}
                  disabled={!matchingIds.length}
                  onClick={() => {
                    controls.attachConversation({
                      conversationId: openChat.id,
                      mode: 'selected',
                      selectedMessageIds: matchingIds,
                    });
                    setOpenId(undefined);
                  }}
                >
                  Attach selected messages
                  {matchingIds.length ? ` (${matchingIds.length})` : ''}
                </button>
              </div>
              <ul className="space-y-1" aria-label="Messages to attach">
                {messages.map((message) => (
                  <li key={message.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md p-1 hover:bg-[var(--bg-hover)]">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedIds.includes(message.id)}
                        onChange={(event) => {
                          const { checked } = event.currentTarget;
                          setSelectedIds((current) =>
                            checked
                              ? [...current, message.id]
                              : current.filter((id) => id !== message.id),
                          );
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {message.role === 'assistant' ? 'Assistant' : 'You'}
                        </span>
                        <span
                          className="line-clamp-3 break-words"
                          title={message.content.slice(0, 400)}
                        >
                          {message.content.slice(0, 400)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <>
          {matches.length === 0 && (
            <p className="p-2">
              {search.trim() ? 'No matching chats.' : 'No previous chats yet.'}
            </p>
          )}
          {matches.map((chat) => {
            const entry = controls.conversationEntries.find(
              (context) => context.conversationId === chat.id,
            );
            return (
              <button
                type="button"
                key={chat.id}
                className={rowClass}
                onClick={() => {
                  setOpenId(chat.id);
                  setSelectedIds(entry?.selectedMessageIds ?? []);
                  void loadConversation(chat, conversations);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{chat.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {entry
                    ? 'Attached'
                    : isLocalConversation(chat)
                    ? 'Local'
                    : 'Cloud'}
                </span>
              </button>
            );
          })}
        </>
      )}
    </PickerPanel>
  );
}
