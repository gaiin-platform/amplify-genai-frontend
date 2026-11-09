/**
 * NewUIStatusExitLayer — fades out and collapses a status indicator that React has just removed.
 *
 * Why this exists: "Thinking…" is owned by several components (the classic PromptStatus card,
 * ConversationViewShell's injected row, the tool-step layer). Each is unmounted instantly by
 * its owner at a moment that is correct and must not change — but the instant removal makes
 * the whole reply jump up by the row's height (~50px). We can't delay React's unmount, so
 * instead we watch for it: when an indicator disappears we put an inert copy of it back in the
 * same spot and animate that copy to opacity 0 / height 0. The reply glides up instead.
 *
 * What it does NOT do:
 *   - It never decides whether an indicator shows. It only reacts to one that is already gone.
 *   - "Sending…" (ChatLoader) is excluded: it is always handed straight over to the assistant
 *     turn, and a copy in a different container would stack on top of the new indicator.
 *   - If another indicator appears while a copy is still leaving (a hand-off between two
 *     sources), every copy is dropped at once, so two rows never sit stacked.
 *   - Nothing is animated under prefers-reduced-motion (the removal stays instant).
 *   - Anything big (a message, a step group, a whole turn) is left alone: only a small
 *     subtree whose single job is the indicator qualifies.
 *
 * The copy is aria-hidden, pointer-events:none and short-lived (EXIT_MS), and is inserted the
 * same way ConversationViewShell already inserts its own nodes into React-owned containers.
 */
import React, { useEffect } from 'react';

/** Keep in sync with `.nui-status-ghost` in styles/conversation-view.css. */
const EXIT_MS = 180;
const GHOST_ATTR = 'data-nui-status-ghost';

/**
 * Is `el` a leaving copy, or inside one?
 *
 * A copy is a deep clone of the removed indicator, so it carries the SAME classes as the real
 * one (`new-ui-awaiting-answer`, `new-ui-loading-text`, `[data-nui-status]`). Every other effect
 * that looks those nodes up by class (ConversationViewShell) must skip copies, or it will adopt,
 * move or remove one — and that removal is itself a mutation this layer would answer with yet
 * another copy: an endless chain of MutationObserver callbacks that never yields to React and
 * freezes the tab. Copies are scenery only.
 */
export const isInStatusGhost = (el: Element | null | undefined): boolean =>
  !!el && !!el.closest(`[${GHOST_ATTR}]`);
const INDICATOR = '[data-nui-status]';
/** A qualifying unit is tiny. Anything with more elements than this is some other component. */
const MAX_UNIT_ELEMENTS = 40;

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Is this removed node just an indicator (plus its immediate wrapper), and not "Sending…"? */
const isIndicatorUnit = (node: HTMLElement): boolean => {
  if (node.hasAttribute(GHOST_ATTR)) return false;
  const marks = node.matches(INDICATOR) ? [node] : Array.from(node.querySelectorAll(INDICATOR));
  if (marks.length !== 1) return false;
  if ((marks[0] as HTMLElement).getAttribute('data-source') === 'sending') return false;
  if (node.querySelector('#chatHover, .chatContentBlock, .enhanced-chat-message')) return false;
  return node.querySelectorAll('*').length <= MAX_UNIT_ELEMENTS;
};

const liveIndicatorExists = (root: ParentNode): boolean =>
  Array.from(root.querySelectorAll(INDICATOR)).some((el) => !isInStatusGhost(el));

export const NewUIStatusExitLayer: React.FC = () => {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const ghosts = new Set<HTMLElement>();
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const dropGhosts = () => {
      ghosts.forEach((g) => g.remove());
      ghosts.clear();
    };

    const leave = (node: HTMLElement, parent: Element, before: Node | null) => {
      const wrap = document.createElement('div');
      wrap.setAttribute(GHOST_ATTR, '');
      wrap.setAttribute('aria-hidden', 'true');
      wrap.className = 'nui-status-ghost';
      const inner = document.createElement('div');
      inner.className = 'nui-status-ghost-inner';

      const copy = node.cloneNode(true) as HTMLElement;
      // A copy must never duplicate ids or become a second live region.
      [copy, ...Array.from(copy.querySelectorAll<HTMLElement>('*'))].forEach((el) => {
        el.removeAttribute('id');
        el.removeAttribute('aria-live');
        el.removeAttribute('role');
      });
      inner.appendChild(copy);
      wrap.appendChild(inner);

      parent.insertBefore(wrap, before && before.parentNode === parent ? before : null);
      ghosts.add(wrap);

      // Commit the full-height state first, then flip, so the transition has a start value.
      void wrap.offsetHeight;
      requestAnimationFrame(() => wrap.setAttribute('data-leaving', ''));
      const t = setTimeout(() => {
        wrap.remove();
        ghosts.delete(wrap);
        timers.delete(t);
      }, EXIT_MS + 40);
      timers.add(t);
    };

    const onMutations = (records: MutationRecord[]) => {
      const container = document.querySelector('.chatcontainer');
      if (!container) return;

      // A new indicator means a hand-off between sources: drop any leaving copy immediately.
      const added = records.some((r) =>
        Array.from(r.addedNodes).some(
          (n) =>
            n instanceof HTMLElement &&
            !n.hasAttribute(GHOST_ATTR) &&
            (n.matches(INDICATOR) || n.querySelector(INDICATOR)),
        ),
      );
      if (added) dropGhosts();

      if (prefersReducedMotion()) return;
      // The replacement may already be in the DOM (same commit): nothing to leave behind.
      if (liveIndicatorExists(container)) return;

      for (const rec of records) {
        const parent = rec.target;
        if (!(parent instanceof Element) || !parent.isConnected) continue;
        // Something was removed from inside a leaving copy (or the copy itself is going): a copy
        // never gets a copy of its own.
        if (isInStatusGhost(parent)) continue;
        for (const node of Array.from(rec.removedNodes)) {
          if (node instanceof HTMLElement && isIndicatorUnit(node)) {
            leave(node, parent, rec.nextSibling);
          }
        }
      }
    };

    const start = () => {
      const container = document.querySelector('.chatcontainer');
      if (!container) {
        retryTimer = setTimeout(start, 300);
        return;
      }
      observer = new MutationObserver(onMutations);
      observer.observe(container, { childList: true, subtree: true });
    };
    start();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      observer?.disconnect();
      timers.forEach(clearTimeout);
      dropGhosts();
    };
  }, []);

  return null;
};

export default NewUIStatusExitLayer;
