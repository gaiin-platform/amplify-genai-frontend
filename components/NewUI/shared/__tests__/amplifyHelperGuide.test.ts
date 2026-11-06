import { describe, expect, it } from 'vitest';
import {
  AMPLIFY_HELPER_ASSISTANT_ID,
  AMPLIFY_HELPER_DATA_CLASSIFICATION_URL,
  AMPLIFY_HELPER_GUIDE_SECTIONS,
  AMPLIFY_HELPER_RESOURCES_URL,
  AMPLIFY_HELPER_SUPPORT_EMAIL,
  buildAmplifyHelperGuideSections,
  buildAmplifyHelperPrompt,
  createAmplifyHelperAssistant,
} from '@/components/NewUI/shared/amplifyHelperGuide';

describe('Amplify Helper guide', () => {
  it('covers the major New UI workflows and supplied policy facts', () => {
    const guide = AMPLIFY_HELPER_GUIDE_SECTIONS.map((section) => `${section.title} ${section.summary} ${section.steps.join(' ')}`).join(' ');
    for (const expected of [
      'Assistants and sharing',
      'Prompt Templates and Custom Instructions',
      'Connectors, actions, skills, and MCP',
      'Library, files, and data sources',
      'Scheduled Tasks and Workflows',
      'Chats, folders, and Notebook',
      'Level 3 data excluding HIPAA',
      'quarterly for AI token cost/consumption',
      'amplify@vanderbilt.edu',
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

  it('publishes safe default resources and support links', () => {
    expect(AMPLIFY_HELPER_RESOURCES_URL).toMatch(/^https:\/\//);
    expect(AMPLIFY_HELPER_DATA_CLASSIFICATION_URL).toMatch(/^https:\/\//);
    expect(AMPLIFY_HELPER_SUPPORT_EMAIL).toBe('amplify@vanderbilt.edu');
  });
});

describe('Amplify Helper white labeling', () => {
  const flatten = (sections: ReturnType<typeof buildAmplifyHelperGuideSections>) =>
    sections.map((section) => `${section.title} ${section.summary} ${section.steps.join(' ')}`).join(' ');

  it('keeps the Vanderbilt content for the stock deployment', () => {
    const guide = flatten(buildAmplifyHelperGuideSections(null));
    expect(guide).toContain('Level 3 data excluding HIPAA');
    expect(guide).toContain(AMPLIFY_HELPER_SUPPORT_EMAIL);
    expect(buildAmplifyHelperPrompt(null)).toContain('Vanderbilt Amplify');
    expect(buildAmplifyHelperPrompt(null)).toContain('amplify@vanderbilt.edu');
  });

  it('removes every Vanderbilt-specific guide detail for another organization', () => {
    const sections = buildAmplifyHelperGuideSections('Acme Corporation');
    const guide = flatten(sections);
    expect(sections.map((section) => section.title)).not.toContain('Data classification and cost');
    for (const forbidden of ['Vanderbilt', 'vanderbilt', 'VUIT', 'Level 3', 'HIPAA', 'COA', 'AGI']) {
      expect(guide).not.toContain(forbidden);
    }
    // The rest of the guide is unchanged.
    expect(sections.length).toBe(buildAmplifyHelperGuideSections(null).length - 1);
    expect(guide).toContain('Assistants and sharing');
  });

  it('writes a generic prompt for another organization', () => {
    const prompt = buildAmplifyHelperPrompt('Acme Corporation', 'Acme AI');
    expect(prompt).toContain('Acme AI Helper');
    for (const forbidden of ['Vanderbilt', 'vanderbilt', 'Level 3', 'HIPAA', 'COA']) {
      expect(prompt).not.toContain(forbidden);
    }
  });
});
