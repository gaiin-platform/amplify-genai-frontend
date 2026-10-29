/**
 * Layout for the layered-assistant mini map: where each node and edge sits in a fixed-width SVG.
 * Ported from the old builder's `buildMiniLayout`. Children share their parent's horizontal span
 * evenly, one row (`ROW_HEIGHT`) per level. Pure, so it can be tested.
 *
 * No React imports.
 */

import { LayeredAssistantNode, RouterNode, isRouterNode } from '@/types/layeredAssistant';

export const MAP_WIDTH = 200;
export const ROW_HEIGHT = 34;
const TOP = 16;
const MIN_HALF_WIDTH = 7;

export interface MapNode { id: string; x: number; y: number; isParent: boolean; depth: number }
export interface MapEdge { x1: number; y1: number; x2: number; y2: number }
export interface MapLayout { nodes: MapNode[]; edges: MapEdge[]; width: number; height: number }

export function buildMapLayout(root: RouterNode): MapLayout {
    const nodes: MapNode[] = [];
    const edges: MapEdge[] = [];

    const place = (node: LayeredAssistantNode, x: number, y: number, halfWidth: number, depth: number) => {
        nodes.push({ id: node.id, x, y, isParent: isRouterNode(node), depth });
        if (!isRouterNode(node) || node.children.length === 0) return;
        const step = (halfWidth * 2) / node.children.length;
        const startX = x - halfWidth + step / 2;
        node.children.forEach((child, i) => {
            const cx = startX + step * i;
            const cy = y + ROW_HEIGHT;
            edges.push({ x1: x, y1: y, x2: cx, y2: cy });
            place(child, cx, cy, Math.max(step / 2, MIN_HALF_WIDTH), depth + 1);
        });
    };

    place(root, MAP_WIDTH / 2, TOP, 82, 0);
    const maxY = nodes.reduce((max, n) => Math.max(max, n.y), 0);
    return { nodes, edges, width: MAP_WIDTH, height: Math.max(54, maxY + 20) };
}
