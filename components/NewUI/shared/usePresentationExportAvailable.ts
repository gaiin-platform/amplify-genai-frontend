import { useContext } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { useStableFeatureFlags } from './useStableFeatureFlags';

/**
 * "Export as PowerPoint" needs the `presentationAgent` feature flag and at least
 * one PowerPoint template the user can access.
 */
export function usePresentationExportAvailable(): boolean {
  const flags = useStableFeatureFlags();
  const {
    state: { powerPointTemplateOptions },
  } = useContext(HomeContext);
  return Boolean(flags.presentationAgent) && (powerPointTemplateOptions?.length ?? 0) > 0;
}
