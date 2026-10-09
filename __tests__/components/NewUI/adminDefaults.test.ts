import { describe, expect, it } from 'vitest';
import { BUILTIN_SYSTEM_PROMPTS } from '@/components/NewUI/settings/admin/systemPromptDefaults';
import { getDeploymentFeatureAvailability } from '@/components/NewUI/shared/deploymentFeaturePolicy';
import { normalizeAdminConversationStorage } from '@/components/NewUI/settings/admin/adminDefaults';

describe('New UI admin defaults', () => {
  it('shows effective built-in ordinary-chat prompts in blank admin fields', () => {
    expect(BUILTIN_SYSTEM_PROMPTS['ordinaryChat.base']).toContain('You are Amplify');
    expect(BUILTIN_SYSTEM_PROMPTS['webSearch.use']).toContain('cite source URLs');
    expect(BUILTIN_SYSTEM_PROMPTS['artifacts.generate']).toContain('autoArtifacts');
    expect(BUILTIN_SYSTEM_PROMPTS['codeInterpreter.use']).toContain('secure Python sandbox');
    expect(BUILTIN_SYSTEM_PROMPTS['amplifyHelper.base']).toContain('Amplify Helper');
  });

  it('defaults highlighter and memory off while preserving other availability defaults', () => {
    expect(getDeploymentFeatureAvailability({})).toEqual({
      promptHighlighter: false,
      artifacts: true,
      webSearch: true,
      codeInterpreter: true,
      memory: false,
    });
  });

  it('defaults missing or invalid admin conversation storage to future-cloud', () => {
    expect(normalizeAdminConversationStorage(undefined)).toBe('future-cloud');
    expect(normalizeAdminConversationStorage('future-local')).toBe('future-local');
  });
});
