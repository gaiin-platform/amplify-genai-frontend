/**
 * useUiSwitchPolicy — which UI-switch menu items a user may be offered.
 *
 * Both account menus (Classic `UserMenu`, New `AccountMenu`) read this hook so they
 * follow one rule. The rollout must be confirmed enabled by the shared store AND not
 * contradicted by the live flag payload (an admin can turn the flag off mid-session).
 * While the rollout is unresolved or disabled, neither direction is offered.
 */
import { isFullFlagSet, useStableFeatureFlags } from '@/components/NewUI/shared/useStableFeatureFlags';
import { useUiRolloutSnapshot } from '@/components/NewUI/shared/NewUiRolloutGate';
import { isClassicUiSwitchAllowed, isNewUiEnabled } from '@/components/NewUI/shared/deploymentFeaturePolicy';

export interface UiSwitchPolicy {
  canSwitchToNew: boolean;
  canSwitchToClassic: boolean;
}

export function useUiSwitchPolicy(): UiSwitchPolicy {
  const flags = useStableFeatureFlags();
  const snapshot = useUiRolloutSnapshot();

  // The live payload may only *contradict* the verdict when it is a real flag set. While it
  // is unknown (`{}` after a failed fetch) the shared store's verdict — a trusted payload or
  // this user's cached one — stands; reading `{}` as "newUi off" hid the switch item.
  const rolloutEnabled =
    snapshot.resolved &&
    snapshot.rollout === 'enabled' &&
    (!isFullFlagSet(flags) || isNewUiEnabled(flags as any));

  return {
    canSwitchToNew: rolloutEnabled,
    canSwitchToClassic: rolloutEnabled && snapshot.classicAllowed && isClassicUiSwitchAllowed(flags as any),
  };
}
