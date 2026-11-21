import {
  getAvailableManualChatTools,
  getConversationChatTools,
  getManualChatToolOptions,
  toggleManualChatTool,
  withConversationChatTools,
} from '../conversationChatTools';

import { describe, expect, it } from 'vitest';

const routingOff = { deploymentFeatures: { routingEnabled: false } };

describe('manual conversation tools', () => {
  it('requires known routing-off and hides tools disabled by the deployment', () => {
    expect(getAvailableManualChatTools({})).toEqual([]);
    expect(getAvailableManualChatTools({ deploymentFeatures: {} })).toEqual([]);
    expect(
      getAvailableManualChatTools({
        deploymentFeatures: { routingEnabled: true },
      }),
    ).toEqual([]);
    expect(
      getAvailableManualChatTools({
        deploymentFeatures: {
          routingEnabled: false,
          availability: { webSearch: false, codeInterpreter: false },
        },
      }),
    ).toEqual(['artifacts']);
  });

  it('keeps Web search independent and switches between specialized modes', () => {
    const withArtifacts = toggleManualChatTool(['webSearch'], 'artifacts');
    const withInterpreter = toggleManualChatTool(
      withArtifacts,
      'codeInterpreter',
    );
    expect(withArtifacts).toEqual(['webSearch', 'artifacts']);
    expect(withInterpreter).toEqual(['webSearch', 'codeInterpreter']);
    expect(toggleManualChatTool(withInterpreter, 'webSearch')).toEqual([
      'codeInterpreter',
    ]);
  });

  it('stores selections on one chat and preserves other conversation metadata', () => {
    const chat = { id: 'one', data: { reasoningLevel: 'low' } };
    const saved = withConversationChatTools(chat, ['artifacts']);
    expect(getConversationChatTools(saved)).toEqual(['artifacts']);
    expect(saved.data.reasoningLevel).toBe('low');
    expect(getConversationChatTools(chat)).toEqual([]);
    expect(
      getConversationChatTools({
        data: { nuiChatTools: [null, 'webSearch', 'webSearch', 'not-a-tool'] },
      }),
    ).toEqual(['webSearch']);
  });

  it('maps active selections to explicit request options and drops hidden tools', () => {
    const chat = withConversationChatTools({ data: {} }, [
      'webSearch',
      'codeInterpreter',
    ]);
    expect(getManualChatToolOptions(chat, routingOff)).toEqual({
      enableWebSearch: true,
      codeInterpreterOnly: true,
      skipRag: true,
      ragOnly: false,
      ragEvaluation: false,
    });
    expect(getManualChatToolOptions(chat, {})).toEqual({});
    expect(
      getManualChatToolOptions(chat, {
        deploymentFeatures: { routingEnabled: true },
      }),
    ).toEqual({});
    expect(
      getManualChatToolOptions(chat, {
        deploymentFeatures: {
          routingEnabled: false,
          availability: { codeInterpreter: false },
        },
      }),
    ).toEqual({ enableWebSearch: true });
    expect(
      getManualChatToolOptions(
        withConversationChatTools(chat, ['artifacts']),
        routingOff,
      ),
    ).toEqual({ artifactsMode: true });
  });
});
