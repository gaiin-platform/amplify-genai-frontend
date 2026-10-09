/**
 * useUiSwitchPolicy — which UI-switch menu items a user may be offered.
 *
 * Both account menus (Classic `UserMenu`, New `AccountMenu`) read this hook so they
 * follow one rule. The rollout must be confirmed enabled by the shared store AND not
 * contradicted by the live flag payload (an admin can turn the flag off mid-session).
 * While the rollout is unresolved or disabled, neither direction is offered.
 */
import { useStableFeatureFlags } from '@/components/NewUI/shared/useStableFeatureFlags';
import { useUiRolloutSnapshot } from '@/components/NewUI/shared/NewUiRolloutGate';
import { isClassicUiSwitchAllowed, isNewUiEnabled } from '@/components/NewUI/shared/deploymentFeaturePolicy';

export interface UiSwitchPolicy {
  canSwitchToNew: boolean;
  canSwitchToClassic: boolean;
}

export function useUiSwitchPolicy(): UiSwitchPolicy {
  const flags = useStableFeatureFlags();
  const snapshot = useUiRolloutSnapshot();

  const rolloutEnabled =
    snapshot.resolved && snapshot.rollout === 'enabled' && isNewUiEnabled(flags as any);

  return {
    canSwitchToNew: rolloutEnabled,
    canSwitchToClassic: rolloutEnabled && snapshot.classicAllowed && isClassicUiSwitchAllowed(flags as any),
  };
}
