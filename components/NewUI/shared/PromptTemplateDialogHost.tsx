/**
 * PromptTemplateDialogHost — mounts the "use this template" popup at the new-UI
 * root, outside every modal that can launch it.
 *
 * WHY THIS EXISTS
 * ---------------
 * The popup is launched from `PromptTemplatesSection`, which lives *inside*
 * `NewSettingsModal`. Rendering the dialog there means it can only ever be shown
 * with the settings modal still sitting behind it — and closing settings to get it
 * out of the way unmounts the dialog along with it (React unmounts the whole
 * subtree). The two requirements are mutually exclusive as long as the dialog is
 * a descendant of the thing that opened it.
 *
 * So ownership moves up here. Launchers fire the `amplifyUsePromptTemplate`
 * window event with the template in `detail.prompt` and are then free to close
 * themselves; this host is mounted once by `home.tsx`'s new-UI layout block, as a
 * sibling of `NewSettingsModal`, so the popup survives.
 *
 * There is exactly one mount, deliberately: settings can appear from three
 * different places (the collapsed sidebar, the expanded sidebar, and the ⌘,
 * shortcut in home.tsx), and a per-launcher host would have to be duplicated into
 * each one.
 */

import React, { useEffect, useState } from 'react';
import { Prompt } from '@/types/prompt';
import { PromptTemplateDialog } from '@/components/NewUI/shared/PromptTemplateDialog';

/** Event name launchers use to open the popup. */
export const USE_PROMPT_TEMPLATE_EVENT = 'amplifyUsePromptTemplate';

/**
 * Open the "populate and use this template" popup. Safe to call immediately
 * before closing the modal you're calling it from — the host is not a descendant
 * of it, so the popup outlives the launcher.
 */
export const openPromptTemplateDialog = (prompt: Prompt) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(USE_PROMPT_TEMPLATE_EVENT, { detail: { prompt } }),
  );
};

export const PromptTemplateDialogHost: React.FC = () => {
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent).detail?.prompt as Prompt | undefined;
      if (next) setPrompt(next);
    };
    window.addEventListener(USE_PROMPT_TEMPLATE_EVENT, handler);
    return () => window.removeEventListener(USE_PROMPT_TEMPLATE_EVENT, handler);
  }, []);

  if (!prompt) return null;

  return (
    <PromptTemplateDialog
      prompt={prompt}
      onClose={() => setPrompt(null)}
      onStarted={() => setPrompt(null)}
    />
  );
};

export default PromptTemplateDialogHost;
