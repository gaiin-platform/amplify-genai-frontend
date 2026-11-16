import { describe, expect, it } from 'vitest';
import {
  AMPLIFY_HELPER_ASSISTANT_ID,
  AMPLIFY_HELPER_GUIDE_SECTIONS,
  buildAmplifyHelperGuideSections,
  buildAmplifyHelperPrompt,
  createAmplifyHelperAssistant,
} from '@/components/NewUI/shared/amplifyHelperGuide';

const flatten = (sections: ReturnType<typeof buildAmplifyHelperGuideSections>) =>
  sections.map((section) => `${section.title} ${section.summary} ${section.steps.join(' ')}`).join(' ');

describe('Amplify Helper guide', () => {
  it('covers the major New UI workflows', () => {
    const guide = flatten([...AMPLIFY_HELPER_GUIDE_SECTIONS]);
    for (const expected of [
      'Assistants and sharing',
      'Prompt Templates and Custom Instructions',
      'Connectors, actions, skills, and MCP',
      'Library, files, and data sources',
      'Scheduled Tasks and Workflows',
      'Chats, folders, and Notebook',
    ]) {
      expect(guide).toContain(expected);
    }
  });

  it('creates a non-persisted identity with the reserved helper marker', () => {
    const helper = createAmplifyHelperAssistant();
    expect(helper.id).toBe(AMPLIFY_HELPER_ASSISTANT_ID);
    expect(helper.definition.data?.amplifyHelper).toBe(true);
    expect(helper.definition.tags).toContain('amplify:system');
  });
});

describe('Amplify Helper has no hardcoded organization content', () => {
  const FORBIDDEN = ['Vanderbilt', 'vanderbilt', 'VUIT', 'Level 3', 'HIPAA', 'COA', 'AGI'];

  it('keeps the guide generic', () => {
    for (const org of [null, 'Acme Corporation']) {
      const guide = flatten(buildAmplifyHelperGuideSections(org));
      for (const forbidden of FORBIDDEN) expect(guide).not.toContain(forbidden);
    }
  });

  it('writes a generic prompt, naming the organization only when configured', () => {
    for (const prompt of [buildAmplifyHelperPrompt(null), buildAmplifyHelperPrompt('Acme Corporation', 'Acme AI')]) {
      for (const forbidden of FORBIDDEN) expect(prompt).not.toContain(forbidden);
    }
    expect(buildAmplifyHelperPrompt('Acme Corporation', 'Acme AI')).toContain('Acme AI Helper');
    expect(buildAmplifyHelperPrompt('Acme Corporation', 'Acme AI')).toContain('Acme Corporation');
  });
});
