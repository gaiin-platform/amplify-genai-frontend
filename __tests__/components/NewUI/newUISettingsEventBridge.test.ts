import { describe, expect, it } from 'vitest';
import {
  CONNECTORS_SETTINGS_SECTION,
  NEW_UI_SETTINGS_EVENT,
  newUISectionForLegacySettings,
} from '@/components/NewUI/shared/newUISettingsEvents';

describe('New UI settings event bridge', () => {
  it('forwards the workflow generator integrations target to Customize → Connectors', () => {
    expect(newUISectionForLegacySettings({ openToTab: 'Integrations' })).toBe(
      CONNECTORS_SETTINGS_SECTION,
    );
    expect(NEW_UI_SETTINGS_EVENT).toBe('openNewUISettingsSection');
  });

  it('forwards the scheduled action-set integrations target to Customize → Connectors', () => {
    // Both affected flows use the same legacy CompositeActionsPanel event contract.
    expect(newUISectionForLegacySettings({ openToTab: 'Integrations' })).toBe('connectors');
  });

  it('ignores unrelated legacy settings targets', () => {
    expect(newUISectionForLegacySettings({ openToTab: 'General' })).toBeNull();
    expect(newUISectionForLegacySettings(undefined)).toBeNull();
  });
});
