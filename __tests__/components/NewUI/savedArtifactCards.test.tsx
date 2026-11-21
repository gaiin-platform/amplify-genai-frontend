// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import HomeContext, { type HomeContextProps } from '@/components/Home/home.context';
import { SavedArtifactCards } from '@/components/Chat/ChatContentBlocks/AutoArtifactBlock';
import type { Artifact } from '@/types/artifacts';
import { newMessage } from '@/types/chat';

it('renders the New UI cards for saved references and switches between their exact versions', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const artifact = (artifactId: string, version: number, name: string): Artifact => ({
    artifactId, version, name, type: 'text', description: '', createdAt: '', contents: [], tags: [],
  });
  const artifacts = {
    report: [artifact('report', 1, 'Release draft'), artifact('report', 2, 'Release checklist')],
    migration: [artifact('migration', 1, 'Migration notes')],
  };
  const message = newMessage({ role: 'user', content: 'Compare the saved sources.', data: {
    artifacts: [{ artifactId: 'report', version: 1 }, { artifactId: 'migration' }, { artifactId: 'missing' }],
  }});
  const onPanelChange = vi.fn();
  window.addEventListener('openArtifactsTrigger', onPanelChange);
  const element = document.createElement('div');
  const root = createRoot(element);

  function Context() {
    const [selectedArtifacts, setSelectedArtifacts] = useState<Artifact[]>();
    const context = {
      state: { selectedConversation: { artifacts }, selectedArtifacts },
      dispatch: ({ value }: { value: Artifact[] }) => setSelectedArtifacts(value),
    } as unknown as HomeContextProps;
    return <HomeContext.Provider value={context}><SavedArtifactCards message={message} /></HomeContext.Provider>;
  }

  try {
    act(() => root.render(<Context />));
    expect(element.querySelector('#artifactsButtonBlock')).toBeNull();
    expect(element.textContent).toContain('Release draft');
    expect(element.textContent).not.toContain('Release checklist');
    const cards = element.querySelectorAll('[data-nui-direct-artifact-card="true"]');
    expect(cards).toHaveLength(2);

    const release = cards[0].querySelector('button')!;
    const migration = cards[1].querySelector('button')!;
    act(() => release.click());
    expect(onPanelChange.mock.lastCall?.[0].detail).toEqual({ isOpen: true, artifactIndex: 0 });
    expect(release.textContent).toBe('Hide');
    expect(migration.textContent).toBe('Open');
    act(() => migration.click());
    expect(release.textContent).toBe('Open');
    expect(migration.textContent).toBe('Hide');
  } finally {
    act(() => window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false } })));
    act(() => root.unmount());
    window.removeEventListener('openArtifactsTrigger', onPanelChange);
    vi.unstubAllGlobals();
  }
});
