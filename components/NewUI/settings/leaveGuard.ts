/**
 * LeaveGuard — what a Settings section tells the modal when leaving it would lose something
 * (close, Escape, backdrop click, switching to another section).
 *
 * The modal already guarded unsaved Account edits with fixed copy; a section that has its own
 * "are you sure?" reports one of these instead. No React imports.
 */
export interface LeaveGuard {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'danger' | 'neutral';
}

/** A shown-once API key the user has not copied. Same wording as the reveal's Done button. */
export const UNSAVED_KEY_GUARD: LeaveGuard = {
  title: 'Have you saved this key?',
  message: "It can't be shown again.",
  confirmLabel: "I've saved it",
  cancelLabel: 'Cancel',
  variant: 'neutral',
};

export const UNSAVED_KEY_EDITS_GUARD: LeaveGuard = {
  title: 'Discard unsaved changes?',
  message: "You have unsaved changes to an API key. If you leave now they'll be discarded.",
  confirmLabel: 'Discard changes',
  cancelLabel: 'Keep editing',
  variant: 'danger',
};
