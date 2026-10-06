/**
 * Remembers which project workspace is open so navigating to a project chat and
 * back (or reloading the tab) returns to the project instead of the gallery.
 * sessionStorage is per-tab, which matches how the rest of the app treats
 * "current view" state. Storage can throw (private mode, blocked), so every
 * access is wrapped and the UI works without it.
 */
const KEY = 'amplify_selected_project';

export const getSelectedProjectId = (): string | null => {
    try {
        return typeof window === 'undefined' ? null : window.sessionStorage.getItem(KEY);
    } catch {
        return null;
    }
};

export const setSelectedProjectId = (id: string | null): void => {
    try {
        if (typeof window === 'undefined') return;
        if (id) window.sessionStorage.setItem(KEY, id);
        else window.sessionStorage.removeItem(KEY);
    } catch {
        /* storage unavailable — navigation simply isn't remembered */
    }
};
