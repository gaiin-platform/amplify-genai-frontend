import { describe, it, expect } from 'vitest';
import { LayeredNodeType, LeafNode, RouterNode } from '@/types/layeredAssistant';
import {
    addLeaf,
    addSubParent,
    allLeaves,
    assignedLeafIds,
    assistantRefId,
    collectWarnings,
    countNodes,
    deleteNode,
    findNode,
    getNodeDepth,
    indentNode,
    insertNode,
    isProperAncestor,
    leafNameMap,
    moveNode,
    moveNodeStep,
    moveOptions,
    normalizeDropPosition,
    outdentNode,
    removeNode,
    resolveDropDestination,
    routerContextOptions,
    setRouterContext,
    unresolvedLeaves,
    updateNode,
    validateForSave,
} from '../layeredTreeModel';

const router = (id: string, children: (RouterNode | LeafNode)[] = [], extra: Partial<RouterNode> = {}): RouterNode => ({
    type: LayeredNodeType.ROUTER, id, name: id, description: '', instructions: 'guide', children, ...extra,
});
const leaf = (id: string, assistantId = `ast-${id}`): LeafNode => ({
    type: LayeredNodeType.LEAF, id, assistantId, name: id, description: '', routerContext: [],
});

/**
 * root
 * ├─ a (leaf)
 * ├─ r1
 * │  ├─ b (leaf)
 * │  └─ c (leaf)
 * └─ d (leaf)
 */
const sample = () => router('root', [leaf('a'), router('r1', [leaf('b'), leaf('c')]), leaf('d')]);
const ids = (r: RouterNode) => r.children.map((c) => c.id);

describe('lookup', () => {
    it('finds nodes with parent and index', () => {
        const found = findNode(sample(), 'c')!;
        expect(found.parent!.id).toBe('r1');
        expect(found.index).toBe(1);
        expect(findNode(sample(), 'root')!.parent).toBeNull();
        expect(findNode(sample(), 'nope')).toBeNull();
    });
    it('computes depth, counts and ancestry', () => {
        const root = sample();
        expect(getNodeDepth(root, 'root')).toBe(0);
        expect(getNodeDepth(root, 'c')).toBe(2);
        expect(getNodeDepth(root, 'nope')).toBe(-1);
        expect(countNodes(root, 'router')).toBe(2);
        expect(countNodes(root, 'leaf')).toBe(4);
        expect(isProperAncestor(root, 'r1', 'c')).toBe(true);
        expect(isProperAncestor(root, 'r1', 'r1')).toBe(false);
        expect(isProperAncestor(root, 'c', 'r1')).toBe(false);
    });
    it('collects leaves, ids and a name map', () => {
        const root = sample();
        expect(allLeaves(root).map((l) => l.id)).toEqual(['a', 'b', 'c', 'd']);
        expect(assignedLeafIds(root).has('ast-b')).toBe(true);
        expect(leafNameMap(root)).toMatchObject({ 'ast-a': 'a', 'ast-d': 'd' });
    });
});

describe('immutable edits', () => {
    it('updateNode changes one node and leaves the input alone', () => {
        const root = sample();
        const next = updateNode(root, 'r1', (n) => ({ ...n, name: 'Renamed' }));
        expect(findNode(next, 'r1')!.node.name).toBe('Renamed');
        expect(findNode(root, 'r1')!.node.name).toBe('r1');
    });
    it('removeNode drops a subtree but never the root', () => {
        expect(findNode(removeNode(sample(), 'r1'), 'b')).toBeNull();
        expect(removeNode(sample(), 'root').id).toBe('root');
    });
    it('insertNode clamps the index', () => {
        expect(ids(insertNode(sample(), 'root', leaf('z'), 99))).toEqual(['a', 'r1', 'd', 'z']);
        expect(ids(insertNode(sample(), 'root', leaf('z'), -5))[0]).toBe('z');
    });
    it('setRouterContext adds and removes without duplicating', () => {
        let root = setRouterContext(sample(), 'a', 'tools', true);
        root = setRouterContext(root, 'a', 'tools', true);
        expect((findNode(root, 'a')!.node as LeafNode).routerContext).toEqual(['tools']);
        root = setRouterContext(root, 'a', 'tools', false);
        expect((findNode(root, 'a')!.node as LeafNode).routerContext).toEqual([]);
    });
    it('deleteNode returns the parent as the next selection, and refuses the root', () => {
        const result = deleteNode(sample(), 'b')!;
        expect(result.selectId).toBe('r1');
        expect(findNode(result.root, 'b')).toBeNull();
        expect(deleteNode(sample(), 'root')).toBeNull();
    });
});

