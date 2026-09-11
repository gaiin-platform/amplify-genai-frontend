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
 * SINGLE-PORTAL ARCHITECTURE
 * --------------------------
 * The host owns ONE portal at zIndex 10001. Inside it, exactly one of these is
 * ever rendered:
 *   - PromptTemplateDialog → PromptTemplateFillDialog (mode === 'fill')
 *   - NewUIPromptCreationModal              (mode === 'edit')
 *
 * Neither of those may portal itself. Two portals into `document.body` from the
 * same conditional slot is how the fill dialog ended up stranded behind the edit
 * modal: React removes a portal's children from the container it recorded, so a
 * portal root that is swapped out (or replaced by Fast Refresh while it is open)
 * can leave an owner-less `position:fixed` node sitting in `document.body` that
 * nothing can ever close.
 *
 * The portal target is a dedicated element this host creates and removes in an
 * effect — NOT `document.body` itself. Tearing down the container removes every
 * node inside it in one step, so no stale overlay can outlive the host even if
 * React's own child removal is skipped (which is exactly what a hot-module swap
 * of a portalling child does).
 *
 * SCROLLBAR SCOPE
 * ---------------
 * The wrapper carries `data-new-ui-shell="true"`. It has to: `_app.tsx` puts
 * `data-chat-palette="warm-browns"` on `document.body`, whose
 * `::-webkit-scrollbar-thumb` rule is orange, and `conversation-view.css` is
 * `@import`ed at the TOP of `globals.css` — so the `[data-new-ui="true"]` blue
 * thumb rule loses the equal-specificity tie on source order. The
 * `[data-new-ui-shell="true"]` rules are declared after every palette override
 * in globals.css and win. Portalled surfaces are outside home.tsx's shell div,
 * so they must opt in explicitly or they inherit the palette's orange.
 */

import React, { useEffect, useContext, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Prompt } from '@/types/prompt';
import { PromptTemplateDialog } from '@/components/NewUI/shared/PromptTemplateDialog';
import { NewUIPromptCreationModal } from '@/components/NewUI/views/NewUIPromptCreationModal';
import HomeContext from '@/pages/api/home/home.context';
import { savePrompts } from '@/utils/app/prompts';

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

type Mode = 'fill' | 'edit';

export const PromptTemplateDialogHost: React.FC = () => {
  const {
    state: { prompts },
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const promptsRef = useRef(prompts);
  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [mode, setMode] = useState<Mode>('fill');

  /**
   * Dedicated portal target. Owned by this host so its removal is a single
   * `el.remove()` — see SCROLLBAR/PORTAL notes at the top of the file.
   */
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.createElement('div');
    el.setAttribute('data-prompt-template-portal', 'true');
    document.body.appendChild(el);
    setContainer(el);
    return () => {
      el.remove();
      setContainer(null);
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent).detail?.prompt as Prompt | undefined;
      if (next) {
        setMode('fill');
        setPrompt(next);
      }
    };
    window.addEventListener(USE_PROMPT_TEMPLATE_EVENT, handler);
    return () => window.removeEventListener(USE_PROMPT_TEMPLATE_EVENT, handler);
  }, []);

  const handleClose = useCallback(() => setPrompt(null), []);

  const handleStarted = useCallback(() => setPrompt(null), []);

  const handleEdit = useCallback(() => setMode('edit'), []);

  const handleUpdatePrompt = useCallback((updated: Prompt) => {
    const next = promptsRef.current.map((p: Prompt) =>
      p.id === updated.id ? updated : p,
    );
    homeDispatch({ field: 'prompts', value: next });
    savePrompts(next);
    setPrompt(updated);
  }, [homeDispatch]);

  const handleEditDone = useCallback(() => setMode('fill'), []);

  // Render nothing when no template is active, or before the container exists
  if (!prompt || !container) return null;

  // Single portal — always at zIndex 10001. Inside it we swap content.
  return createPortal(
    <div
      data-new-ui-shell="true"
      className="text-neutral-900 dark:text-white"
      style={{ position: 'fixed', inset: 0, zIndex: 10001 }}
    >
      {mode === 'fill' ? (
        <PromptTemplateDialog
          prompt={prompt}
          onClose={handleClose}
          onStarted={handleStarted}
          onEdit={handleEdit}
        />
      ) : (
        /* Edit mode: NewUIPromptCreationModal's CreationModalShell renders its
           own position:fixed overlay at zIndex 9999, which paints within this
           stacking context (10001) — appearing above everything else. */
        <NewUIPromptCreationModal
          prompt={prompt}
          onSave={handleEditDone}
          onCancel={handleEditDone}
          onUpdatePrompt={handleUpdatePrompt}
        />
      )}
    </div>,
    container,
  );
};

export default PromptTemplateDialogHost;
