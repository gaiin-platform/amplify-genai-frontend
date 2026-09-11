/**
 * SidebarVisibility — shared type + defaults for the sidebar items visibility setting.
 *
 * localStorage key: amplify_sidebar_items_visible
 * Schema: JSON object with boolean values, all defaulting to true.
 *
 * The spread pattern `{ ...DEFAULT_SIDEBAR_VISIBILITY, ...JSON.parse(stored) }` ensures
 * any newly-added keys default to true even for users who have an older stored value.
 *
 * Note: "Recents" is NOT included here — the Recents conversation list is always shown
 * and cannot be hidden. New Chat and Customize are also always shown.
 *
 * Consumed by:
 *   - SidebarItemsSection.tsx — writes changes + dispatches amplifySidebarVisibilityChanged
 *   - NewSidebar.tsx          — reads state + listens for amplifySidebarVisibilityChanged
 */

export interface SidebarVisibility {
  chats: boolean;       // "Chats" nav item (full chats list view)
  assistants: boolean;  // "Assistants" nav item
  library: boolean;     // "Library" nav item
  workflows: boolean;   // "Workflows" nav item (only relevant when feature flag is on)
  notebook: boolean;    // "Notebook" nav item (only relevant when feature flag is on)
  scheduled: boolean;   // "Scheduled" nav item (only relevant when feature flag is on)
}

export const DEFAULT_SIDEBAR_VISIBILITY: SidebarVisibility = {
  chats: true,
  assistants: true,
  library: true,
  workflows: true,
  notebook: true,
  scheduled: true,
};

export const SIDEBAR_VISIBILITY_KEY = 'amplify_sidebar_items_visible';
