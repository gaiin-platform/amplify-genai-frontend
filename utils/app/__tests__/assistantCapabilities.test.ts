import { describe, it, expect } from 'vitest';
import { getAssistantCapabilities } from '../assistantCapabilities';
import { alphaGroupKey } from '../alphaGroups';

const prompt = (definition: any) => ({ id: 'p', data: { assistant: { definition } } } as any);

describe('getAssistantCapabilities', () => {
    it('is empty for a plain assistant', () => {
        expect(getAssistantCapabilities(prompt({ name: 'a', dataSources: [], data: {} }))).toEqual([]);
    });

    it('reports every configured capability in display order, counting files apart from websites', () => {
        const out = getAssistantCapabilities(prompt({
            name: 'a',
            dataSources: [{ id: '1', type: 'application/pdf' }, { id: '2', type: 'text/plain' }, { id: '3', type: 'website/url' }],
            data: {
                opsLanguageVersion: 'v4',
                emailEvents: { tag: 't' },
                builtInOperations: ['x'],
                scheduledTaskIds: { websites: 'w' },
                baseWorkflowTemplateId: 'wf',
                integrationDriveData: { onedrive: { folders: { a: {}, b: {} }, files: { c: {} } } },
            },
        }));
        expect(out.map((c) => c.kind)).toEqual(['agent', 'email', 'api', 'scheduled', 'website', 'drive', 'workflow', 'files']);
        expect(out.find((c) => c.kind === 'files')?.label).toBe('2');
        expect(out.find((c) => c.kind === 'website')?.label).toBe('1');
        expect(out.find((c) => c.kind === 'drive')).toMatchObject({ label: '2/1', tooltip: '2 Folders, 1 File' });
    });

    it('ignores empty scheduled ids and empty tool lists', () => {
        expect(getAssistantCapabilities(prompt({ name: 'a', data: { scheduledTaskIds: {}, operations: [], builtInOperations: [] } }))).toEqual([]);
    });
});

describe('alphaGroupKey', () => {
    it('files by first letter, ignoring case, accents and leading space', () => {
        expect(alphaGroupKey('apple')).toBe('A');
        expect(alphaGroupKey('  Émile')).toBe('E');
    });
    it('puts digits, symbols and empty names under #', () => {
        expect(alphaGroupKey('1 ast')).toBe('#');
        expect(alphaGroupKey('_x')).toBe('#');
        expect(alphaGroupKey('')).toBe('#');
    });
});
