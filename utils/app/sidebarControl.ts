// Sidebar control utilities to prevent auto-open on first message

const SIDEBAR_OPENED_KEY = 'sidebar-manually-opened';
const FIRST_MESSAGE_SENT_KEY = 'first-message-sent';

export const setSidebarOpenedManually = () => {
    localStorage.setItem(SIDEBAR_OPENED_KEY, 'true');
};

export const hasSidebarBeenOpenedManually = (): boolean => {
    return localStorage.getItem(SIDEBAR_OPENED_KEY) === 'true';
};

export const setFirstMessageSent = () => {
    sessionStorage.setItem(FIRST_MESSAGE_SENT_KEY, 'true');
};

export const hasFirstMessageBeenSent = (): boolean => {
    return sessionStorage.getItem(FIRST_MESSAGE_SENT_KEY) === 'true';
};

export const shouldAutoOpenSidebar = (): boolean => {
    // Only auto-open if user has manually opened it before AND it's not the first message
    return hasSidebarBeenOpenedManually() && hasFirstMessageBeenSent();
};

export const resetSidebarState = () => {
    sessionStorage.removeItem(FIRST_MESSAGE_SENT_KEY);
};