/**
 * UserPrefsSync — mounts once inside the new-UI layout, renders nothing.
 *
 * Applies the user's server-synced display prefs (chat font, conversation
 * storage, default model, default reasoning effort) to this device, seeds the
 * system defaults for brand-new users, and backfills prefs that were chosen
 * before they roamed.
 *
 * Model/effort need no notification step: ModelPicker, NewHome and
 * ConversationComposer all read their localStorage keys lazily, so writing the
 * key before they next mount is sufficient. The mount pass below runs within
 * milliseconds of the new-UI shell appearing, well before Settings can be opened.
 *
 * ── Why this is not a one-shot "if unset, write the default" ────────────────
 *
 * `updateFeatureSettings` is a shared event with ~7 dispatchers. home.tsx fires
 * it on every `featureFlags` change, which happens well BEFORE fetchSettings
 * resolves — and for a brand-new user fetchSettings never fires it at all (the
 * backend returns `data: None` and home.tsx only dispatches inside
 * `if (result.data)`). So no single firing can be treated as "the server has
 * spoken", and a `if (a value exists) return;` guard would let an early firing
 * write the hardcoded default and then permanently block the user's real
 * server-side choice — defeating the roaming requirement.
 *
 * Instead the sync is idempotent and difference-based: whenever the
 * server-synced blob disagrees with this device's key, the server wins. That is
 * safe because every local write also mirrors into the blob
 * (saveDisplayPrefsToServer), so a fresh local choice never looks like a
 * disagreement and never gets reverted.
 *
 * Precedence:  server-synced user choice  >  admin default  >  system default
 *
 * We deliberately do NOT call `handleStorageSelection` (the bulk migrator):
 * 'future-cloud' is a going-forward option, so seeding it must not move any
 * existing conversation.
 */

import { FC, useContext, useEffect, useRef } from 'react';
import HomeContext from '@/pages/api/home/home.context';
import { saveStorageSettings } from '@/utils/app/conversationStorage';
import {
    DEFAULT_STORAGE_SELECTION,
    STORAGE_SELECTION_LS_KEY,
    applyServerPrefsToLocalStorage,
    backfillLocalDefaultsToServer,
} from './userDisplayPrefs';
import type { ConversationStorage } from '@/types/conversationStorage';

/**
 * Module-scoped, not a ref: this must run once per page load, and StrictMode
 * mounts → unmounts → remounts every component, which would otherwise pay for
 * a second backfill fetch.
 */
let backfillAttempted = false;

/**
 * Grace period before seeding the hardcoded default, so the concurrent
 * fetchSettings (the user's server value) and fetchUserAppConfigs (the
 * admin-configured default) get first claim. Both write storageSelection
 * through paths this component cannot hook, and home.tsx's admin branch is
 * gated on `!storageSelection`, so winning the race would suppress the admin
 * default for the whole session.
 */
const DEFAULT_SEED_DELAY_MS = 2500;

export const UserPrefsSync: FC = () => {
    const { dispatch: homeDispatch } = useContext(HomeContext);

    // §16: re-arm in the effect body — StrictMode's simulated unmount would
    // otherwise latch this false for the life of the component.
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    useEffect(() => {
        let graceElapsed = false;

        const applyStorage = (value: ConversationStorage) => {
            saveStorageSettings(value);
            homeDispatch({ field: 'storageSelection', value });
        };

        /**
         * Push any server-synced value onto this device. Safe to call at any
         * time, including before the server has answered (it no-ops then).
         */
        const syncServerValue = () => {
            // Also promotes a server-synced chatFont to its dedicated key and
            // notifies ConversationViewShell if it actually changed.
            const { storageSelection: serverStorage } = applyServerPrefsToLocalStorage();
            if (!serverStorage) return;
            if (localStorage.getItem(STORAGE_SELECTION_LS_KEY) === serverStorage) return;
            applyStorage(serverStorage as ConversationStorage);
        };

        /** Seed the hardcoded default only when nothing has claimed the key. */
        const seedDefaultIfNeeded = () => {
            if (localStorage.getItem(STORAGE_SELECTION_LS_KEY)) return;
            applyStorage(DEFAULT_STORAGE_SELECTION);
        };

        const handleEvent = () => {
            syncServerValue();
            // Never seed before the grace window: an early firing would beat
            // the admin default to the key and silently suppress it.
            if (graceElapsed) seedDefaultIfNeeded();
        };

        // Mount pass: the authoritative fetchSettings firing may already have
        // happened before this component rendered — uiPreference starts null, so
        // the new-UI branch only mounts once the server answers (§22).
        syncServerValue();

        const seedTimer = window.setTimeout(() => {
            if (!alive.current) return;
            graceElapsed = true;
            syncServerValue();
            seedDefaultIfNeeded();

            // Once the server has had time to answer, publish any pref this user
            // set before it roamed. Decides from its own fresh fetch and skips
            // every key the server already holds, so it cannot clobber a newer
            // choice made on another device.
            if (!backfillAttempted) {
                backfillAttempted = true;
                void backfillLocalDefaultsToServer();
            }
        }, DEFAULT_SEED_DELAY_MS);

        window.addEventListener('updateFeatureSettings', handleEvent);
        return () => {
            window.clearTimeout(seedTimer);
            window.removeEventListener('updateFeatureSettings', handleEvent);
        };
    }, [homeDispatch]);

    return null;
};

export default UserPrefsSync;
