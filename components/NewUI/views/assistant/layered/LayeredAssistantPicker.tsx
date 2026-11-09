/**
 * LayeredAssistantPicker — the right-hand panel of the layered-assistant builder: a searchable list
 * of assistants that can be added to the selected parent.
 *
 * The caller decides which assistants are eligible (your own editable ones, or a group's). An
 * assistant already used somewhere in the tree is marked "Added" and can't be added twice — a router
 * choosing between two copies of the same assistant has nothing to decide. "Preview" expands the
 * assistant's description and the start of its instructions in place (the old builder opened a
 * second modal for this).
 */

import React, { useMemo, useState } from 'react';
import { IconCheck, IconChevronDown, IconPlus, IconRobot } from '@tabler/icons-react';
import { Prompt } from '@/types/prompt';
import { AssistantDefinition } from '@/types/assistant';
import { SearchInput } from '@/components/NewUI/shared/SearchInput';
import { assistantRefId } from '../layeredTreeModel';

export interface LayeredAssistantPickerProps {
    assistants: Prompt[];
    /** Assistant ids already used as leaves. */
    assignedIds: ReadonlySet<string>;
    /** Name of the parent new assistants would be added to; `null` when the selection can't take members. */
    targetName: string | null;
    onAdd: (assistant: Prompt) => void;
}

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';

export const LayeredAssistantPicker: React.FC<LayeredAssistantPickerProps> = ({ assistants, assignedIds, targetName, onAdd }) => {
    const [term, setTerm] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const q = term.trim().toLowerCase();
        if (!q) return assistants;
        return assistants.filter(
            (a) => a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q),
        );
    }, [assistants, term]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, height: '100%' }}>
            <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Add assistants</h3>
                <p role="status" style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    {targetName === null
                        ? 'Select a parent in the tree to add assistants to it.'
                        : `Adding to “${targetName.trim() || 'Unnamed parent'}”`}
                </p>
            </div>
            <SearchInput fullWidth value={term} onChange={setTerm} onClear={() => setTerm('')} placeholder="Search assistants…" aria-label="Search assistants" />

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {filtered.length === 0 && (
                    <li style={{ padding: '24px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
                        {assistants.length === 0 ? 'You have no assistants to add yet.' : `No assistants match “${term}”.`}
                    </li>
                )}
                {filtered.map((assistant) => {
                    const id = assistantRefId(assistant);
                    const added = assignedIds.has(id);
                    const disabled = added || targetName === null;
                    const open = openId === assistant.id;
                    const definition = assistant.data?.assistant?.definition as AssistantDefinition | undefined;
                    const instructions = definition?.instructions?.trim();
                    return (
                        <li
                            key={assistant.id}
                            style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg-app)', opacity: added ? 0.7 : 1 }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 8px 10px' }}>
                                <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--text-secondary)' }}><IconRobot size={16} /></span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assistant.name}</p>
                                    {assistant.description && (
                                        <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assistant.description}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    aria-expanded={open}
                                    aria-label={`${open ? 'Hide' : 'Preview'} ${assistant.name}`}
                                    onClick={() => setOpenId(open ? null : assistant.id)}
                                    className={`${FOCUS} hover:bg-[--bg-active]`}
                                    style={{ display: 'inline-flex', width: 26, height: 26, alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                                >
                                    <IconChevronDown size={14} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }} className="motion-safe:transition-transform" />
                                </button>
                                {added ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 8px', height: 26, fontSize: 11.5, fontWeight: 600, color: 'var(--success-fg)' }}>
                                        <IconCheck size={13} aria-hidden="true" /> Added
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        aria-label={`Add ${assistant.name}`}
                                        title={targetName === null ? 'Select a parent first' : `Add to ${targetName.trim() || 'this parent'}`}
                                        onClick={() => onAdd(assistant)}
                                        className={`${FOCUS} disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[--bg-active]`}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 26, padding: '0 8px', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}
                                    >
                                        <IconPlus size={13} aria-hidden="true" /> Add
                                    </button>
                                )}
                            </div>
                            {open && (
                                <div style={{ padding: '0 12px 10px 32px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    {definition?.description || assistant.description ? <p style={{ margin: '0 0 6px' }}>{definition?.description || assistant.description}</p> : null}
                                    {instructions ? (
                                        <p style={{ margin: 0, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                                            {instructions.slice(0, 400)}{instructions.length > 400 ? '…' : ''}
                                        </p>
                                    ) : (
                                        <p style={{ margin: 0, color: 'var(--text-muted)' }}>No instructions to show.</p>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};
