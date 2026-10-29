/**
 * NewGroupConversationTable — the conversations a group assistant has had, with search, sortable
 * columns, a column picker, and a transcript + metadata detail.
 *
 * Replaces the old admin interface's `ConversationTable`. Rules (sort, search, which columns exist,
 * transcript parsing) live in `groupInsightsModel.ts`. The detail replaces the table in place with a
 * back button instead of opening a second modal over the insights modal (Guide §5 rule 2).
 */

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconAdjustmentsHorizontal, IconArrowLeft, IconMessages } from '@tabler/icons-react';
import HomeContext from '@/components/Home/home.context';
import { getGroupConversationData } from '@/services/groupAssistantService';
import { SortableHeader } from '@/components/NewUI/shared/SortableHeader';
import { SearchInput } from '@/components/NewUI/shared/SearchInput';
import { CheckboxControl } from '@/components/NewUI/shared/FormControls';
import { NewUILoadingStatus } from '@/components/NewUI/shared/NewUILoadingStatus';
import { RatingStars } from './RatingStars';
import {
    AstUserConversation,
    ConversationColumn,
    SortDirection,
    TranscriptMessage,
    columnLabel,
    defaultColumns,
    filterConversations,
    formatTimestamp,
    nextSort,
    parseTranscript,
    routedLabel,
    selectableColumns,
    shortId,
    sortConversations,
} from './groupInsightsModel';

export interface NewGroupConversationTableProps {
    conversations: AstUserConversation[];
    supportConvAnalysis: boolean;
    /** Layered assistants: `{ leafAssistantId: name }` so "Routed to" reads names, not ids. */
    leafNameMap?: Record<string, string>;
}

const pill: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 8px',
    borderRadius: 10,
    fontSize: 11.5,
    fontWeight: 500,
    background: 'var(--bg-active)',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
};

const secondaryButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 34,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-raised)',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
};

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';

