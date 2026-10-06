export type SharedAssistantAccess = 'Private' | 'Shared' | 'Group';

export interface SharedAssistantProvenance {
  sharedBy: string;
  sharedAt?: number;
  note?: string;
  sourceAssistantId?: string;
  sourcePromptId?: string;
  /** Non-secret stable metadata identity; never use the bearer share key here. */
  shareIdentity?: string;
}

/** A stable identity for one received share, derived only from non-secret metadata. */
export const getSharedShareIdentity = (share: {
  sharedBy: string;
  sharedAt?: number;
  note?: string;
}): string => `share:${JSON.stringify([share.sharedBy, share.sharedAt ?? null, share.note ?? ''])}`;

/** Stable identities that can be matched against both imported prompts and pending shares. */
export const getSharedAssistantIdentity = (prompt: {
  data?: Record<string, any>;
}): string[] => {
  const provenance = prompt.data?.sharedAssistant as SharedAssistantProvenance | undefined;
  if (!provenance?.sharedBy) return [];

  return Array.from(new Set([
    getSharedShareIdentity(provenance),
    ...(provenance.shareIdentity ? [provenance.shareIdentity] : []),
    ...(provenance.sourceAssistantId ? [`assistant:${provenance.sourceAssistantId}`] : []),
    ...(provenance.sourcePromptId ? [`prompt:${provenance.sourcePromptId}`] : []),
  ]));
};

export const isReceivedSharedAssistant = (prompt: {
  data?: Record<string, any>;
}): boolean => prompt.data?.noEdit === true && getSharedAssistantIdentity(prompt).length > 0;

/** Load the roaming hide list from the settings blob, safely for SSR/corrupt storage. */
export const readDismissedSharedAssistantIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    const dismissed = settings?.dismissedSharedAssistantIds;
    return Array.isArray(dismissed) ? dismissed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

/** Keep the hover-card label consistent with the assistant gallery semantics. */
export const resolveSharedAssistantAccess = (input: {
  astPath?: string;
  groupId?: string;
  sharedAssistant?: { sharedBy?: string } | null;
}): SharedAssistantAccess => {
  if (input.groupId) return 'Group';
  if (input.sharedAssistant?.sharedBy || input.astPath) return 'Shared';
  return 'Private';
};
