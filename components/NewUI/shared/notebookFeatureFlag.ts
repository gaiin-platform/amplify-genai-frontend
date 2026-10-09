import { useContext } from 'react';

import HomeContext from '@/pages/api/home/home.context';
import { Features } from '@/types/features';

/**
 * Notebook is a deployment gate, so it must be explicitly enabled by the
 * current feature-flag payload. Missing, false, and malformed values are off.
 */
export function isNotebookFeatureEnabled(flags: Features | null | undefined): boolean {
  return flags?.notebook === true;
}

/**
 * Unlike ordinary New UI flags, Notebook must not be resurrected from the
 * stable localStorage cache while its current deployment flag is unresolved.
 * A missing key therefore stays disabled during startup and patch races.
 */
export function useNotebookFeatureFlag(): boolean {
  const {
    state: { featureFlags },
  } = useContext(HomeContext);
  return isNotebookFeatureEnabled(featureFlags);
}
