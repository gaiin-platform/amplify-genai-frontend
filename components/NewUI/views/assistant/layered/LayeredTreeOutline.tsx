/**
 * LayeredTreeOutline — the routing tree as an accessible outline (`role="tree"`).
 *
 * Mouse: drag a row by its handle; the row under the pointer shows where it will land (line above /
 * below, or an outline for "inside a parent"). Keyboard (no pointer needed):
 *   ↑ / ↓        move selection        Alt+↑ / Alt+↓   move the node among its siblings
 *   Alt+→        indent into the parent above          Alt+←   outdent out of its parent
 * The same moves are also buttons in the node editor. Which drops are legal (not onto itself, not a
 * parent into its own subtree, leaves can't take children) is decided by `layeredTreeModel`.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconGitBranch, IconGripVertical, IconRobot } from '@tabler/icons-react';
import { LayeredAssistantNode, RouterNode, isRouterNode } from '@/types/layeredAssistant';
import { DropPosition, normalizeDropPosition } from '../layeredTreeModel';

export type KeyboardMove = 'up' | 'down' | 'indent' | 'outdent';

export interface LayeredTreeOutlineProps {
    root: RouterNode;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onMove: (dragId: string, targetId: string, position: DropPosition) => void;
    /** Returns true when the node actually moved (a no-op must not claim focus). */
    onKeyboardMove: (id: string, move: KeyboardMove) => boolean;
}

interface Row { node: LayeredAssistantNode; depth: number }

const flatten = (root: RouterNode): Row[] => {
    const rows: Row[] = [];
    const walk = (node: LayeredAssistantNode, depth: number) => {
        rows.push({ node, depth });
        if (isRouterNode(node)) node.children.forEach((c) => walk(c, depth + 1));
    };
    walk(root, 0);
    return rows;
};

export const LayeredTreeOutline: React.FC<LayeredTreeOutlineProps> = ({
    root,
    selectedId,
    onSelect,
    onMove,
    onKeyboardMove,
}) => {
    const rows = useMemo(() => flatten(root), [root]);
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
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
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
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
            {rows.map(({ node, depth }, index) => {
                const selected = node.id === selectedId;
                const isRoot = node.id === root.id;
                const router = isRouterNode(node);
                const dropHere = drop?.id === node.id ? drop.position : null;
                const label = node.name.trim() || (router ? 'Unnamed parent' : 'Unnamed assistant');
                const childCount = router ? (node as RouterNode).children.length : 0;
                return (
                    <div
                        key={node.id}
                        ref={(el) => { if (el) rowRefs.current.set(node.id, el); else rowRefs.current.delete(node.id); }}
                        role="treeitem"
                        aria-level={depth + 1}
                        aria-selected={selected}
                        aria-expanded={router ? true : undefined}
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
                            if (dragId && drop) onMove(dragId, drop.id, drop.position);
                            clearDrag();
                        }}
                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                        style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            minHeight: 36,
                            padding: `0 8px 0 ${6 + depth * 16}px`,
                            borderRadius: 8,
                            cursor: 'pointer',
                            opacity: dragId === node.id ? 0.45 : 1,
                            background: selected ? 'var(--bg-active)' : 'transparent',
                            outline: dropHere === 'inside' ? '2px solid var(--accent)' : undefined,
                            outlineOffset: -2,
                            color: 'var(--text-primary)',
                        }}
                    >
                        {dropHere === 'before' && <span aria-hidden="true" style={dropLine('top')} />}
                        {dropHere === 'after' && <span aria-hidden="true" style={dropLine('bottom')} />}

                        <span aria-hidden="true" style={{ width: 14, flexShrink: 0, color: 'var(--text-muted)', cursor: isRoot ? 'default' : 'grab', opacity: isRoot ? 0 : 1 }} title={isRoot ? undefined : 'Drag to move'}>
                            <IconGripVertical size={14} />
                        </span>
                        <span aria-hidden="true" style={{ flexShrink: 0, color: selected ? 'var(--accent)' : 'var(--text-secondary)', display: 'inline-flex' }}>
                            {router ? <IconGitBranch size={15} /> : <IconRobot size={15} />}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: router ? 600 : 400, fontStyle: node.name.trim() ? 'normal' : 'italic' }}>
                            {label}
                        </span>
                        {router && (
                            <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-hover)', borderRadius: 9, padding: '1px 7px' }}>
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