describe('adding members', () => {
    it('refuses a sub-parent under a router with no assistant yet', () => {
        const result = addSubParent(router('root', [router('empty')]), 'root');
        expect(result.ok).toBe(false);
    });
    it('adds a numbered sub-parent once the router has a leaf', () => {
        const result = addSubParent(sample(), 'root');
        expect(result.ok).toBe(true);
        if (result.ok) {
            const created = findNode(result.root, result.id)!.node;
            expect(created.name).toBe('Parent 3');
        }
    });
    it('will not add under a leaf', () => {
        expect(addSubParent(sample(), 'a').ok).toBe(false);
        expect(addLeaf(sample(), 'a', { id: 'p', name: 'P' }).ok).toBe(false);
    });
    it('builds a leaf from an assistant, preferring the root assistant id and definition description', () => {
        const withDef = { id: 'prompt-1', name: 'Helper', description: 'short', data: { assistant: { definition: { assistantId: 'astp/9', description: 'full' } } } };
        expect(assistantRefId(withDef)).toBe('astp/9');
        expect(assistantRefId({ id: 'prompt-2', name: 'X' })).toBe('prompt-2');
        const result = addLeaf(sample(), 'r1', withDef);
        expect(result.ok).toBe(true);
        if (result.ok) {
            const added = findNode(result.root, result.id)!.node as LeafNode;
            expect(added).toMatchObject({ assistantId: 'astp/9', name: 'Helper', description: 'full' });
        }
    });
});

describe('drop position', () => {
    const root = sample();
    it('maps the pointer to before / inside / after', () => {
        expect(normalizeDropPosition(root, 'a', 'r1', 0.1)).toBe('before');
        expect(normalizeDropPosition(root, 'a', 'r1', 0.5)).toBe('inside');
        expect(normalizeDropPosition(root, 'a', 'r1', 0.9)).toBe('after');
    });
    it('uses the nearest edge on a leaf and only "inside" on the root', () => {
        expect(normalizeDropPosition(root, 'a', 'd', 0.4)).toBe('before');
        expect(normalizeDropPosition(root, 'a', 'd', 0.6)).toBe('after');
        expect(normalizeDropPosition(root, 'a', 'root', 0.1)).toBe('inside');
    });
    it('rejects self, root drags and dropping a router into its own subtree', () => {
        expect(normalizeDropPosition(root, 'a', 'a', 0.5)).toBeNull();
        expect(normalizeDropPosition(root, 'root', 'a', 0.5)).toBeNull();
        expect(normalizeDropPosition(root, 'r1', 'c', 0.5)).toBeNull();
        expect(normalizeDropPosition(root, 'nope', 'a', 0.5)).toBeNull();
    });
});

describe('resolveDropDestination / moveNode', () => {
    it('resolves before, after and inside', () => {
        const root = sample();
        expect(resolveDropDestination(root, 'r1', 'before')).toEqual({ parentId: 'root', index: 1 });
        expect(resolveDropDestination(root, 'r1', 'after')).toEqual({ parentId: 'root', index: 2 });
        expect(resolveDropDestination(root, 'r1', 'inside')).toEqual({ parentId: 'r1', index: 2 });
        expect(resolveDropDestination(root, 'a', 'inside')).toBeNull();
        expect(resolveDropDestination(root, 'root', 'before')).toBeNull();
    });
    it('moves a leaf into another router', () => {
        const next = moveNode(sample(), 'a', 'r1', 'inside')!;
        expect(ids(next)).toEqual(['r1', 'd']);
        expect(ids(findNode(next, 'r1')!.node as RouterNode)).toEqual(['b', 'c', 'a']);
    });
    it('reorders within a parent, accounting for the index shift', () => {
        expect(ids(moveNode(sample(), 'a', 'd', 'after')!)).toEqual(['r1', 'd', 'a']);
        expect(ids(moveNode(sample(), 'd', 'a', 'before')!)).toEqual(['d', 'a', 'r1']);
    });
    it('treats dropping where it already is as a no-op', () => {
        expect(moveNode(sample(), 'a', 'r1', 'before')).toBeNull();
        expect(moveNode(sample(), 'r1', 'a', 'after')).toBeNull();
    });
    it('refuses cycles, self, the root, and "inside" a leaf', () => {
        expect(moveNode(sample(), 'r1', 'c', 'before')).toBeNull();
        expect(moveNode(sample(), 'r1', 'r1', 'inside')).toBeNull();
        expect(moveNode(sample(), 'root', 'a', 'after')).toBeNull();
        expect(moveNode(sample(), 'a', 'd', 'inside')).toBeNull();
    });
    it('keeps every node (a move never drops or duplicates)', () => {
        const before = countNodes(sample(), 'leaf') + countNodes(sample(), 'router');
        const next = moveNode(sample(), 'b', 'root', 'inside')!;
        expect(countNodes(next, 'leaf') + countNodes(next, 'router')).toBe(before);
    });
});

