import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LayeredNodeType, LeafNode, RouterNode } from '@/types/layeredAssistant';
import { LayeredTreeOutline } from '../layered/LayeredTreeOutline';
import { DEPTH_COLORS } from '../layeredTreeStyle';

const leaf = (id: string): LeafNode => ({ type: LayeredNodeType.LEAF, id, assistantId: id, name: id, description: '', routerContext: [] });
const router = (id: string, children: (RouterNode | LeafNode)[] = []): RouterNode => ({
    type: LayeredNodeType.ROUTER, id, name: id, description: '', instructions: '', children,
});

// top ─ a, mid ─ (b, inner ─ c), empty
const tree = () => router('top', [leaf('a'), router('mid', [leaf('b'), router('inner', [leaf('c')])]), router('empty')]);

const render = () =>
    renderToStaticMarkup(
        <LayeredTreeOutline root={tree()} selectedId="b" onSelect={() => {}} onMove={() => {}} onKeyboardMove={() => false} />,
    );

describe('LayeredTreeOutline structure', () => {
    it('renders every node as a tree item at its nesting level', () => {
        const html = render();
        expect((html.match(/role="treeitem"/g) || []).length).toBe(7);
        expect((html.match(/aria-level="1"/g) || []).length).toBe(1);
        expect((html.match(/aria-level="4"/g) || []).length).toBe(1);
    });

    it('starts fully expanded: parents with members say so, leaves and empty parents have no expanded state', () => {
        const html = render();
        // top, mid, inner
        expect((html.match(/aria-expanded="true"/g) || []).length).toBe(3);
        expect(html).not.toContain('aria-expanded="false"');
    });

    it('draws one coloured guide line per ancestor level', () => {
        const html = render();
        // Guides are the 2px-wide absolute spans; rows at depth d carry d of them. 1+1+2+2+... = sum of depths.
        // depths: top0 a1 mid1 b2 inner2 c3 empty1 => 10
        expect((html.match(/width:2px/g) || []).length).toBe(10);
    });

    it('colours the level icon chips from the shared depth palette', () => {
        const html = render().toLowerCase();
        DEPTH_COLORS.forEach((c) => expect(html).toContain(`background:${c}`));
    });

    it('tints only the selected row', () => {
        const html = render();
        expect((html.match(/aria-selected="true"/g) || []).length).toBe(1);
        expect((html.match(/inset 0 0 0 1\.5px/g) || []).length).toBe(1);
    });
});
