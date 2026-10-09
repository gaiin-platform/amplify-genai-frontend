import { describe, expect, it } from 'vitest';
import {
  AMPLIFY_HELPER_ASSISTANT_ID,
  AMPLIFY_HELPER_DATA_CLASSIFICATION_URL,
  AMPLIFY_HELPER_GUIDE_SECTIONS,
  AMPLIFY_HELPER_RESOURCES_URL,
  AMPLIFY_HELPER_SUPPORT_EMAIL,
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
