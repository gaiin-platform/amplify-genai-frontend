/**
 * openAtLatest — the "open a conversation at its newest message" rule.
 *
 * WHY THIS EXISTS
 * `home.tsx` renders the chat shell with `key={selectedConversation.id}`, so
 * switching conversations REMOUNTS the shell and `Chat.tsx` with it. Scroll
 * position is DOM state on `.chatcontainer`, so the new node starts at
 * `scrollTop = 0` — the very first message of the transcript. Chat.tsx never
 * corrects this: its only auto-scroll (Chat.tsx ~L1045) requires the message
 * count to GROW *and* the last message to be the user's, and neither is true
 * when you merely open an existing conversation. Result: every chat switch drops
 * you at the start of the conversation instead of at the latest message.
 *
 * The correction runs as a short pin loop rather than a single scroll, because
 * transcript height keeps growing after the first paint (images decoding, code
 * blocks highlighting, KaTeX, tables) — a one-shot scroll to the bottom lands
 * mid-conversation the moment anything below the fold gets taller.
 *
 * This module is the decision half of that loop, kept React-free and DOM-free so
 * the "when do we stop?" rule is unit-testable.
 */

/** Just the scroll geometry we need — so tests can pass a plain object. */
export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * How far the user may drift upward before we consider the pin cancelled.
 *
 * Matches Chat.tsx's own at-bottom tolerance (`bottomTolerance`, ~L905-935) and
 * ConversationViewShell's `BOTTOM_TOLERANCE`, so all three agree on what
 * "still at the bottom" means.
 */
export const OPEN_AT_LATEST_TOLERANCE = 30;

/** Frame budget for the pin loop (~1s at 60fps, same budget as anchorNewPrompt). */
export const OPEN_AT_LATEST_MAX_FRAMES = 60;

/**
 * Consecutive frames of unchanged `scrollHeight` that end the pin early. Once
 * the transcript has stopped growing there is nothing left to correct, so we
 * hand scrolling back rather than holding the user at the bottom for the full
 * budget.
 */
export const OPEN_AT_LATEST_STABLE_FRAMES = 5;

/**
 * The `scrollTop` that parks a freshly-opened conversation on its newest
 * message, or `null` to stop pinning because the user has taken over.
 *
 * `lastAppliedTop` is the scrollTop we ourselves left behind on the previous
 * frame (`null` on the first frame). Late content growth only raises the scroll
 * maximum and leaves `scrollTop` where it is, so a scrollTop that has moved
 * UPWARD by more than `tolerance` can only be the user scrolling — and their
 * position must win over ours.
 */
export function nextOpenAtLatestTop(
  metrics: ScrollMetrics,
  lastAppliedTop: number | null,
  tolerance: number = OPEN_AT_LATEST_TOLERANCE,
): number | null {
  if (lastAppliedTop !== null && metrics.scrollTop < lastAppliedTop - tolerance) {
    return null;
  }
  return Math.max(0, metrics.scrollHeight - metrics.clientHeight);
}
