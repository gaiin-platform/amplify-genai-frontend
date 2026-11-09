import { useCallback, useEffect, useState } from 'react';
import type { AstWorkflow } from '@/types/assistantWorkflows';
import { listAstWorkflowTemplates } from '@/services/assistantWorkflowService';

/**
 * The user's workflow templates for the chat attach menu. Fetched once and shared by every menu on the
 * page (home + docked composer); re-fetched only when older than the TTL, so opening the menu is cheap.
 * Same query the classic ChatWorkflowViewer uses: the user's own configured templates, no public ones.
 */
const TTL_MS = 2 * 60 * 1000;
let cached: { at: number; templates: AstWorkflow[] } | null = null;
let inflight: Promise<AstWorkflow[]> | null = null;

const load = (): Promise<AstWorkflow[]> => {
  if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.templates);
  if (!inflight) {
    inflight = listAstWorkflowTemplates(true, false)
      .then((response) => {
        const templates: AstWorkflow[] = response?.success && Array.isArray(response.data?.templates)
          ? [...response.data.templates].sort((a: AstWorkflow, b: AstWorkflow) => a.name.localeCompare(b.name))
          : [];
        cached = { at: Date.now(), templates };
        return templates;
      })
      .catch(() => cached?.templates ?? [])
      .finally(() => { inflight = null; });
  }
  return inflight;
};

/** `null` until the first load finishes (or while disabled). */
export const useChatWorkflowTemplates = (enabled: boolean) => {
  const [templates, setTemplates] = useState<AstWorkflow[] | null>(cached?.templates ?? null);

  const refresh = useCallback(() => {
    if (!enabled) return;
    void load().then(setTemplates);
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  return { templates, refresh };
};
