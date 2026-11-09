/**
 * One-shot handoff from the Amplify Helper guide to the new-chat composer.
 * This intentionally does not use the pending-message bridge because that path
 * is consumed by the conversation shell and sends automatically.
 */
export const AMPLIFY_HELPER_PREFILL_KEY = 'amplify_helper_topic_prefill';

export function writeAmplifyHelperPrefill(question?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (question?.trim()) {
      sessionStorage.setItem(AMPLIFY_HELPER_PREFILL_KEY, question.trim());
    } else {
      sessionStorage.removeItem(AMPLIFY_HELPER_PREFILL_KEY);
    }
  } catch {
    // Private browsing or storage quota errors should not block starting chat.
  }
}

/** Read and remove the question so a browser refresh cannot duplicate it. */
export function consumeAmplifyHelperPrefill(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const question = sessionStorage.getItem(AMPLIFY_HELPER_PREFILL_KEY)?.trim() || null;
    sessionStorage.removeItem(AMPLIFY_HELPER_PREFILL_KEY);
    return question;
  } catch {
    return null;
  }
}
