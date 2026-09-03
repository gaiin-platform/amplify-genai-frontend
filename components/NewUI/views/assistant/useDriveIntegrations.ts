/**
 * useDriveIntegrations — which drive services exist, which are connected, and
 * how to connect or disconnect one.
 *
 * PORT: the two fetches and the OAuth dance come from
 *   components/Integrations/IntegrationsTab.tsx        (loading + error sniffing)
 *   components/NewUI/settings/NewConnectorsSection.tsx (connect popup, token share)
 * Neither is modified. The old drive panel got this data by rendering
 * `IntegrationTabs` purely for its side effects; a hook says the same thing
 * without a tab bar attached to it.
 *
 * "Drive" here means whatever `getDriveFileIntegrationTypes` recognises — any
 * integration id containing "drive" or "sharepoint".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
    deleteUserIntegration,
    getAvailableIntegrations,
    getConnectedIntegrations,
    getOauthRedirect,
} from '@/services/oauthIntegrationsService';
import { IntegrationsMap } from '@/types/integrations';
import { getDriveFileIntegrationTypes } from '@/utils/app/integrations';
import { capitalize } from '@/utils/app/data';

/**
 * An unconfigured backend answers these requests with a message rather than a
 * failure worth shouting about. Alerting on it turns "your admin hasn't set up
 * integrations" into a modal error the user can do nothing with.
 */
const isConfigurationMessage = (message?: string): boolean => {
    const text = message ?? '';
    return (
        text.includes('Admin Table') ||
        text.includes('not configured') ||
        text.includes('No integrations')
    );
};

export interface DriveIntegration {
    /** Integration id, e.g. `microsoft_sharepoint`. */
    id: string;
    /** Provider key, e.g. `microsoft`. */
    provider: string;
    /** OAuth settings the provider needs at connect time. */
    providerSettings: Record<string, unknown>;
}

export interface UseDriveIntegrations {
    /** Every drive integration this deployment supports. */
    supported: DriveIntegration[];
    /** Ids of the ones this user has authorised. */
    connected: string[];
    /** True until the first load settles. */
    loading: boolean;
    /** Ids with a connect/disconnect request in flight. */
    busy: Record<string, boolean>;
    connect: (id: string) => Promise<void>;
    disconnect: (id: string) => Promise<void>;
    refresh: () => Promise<void>;
}

export const useDriveIntegrations = (): UseDriveIntegrations => {
    const [supported, setSupported] = useState<DriveIntegration[]>([]);
    const [connected, setConnected] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<Record<string, boolean>>({});

    // The panel unmounts whenever the user collapses the data-source method, so
    // a late response must not write into a dead component.
    //
    // The setup body has to re-arm the flag, not just the initial `useRef(true)`:
    // StrictMode mounts → unmounts → remounts, so the cleanup runs once on the
    // simulated unmount. Without re-arming, `alive` latches false for the life of
    // the component and every setter below is skipped — including
    // `setLoading(false)`, which leaves the panel on its skeleton rows forever.
    //
    // Keep this effect declared before the load effect: setups run in
    // declaration order, so the flag must be re-armed before `refresh` reads it.
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    const loadSupported = useCallback(async () => {
        const response = await getAvailableIntegrations();
        if (!response?.success) {
            if (!alive.current) return;
            setSupported([]);
            if (response && !isConfigurationMessage(response.message)) {
                toast.error('Unable to load available integrations right now.');
            }
            return;
        }

        // Two response shapes in the wild: the map on its own, or the map plus
        // provider_settings. Both are handled the same way upstream.
        const payload = response.data;
        let map: IntegrationsMap = {};
        let providerSettings: Record<string, Record<string, unknown>> = {};
        if (payload && typeof payload === 'object') {
            if ('integrations' in payload && 'provider_settings' in payload) {
                map = payload.integrations ?? {};
                providerSettings = payload.provider_settings ?? {};
            } else {
                map = payload as IntegrationsMap;
            }
        }

        const drives: DriveIntegration[] = Object.entries(map).flatMap(([provider, list]) => {
            const driveIds = getDriveFileIntegrationTypes((list ?? []).map((entry) => entry.id));
            return driveIds.map((id) => ({
                id,
                provider,
                // getOauthRedirect wants the settings under the capitalised
                // provider key, which is how the backend indexes them.
                providerSettings: providerSettings[capitalize(provider)] ?? {},
            }));
        });
        drives.sort((a, b) => a.id.localeCompare(b.id));

        if (alive.current) setSupported(drives);
    }, []);

    const loadConnected = useCallback(async () => {
        const response = await getConnectedIntegrations();
        if (!alive.current) return;
        if (response?.success) {
            setConnected(getDriveFileIntegrationTypes(response.data || []));
            return;
        }
        setConnected([]);
        if (response && !isConfigurationMessage(response.message)) {
            toast.error('Unable to check which integrations are connected.');
        }
    }, []);

    const refresh = useCallback(async () => {
        if (alive.current) setLoading(true);
        try {
            await Promise.all([loadSupported(), loadConnected()]);
        } catch (error) {
            console.error('Error loading drive integrations:', error);
        } finally {
            if (alive.current) setLoading(false);
        }
    }, [loadSupported, loadConnected]);

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const markBusy = (id: string, value: boolean) =>
        setBusy((prev) => ({ ...prev, [id]: value }));

    const connect = useCallback(async (id: string) => {
        const settings = supported.find((entry) => entry.id === id)?.providerSettings ?? {};
        markBusy(id, true);

        let location: string | null = null;
        try {
            const response = await getOauthRedirect(id, settings);

            // The backend can hand back an already-valid token for a sibling
            // integration of the same provider — nothing to authorise.
            if (response?.body?.token_shared) {
                await refresh();
                if (alive.current) markBusy(id, false);
                toast.success('Connected', { duration: 4000, position: 'top-center' });
                return;
            }

            if (response?.body?.error) {
                toast.error(response.body.message || 'Could not start authorization.');
                if (alive.current) markBusy(id, false);
                return;
            }

            location = response?.body?.Location ?? null;
        } catch (error) {
            console.error('Error starting integration auth:', error);
            toast.error('Could not start authorization. Please try again.');
            if (alive.current) markBusy(id, false);
            return;
        }

        if (!location || !/^https:\/\//.test(location)) {
            toast.error('Could not start authorization. Please try again.');
            if (alive.current) markBusy(id, false);
            return;
        }

        const width = 600;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        const authWindow = window.open(
            location,
            'Auth Window',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`,
        );

        if (!authWindow) {
            toast.error('Allow pop-ups for this site to connect an integration.');
            if (alive.current) markBusy(id, false);
            return;
        }

        // There is no callback into this window, so closing the popup is the
        // only signal that the flow finished one way or the other.
        const poll = setInterval(() => {
            if (!authWindow.closed) return;
            clearInterval(poll);
            refresh().finally(() => { if (alive.current) markBusy(id, false); });
        }, 500);
        authWindow.focus();
    }, [supported, refresh]);

    const disconnect = useCallback(async (id: string) => {
        markBusy(id, true);
        try {
            // deleteUserIntegration already alerts on failure — a second message
            // here would double up, so only the success path is handled.
            const ok = await deleteUserIntegration(id);
            if (ok && alive.current) setConnected((prev) => prev.filter((entry) => entry !== id));
        } finally {
            if (alive.current) markBusy(id, false);
        }
    }, []);

    return { supported, connected, loading, busy, connect, disconnect, refresh };
};

export default useDriveIntegrations;
