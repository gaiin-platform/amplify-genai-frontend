/**
 * uiPreferenceResolver — the New-vs-Classic startup decision as a small state machine.
 *
 * React-free so the timing cases (slow, failed, late, concurrent responses) can be
 * unit-tested. `UIPreferenceBanner` feeds it the two network results and a timeout and
 * applies whatever it reports.
 *
 * Rules:
 *   - The decision is made once BOTH requests settle, or when the timeout fires.
 *   - Rollout verdict precedence: live server payload → this user's cached verdict →
 *     disabled (fail closed). An untrusted payload (see `resolveNewUiRollout`) counts
 *     as a failed request and never overrides the fallback.
 *   - After the first decision the resolver stays live: a late response re-reports if,
 *     and only if, it changes the outcome. A late "disabled" therefore always wins.
 */

import {
  isClassicUiSwitchAllowed,
  resolveNewUiRollout,
  type DeploymentFeatureFlags,
} from '@/components/NewUI/shared/deploymentFeaturePolicy';
import {
  resolveUIPreferenceWithPolicy,
  type UIPreference,
} from '@/components/NewUI/shared/uiPreferenceResolution';

export interface ResolvedUiPolicy {
  rollout: boolean;
  /** Where the rollout verdict came from. Only `'server'` may be written back to the cache. */
  rolloutSource: 'server' | 'cache' | 'failClosed';
  allowClassic: boolean;
  effective: 'new' | 'classic';
}

export interface UiPreferenceResolverOptions {
  local: UIPreference;
  /** This user's last server verdict, or null when unknown. */
  cachedRollout: boolean | null;
  /** Last observed "classic switching forbidden" policy. */
  cachedClassicDisallowed: boolean;
  onResolved: (result: ResolvedUiPolicy) => void;
}

export interface UiPreferenceResolver {
  /** `serverPreference` is `undefined` when the settings request failed. */
  receiveSettings(serverPreference: unknown): void;
  /** `flags` is `null` when the flags request failed. */
  receiveFlags(flags: unknown): void;
  /**
   * A fresh trusted `/feature_flags` payload after startup (tab refocus, admin change).
   * Unlike `receiveFlags`, callers must not report failures here: a transient error must
   * never knock a running session off the verdict it already has.
   */
  revalidate(flags: unknown): void;
  /** Another tab of this same user observed the rollout verdict; adopt it immediately. */
  adoptPeerVerdict(enabled: boolean): void;
  /** Decide now with whatever is known (fires from the startup timeout). */
  timeout(): void;
  isFinalized(): boolean;
}

export function createUiPreferenceResolver(options: UiPreferenceResolverOptions): UiPreferenceResolver {
  const { local, cachedRollout, cachedClassicDisallowed, onResolved } = options;

  let server: unknown = undefined;
  let liveRollout: boolean | null = null;
  let liveAllowClassic: boolean | null = null;
  let settingsDone = false;
  let flagsDone = false;
  let finalized = false;
  let lastKey = '';

  const compute = (): ResolvedUiPolicy => {
    const rollout = liveRollout ?? cachedRollout ?? false;
    const rolloutSource = liveRollout !== null ? 'server' : cachedRollout !== null ? 'cache' : 'failClosed';
    const allowClassic = liveAllowClassic ?? !cachedClassicDisallowed;
    return {
      rollout,
      rolloutSource,
      allowClassic,
      effective: resolveUIPreferenceWithPolicy(local, server, allowClassic, rollout),
    };
  };

  const report = () => {
    const result = compute();
    const key = `${result.rollout}|${result.rolloutSource}|${result.allowClassic}|${result.effective}`;
    if (key === lastKey) return;
    lastKey = key;
    onResolved(result);
  };

  const maybeFinalize = () => {
    if (!finalized && settingsDone && flagsDone) finalized = true;
    if (finalized) report();
  };

  return {
    receiveSettings(serverPreference) {
      server = serverPreference;
      settingsDone = true;
      maybeFinalize();
    },
    receiveFlags(flags) {
      liveRollout = resolveNewUiRollout(flags);
      // Only a trusted payload may speak for the classic-switch policy as well.
      liveAllowClassic = liveRollout === null ? null : isClassicUiSwitchAllowed(flags as DeploymentFeatureFlags);
      flagsDone = true;
      maybeFinalize();
    },
    revalidate(flags) {
      const verdict = resolveNewUiRollout(flags);
      if (verdict === null) return;
      liveRollout = verdict;
      liveAllowClassic = isClassicUiSwitchAllowed(flags as DeploymentFeatureFlags);
      flagsDone = true;
      maybeFinalize();
    },
    adoptPeerVerdict(enabled) {
      liveRollout = enabled;
      flagsDone = true;
      maybeFinalize();
    },
    timeout() {
      finalized = true;
      report();
    },
    isFinalized: () => finalized,
  };
}
