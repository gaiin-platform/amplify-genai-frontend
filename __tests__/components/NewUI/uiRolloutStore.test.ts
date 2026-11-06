import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canApplyUiPreference,
  computeEffectiveUi,
  getUiRolloutSnapshot,
  resetUiRollout,
  setUiRollout,
  subscribeUiRollout,
  type UiRolloutSnapshot,
} from '@/components/NewUI/shared/uiRolloutStore';

const snap = (rollout: UiRolloutSnapshot['rollout'], resolved = true, classicAllowed = true): UiRolloutSnapshot =>
  ({ rollout, resolved, classicAllowed });

describe('computeEffectiveUi', () => {
  it('never renders New UI while the rollout is disabled, whatever is stored', () => {
    for (const pref of ['new', 'classic', null] as const) {
      expect(computeEffectiveUi(snap('disabled'), pref)).toBe('classic');
    }
  });

  it('renders nothing for a stored New choice until the rollout is resolved', () => {
    expect(computeEffectiveUi(snap('unknown', false), 'new')).toBe('pending');
    expect(computeEffectiveUi(snap('enabled', false), 'new')).toBe('pending');
  });

  it('keeps Classic/unchosen users on Classic while unresolved', () => {
    expect(computeEffectiveUi(snap('unknown', false), 'classic')).toBe('classic');
    expect(computeEffectiveUi(snap('unknown', false), null)).toBe('classic');
  });

  it('renders New only for an enabled rollout and a New preference', () => {
    expect(computeEffectiveUi(snap('enabled'), 'new')).toBe('new');
    expect(computeEffectiveUi(snap('enabled'), 'classic')).toBe('classic');
    expect(computeEffectiveUi(snap('enabled'), null)).toBe('classic');
  });
});

describe('canApplyUiPreference', () => {
  it('refuses New unless the rollout is resolved and enabled', () => {
    expect(canApplyUiPreference(snap('disabled'), 'new')).toBe(false);
    expect(canApplyUiPreference(snap('unknown', false), 'new')).toBe(false);
    expect(canApplyUiPreference(snap('enabled', false), 'new')).toBe(false);
    expect(canApplyUiPreference(snap('enabled'), 'new')).toBe(true);
  });

  it('refuses Classic only when an enabled rollout forbids it', () => {
    expect(canApplyUiPreference(snap('enabled', true, false), 'classic')).toBe(false);
    expect(canApplyUiPreference(snap('enabled', true, true), 'classic')).toBe(true);
    expect(canApplyUiPreference(snap('disabled', true, false), 'classic')).toBe(true);
  });
});

describe('rollout store', () => {
  afterEach(() => resetUiRollout());

  it('publishes verdicts, notifies subscribers once per change, and resets', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUiRollout(listener);

    setUiRollout('enabled', true);
    setUiRollout('enabled', true); // unchanged → no notification
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getUiRolloutSnapshot()).toEqual({ rollout: 'enabled', classicAllowed: true, resolved: true });

    setUiRollout('disabled', true); // late "disabled" wins immediately
    expect(listener).toHaveBeenCalledTimes(2);
    expect(computeEffectiveUi(getUiRolloutSnapshot(), 'new')).toBe('classic');

    resetUiRollout();
    expect(getUiRolloutSnapshot().resolved).toBe(false);

    unsubscribe();
    setUiRollout('enabled', true);
    expect(listener).toHaveBeenCalledTimes(3); // not called after unsubscribe
  });
});
