import React from 'react';
import { IconBrain, IconFileText, IconMessage2 } from '@tabler/icons-react';
import { Conversation } from '@/types/chat';
import { formatRelative } from './projectFormat';
import type { ProjectSearchResults as Results } from './projectSearch';

interface ProjectSearchResultsProps {
    query: string;
    results: Results;
    onOpenChat: (conversation: Conversation) => void;
    onOpenMemory: () => void;
}

const Group: React.FC<{ id: string; title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ id, title, icon, children }) => (
    <section aria-labelledby={id} className="mb-5">
        <h3 id={id} className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {icon} {title}
        </h3>
        <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }}>
            {children}
        </ul>
    </section>
);

/** Results of searching one project's chats, files and memory. */
export const ProjectSearchResults: React.FC<ProjectSearchResultsProps> = ({ query, results, onOpenChat, onOpenMemory }) => (
    <div role="region" aria-label={`Search results for ${query}`} aria-live="polite">
        {results.total === 0 && (
            <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                Nothing in this project matches “{query}”.
                <span className="mt-1 block text-xs">Chats stored in the cloud are searched by title only.</span>
            </p>
        )}
        {results.chats.length > 0 && (
            <Group id="search-chats" title={`Chats (${results.chats.length})`} icon={<IconMessage2 size={13} aria-hidden="true" />}>
                {results.chats.map(({ conversation, snippet }) => (
                    <li key={conversation.id} style={{ borderColor: 'var(--border-subtle)' }}>
                        <button type="button" onClick={() => onOpenChat(conversation)} className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-[--bg-hover] focus:bg-[--bg-hover] focus:outline-none">
                            <span className="flex items-center justify-between gap-4">
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">{conversation.name || 'Untitled chat'}</span>
                                <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>{formatRelative(conversation.date)}</span>
                            </span>
                            {snippet && <span className="line-clamp-2 text-xs leading-4" style={{ color: 'var(--text-muted)' }}>{snippet}</span>}
                        </button>
                    </li>
                ))}
            </Group>
        )}
        {results.files.length > 0 && (
            <Group id="search-files" title={`Files (${results.files.length})`} icon={<IconFileText size={13} aria-hidden="true" />}>
                {results.files.map(({ file }) => (
                    <li key={file.key} className="flex items-center gap-2 px-4 py-3 text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
                        <IconFileText size={15} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
                    </li>
                ))}
            </Group>
        )}
        {results.memories.length > 0 && (
            <Group id="search-memory" title={`Memory (${results.memories.length})`} icon={<IconBrain size={13} aria-hidden="true" />}>
                {results.memories.map(({ memory }) => (
                    <li key={memory.id} style={{ borderColor: 'var(--border-subtle)' }}>
                        <button type="button" onClick={onOpenMemory} className="flex w-full items-start gap-2 px-4 py-3 text-left text-sm hover:bg-[--bg-hover] focus:bg-[--bg-hover] focus:outline-none">
                            <span className="min-w-0 flex-1 break-words">{memory.content}</span>
                            {memory.status !== 'approved' && <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>Suggested</span>}
                        </button>
                    </li>
                ))}
            </Group>
        )}
    </div>
);

export default ProjectSearchResults;
