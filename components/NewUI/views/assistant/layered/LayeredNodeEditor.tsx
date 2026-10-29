/**
 * LayeredNodeEditor — the centre panel of the layered-assistant builder: edit whichever node is
 * selected in the tree.
 *
 *   Parent (router)  name · description · decision guide · members · move/remove
 *   Assistant (leaf) linked assistant · description · router context · move/remove
 *
 * A leaf's name is read-only — it mirrors the linked assistant. "Router context" only offers what the
 * linked assistant really has (files, tools, workflow). Every text field can be drafted by AI; the
 * request itself lives in the builder (this component only reports the click). Moves are plain
 * buttons so reordering never requires dragging.
 */

import React from 'react';
import {
    IconArrowDown,
    IconArrowUp,
    IconArrowBarToRight,
    IconArrowBarToLeft,
    IconAlertTriangle,
    IconGitBranch,
    IconLoader2,
    IconRobot,
    IconSparkles,
    IconTrash,
    IconX,
} from '@tabler/icons-react';
import {
    LayeredAssistantNode,
    LeafNode,
    RouterContextField,
    RouterNode,
    isLeafNode,
    isRouterNode,
} from '@/types/layeredAssistant';
import { CheckboxControl, TextAreaControl, TextControl } from '@/components/NewUI/shared/FormControls';
import { InfoTooltip } from '@/components/NewUI/shared/InfoTooltip';
import { ContextOption } from '../layeredTreeModel';
import type { KeyboardMove } from './LayeredTreeOutline';
import type { AiField } from '../layeredAiModel';

export interface LayeredNodeEditorProps {
    node: LayeredAssistantNode;
    isRoot: boolean;
    /** The assistant a leaf points at, when it can be found in the user's list. */
    linked: { name: string; description?: string } | null;
    /** What the linked assistant can offer the router as extra context. */
    contextOptions: ContextOption[];
    onChangeField: (field: 'name' | 'description' | 'instructions', value: string) => void;
    onToggleContext: (field: RouterContextField, on: boolean) => void;
    onSelect: (id: string) => void;
    onRemoveNode: (id: string) => void;
    moves: { up: boolean; down: boolean; indent: boolean; outdent: boolean };
    onMove: (move: KeyboardMove) => void;
    generating: ReadonlySet<string>;
    canGenerate: boolean;
    onGenerate: (field: AiField) => void;
}

const label: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
    margin: 0,
};
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' };
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]';

const ghostButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 28,
    padding: '0 10px',
    borderRadius: 7,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-raised)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
};

const AiButton: React.FC<{ busy: boolean; disabled: boolean; onClick: () => void; what: string }> = ({ busy, disabled, onClick, what }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={busy || disabled}
        aria-busy={busy}
        title={disabled && !busy ? 'AI generation isn’t available right now' : `Draft the ${what} with AI`}
        className={`${FOCUS} disabled:opacity-50 disabled:cursor-not-allowed`}
        style={{ ...ghostButton, color: 'var(--accent)' }}
    >
        {busy
            ? <IconLoader2 size={13} aria-hidden="true" className="motion-safe:animate-spin motion-reduce:animate-none" />
            : <IconSparkles size={13} aria-hidden="true" />}
        {busy ? 'Writing…' : 'Generate with AI'}
    </button>
);

