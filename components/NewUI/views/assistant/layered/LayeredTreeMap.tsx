/**
 * LayeredTreeMap — a small SVG overview of the whole routing tree, for orientation and quick
 * selection. Nodes take the same per-level colour as the outline (`layeredTreeStyle`) and the selected
 * node is amber with a glow ring. Colour is a second cue: shape carries the meaning (parents are larger
 * discs, assistants smaller discs with a centre dot) and the selection also gets a ring, so nothing
 * depends on hue. Every node is a keyboard-focusable button named after the node. Layout comes from
 * `layeredTreeLayout`.
 */

import React, { useMemo } from 'react';
import { RouterNode } from '@/types/layeredAssistant';
import { findNode } from '../layeredTreeModel';
import { buildMapLayout } from '../layeredTreeLayout';
import { SELECTED_COLOR, depthColor } from '../layeredTreeStyle';

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
                    const color = selected ? SELECTED_COLOR : depthColor(n.depth);
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
                            {selected && (
                                <>
                                    <circle cx={n.x} cy={n.y} r={r + 8} fill="none" stroke={SELECTED_COLOR} strokeWidth={1.5} opacity={0.3} />
                                    <circle cx={n.x} cy={n.y} r={r + 4} fill="none" stroke={SELECTED_COLOR} strokeWidth={2} opacity={0.65} />
                                </>
                            )}
                            <circle cx={n.x} cy={n.y} r={r} fill={color} stroke={selected ? 'var(--text-primary)' : 'var(--bg-raised)'} strokeWidth={selected ? 1.5 : 1} />
                            {!n.isParent && <circle cx={n.x} cy={n.y} r={1.8} fill="#fff" />}
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
                <LegendItem label="Parent" color={depthColor(0)} r={5.5} />
                <LegendItem label="Assistant" color={depthColor(1)} r={4} dot />
                <LegendItem label="Selected" color={SELECTED_COLOR} r={5.5} />
            </figcaption>
        </figure>
    );
};

const LegendItem: React.FC<{ label: string; color: string; r: number; dot?: boolean }> = ({ label, color, r, dot }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
            <circle cx={7} cy={7} r={r} fill={color} />
            {dot && <circle cx={7} cy={7} r={1.5} fill="#fff" />}
        </svg>
        {label}
    </span>
);
