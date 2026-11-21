import { BUILTIN_SYSTEM_PROMPTS } from '@/components/NewUI/settings/admin/systemPromptDefaults';
import {
  AMPLIFY_HELPER_ASSISTANT_ID,
  AMPLIFY_HELPER_GUIDE_SECTIONS,
  buildAmplifyHelperPrompt,
  createAmplifyHelperAssistant,
} from '@/components/NewUI/shared/amplifyHelperGuide';

import { describe, expect, it } from 'vitest';

describe('Amplify Helper guide', () => {
  it('covers New UI workflows without deployment-specific contact or policy information', () => {
    const guide = AMPLIFY_HELPER_GUIDE_SECTIONS.map(
      ({ title, summary, steps }) => [title, summary, ...steps].join(' '),
    ).join(' ');

    for (const expected of [
      'Assistants and sharing',
      'Prompt Templates and Custom Instructions',
      'Connectors, actions, skills, and MCP',
      'Library, files, and data sources',
      'Scheduled Tasks and Workflows',
      'Chats, folders, and Notebook',
      'contact your administrator',
    ]) {
      expect(guide).toContain(expected);
    }
    expect(guide).not.toMatch(
      /Vanderbilt|VUIT|Level 3|HIPAA|Data classification and cost/i,
    );
  });

  it('creates a non-persisted identity with the reserved helper marker', () => {
    const helper = createAmplifyHelperAssistant();
    expect(helper.id).toBe(AMPLIFY_HELPER_ASSISTANT_ID);
    expect(helper.definition.data?.amplifyHelper).toBe(true);
    expect(helper.definition.tags).toContain('amplify:system');
  });

  it('uses the same neutral default in the admin editor and the built-in Helper', () => {
    const prompt = buildAmplifyHelperPrompt();
    expect(BUILTIN_SYSTEM_PROMPTS['amplifyHelper.base']).toBe(prompt);
    expect(prompt).toContain(
      'Direct support questions to the deployment administrators',
    );
    expect(prompt).not.toMatch(/Vanderbilt|Level 3|HIPAA|COA/i);
  });

  it('uses the chosen brand name in the Helper prompt', () => {
    expect(buildAmplifyHelperPrompt('Acme AI')).toContain(
      'You are Acme AI Helper',
    );
  });
});
