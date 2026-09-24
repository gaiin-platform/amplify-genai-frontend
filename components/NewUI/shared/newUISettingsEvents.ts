import { useEffect } from 'react';

export const LEGACY_SETTINGS_EVENT = 'openSettingsTrigger';
export const NEW_UI_SETTINGS_EVENT = 'openNewUISettingsSection';
export const CONNECTORS_SETTINGS_SECTION = 'connectors';

export interface LegacySettingsEventDetail {
  openToTab?: string;
}

/**
 * Translate the integrations target used by classic components into the
 * section vocabulary consumed by the New UI settings shell.
 */
export function newUISectionForLegacySettings(
  detail: LegacySettingsEventDetail | null | undefined,
): string | null {
  return detail?.openToTab === 'Integrations' ? CONNECTORS_SETTINGS_SECTION : null;
}

/** Forward only the legacy integrations deep-link into the New UI event bus. */
export function forwardLegacySettingsEvent(event: Event): void {
  if (typeof window === 'undefined') return;

  const detail = (event as CustomEvent<LegacySettingsEventDetail>).detail;
  const section = newUISectionForLegacySettings(detail);
  if (!section) return;

  window.dispatchEvent(new CustomEvent(NEW_UI_SETTINGS_EVENT, { detail: { section } }));
}

/**
 * Keep the bridge local to views that still host a legacy child component.
 * Named handler + cleanup is important because New UI runs in StrictMode.
 */
export function useLegacySettingsEventBridge(): void {
  useEffect(() => {
    const handler = (event: Event) => forwardLegacySettingsEvent(event);
    window.addEventListener(LEGACY_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(LEGACY_SETTINGS_EVENT, handler);
  }, []);
}