export const LayeredNodeEditor: React.FC<LayeredNodeEditorProps> = ({
    node,
    isRoot,
    linked,
    contextOptions,
    onChangeField,
    onToggleContext,
    onSelect,
    onRemoveNode,
    moves,
    onMove,
    generating,
    canGenerate,
    onGenerate,
}) => {
    const router = isRouterNode(node);
    const leaf = isLeafNode(node) ? (node as LeafNode) : null;
    const key = (field: AiField) => `${node.id}-${field}`;
    const nameId = `node-name-${node.id}`;
    const descId = `node-desc-${node.id}`;
    const guideId = `node-guide-${node.id}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Header: what this is + position controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                    aria-hidden="true"
                    style={{ display: 'inline-flex', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'var(--bg-active)', color: 'var(--accent)' }}
                >
                    {router ? <IconGitBranch size={17} /> : <IconRobot size={17} />}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {node.name.trim() || (router ? 'Unnamed parent' : 'Unnamed assistant')}
                    </h3>
                    <p style={hint}>
                        {router ? (isRoot ? 'Top-level parent — every conversation starts here' : 'Parent — routes among its members') : 'Assistant — handles the conversation'}
                    </p>
                </div>
                {!isRoot && (
                    <div role="group" aria-label="Position" style={{ display: 'flex', gap: 4 }}>
                        <IconAction label="Move up" disabled={!moves.up} onClick={() => onMove('up')}><IconArrowUp size={14} /></IconAction>
                        <IconAction label="Move down" disabled={!moves.down} onClick={() => onMove('down')}><IconArrowDown size={14} /></IconAction>
                        <IconAction label="Move into the parent above" disabled={!moves.indent} onClick={() => onMove('indent')}><IconArrowBarToRight size={14} /></IconAction>
                        <IconAction label="Move out of this parent" disabled={!moves.outdent} onClick={() => onMove('outdent')}><IconArrowBarToLeft size={14} /></IconAction>
                        <IconAction label={router ? 'Remove this parent and its members' : 'Remove this assistant'} danger onClick={() => onRemoveNode(node.id)}><IconTrash size={14} /></IconAction>
                    </div>
                )}
            </div>

            {/* Linked assistant (leaf) */}
            {leaf && (
                <div>
                    <span style={label}>Linked assistant</span>
                    {linked ? (
                        <div style={{ marginTop: 6, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg-app)' }}>
                            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{linked.name}</p>
                            {linked.description && <p style={{ ...hint, marginTop: 3 }}>{linked.description}</p>}
                        </div>
                    ) : (
                        <div
                            role="alert"
                            style={{ marginTop: 6, display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-fg)', fontSize: 12.5 }}
                        >
                            <IconAlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--warning-icon)' }} />
                            <span>
                                This assistant isn’t in your list — it may have been deleted or not shared with you. Routing to it
                                will fail until you replace it with one from the list on the right.
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Name */}
            <div>
                <label htmlFor={nameId} style={label}>Name</label>
                <div style={{ marginTop: 6 }}>
                    <TextControl
                        id={nameId}
                        value={node.name}
                        readOnly={!router}
                        aria-readonly={!router}
                        placeholder={router ? 'e.g. Student services' : undefined}
                        onChange={(e) => router && onChangeField('name', e.target.value)}
                        style={!router ? { color: 'var(--text-secondary)', cursor: 'default' } : undefined}
                    />
                </div>
                {!router && <p style={hint}>Taken from the linked assistant.</p>}
            </div>

            {/* Description */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <label htmlFor={descId} style={label}>
                        Description
                    </label>
                    <AiButton what="description" busy={generating.has(key('description'))} disabled={!canGenerate} onClick={() => onGenerate('description')} />
                </div>
                <div style={{ marginTop: 6 }}>
                    <TextAreaControl
                        id={descId}
                        rows={3}
                        value={node.description}
                        placeholder={router ? 'What kinds of requests does this parent handle?' : 'When should the router choose this assistant?'}
                        onChange={(e) => onChangeField('description', e.target.value)}
                    />
                </div>
                <p style={hint}>The router reads this to decide where to send a conversation.</p>
            </div>

            {/* Router context (leaf) */}
            {leaf && contextOptions.length > 0 && (
                <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
                    <legend style={{ ...label, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
                        Router context
                        <InfoTooltip text="Share extra details about this assistant with the parent router so it can route better. Only tick what the decision really needs." ariaLabel="About router context" maxWidth={300} />
                    </legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        {contextOptions.map((option) => (
                            <CheckboxControl
                                key={option.field}
                                id={`ctx-${node.id}-${option.field}`}
                                label={option.label}
                                checked={(leaf.routerContext ?? []).includes(option.field)}
                                onChange={(on) => onToggleContext(option.field, on)}
                            />
                        ))}
                    </div>
                </fieldset>
            )}

            {/* Decision guide (router) */}
            {router && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <label htmlFor={guideId} style={label}>Decision guide</label>
                        <AiButton what="decision guide" busy={generating.has(key('instructions'))} disabled={!canGenerate} onClick={() => onGenerate('instructions')} />
                    </div>
                    <div style={{ marginTop: 6 }}>
                        <TextAreaControl
                            id={guideId}
                            rows={7}
                            value={(node as RouterNode).instructions}
                            placeholder="Explain when to pick each member — name them and describe the signals in a user's message."
                            onChange={(e) => onChangeField('instructions', e.target.value)}
                        />
                    </div>
                    <p style={hint}>Without a guide the router can’t tell its members apart.</p>
                </div>
            )}

            {/* Members (router) */}
            {router && (
                <div>
                    <span style={label}>Members ({(node as RouterNode).children.length})</span>
                    {(node as RouterNode).children.length === 0 ? (
                        <p style={{ ...hint, marginTop: 6 }}>No members yet. Add assistants from the list, or a sub-parent from the tree.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(node as RouterNode).children.map((child) => (
                                <li key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(child.id)}
                                        className={FOCUS}
                                        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 13, textAlign: 'left', cursor: 'pointer' }}
                                    >
                                        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--text-secondary)' }}>
                                            {isRouterNode(child) ? <IconGitBranch size={14} /> : <IconRobot size={14} />}
                                        </span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.name.trim() || 'Unnamed'}</span>
                                    </button>
                                    <IconAction label={`Remove ${child.name.trim() || 'member'}`} danger onClick={() => onRemoveNode(child.id)}>
                                        <IconX size={14} />
                                    </IconAction>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

const IconAction: React.FC<{ label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }> = ({
    label: ariaLabel,
    onClick,
    disabled,
    danger,
    children,
}) => (
    <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled}
        onClick={onClick}
        className={`${FOCUS} disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[--bg-active] ${danger ? 'hover:text-[--text-error]' : 'hover:text-[--text-primary]'}`}
        style={{ display: 'inline-flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
    >
        {children}
    </button>
);
