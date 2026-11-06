/**
 * NewUiRolloutGate — the one place that decides whether home.tsx renders the New UI.
 *
 * home.tsx wraps its New-vs-Classic ternary in this component and receives the
 * effective layout through a render prop:
 *
 *   'new'     — rollout enabled AND the user is on New
 *   'classic' — rollout disabled, or the user is on Classic / has not chosen
 *   'pending' — the user's stored choice is New but the rollout is not resolved yet;
 *               render nothing so no New UI component mounts (and none of their
 *               startup side effects run) ahead of the answer
 *
 * Because the gate re-renders from the shared store, a late `/feature_flags` response
 * or a stale `uiPreference` written by another code path can never put the New UI on
 * screen while the rollout is disabled.
 */
import React, { useEffect, useSyncExternalStore } from 'react';
import {
  computeEffectiveUi,
  getServerUiRolloutSnapshot,
  getUiRolloutSnapshot,
  subscribeUiRollout,
  type UiRolloutSnapshot,
} from '@/components/NewUI/shared/uiRolloutStore';
import { clearUIRoutingCookie } from '@/components/NewUI/shared/uiPreferenceResolution';

export function useUiRolloutSnapshot(): UiRolloutSnapshot {
  return useSyncExternalStore(subscribeUiRollout, getUiRolloutSnapshot, getServerUiRolloutSnapshot);
}

interface NewUiRolloutGateProps {
  uiPreference: 'new' | 'classic' | null;
  children: (effective: 'new' | 'classic' | 'pending') => React.ReactNode;
}

export const NewUiRolloutGate: React.FC<NewUiRolloutGateProps> = ({ uiPreference, children }) => {
  const snapshot = useUiRolloutSnapshot();
  const effective = computeEffectiveUi(snapshot, uiPreference);
  const disabled = snapshot.resolved && snapshot.rollout === 'disabled';

  // The routing cookie would keep steering the load balancer at the New UI target
  // group; drop it whenever the rollout is off (any code path may have re-set it).
  useEffect(() => {
    if (disabled) clearUIRoutingCookie();
  }, [disabled, uiPreference]);

  return <>{children(effective)}</>;
};

export default NewUiRolloutGate;
