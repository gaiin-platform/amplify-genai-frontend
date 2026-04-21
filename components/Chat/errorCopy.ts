/**
 * Central dictionary of user-facing error messages.
 *
 * Lesson from the 2025 partial-outage incident (see archive/docs/EMERGENCY_UX_INTERVENTION.md):
 * silent failures erode trust faster than visible errors. Every error users can hit
 * should resolve to one of these entries with a human message and a recovery action.
 */

import { ErrorMessage } from '@/types/error';

/** Primary support contact surfaced in error copy and feedback. */
export const SUPPORT_EMAIL = 'helpdesk@holyfamily.edu';

export type ErrorKey =
  | 'unauthorized'
  | 'forbidden'
  | 'rateLimited'
  | 'serverError'
  | 'serviceUnavailable'
  | 'networkDown'
  | 'modelUnavailable'
  | 'canvasOauthExpired'
  | 'canvasOauthDenied'
  | 'canvasNetwork'
  | 'fileTooLarge'
  | 'attachmentBlocked'
  | 'timeout'
  | 'unknown';

export interface ErrorEntry extends ErrorMessage {
  /** Suggested user-side action. Rendered as a recovery CTA if present. */
  action?: {
    label: string;
    kind: 'retry' | 'reauth' | 'contact' | 'status' | 'reload';
  };
}

export const ERROR_COPY: Record<ErrorKey, ErrorEntry> = {
  unauthorized: {
    title: 'Please sign in again',
    messageLines: [
      "Your session expired.",
      "Signing back in will bring you right back here.",
    ],
    code: '401',
    action: { label: 'Sign in', kind: 'reauth' },
  },
  forbidden: {
    title: "You don't have access to this",
    messageLines: [
      "You're signed in, but this item belongs to someone else or requires extra permissions.",
      `If you think this is a mistake, contact the Help Desk at ${SUPPORT_EMAIL}.`,
    ],
    code: '403',
    action: { label: `Email ${SUPPORT_EMAIL}`, kind: 'contact' },
  },
  rateLimited: {
    title: 'Taking a quick breath',
    messageLines: [
      "You're going faster than our servers can keep up with.",
      "Try again in a few seconds.",
    ],
    code: '429',
    action: { label: 'Try again', kind: 'retry' },
  },
  serverError: {
    title: 'Something went wrong on our end',
    messageLines: [
      "We've logged the error. Please try again.",
      `If it keeps happening, email the Help Desk at ${SUPPORT_EMAIL}.`,
    ],
    code: '500',
    action: { label: 'Try again', kind: 'retry' },
  },
  serviceUnavailable: {
    title: 'Amplify is temporarily offline',
    messageLines: [
      "We're working on a fix. Your conversation history is safe.",
      'Check the status page for updates.',
    ],
    code: '503',
    action: { label: 'Open status page', kind: 'status' },
  },
  networkDown: {
    title: "Can't reach Amplify",
    messageLines: [
      'Looks like your internet connection dropped.',
      'Check your network and try again.',
    ],
    code: 'NETWORK_DOWN',
    action: { label: 'Try again', kind: 'retry' },
  },
  modelUnavailable: {
    title: 'That model is unavailable right now',
    messageLines: [
      "The model you picked isn't responding.",
      'Switch to another model — the rest still work.',
    ],
    code: 'MODEL_UNAVAILABLE',
    action: { label: 'Try again', kind: 'retry' },
  },
  canvasOauthExpired: {
    title: 'Canvas needs to be reconnected',
    messageLines: [
      'Your Canvas link expired.',
      'Reconnect Canvas to see your courses and assignments.',
    ],
    code: 'CANVAS_OAUTH_EXPIRED',
    action: { label: 'Reconnect Canvas', kind: 'reauth' },
  },
  canvasOauthDenied: {
    title: "Canvas didn't grant access",
    messageLines: [
      "Canvas declined the connection request.",
      'Make sure your institution allows third-party apps, then try again.',
    ],
    code: 'CANVAS_OAUTH_DENIED',
    action: { label: 'Try again', kind: 'retry' },
  },
  canvasNetwork: {
    title: "Couldn't reach Canvas",
    messageLines: [
      "Canvas didn't respond in time.",
      'This usually clears up in a minute.',
    ],
    code: 'CANVAS_NETWORK',
    action: { label: 'Try again', kind: 'retry' },
  },
  fileTooLarge: {
    title: 'That file is too large',
    messageLines: [
      'We support attachments up to the per-file limit.',
      'Split the file or compress it, then try again.',
    ],
    code: 'FILE_TOO_LARGE',
  },
  attachmentBlocked: {
    title: 'That file type is blocked',
    messageLines: [
      'For security, some file types are not allowed.',
      'Convert it to a supported format and try again.',
    ],
    code: 'ATTACHMENT_BLOCKED',
  },
  timeout: {
    title: 'The request took too long',
    messageLines: [
      'The model was still thinking when we had to stop waiting.',
      'Try a shorter prompt or a faster model.',
    ],
    code: 'TIMEOUT',
    action: { label: 'Try again', kind: 'retry' },
  },
  unknown: {
    title: 'Something unexpected happened',
    messageLines: [
      "We don't have a specific message for this one.",
      "If it keeps happening, please send feedback so we can fix it.",
    ],
    code: null,
    action: { label: 'Send feedback', kind: 'contact' },
  },
};

/**
 * Map HTTP status codes + known error identifiers to ErrorKey.
 * Used by chatService and error boundaries to resolve a raw error to user copy.
 */
export function resolveErrorKey(input: {
  status?: number;
  code?: string;
  name?: string;
}): ErrorKey {
  const { status, code, name } = input;

  if (code === 'CANVAS_OAUTH_EXPIRED') return 'canvasOauthExpired';
  if (code === 'CANVAS_OAUTH_DENIED') return 'canvasOauthDenied';
  if (code === 'CANVAS_NETWORK') return 'canvasNetwork';
  if (code === 'MODEL_UNAVAILABLE') return 'modelUnavailable';
  if (code === 'FILE_TOO_LARGE') return 'fileTooLarge';
  if (code === 'ATTACHMENT_BLOCKED') return 'attachmentBlocked';

  if (name === 'AbortError' || code === 'TIMEOUT') return 'timeout';
  if (name === 'TypeError' && code === 'FETCH_FAILED') return 'networkDown';

  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 408:
      return 'timeout';
    case 413:
      return 'fileTooLarge';
    case 415:
      return 'attachmentBlocked';
    case 429:
      return 'rateLimited';
    case 503:
      return 'serviceUnavailable';
    case 504:
      return 'timeout';
  }

  if (status && status >= 500) return 'serverError';
  return 'unknown';
}
