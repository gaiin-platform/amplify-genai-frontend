import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssistantConfigSummary } from '../AssistantConfigSummary';

const render = (definition: Record<string, any>, modelName?: (id: string) => string | undefined) =>
    renderToStaticMarkup(
        React.createElement(AssistantConfigSummary, {
            prompt: { id: 'p', name: 'A', content: '', data: { assistant: { definition } } } as any,
            modelName,
        }),
    );

describe('AssistantConfigSummary', () => {
    it('shows instructions, documents, skills, tools and the workflow', () => {
        const html = render({
            instructions: 'Answer briefly',
            dataSources: [{ id: 'd1', name: 'handbook.pdf', type: 'application/pdf' }],
            tools: [{ name: 'send_email' }],
            data: { skills: [{ skillId: 's', name: 'Brand voice', isRequired: true }], baseWorkflowTemplateId: 'wf' },
        });
        for (const text of ['Answer briefly', 'handbook.pdf', 'Brand voice', 'Send Email', 'Runs a workflow template']) {
            expect(html).toContain(text);
        }
    });

    it('omits sections that have nothing in them, and never shows tags', () => {
        const html = render({ instructions: 'Hi', tags: ['secret-tag'], data: { tags: ['secret-tag'] } });
        expect(html).not.toContain('Documents');
        expect(html).not.toContain('Skills');
        expect(html).not.toContain('Workflow');
        expect(html).not.toContain('secret-tag');
    });

    it('names an enforced model through the lookup and falls back to the id', () => {
        const data = { model: 'gpt-x' };
        expect(render({ data }, () => 'GPT X')).toContain('GPT X');
        expect(render({ data })).toContain('gpt-x');
    });

    it('names the workflow when the share carries its name', () => {
        expect(render({ data: { baseWorkflowTemplateId: 'wf', workflowTemplateName: 'Intake Triage' } })).toContain('Runs the “Intake Triage” workflow');
    });

    it('makes document cards openable only when the host provides a handler', () => {
        const definition = { dataSources: [{ id: 'd1', name: 'handbook.pdf', type: 'application/pdf' }] };
        const prompt: any = { id: 'p', name: 'A', content: '', data: { assistant: { definition } } };
        const readOnly = renderToStaticMarkup(React.createElement(AssistantConfigSummary, { prompt }));
        const openable = renderToStaticMarkup(React.createElement(AssistantConfigSummary, { prompt, onOpenDocument: () => {} }));
        expect(readOnly).not.toContain('Download handbook.pdf');
        expect(openable).toContain('Download handbook.pdf');
    });

    it('says so when no instructions came with the share', () => {
        expect(render({})).toContain('No prompt instructions were included');
    });
});
