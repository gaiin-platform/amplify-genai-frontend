/**
 * useDriveIntegrations — which drive services exist, which are connected, and how
 * to connect or disconnect one.
 *
 * Now a thin wrapper over `shared/useIntegrationConnections`, which holds the
 * fetches and the OAuth popup flow. The only thing that is drive-specific is the
 * filter: "drive" means whatever `getDriveFileIntegrationTypes` recognises — any
 * integration id containing "drive" or "sharepoint".
 *
 * The public shape is unchanged, so `DriveSourcesPanel` needs no edits.
 */

import { useMemo } from 'react';
import { getDriveFileIntegrationTypes } from '@/utils/app/integrations';
import {
    IntegrationConnection,
    UseIntegrationConnections,
    useIntegrationConnections,
} from '@/components/NewUI/shared/useIntegrationConnections';

/** Kept as an alias so existing imports of this name keep working. */
export type DriveIntegration = IntegrationConnection;
export type UseDriveIntegrations = UseIntegrationConnections;

export const useDriveIntegrations = (): UseDriveIntegrations => {
    // Stable across renders so the hook's fetches are not re-run needlessly.
    const filter = useMemo(() => getDriveFileIntegrationTypes, []);
    return useIntegrationConnections(filter);
};

export default useDriveIntegrations;
