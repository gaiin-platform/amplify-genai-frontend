/**
 * PromptTemplateDialog — the "populate and use this template" popup for the new UI.
 *
 * WHY THIS EXISTS
 * ---------------
 * Chat.tsx already renders the old `VariableModal` whenever the selected
 * conversation has a `promptTemplate` and zero messages — but in the new UI that
 * modal can never be seen, for three independent reasons:
 *
 *   1. It is nested INSIDE `#overflowScroll` (Chat.tsx:1374, container closes at
 *      1397), and `conversation-view.css` sets
 *      `[data-new-ui="true"] #overflowScroll { display: none !important }`.
 *   2. `home.tsx` parks the whole `ConversationViewShell` at
 *      `left:-100vw; visibility:hidden` while `messages.length === 0` — which is
 *      exactly the state a freshly-created template conversation is in.
 *   3. `ReusableComponents/Modal` is NOT portalled and uses `z-50`, while
 *      `NewSettingsModal` sits at `zIndex: 9999` — so it would render underneath
 *      the settings modal it was launched from anyway.
 *
 * So the new UI has to own this presentation. We import the old `VariableModal`
 * unmodified (NEW_UI_GUIDE §1 — import old behaviour, never edit it) and portal it
 * to `document.body` above everything, then reproduce Chat.tsx's fill semantics
 * (`fillInTemplate` with the same `fillInDocuments` rule) and hand the resulting
 * text to the proven `amplify_pending_message` bridge that NewHome already uses.
 *
 * The model is now selected via a `ModelPicker` in the footer of
 * `PromptTemplateFillDialog`. The selection flows through
 * `startConversationWithTemplate` → `handleNewConversation({ model })`, which
 * is the only path that actually applies a model to a new conversation.
 * (`amplify_pending_model_id` is cleared by ConversationViewShell and never
 * applied, so that key is not used here.)  A template's own enforced model
 * always takes priority over the user's pick.
 */

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { Prompt } from '@/types/prompt';
import { AttachedDocument } from '@/types/attacheddocument';
import { PromptTemplateFillDialog } from '@/components/NewUI/shared/PromptTemplateFillDialog';
import { EffortLevel } from '@/components/NewUI/shared/ModelPicker';
import {
  fillInTemplate,
  parseEditableVariables,
} from '@/utils/app/prompts';
import { startConversationWithTemplate } from '@/components/NewUI/shared/promptConversation';

/**
 * The variables a user must fill before this template can run.
 * Callers use this to decide whether the popup is worth showing at all — a
 * template with nothing to populate should just start the conversation.
 */
export const promptTemplateVariables = (prompt: Prompt): string[] =>
  parseEditableVariables(prompt.content || '');

export interface PromptTemplateDialogProps {
  /** The template being used. */
  prompt: Prompt;
  /** Close the popup without starting anything. */
  onClose: () => void;
  /** Fired after the conversation has been created and the send queued. */
  onStarted?: () => void;
  /** When provided, renders an edit icon button that fires this callback. */
  onEdit?: () => void;
}

export const PromptTemplateDialog: React.FC<PromptTemplateDialogProps> = ({
  prompt,
  onClose,
  onStarted,
  onEdit,
}) => {
  const {
    state: { prompts, availableModels, statsService, defaultModelId },
    dispatch: homeDispatch,
    handleNewConversation,
  } = useContext(HomeContext);

  // handleStartConversationWithPrompt resolves data.rootPromptId against this list.
  const promptsRef = useRef(prompts);
  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  const variables = useMemo(() => promptTemplateVariables(prompt), [prompt]);

  // Model + effort selection state — seeded from the user's default model.
  // The template's enforced model (if any) takes priority in
  // startConversationWithTemplate; we still pass selectedModelId so it is used
  // when no model is enforced.
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
    defaultModelId ?? undefined,
  );
  const [selectedEffort, setSelectedEffort] = useState<EffortLevel>('medium');

  // Suppress the picker when the template itself enforces a specific model.
  const enforcedModelId: string | undefined =
    (prompt.data?.assistant?.definition?.data?.model as string | undefined) ?? undefined;

  const handleSubmit = (
    updatedVariables: string[],
    documents: AttachedDocument[] | null,
  ) => {
    const template = prompt.content || '';

    // Same rule as Chat.tsx#handleSubmit: don't inline document text when this is
    // a workflow, or when the documents are already uploaded (they travel as
    // dataSources instead of being pasted into the prompt body).
    const doWorkflow = prompt.type === 'automation';
    const fillInDocuments = !(
      doWorkflow || (documents && documents.some((doc) => doc.key))
    );

    const content = fillInTemplate(
      template,
      variables,
      updatedVariables,
      documents,
      fillInDocuments,
    );

    const docsWithKeys = (documents ?? []).filter((doc) => !!doc.key);

    if (typeof window !== 'undefined') {
      // The bridge ConversationViewShell#tryInject consumes once the new
      // conversation mounts. Mirrors NewHome's send path exactly.
      if (content.trim()) {
        sessionStorage.setItem('amplify_pending_message', content);
      }
      if (docsWithKeys.length > 0) {
        sessionStorage.setItem('amplify_pending_docs', JSON.stringify(docsWithKeys));
      }
      // Tell home.tsx a send is already in flight, so it doesn't flash the
      // NewHome landing page during the window where messages.length is still 0.
      window.dispatchEvent(new Event('amplifyNewConversationSendPending'));
    }

    statsService.startConversationEvent(prompt);
    // Creates the conversation with promptTemplate, tags, rootPrompt and the
    // resolved model (user-selected, falling back to the template's enforced
    // model if present). Uses 'New Conversation' name so the AI renames it
    // after the first reply (same as every other chat).
    startConversationWithTemplate(
      handleNewConversation,
      promptsRef.current,
      prompt,
      availableModels,
      selectedModelId,
    );
    homeDispatch({ field: 'page', value: 'chat' });
    onStarted?.();
  };

  // Use the new-UI fill dialog (styled with design tokens, edit button support).
  return (
    <PromptTemplateFillDialog
      prompt={prompt}
      variables={variables}
      onSubmit={handleSubmit}
      onClose={onClose}
      onEdit={onEdit}
      selectedModelId={selectedModelId}
      selectedEffort={selectedEffort}
      onModelChange={setSelectedModelId}
      onEffortChange={setSelectedEffort}
      enforcedByAssistant={!!enforcedModelId}
    />
  );
};

export default PromptTemplateDialog;
