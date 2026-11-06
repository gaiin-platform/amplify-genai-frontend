/**
 * LayeredTreeOutline — the routing tree as an accessible outline (`role="tree"`).
 *
 * Structure: parents collapse and expand (chevron, or → / ←), and each level is colour-coded — an icon
 * chip per row plus a coloured vertical guide line for every ancestor level, so nesting reads at a glance.
 * Colour is a second cue only (parent vs assistant is also the icon; the selection also has a ring).
 * A collapsed parent hides its subtree; selecting something inside it (map click, new sub-parent, a
 * keyboard move) reveals it again.
 *
 * Mouse: drag a row by its handle; the row under the pointer shows where it will land (line above /
 * below, or an outline for "inside a parent"). Keyboard (no pointer needed):
 *   ↑ / ↓        move selection        → / ←   expand / collapse (or step into / out to the parent)
 *   Alt+↑ / Alt+↓   move the node among its siblings
 *   Alt+→        indent into the parent above          Alt+←   outdent out of its parent
 * The same moves are also buttons in the node editor. Which drops are legal (not onto itself, not a
 * parent into its own subtree, leaves can't take children) is decided by `layeredTreeModel`.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronRight, IconGripVertical, IconRobot, IconRoute } from '@tabler/icons-react';
import { RouterNode, isRouterNode } from '@/types/layeredAssistant';
import { DropPosition, ancestorIds, normalizeDropPosition, visibleRows } from '../layeredTreeModel';
import { depthColor, tint } from '../layeredTreeStyle';

export type KeyboardMove = 'up' | 'down' | 'indent' | 'outdent';

export interface LayeredTreeOutlineProps {
    root: RouterNode;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onMove: (dragId: string, targetId: string, position: DropPosition) => void;
    /** Returns true when the node actually moved (a no-op must not claim focus). */
    onKeyboardMove: (id: string, move: KeyboardMove) => boolean;
}

// Row geometry: [grip hangs in the left gutter] [chevron] [icon chip] [name] [count]. A guide line for
// ancestor level k runs down the centre of that ancestor's chevron, so it sits just left of its children.
const GUTTER = 20;
const INDENT = 20;
const CHEVRON = 16;
const guideX = (level: number) => GUTTER + level * INDENT + CHEVRON / 2;

