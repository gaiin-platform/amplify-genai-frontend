/**
 * webSearchPreference — bridges the New UI's Web Search toggle into the
 * mechanism that Chat.tsx (a DO-NOT-CHANGE file) actually uses to decide
 * whether the WEB_SEARCH plugin is present in its outgoing request.
 *
 * Root cause this works around (see NEW_UI_DOCS.md §13 "RAG / Web Search
 * Wiring Gap"): Chat.tsx maintains its OWN local `plugins` array, populated
 * once per mount from `getActivePlugins()` (utils/app/plugin.ts). For
 * PluginID.WEB_SEARCH specifically, `getActivePlugins` ALWAYS overrides
 * whatever is in localStorage with `settings.featureOptions.includeWebSearch`
 * (a global, per-user, localStorage-persisted setting — see
 * utils/app/settings.ts `featureOptionDefaults`/`settingsDrivenPlugins`).
 * New UI's per-conversation `webSearchEnabled` toggle (persisted to
 * `conversation.data.webSearchEnabled`) is a SEPARATE, per-message gate
 * (`useChatSendService.ts` ANDs it with plugin membership) — it was never
 * enough on its own to get WEB_SEARCH into Chat.tsx's `plugins` array.
 *
 * This helper forces `includeWebSearch: true` into the same
 * `getSettings`/`saveSettings` utilities the app already uses (Section 2.5
 * "services/... use getSettings/saveSettings" — these are sanctioned shared
 * utilities, not a Chat.tsx edit), so that any FUTURE mount of Chat.tsx
 * (new conversation, page reload, conversation switch — all of which
 * remount Chat.tsx via `key={selectedConversation.id}` in home.tsx) picks
 * up WEB_SEARCH in its initial `plugins` array.
 *
 * KNOWN LIMITATION: this does NOT retroactively affect an already-mounted
 * Chat.tsx instance for the conversation currently open when the toggle is
 * first flipped on — Chat.tsx only re-derives `plugins` from settings when
 * its `featureFlags` prop reference changes, not on this localStorage write.
 * The very first message sent immediately after enabling Web Search in an
 * already-open, already-mounted conversation may still be sent without the
 * plugin. Every conversation opened/reloaded/created AFTER the toggle has
 * been flipped once will work correctly. See NEW_UI_PORTING_STATUS.md.
 */
import { getSettings, saveSettings } from '@/utils/app/settings';

export function persistWebSearchPluginPreference(featureFlags: any): void {
  if (typeof window === 'undefined') return;
  // If the admin hasn't enabled the `webSearch` feature flag at all, there is
  // nothing we can force — `includeWebSearch` would just be stripped again by
  // `getSettings`'s allowed-feature-option filtering.
  if (!featureFlags?.webSearch) return;
  try {
    const settings = getSettings(featureFlags);
    if (settings.featureOptions.includeWebSearch !== true) {
      settings.featureOptions.includeWebSearch = true;
      saveSettings(settings);
    }
  } catch {
    // Best-effort — never block the toggle/send flow on a localStorage issue.
  }
}
