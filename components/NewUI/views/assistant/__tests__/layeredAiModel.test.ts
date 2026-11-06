import { describe, it, expect } from 'vitest';
import { LayeredNodeType, LeafNode, RouterNode } from '@/types/layeredAssistant';
import { buildFieldRequest, buildTreePrompt, extractJson, parseTree, summarizeAssistant } from '../layeredAiModel';

const known = [{ id: 'astp/1', name: 'Billing Helper' }, { id: 'astp/2', name: 'Tech Support' }];
const leaf = (assistantId = 'astp/1', over: Partial<LeafNode> = {}): LeafNode => ({
    type: LayeredNodeType.LEAF, id: 'l', assistantId, name: 'Billing Helper', description: '', routerContext: [], ...over,
});
const router = (children: (RouterNode | LeafNode)[] = [], over: Partial<RouterNode> = {}): RouterNode => ({
    type: LayeredNodeType.ROUTER, id: 'r', name: 'Front desk', description: '', instructions: '', children, ...over,
});

describe('summarizeAssistant', () => {
    it('falls back to just the name', () => {
        expect(summarizeAssistant(null, 'X')).toBe('- Name: X');
    });
    it('truncates long instructions and lists tags, data sources and tools', () => {
        const text = summarizeAssistant({
            name: 'A', description: 'd', instructions: 'x'.repeat(400), tags: ['t1', 't2'],
            dataSources: [{ name: 'f.pdf' }, { id: 'raw' }], data: { operations: [{ name: 'op' }], builtInOperations: ['b'], workflowTemplateId: 'w' },
        }, 'A');
        expect(text).toContain('...');
        expect(text).toContain('Tags: t1, t2');
        expect(text).toContain('Data Sources: f.pdf, raw');
        expect(text).toContain('Tools: op, b');
        expect(text).toContain('Workflow: w');
    });
});

describe('buildFieldRequest', () => {
    const summaryFor = (id: string, name: string) => `- Name: ${name} (${id})`;
    it('builds a router description prompt listing its children', () => {
        const req = buildFieldRequest(router([leaf()]), 'description', summaryFor)!;
        expect(req.userMessage).toContain('router named "Front desk"');
        expect(req.userMessage).toContain('Billing Helper (astp/1)');
    });
    it('describes sub-routers by child count', () => {
        const req = buildFieldRequest(router([router([leaf(), leaf('astp/2')], { name: 'Inner' })]), 'instructions', summaryFor)!;
        expect(req.userMessage).toContain('Inner (sub-router with 2 children)');
        expect(req.systemPrompt).toContain('decision guides');
    });
    it('includes the current draft so the model refines it', () => {
        expect(buildFieldRequest(router([], { instructions: 'old guide' }), 'instructions', summaryFor)!.userMessage).toContain('old guide');
    });
    it('offers only a description for a leaf', () => {
        expect(buildFieldRequest(leaf(), 'description', summaryFor)).not.toBeNull();
        expect(buildFieldRequest(leaf(), 'instructions', summaryFor)).toBeNull();
    });
});

describe('buildTreePrompt', () => {
    it('includes purpose, assistants and categories, with placeholders when empty', () => {
        const filled = buildTreePrompt({ purpose: 'Help students', assistants: [{ id: '1', name: 'Billing Helper', tags: ['fees'] }], categories: ['Aid'], extraContext: 'ctx' });
        expect(filled).toContain('Help students');
        expect(filled).toContain('name: "Billing Helper"');
        expect(filled).toContain('tags: ["fees"]');
        expect(filled).toContain('- "Aid"');
        const empty = buildTreePrompt({ purpose: ' ', assistants: [], categories: [], extraContext: '' });
        expect(empty).toContain('not specified');
        expect(empty).toContain('No specific assistants pre-selected');
    });
});

describe('extractJson', () => {
    it('reads plain, fenced and prose-wrapped JSON', () => {
        expect(extractJson('{"a":1}')).toEqual({ a: 1 });
        expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
        expect(extractJson('Here you go: {"a":1} enjoy')).toEqual({ a: 1 });
    });
    it('throws a readable message for empty, missing and broken JSON', () => {
        expect(() => extractJson('')).toThrow('No response');
        expect(() => extractJson('no json here')).toThrow('did not contain');
        expect(() => extractJson('{ nope }')).toThrow('not valid JSON');
    });
});

describe('parseTree', () => {
    const raw = {
        name: 'Campus', description: 'Routes things',
        rootNode: { type: 'router', id: 'dup', name: 'Root', instructions: 'guide', children: [
            { type: 'leaf', id: 'dup', name: 'billing helper', assistantId: 'Billing Helper', description: 'bills' },
            { type: 'leaf', id: 'dup', name: 'Invented', assistantId: 'Something New' },
            { type: 'router', id: 'dup', name: 'Sub', children: [{ type: 'leaf', name: 'Tech Support', assistantId: 'ASTP/2' }] },
        ] },
    };
    it('resolves leaf references by name or id, case-insensitively, and keeps unknown ones as written', () => {
        const la = parseTree(raw, known);
        const [a, b, sub] = la.rootNode.children as any[];
        expect(a.assistantId).toBe('astp/1');
        expect(b.assistantId).toBe('Something New');
        expect(sub.children[0].assistantId).toBe('astp/2');
        expect(la.name).toBe('Campus');
    });
    it('gives every node a fresh, unique id even when the model repeats them', () => {
        const la = parseTree(raw, known);
        const ids: string[] = [];
        const walk = (n: any) => { ids.push(n.id); (n.children ?? []).forEach(walk); };
        walk(la.rootNode);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).not.toContain('dup');
    });
    it('accepts a bare root node and fills defaults', () => {
        const la = parseTree({ type: 'router', children: [] }, known);
        expect(la.name).toBe('Generated Layered Assistant');
        expect(la.rootNode.name).toBe('Router');
    });
    it('coerces non-string fields from the model so rendering can never throw', () => {
        const la = parseTree({ name: 99, rootNode: { type: 'router', name: 42, description: { x: 1 }, instructions: null, children: [{ type: 'leaf', name: 7, assistantId: 5 }] } }, []);
        const leaf = la.rootNode.children[0] as any;
        expect(la.name).toBe('99');
        expect(la.rootNode.name).toBe('42');
        expect(la.rootNode.description).toBe('');
        expect(la.rootNode.instructions).toBe('');
        expect(leaf.name).toBe('7');
        expect(leaf.assistantId).toBe('5');
        expect(() => la.rootNode.name.trim()).not.toThrow();
    });
    it('rejects a tree whose root is a leaf', () => {
        expect(() => parseTree({ rootNode: { type: 'leaf', name: 'x' } }, known)).toThrow('must start with a parent');
    });
});
