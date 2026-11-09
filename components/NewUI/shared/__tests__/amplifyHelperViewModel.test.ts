import { describe, expect, it } from 'vitest';
import {
  amplifyHelperSectionSlug,
  buildAmplifyHelperQuestion,
  filterAmplifyHelperSections,
} from '@/components/NewUI/views/AmplifyHelperAssistant';

describe('Amplify Helper view model', () => {
  const sections = [
    { title: 'Library & files', summary: 'Use Library for saved files.', steps: ['Open Library to search.'] },
    { title: 'Settings', summary: 'Configure your preferences.', steps: ['Open Settings → Connectors.'] },
  ];

  it('creates stable section anchors', () => {
    expect(amplifyHelperSectionSlug('Prompt Templates and Custom Instructions')).toBe('prompt-templates-and-custom-instructions');
    expect(amplifyHelperSectionSlug('!!!', 2)).toBe('section-3');
  });

  it('filters titles, summaries, and steps without changing guide data', () => {
    expect(filterAmplifyHelperSections(sections, 'saved files')).toHaveLength(1);
    expect(filterAmplifyHelperSections(sections, 'connectors')[0].title).toBe('Settings');
    expect(filterAmplifyHelperSections(sections, '')).toEqual(sections);
  });

  it('builds a topic question for a section', () => {
    expect(buildAmplifyHelperQuestion(sections[0])).toContain('Library & files');
  });
});