export const NewGroupConversationTable: React.FC<NewGroupConversationTableProps> = ({
    conversations,
    supportConvAnalysis,
    leafNameMap,
}) => {
    const [sort, setSort] = useState<{ column: ConversationColumn; direction: SortDirection }>({
        column: 'timestamp',
        direction: 'desc',
    });
    const [term, setTerm] = useState('');
    const [visible, setVisible] = useState<ConversationColumn[]>(() =>
        defaultColumns(supportConvAnalysis, conversations.some((c) => !!c.routedToAssistantId)),
    );
    const [pickerOpen, setPickerOpen] = useState(false);
    const [selected, setSelected] = useState<AstUserConversation | null>(null);
    const pickerRef = useRef<HTMLDivElement>(null);

    // A "Routed to" column only makes sense when some conversation was routed by a layered assistant.
    const hasRouting = useMemo(() => conversations.some((c) => !!c.routedToAssistantId), [conversations]);
    const allColumns = useMemo<ConversationColumn[]>(
        () => [
            ...selectableColumns(supportConvAnalysis),
            ...(hasRouting ? (['routedToAssistantId'] as ConversationColumn[]) : []),
        ],
        [supportConvAnalysis, hasRouting],
    );

    const rows = useMemo(
        () => sortConversations(filterConversations(conversations, term, supportConvAnalysis), sort.column, sort.direction),
        [conversations, term, supportConvAnalysis, sort],
    );

    // Close the column picker on an outside click. (Escape closes the whole insights modal, which
    // owns the document-level Escape listener — there is nothing to lose, so no extra handling.)
    useEffect(() => {
        if (!pickerOpen) return;
        const onPointer = (e: MouseEvent) => {
            if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        return () => document.removeEventListener('mousedown', onPointer);
    }, [pickerOpen]);

    if (selected) {
        return (
            <ConversationDetail
                conversation={selected}
                supportConvAnalysis={supportConvAnalysis}
                leafNameMap={leafNameMap}
                onBack={() => setSelected(null)}
            />
        );
    }

    if (conversations.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '48px 0', color: 'var(--text-muted)' }}>
                <IconMessages size={36} aria-hidden="true" style={{ opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No conversations yet</p>
                <p style={{ margin: 0, fontSize: 12 }}>They appear here once people chat with this assistant.</p>
            </div>
        );
    }

    const toggleColumn = (column: ConversationColumn, on: boolean) =>
        setVisible((prev) => (on ? allColumns.filter((c) => c === column || prev.includes(c)) : prev.filter((c) => c !== column)));

    const renderCell = (conv: AstUserConversation, column: ConversationColumn): React.ReactNode => {
        const value = conv[column];
        switch (column) {
            case 'timestamp':
                return formatTimestamp(value as string);
            case 'userRating':
            case 'systemRating':
                return <RatingStars value={value} showValue={false} size={13} />;
            case 'assistantName':
            case 'category':
                return value ? <span style={pill}>{String(value)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>;
            case 'routedToAssistantId':
                return value ? <span style={pill}>{routedLabel(String(value), leafNameMap)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>;
            case 'userFeedback':
                return (
                    <span title={String(value ?? '')} style={{ display: 'inline-block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>
                        {value ? String(value) : <span style={{ color: 'var(--text-muted)' }}>No feedback</span>}
                    </span>
                );
            case 'conversationId':
            case 'assistantId':
                return <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12 }} title={String(value ?? '')}>{shortId(String(value ?? ''))}</span>;
            default:
                return value === undefined || value === null || value === '' ? <span style={{ color: 'var(--text-muted)' }}>—</span> : String(value);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <SearchInput
                    value={term}
                    onChange={setTerm}
                    onClear={() => setTerm('')}
                    placeholder="Search conversations…"
                    aria-label="Search conversations"
                />
                <div ref={pickerRef} style={{ position: 'relative' }}>
                    <button
                        type="button"
                        aria-haspopup="true"
                        aria-expanded={pickerOpen}
                        onClick={() => setPickerOpen((open) => !open)}
                        className={FOCUS}
                        style={secondaryButton}
                    >
                        <IconAdjustmentsHorizontal size={15} aria-hidden="true" /> Columns
                    </button>
                    {pickerOpen && (
                        <div
                            role="group"
                            aria-label="Visible columns"
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 6px)',
                                left: 0,
                                zIndex: 5,
                                width: 220,
                                maxHeight: 280,
                                overflowY: 'auto',
                                padding: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 10,
                                background: 'var(--bg-raised)',
                            }}
                        >
                            {allColumns.map((column) => (
                                <CheckboxControl
                                    key={column}
                                    id={`conv-col-${column}`}
                                    label={columnLabel(column)}
                                    checked={visible.includes(column)}
                                    onChange={(on) => toggleColumn(column, on)}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <span role="status" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                    {rows.length === conversations.length
                        ? `${conversations.length} conversations`
                        : `${rows.length} of ${conversations.length} conversations`}
                </span>
            </div>

            <div
                style={{
                    overflow: 'auto',
                    maxHeight: 'min(60dvh, 560px)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    background: 'var(--bg-raised)',
                }}
            >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: 'var(--text-primary)' }}>
                    <thead>
                        <tr>
                            {visible.map((column) => (
                                <th
                                    key={column}
                                    scope="col"
                                    aria-sort={sort.column === column ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                                    style={{
                                        position: 'sticky',
                                        top: 0,
                                        textAlign: 'left',
                                        padding: '10px 14px',
                                        background: 'var(--bg-raised)',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <SortableHeader
                                        label={columnLabel(column)}
                                        sortKey={column}
                                        activeKey={sort.column}
                                        direction={sort.direction}
                                        onSort={(key) => setSort((current) => nextSort(current, key))}
                                    />
                                </th>
                            ))}
                            <th
                                scope="col"
                                style={{ position: 'sticky', top: 0, background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 14px' }}
                            >
                                <span className="sr-only">Open</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={visible.length + 1} style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No conversations match “{term}”.
                                </td>
                            </tr>
                        ) : (
                            rows.map((conv, index) => (
                                <tr
                                    key={`${conv.conversationId}-${index}`}
                                    onClick={() => setSelected(conv)}
                                    className="cursor-pointer hover:bg-[--bg-hover]"
                                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                >
                                    {visible.map((column) => (
                                        <td key={column} style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                            {renderCell(conv, column)}
                                        </td>
                                    ))}
                                    <td style={{ padding: '6px 14px', textAlign: 'right' }}>
                                        <button
                                            type="button"
                                            aria-label={`Open conversation with ${conv.user || 'unknown user'}`}
                                            onClick={(e) => { e.stopPropagation(); setSelected(conv); }}
                                            className={FOCUS}
                                            style={{ border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', borderRadius: 6, padding: '4px 6px' }}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ── Detail ─────────────────────────────────────────────────────────────────────

const ConversationDetail: React.FC<{
    conversation: AstUserConversation;
    supportConvAnalysis: boolean;
    leafNameMap?: Record<string, string>;
    onBack: () => void;
}> = ({ conversation, supportConvAnalysis, leafNameMap, onBack }) => {
    const { state: { statsService } } = useContext(HomeContext);
    const [messages, setMessages] = useState<TranscriptMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    // Latest-request guard: opening another conversation (or going back) discards a late response.
    const requestSeq = useRef(0);
    useEffect(() => {
        const seq = ++requestSeq.current;
        setLoading(true);
        setFailed(false);
        (async () => {
            try {
                statsService?.getGroupConversationDataEvent?.(conversation.assistantId, conversation.conversationId);
                const result = await getGroupConversationData(conversation.assistantId, conversation.conversationId);
                if (seq !== requestSeq.current) return;
                if (result.success && typeof result.data?.content === 'string') setMessages(parseTranscript(result.data.content));
                else setFailed(true);
            } catch {
                if (seq === requestSeq.current) setFailed(true);
            } finally {
                if (seq === requestSeq.current) setLoading(false);
            }
        })();
        return () => { requestSeq.current++; };
    }, [conversation.assistantId, conversation.conversationId]);

    const fields: ConversationColumn[] = [
        'timestamp', 'routedToAssistantId', 'assistantName', 'user', 'numberPrompts', 'modelUsed', 'userRating',
        ...(supportConvAnalysis ? (['employeeType', 'entryPoint', 'category', 'systemRating'] as ConversationColumn[]) : []),
    ];

    const fieldValue = (field: ConversationColumn): React.ReactNode => {
        const value = conversation[field];
        if (value === undefined || value === null || value === '') return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        if (field === 'timestamp') return formatTimestamp(String(value));
        if (field === 'userRating' || field === 'systemRating') return <RatingStars value={value} />;
        if (field === 'routedToAssistantId') return routedLabel(String(value), leafNameMap);
        return String(value);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                    type="button"
                    onClick={onBack}
                    className={FOCUS}
                    style={secondaryButton}
                >
                    <IconArrowLeft size={15} aria-hidden="true" /> All conversations
                </button>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {conversation.routedToAssistantId
                        ? <>{routedLabel(conversation.routedToAssistantId, leafNameMap)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>via {conversation.assistantName}</span></>
                        : conversation.assistantName}
                    <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-secondary)' }}>{formatTimestamp(conversation.timestamp)}</span>
                </h3>
            </div>

            <style>{`
                .nui-conv-detail { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: 16px; align-items: start; }
                @media (max-width: 720px) { .nui-conv-detail { grid-template-columns: minmax(0, 1fr); } }
            `}</style>
            <div className="nui-conv-detail">
                <section aria-label="Conversation" style={{ minWidth: 0 }}>
                    {loading ? (
                        <NewUILoadingStatus open variant="inline" message="Loading conversation…" />
                    ) : failed ? (
                        <p role="alert" style={{ color: 'var(--text-error)', fontSize: 13, margin: 0 }}>
                            Couldn’t load this conversation. Go back and try again.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    style={{
                                        padding: 12,
                                        borderRadius: 10,
                                        border: '1px solid var(--border-subtle)',
                                        background: message.role === 'user' ? 'var(--bg-active)' : 'var(--bg-raised)',
                                        marginLeft: message.role === 'assistant' ? 24 : 0,
                                        marginRight: message.role === 'user' ? 24 : 0,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                        {message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'Transcript'}
                                        {message.routedTo && <span style={pill}>↳ {routedLabel(message.routedTo, leafNameMap)}</span>}
                                    </div>
                                    <div className="prose prose-sm dark:prose-invert max-w-none" style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <aside aria-label="Conversation details" style={{ minWidth: 0 }}>
                    <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {fields.map((field) => (
                            <div key={field}>
                                <dt style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                                    {columnLabel(field)}
                                </dt>
                                <dd style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-primary)' }}>{fieldValue(field)}</dd>
                            </div>
                        ))}
                        {conversation.userFeedback && (
                            <div>
                                <dt style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                                    User feedback
                                </dt>
                                <dd style={{ margin: '2px 0 0', fontSize: 13, fontStyle: 'italic', color: 'var(--text-primary)' }}>
                                    {conversation.userFeedback}
                                </dd>
                            </div>
                        )}
                        <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--text-muted)' }}>
                            <div>Conversation ID: <span style={{ fontFamily: 'ui-monospace, monospace' }}>{shortId(conversation.conversationId, 12)}</span></div>
                            <div style={{ marginTop: 2 }}>Assistant ID: <span style={{ fontFamily: 'ui-monospace, monospace' }}>{shortId(conversation.assistantId, 12)}</span></div>
                        </div>
                    </dl>
                </aside>
            </div>
        </div>
    );
};
