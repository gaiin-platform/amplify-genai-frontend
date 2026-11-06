import { describe, it, expect } from 'vitest';
import { humanizeConfigName, resolveSourceOpenTarget, summarizeAssistantConfig } from '../assistantConfigModel';

const promptWith = (definition: Record<string, any>, content = ''): any => ({
    id: 'p1',
    name: 'Shared one',
    content,
    data: { assistant: { definition } },
});

describe('summarizeAssistantConfig', () => {
    it('lists documents and websites separately, and each website once', () => {
        const summary = summarizeAssistantConfig(promptWith({
            instructions: 'Be helpful',
            dataSources: [
                { id: 's3://a', name: 'report.pdf', type: 'application/pdf' },
                { id: 'https://x.dev', name: 'https://x.dev', type: 'website/url' },
            ],
            data: { websiteUrls: [{ url: 'https://x.dev' }, { url: 'https://y.dev' }] },
        }));
        expect(summary.instructions).toBe('Be helpful');
        expect(summary.documents.map((d) => d.name)).toEqual(['report.pdf']);
        expect(summary.websites.map((d) => d.name)).toEqual(['https://x.dev', 'https://y.dev']);
    });

    it('falls back to prompt.content for instructions', () => {
        expect(summarizeAssistantConfig(promptWith({}, 'legacy text')).instructions).toBe('legacy text');
    });

    it('counts drive selections per integration and skips empty ones', () => {
        const summary = summarizeAssistantConfig(promptWith({
            data: {
                integrationDriveData: {
                    microsoft_drive: {
                        folders: { f1: { type: 'folder', datasource: { name: 'Specs' } } },
                        files: { a: { type: 'file', datasource: { name: 'a.docx' } }, b: { type: 'file' } },
                    },
                    google_drive: { folders: {}, files: {} },
                },
            },
        }));
        expect(summary.drive).toEqual([
            { integration: 'microsoft_drive', label: 'Microsoft Drive', fileCount: 2, folderCount: 1, names: ['Specs', 'a.docx'] },
        ]);
    });

    it('reads skills, never exposing a raw id as a name', () => {
        const summary = summarizeAssistantConfig(promptWith({
            data: { skills: [{ skillId: 'abc-123', isRequired: false, name: 'Brand voice' }, { skillId: 'def-456', isRequired: true }, 'junk'] },
        }));
        expect(summary.skills).toEqual([
            { name: 'Brand voice', required: false },
            { name: 'Unnamed skill', required: true },
        ]);
    });

    it('merges tools, operations and built-ins without duplicates', () => {
        const summary = summarizeAssistantConfig(promptWith({
            tools: [{ name: 'send_email' }],
            data: { operations: [{ name: 'sendEmail' }, { id: 'list_events' }], builtInOperations: ['list_events'] },
        }));
        expect(summary.tools).toEqual(['Send Email', 'List Events']);
    });

    it('carries the stored workflow name, and copes without one', () => {
        const named = summarizeAssistantConfig(promptWith({ data: { baseWorkflowTemplateId: 't-1', workflowTemplateName: 'Intake Triage' } }));
        expect(named).toMatchObject({ hasWorkflow: true, workflowName: 'Intake Triage' });
        expect(summarizeAssistantConfig(promptWith({ data: { baseWorkflowTemplateId: 't-1' } })).workflowName).toBeUndefined();
    });

    it('keeps each source key and group id for downloads', () => {
        const summary = summarizeAssistantConfig(promptWith({
            dataSources: [{ id: 'uuid-1', name: 'a.pdf', type: 'application/pdf', key: 's3://user/a.pdf', groupId: 'g1' }],
        }));
        expect(summary.documents[0]).toMatchObject({ id: 'uuid-1', key: 's3://user/a.pdf', groupId: 'g1' });
    });

    it('flags a workflow without needing the template to be readable', () => {
        expect(summarizeAssistantConfig(promptWith({ data: { baseWorkflowTemplateId: 't-1' } })).hasWorkflow).toBe(true);
        expect(summarizeAssistantConfig(promptWith({ data: {} })).hasWorkflow).toBe(false);
    });

    it('shows an enforced effort only while the model is enforced', () => {
        const base = { enforceThinkingLevel: true, thinkingLevel: 'high' };
        expect(summarizeAssistantConfig(promptWith({ data: { ...base, model: 'm1' } }))).toMatchObject({ enforcedModelId: 'm1', enforcedEffort: 'high' });
        expect(summarizeAssistantConfig(promptWith({ data: base }))).toMatchObject({ enforcedModelId: undefined, enforcedEffort: undefined });
    });

    it('survives empty and malformed records', () => {
        for (const bad of [null, undefined, { id: 'x', name: 'n', content: '' } as any, promptWith({ dataSources: 'nope', tools: 7, data: 'x' })]) {
            const summary = summarizeAssistantConfig(bad as any);
            expect(summary.documents).toEqual([]);
            expect(summary.tools).toEqual([]);
            expect(summary.skills).toEqual([]);
            expect(summary.drive).toEqual([]);
        }
    });
});

describe('humanizeConfigName', () => {
    it('handles snake, kebab and camel case', () => {
        expect(humanizeConfigName('microsoft_sharepoint')).toBe('Microsoft Sharepoint');
        expect(humanizeConfigName('getUserEmail')).toBe('Get User Email');
        expect(humanizeConfigName('web-search')).toBe('Web Search');
    });
});

describe('resolveSourceOpenTarget', () => {
    it('requests a file by its stored key with the s3:// prefix removed', () => {
        expect(resolveSourceOpenTarget({ id: 'uuid', name: 'a.pdf', key: 's3://u/a.pdf' })).toEqual({ kind: 'file', key: 'u/a.pdf' });
        expect(resolveSourceOpenTarget({ id: 's3://u/b.pdf', name: 'b.pdf', groupId: 'g' })).toEqual({ kind: 'file', key: 'u/b.pdf', groupId: 'g' });
    });

    it('opens a website at its http(s) address', () => {
        expect(resolveSourceOpenTarget({ id: 'https://x.dev', name: 'https://x.dev', type: 'website/url' })).toEqual({ kind: 'url', url: 'https://x.dev' });
    });

    it('refuses a website whose address is not http(s) — a share is untrusted data', () => {
        for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'x.dev', '']) {
            expect(resolveSourceOpenTarget({ id: bad, name: bad, type: 'website/url' })).toEqual({ kind: 'invalid' });
        }
    });
});
