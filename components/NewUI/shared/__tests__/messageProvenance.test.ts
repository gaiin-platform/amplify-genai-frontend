import { describe, expect, it } from 'vitest';
import {
  buildMessageMetaStamp,
  capList,
  formatExactTimestamp,
  formatProvenanceMarkdown,
  getMessageProvenance,
  humanizeToolName,
  MESSAGE_META_KEY,
} from '@/components/NewUI/shared/messageProvenance';

describe('buildMessageMetaStamp', () => {
  it('captures model and effort', () => {
    expect(
      buildMessageMetaStamp({
        model: { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', extra: 1 },
        data: { reasoningLevel: 'high' },
      }),
    ).toEqual({ model: { id: 'gpt-5', name: 'GPT-5' }, reasoningLevel: 'high' });
  });
  it('returns null without a model', () => {
    expect(buildMessageMetaStamp({})).toBeNull();
  });
});

describe('humanizeToolName', () => {
  it('splits camelCase and snake_case', () => {
    expect(humanizeToolName('sendEmail')).toBe('Send email');
    expect(humanizeToolName('read_email')).toBe('Read email');
  });
});

describe('getMessageProvenance', () => {
  const stamp = { model: { id: 'm1', name: 'Model One' }, reasoningLevel: 'low' };

  it('has no model for replies without a stamp (never guesses)', () => {
    const p = getMessageProvenance({ message: { role: 'assistant', data: {} } });
    expect(p.model).toBeUndefined();
    expect(p.webSearch).toBe(false);
  });

  it('reads model, web search, skills, assistant and attached connector actions', () => {
    const p = getMessageProvenance({
      message: {
        role: 'assistant',
        timestamp: '2026-01-02T03:04:05.000Z',
        data: {
          [MESSAGE_META_KEY]: stamp,
          state: {
            currentAssistant: 'Contract Helper',
            currentAssistantId: 'ast/1',
            sources: { webSearch: { sources: [{ url: 'x' }] } },
            activeSkills: [{ id: 's', name: 'Summarize' }],
          },
        },
      },
      userMessage: {
        role: 'user',
        configuredTools: [{ name: 'readEmail' }, { name: 'readEmail' }],
        data: { dataSources: [{ name: 'a.pdf' }] },
      },
    });
    expect(p.model?.name).toBe('Model One');
    expect(p.reasoningLevel).toBe('low');
    expect(p.webSearch).toBe(true);
    expect(p.assistant).toBe('Contract Helper');
    expect(p.skills).toEqual(['Summarize']);
    expect(p.connectorActionsAttached).toEqual(['Read email']);
    expect(p.files).toEqual(['a.pdf']);
  });

  it('treats backend placeholder assistants as no assistant', () => {
    const p = getMessageProvenance({
      message: { role: 'assistant', data: { state: { currentAssistant: 'default', currentAssistantId: 'default' } } },
    });
    expect(p.assistant).toBeUndefined();
  });

  it('lists executed agent actions via the injected log reader', () => {
    const log = {
      data: {
        result: [
          { role: 'assistant', content: { tool: 'read_email' } },
          { role: 'assistant', content: { tool: 'read_email' } },
          { role: 'assistant', content: { tool: 'exec_code' } },
          { role: 'environment', content: { tool: 'think' } },
        ],
      },
    };
    const p = getMessageProvenance({
      message: { role: 'assistant', data: { state: { agentLog: [1] } } },
      readAgentLog: () => log,
    });
    expect(p.actionsUsed).toEqual(['Read email', 'Code execution']);
  });

  it('survives a throwing log reader', () => {
    const p = getMessageProvenance({
      message: { role: 'assistant', data: { state: { agentLog: [1] } } },
      readAgentLog: () => {
        throw new Error('bad');
      },
    });
    expect(p.actionsUsed).toEqual([]);
  });
});

describe('formatExactTimestamp', () => {
  it('is empty for missing/invalid input', () => {
    expect(formatExactTimestamp(undefined)).toBe('');
    expect(formatExactTimestamp('nope')).toBe('');
  });
  it('stops at the minute', () => {
    expect(formatExactTimestamp('2026-01-02T03:04:05.000Z')).not.toMatch(/\d:\d\d:\d\d/);
  });
});

describe('attached vs used connector actions', () => {
  const log = { data: { result: [{ role: 'assistant', content: { tool: 'read_email' } }] } };
  it('does not list an action as attached when it already ran', () => {
    const p = getMessageProvenance({
      message: { role: 'assistant', data: { state: { agentLog: [1] } } },
      userMessage: { role: 'user', configuredTools: [{ name: 'readEmail' }, { name: 'sendEmail' }] },
      readAgentLog: () => log,
    });
    expect(p.actionsUsed).toEqual(['Read email']);
    expect(p.connectorActionsAttached).toEqual(['Send email']);
  });
});

describe('capList', () => {
  it('truncates long lists with a count', () => {
    expect(capList(['a', 'b', 'c'], 2)).toEqual(['a', 'b', '+1 more']);
    expect(capList(['a', 'b'], 2)).toEqual(['a', 'b']);
  });
});

describe('formatProvenanceMarkdown', () => {
  const base = { webSearch: false, codeInterpreter: false, skills: [], connectorActionsAttached: [], actionsUsed: [], mcpTools: [], files: [] };
  it('is empty when there is nothing to report', () => {
    expect(formatProvenanceMarkdown(base)).toBe('');
  });
  it('emits one blockquote line, each fact once, omitting unrecorded ones', () => {
    const line = formatProvenanceMarkdown({
      ...base,
      timestamp: '2026-01-02T03:04:05.000Z',
      model: { id: 'm', name: 'Model One' },
      reasoningLevel: 'high',
      assistant: 'Helper',
      webSearch: true,
      actionsUsed: ['Read email'],
      connectorActionsAttached: ['Send email'],
      files: ['my*file.pdf'],
    });
    expect(line.startsWith('> ')).toBe(true);
    expect(line).not.toContain('\n');
    expect(line).toContain('Model One · High effort');
    expect(line).toContain('Assistant: Helper');
    expect(line).toContain('Used: Web search, Read email');
    expect(line).toContain('Also attached: Send email');
    expect(line).toContain('Files: my\\*file.pdf');
    expect(line).not.toContain('Not recorded');
  });
});
