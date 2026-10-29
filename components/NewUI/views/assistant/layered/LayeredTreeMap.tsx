/**
 * LayeredTreeMap — a small SVG overview of the whole routing tree, for orientation and quick
 * selection. Shape carries the meaning (parents are solid discs, assistants are rings with a dot) and
 * the selected node gets an accent ring, so nothing depends on hue. Every node is a keyboard-focusable
 * button named after the node. Layout comes from `layeredTreeLayout`.
 */

import React, { useMemo } from 'react';
import { RouterNode } from '@/types/layeredAssistant';
import { findNode } from '../layeredTreeModel';
import { buildMapLayout } from '../layeredTreeLayout';

export interface LayeredTreeMapProps {
    root: RouterNode;
    selectedId: string | null;
    onSelect: (id: string) => void;
}

const FOCUS_RING = 'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--accent]';

export const LayeredTreeMap: React.FC<LayeredTreeMapProps> = ({ root, selectedId, onSelect }) => {
    const layout = useMemo(() => buildMapLayout(root), [root]);

    return (
        <figure
            aria-label="Tree overview"
            style={{
                margin: 0,
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                background: 'var(--bg-app)',
                overflow: 'hidden',
            }}
        >
            <svg
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                role="group"
                aria-label="Routing tree map"
                style={{ width: '100%', height: Math.min(layout.height * 1.5, 150), display: 'block' }}
            >
                {layout.edges.map((e, i) => (
                    <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="var(--border-subtle)" strokeWidth={1.4} />
                ))}
                {layout.nodes.map((n) => {
                    const selected = n.id === selectedId;
                    const r = n.isParent ? 7 : 5;
                    const name = findNode(root, n.id)?.node.name || (n.isParent ? 'Unnamed parent' : 'Unnamed assistant');
                    return (
                        <g
                            key={n.id}
                            role="button"
                            // One tab stop for the whole map; the tree outline is the keyboard path to every node.
                            tabIndex={selected ? 0 : -1}
                            aria-label={`${n.isParent ? 'Parent' : 'Assistant'} ${name}${selected ? ' (selected)' : ''}`}
                            aria-pressed={selected}
                            className={FOCUS_RING}
                            style={{ cursor: 'pointer' }}
                            onClick={() => onSelect(n.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onSelect(n.id);
                                }
                            }}
                        >
                            {selected && <circle cx={n.x} cy={n.y} r={r + 5} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.55} />}
                            <circle
                                cx={n.x}
                                cy={n.y}
                                r={r}
                                fill={n.isParent ? (selected ? 'var(--accent)' : 'var(--text-secondary)') : 'var(--bg-raised)'}
                                stroke={selected ? 'var(--accent)' : 'var(--text-secondary)'}
                                strokeWidth={1.5}
                            />
                            {!n.isParent && <circle cx={n.x} cy={n.y} r={1.8} fill={selected ? 'var(--accent)' : 'var(--text-secondary)'} />}
                            <title>{name}</title>
                        </g>
                    );
                })}
            </svg>
            <figcaption
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 16,
                    padding: '6px 10px',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                }}
            >
                <span>● Parent</span>
                <span>◎ Assistant</span>
                <span style={{ color: 'var(--accent)' }}>◯ Selected</span>
            </figcaption>
        </figure>
    );
};