export const LayeredTreeOutline: React.FC<LayeredTreeOutlineProps> = ({
    root,
    selectedId,
    onSelect,
    onMove,
    onKeyboardMove,
}) => {
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
    const rows = useMemo(() => visibleRows(root, collapsed), [root, collapsed]);
    const [dragId, setDragId] = useState<string | null>(null);
    const [drop, setDrop] = useState<{ id: string; position: DropPosition } | null>(null);
    const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const focusAfterSelect = useRef(false);

    // When selection moved because of the keyboard, keep DOM focus with it.
    useEffect(() => {
        if (!focusAfterSelect.current || !selectedId) return;
        focusAfterSelect.current = false;
        // Never pull focus out of a text field the user has since moved into.
        const active = document.activeElement;
        const typing = active instanceof HTMLElement && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (!typing) rowRefs.current.get(selectedId)?.focus();
    }, [selectedId, rows]);

    // Never leave the selection hidden: if it (or a node just moved/added) sits under a collapsed parent,
    // open the path to it. Deliberately not keyed on `collapsed` — collapsing is handled in `toggle`.
    useEffect(() => {
        if (!selectedId) return;
        const hidden = ancestorIds(root, selectedId);
        setCollapsed((current) => (hidden.some((id) => current.has(id)) ? new Set(Array.from(current).filter((id) => !hidden.includes(id))) : current));
    }, [selectedId, root]);

    const setOpen = (id: string, open: boolean) =>
        setCollapsed((current) => {
            if (open !== current.has(id)) return current;
            const next = new Set(current);
            if (open) next.delete(id); else next.add(id);
            return next;
        });

    const toggle = (id: string) => {
        const closing = !collapsed.has(id);
        setOpen(id, !closing);
        // Collapsing a parent that holds the selection hands the selection to that parent.
        if (closing && selectedId && selectedId !== id && ancestorIds(root, selectedId).includes(id)) onSelect(id);
    };

    const clearDrag = () => { setDragId(null); setDrop(null); };

    const handleKeyDown = (e: React.KeyboardEvent, index: number, id: string) => {
        if (e.target !== e.currentTarget) return;
        if (e.altKey) {
            const move: KeyboardMove | null =
                e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down' : e.key === 'ArrowRight' ? 'indent' : e.key === 'ArrowLeft' ? 'outdent' : null;
            if (move) {
                e.preventDefault();
                // Only follow the node with focus if it really moved; otherwise the flag would linger and
                // steal focus from whatever the user clicks next (e.g. a text box) on the next re-render.
                if (onKeyboardMove(id, move)) focusAfterSelect.current = true;
            }
            return;
        }
        const row = rows[index];
        const expandable = isRouterNode(row.node) && row.node.children.length > 0;
        if (e.key === 'ArrowRight' && expandable) {
            e.preventDefault();
            if (collapsed.has(id)) setOpen(id, true);
            else { focusAfterSelect.current = true; onSelect((row.node as RouterNode).children[0].id); }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (expandable && !collapsed.has(id)) toggle(id);
            else if (row.ancestors.length) { focusAfterSelect.current = true; onSelect(row.ancestors[row.ancestors.length - 1]); }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = rows[index + (e.key === 'ArrowDown' ? 1 : -1)];
            if (next) {
                focusAfterSelect.current = true;
                onSelect(next.node.id);
            }
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(id);
        }
    };

    return (
        <div
            role="tree"
            aria-label="Routing tree"
            style={{ display: 'flex', flexDirection: 'column' }}
        >
            {rows.map(({ node, depth, ancestors }, index) => {
                const selected = node.id === selectedId;
                const isRoot = node.id === root.id;
                const router = isRouterNode(node);
                const dropHere = drop?.id === node.id ? drop.position : null;
                const label = node.name.trim() || (router ? 'Unnamed parent' : 'Unnamed assistant');
                const childCount = router ? (node as RouterNode).children.length : 0;
                const expandable = childCount > 0;
                const isCollapsed = expandable && collapsed.has(node.id);
                const color = depthColor(depth);
                return (
                    <div
                        key={node.id}
                        ref={(el) => { if (el) rowRefs.current.set(node.id, el); else rowRefs.current.delete(node.id); }}
                        role="treeitem"
                        aria-level={depth + 1}
                        aria-selected={selected}
                        aria-expanded={expandable ? !isCollapsed : undefined}
                        aria-label={`${router ? 'Parent' : 'Assistant'} ${label}${router ? `, ${childCount} member${childCount === 1 ? '' : 's'}` : ''}`}
                        tabIndex={selected || (!selectedId && index === 0) ? 0 : -1}
                        draggable={!isRoot}
                        onClick={() => onSelect(node.id)}
                        onKeyDown={(e) => handleKeyDown(e, index, node.id)}
                        onDragStart={(e) => {
                            if (isRoot) return;
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', node.id);
                            setDragId(node.id);
                        }}
                        onDragEnd={clearDrag}
                        onDragOver={(e) => {
                            if (!dragId) return;
                            e.preventDefault();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const position = normalizeDropPosition(root, dragId, node.id, (e.clientY - rect.top) / Math.max(rect.height, 1));
                            if (!position) {
                                e.dataTransfer.dropEffect = 'none';
                                setDrop(null);
                                return;
                            }
                            e.dataTransfer.dropEffect = 'move';
                            setDrop((current) => (current?.id === node.id && current.position === position ? current : { id: node.id, position }));
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (dragId && drop) {
                                if (drop.position === 'inside') setOpen(drop.id, true);
                                onMove(dragId, drop.id, drop.position);
                            }
                            clearDrag();
                        }}
                        className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] hover:bg-[--bg-hover]"
                        style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            minHeight: 36,
                            padding: `0 8px 0 ${GUTTER + depth * INDENT}px`,
                            borderRadius: 8,
                            cursor: 'pointer',
                            opacity: dragId === node.id ? 0.45 : 1,
                            // Selected: a tint of the row's own level colour plus a ring, so it shows without hue too.
                            background: selected ? tint(color, 16) : undefined,
                            boxShadow: selected ? `inset 0 0 0 1.5px ${tint(color, 70)}` : undefined,
                            outline: dropHere === 'inside' ? '2px solid var(--accent)' : undefined,
                            outlineOffset: -2,
                            color: 'var(--text-primary)',
                        }}
                    >
                        {dropHere === 'before' && <span aria-hidden="true" style={dropLine('top')} />}
                        {dropHere === 'after' && <span aria-hidden="true" style={dropLine('bottom')} />}

                        {/* Level guides: one coloured vertical line per ancestor, continuous across rows. */}
                        {ancestors.map((_, level) => (
                            <span key={level} aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: guideX(level), width: 2, borderRadius: 1, background: tint(depthColor(level), 45), pointerEvents: 'none' }} />
                        ))}

                        {!isRoot && (
                            <span aria-hidden="true" className="opacity-0 group-hover:opacity-80" style={{ position: 'absolute', left: 3, display: 'inline-flex', color: 'var(--text-muted)', cursor: 'grab' }} title="Drag to move">
                                <IconGripVertical size={14} />
                            </span>
                        )}
                        <span
                            aria-hidden="true"
                            onClick={expandable ? (e) => { e.stopPropagation(); toggle(node.id); } : undefined}
                            title={expandable ? (isCollapsed ? 'Expand' : 'Collapse') : undefined}
                            className={expandable ? 'hover:bg-[--bg-active]' : undefined}
                            style={{ position: 'relative', width: CHEVRON, height: CHEVRON, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, color: 'var(--text-muted)', cursor: expandable ? 'pointer' : 'default' }}
                        >
                            {expandable && <IconChevronRight size={14} style={{ transform: isCollapsed ? undefined : 'rotate(90deg)', transition: 'transform 120ms' }} />}
                        </span>
                        <span aria-hidden="true" style={{ position: 'relative', flexShrink: 0, width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: color, color: '#fff' }}>
                            {router ? <IconRoute size={14} /> : <IconRobot size={14} />}
                        </span>
                        <span style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: router ? 600 : 400, fontStyle: node.name.trim() ? 'normal' : 'italic' }}>
                            {label}
                        </span>
                        {router && (
                            <span aria-hidden="true" style={{ position: 'relative', flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-hover)', borderRadius: 9, padding: '1px 7px' }}>
                                {childCount}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const dropLine = (edge: 'top' | 'bottom'): React.CSSProperties => ({
    position: 'absolute',
    left: 6,
    right: 6,
    [edge]: -1,
    height: 2,
    borderRadius: 1,
    background: 'var(--accent)',
    pointerEvents: 'none',
});