describe('keyboard moves', () => {
    it('moves up and down among siblings, stopping at the ends', () => {
        expect(ids(moveNodeStep(sample(), 'r1', 'up')!)).toEqual(['r1', 'a', 'd']);
        expect(ids(moveNodeStep(sample(), 'r1', 'down')!)).toEqual(['a', 'd', 'r1']);
        expect(moveNodeStep(sample(), 'a', 'up')).toBeNull();
        expect(moveNodeStep(sample(), 'd', 'down')).toBeNull();
        expect(moveNodeStep(sample(), 'root', 'down')).toBeNull();
    });
    it('indents into the router above, only if the sibling above is a router', () => {
        const next = indentNode(sample(), 'd')!;
        expect(ids(findNode(next, 'r1')!.node as RouterNode)).toEqual(['b', 'c', 'd']);
        expect(indentNode(sample(), 'r1')).toBeNull(); // sibling above is a leaf
        expect(indentNode(sample(), 'a')).toBeNull();  // first child
    });
    it('outdents to follow the parent, but not out of the root', () => {
        const next = outdentNode(sample(), 'b')!;
        expect(ids(next)).toEqual(['a', 'r1', 'b', 'd']);
        expect(outdentNode(sample(), 'a')).toBeNull();
    });
    it('reports which moves are available', () => {
        expect(moveOptions(sample(), 'a')).toEqual({ up: false, down: true, indent: false, outdent: false });
        expect(moveOptions(sample(), 'b')).toEqual({ up: false, down: true, indent: false, outdent: true });
    });
});

describe('validation', () => {
    it('requires a name', () => {
        expect(validateForSave({ name: '  ', rootNode: sample() }).error).toBeTruthy();
        expect(validateForSave({ name: 'X', rootNode: sample() }).error).toBeNull();
    });
    it('warns about empty and single-member routers, missing guides and sub-parent-only routers', () => {
        const warnings = collectWarnings(
            router('root', [router('empty', [], { instructions: '' }), router('only', [leaf('x')]), router('nest', [router('inner', [leaf('y'), leaf('z')])])], { instructions: '' }),
        );
        expect(warnings.some((w) => w.includes('"empty" has no members'))).toBe(true);
        expect(warnings.some((w) => w.includes('"only" has only 1 member'))).toBe(true);
        expect(warnings.some((w) => w.includes('"root" has no Decision Guide'))).toBe(true);
        expect(warnings.some((w) => w.includes('"nest" only contains sub-parents'))).toBe(true);
    });
    it('does not double-report an empty router as "only sub-parents"', () => {
        const warnings = collectWarnings(router('root', [], { instructions: '' }));
        expect(warnings.filter((w) => w.includes('"root"'))).toHaveLength(1);
    });
    it('warns about unnamed nodes', () => {
        const root = router('root', [{ ...leaf('a'), name: ' ' }, leaf('b')]);
        expect(collectWarnings(root).some((w) => w.startsWith('A assistant node has no name'))).toBe(true);
    });
    it('a clean tree has no warnings', () => {
        expect(collectWarnings(sample())).toEqual([]);
    });
    it('adds a save warning for assistants that can’t be found when known ids are supplied', () => {
        const known = new Set(['ast-a', 'ast-b', 'ast-c']);
        const withIds = validateForSave({ name: 'X', rootNode: sample() }, { knownIds: known });
        expect(withIds.warnings.some((w) => w.includes('Assistant "d" can\'t be found'))).toBe(true);
        expect(validateForSave({ name: 'X', rootNode: sample() }).warnings).toEqual([]);
    });
    it('flags leaves whose assistant is unknown', () => {
        expect(unresolvedLeaves(sample(), new Set(['ast-a', 'ast-b', 'ast-c'])).map((l) => l.id)).toEqual(['d']);
    });
});

describe('rule consistency (documented gap)', () => {
    it('indent can create a parent that holds only a parent — addSubParent refuses it, a warning reports it', () => {
        const root = router('root', [router('r0', []), router('r1', [leaf('x')])]);
        const next = indentNode(root, 'r1')!;
        expect(addSubParent(next, 'r0').ok).toBe(false);
        expect(collectWarnings(next).some((w) => w.includes('only contains sub-parents'))).toBe(true);
    });
    it('moving a node into the parent it is already in is a no-op', () => {
        expect(moveNode(sample(), 'c', 'r1', 'inside')).toBeNull();
        expect(moveNode(sample(), 'd', 'r1', 'after')).toBeNull();
    });
});

describe('routerContextOptions', () => {
    it('offers only what the assistant has', () => {
        expect(routerContextOptions(null)).toEqual([]);
        expect(routerContextOptions({})).toEqual([]);
        const all = routerContextOptions({ dataSources: [{}], data: { operations: [{}], workflowTemplateId: 'w' } });
        expect(all.map((o) => o.field)).toEqual(['dataSources', 'tools', 'workflow']);
        expect(routerContextOptions({ data: { integrationDriveData: { x: 1 } } }).map((o) => o.field)).toEqual(['dataSources']);
        expect(routerContextOptions({ data: { builtInOperations: ['x'] } }).map((o) => o.field)).toEqual(['tools']);
    });
});
