import { describe, it, expect } from 'vitest';
import { LayeredNodeType, LeafNode, RouterNode } from '@/types/layeredAssistant';
import { MAP_WIDTH, ROW_HEIGHT, buildMapLayout } from '../layeredTreeLayout';

const leaf = (id: string): LeafNode => ({ type: LayeredNodeType.LEAF, id, assistantId: id, name: id, description: '', routerContext: [] });
const router = (id: string, children: (RouterNode | LeafNode)[] = []): RouterNode => ({
    type: LayeredNodeType.ROUTER, id, name: id, description: '', instructions: '', children,
});

describe('buildMapLayout', () => {
    it('places a lone root centred with a minimum height', () => {
        const layout = buildMapLayout(router('root'));
        expect(layout.nodes).toEqual([{ id: 'root', x: MAP_WIDTH / 2, y: 16, isParent: true, depth: 0 }]);
        expect(layout.edges).toEqual([]);
        expect(layout.height).toBe(54);
    });
    it('spreads children evenly under the parent, one row down, with an edge each', () => {
        const layout = buildMapLayout(router('root', [leaf('a'), leaf('b')]));
        const [root, a, b] = layout.nodes;
        expect(a.y).toBe(root.y + ROW_HEIGHT);
        expect(a.x).toBeLessThan(root.x);
        expect(b.x).toBeGreaterThan(root.x);
        expect(a.x + b.x).toBeCloseTo(root.x * 2);
        expect(layout.edges).toHaveLength(2);
        expect(a.isParent).toBe(false);
    });
    it('grows taller with depth and records each node depth', () => {
        const layout = buildMapLayout(router('root', [router('mid', [leaf('x')])]));
        expect(layout.nodes.map((n) => n.depth)).toEqual([0, 1, 2]);
        expect(layout.height).toBe(16 + ROW_HEIGHT * 2 + 20);
    });
    it('keeps every node inside the viewBox width for a wide tree', () => {
        const layout = buildMapLayout(router('root', Array.from({ length: 12 }, (_, i) => leaf(`l${i}`))));
        layout.nodes.forEach((n) => {
            expect(n.x).toBeGreaterThanOrEqual(0);
            expect(n.x).toBeLessThanOrEqual(MAP_WIDTH);
        });
    });
});
