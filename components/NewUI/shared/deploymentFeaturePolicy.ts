export type DeploymentFeatureKey =
  | 'promptHighlighter'
  | 'artifacts'
  | 'webSearch'
  | 'codeInterpreter'
  | 'memory';

export interface DeploymentFeatureFlags {
  [key: string]: any;
  /** Effective generic feature flag returned by /feature_flags. */
  newUi?: boolean;
  deploymentFeatures?: {
    availability?: Partial<Record<DeploymentFeatureKey, boolean>>;
    allowClassicUiSwitch?: boolean;
  };
}

/**
 * The reserved `newUi` flag is OFF by default: only an explicit `newUi: true` enables
 * the New UI, so a deployment (or backend) that does not carry the flag leaves every
 * user on Classic. Pure: it never reads any cache.
 */
export function isNewUiEnabled(
  flags: DeploymentFeatureFlags | undefined | null,
): boolean {
  return flags?.newUi === true;
}

/** Keys the app dispatches on its own into `state.featureFlags` (see useStableFeatureFlags). */
const PATCH_ONLY_KEYS = ['smartMessages'];

/**
 * Rollout verdict from a raw `/feature_flags` payload, or `null` when the payload
 * cannot be trusted as the real flag set (error shape, `{}`, a lone startup patch).
 * A `null` must never replace a cached verdict. A trusted payload without `newUi` is `false`.
 */
export function resolveNewUiRollout(data: unknown): boolean | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const keys = Object.keys(data as Record<string, unknown>);
  if (!keys.some((key) => !PATCH_ONLY_KEYS.includes(key))) return null;
  return isNewUiEnabled(data as DeploymentFeatureFlags);
}

/** Legacy configs default highlighter/memory to off; other availability gates remain on. */
export function isDeploymentFeatureAvailable(
  flags: DeploymentFeatureFlags | undefined | null,
  feature: DeploymentFeatureKey,
): boolean {
  const availability = flags?.deploymentFeatures?.availability;
  if (availability && typeof availability[feature] === 'boolean') return availability[feature] === true;
  return feature !== 'promptHighlighter' && feature !== 'memory';
}

/**
 * An absent/legacy policy allows classic UI; only an explicit false disables it.
 * Deliberately independent of the new-UI rollout: the two policies are cached and
 * read separately (home.tsx reads the classic-switch cache directly), so folding
 * the rollout in here would make a disabled rollout look like "classic forbidden".
 */
export function isClassicUiSwitchAllowed(
  flags: DeploymentFeatureFlags | undefined | null,
): boolean {
  return flags?.deploymentFeatures?.allowClassicUiSwitch !== false;
}

export function getDeploymentFeatureAvailability(
  flags: DeploymentFeatureFlags | undefined | null,
): Record<DeploymentFeatureKey, boolean> {
  return {
    promptHighlighter: isDeploymentFeatureAvailable(flags, 'promptHighlighter'),
    artifacts: isDeploymentFeatureAvailable(flags, 'artifacts'),
    webSearch: isDeploymentFeatureAvailable(flags, 'webSearch'),
    codeInterpreter: isDeploymentFeatureAvailable(flags, 'codeInterpreter'),
    memory: isDeploymentFeatureAvailable(flags, 'memory'),
  };
}

export const CLASSIC_UI_POLICY_CACHE_KEY = 'amplify_classic_ui_switch_allowed';
/** Whose observation the classic-switch cache holds (the value key stays a bare 'false'). */
export const CLASSIC_UI_POLICY_OWNER_KEY = 'amplify_classic_ui_switch_owner';
export const NEW_UI_ROLLOUT_CACHE_KEY = 'amplify_new_ui_rollout_enabled';

/**
 * The classic-switch value key is also read directly by home.tsx (`=== 'false'`), so its
 * format cannot change. Ownership is a sibling key instead. Call this once per load,
 * before anything else reads the cache: a value another account left behind is removed.
 */
export function claimClassicUiSwitchCache(userKey: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    if (!userKey || localStorage.getItem(CLASSIC_UI_POLICY_OWNER_KEY) !== userKey) {
      localStorage.removeItem(CLASSIC_UI_POLICY_CACHE_KEY);
      if (userKey) localStorage.setItem(CLASSIC_UI_POLICY_OWNER_KEY, userKey);
      else localStorage.removeItem(CLASSIC_UI_POLICY_OWNER_KEY);
    }
  } catch {
    // Without storage there is no cache to leak.
  }
}

/** Cache only the restrictive policy so a settings fetch racing hydration cannot undo it. */
export function cacheClassicUiSwitchPolicy(allowed: boolean, userKey?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (allowed) localStorage.removeItem(CLASSIC_UI_POLICY_CACHE_KEY);
    else {
      localStorage.setItem(CLASSIC_UI_POLICY_CACHE_KEY, 'false');
      if (userKey) localStorage.setItem(CLASSIC_UI_POLICY_OWNER_KEY, userKey);
    }
  } catch {
    // The live in-memory policy remains authoritative for this render.
  }
}

export function isCachedClassicUiSwitchDisallowed(userKey?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(CLASSIC_UI_POLICY_CACHE_KEY) !== 'false') return false;
    // `undefined` skips the owner check (callers without an identity, tests).
    return userKey === undefined || localStorage.getItem(CLASSIC_UI_POLICY_OWNER_KEY) === userKey;
  } catch {
    return false;
  }
}

/**
 * Last verdict the server gave THIS user, used only as the offline/timeout fallback.
 * Scoped by user so a different account on the same browser never inherits it, and
 * stores both outcomes so a stale restrictive value cannot outlive a successful read.
 */
export function cacheNewUiRollout(userKey: string | null | undefined, enabled: boolean): void {
  if (typeof window === 'undefined' || !userKey) return;
  try {
    localStorage.setItem(NEW_UI_ROLLOUT_CACHE_KEY, JSON.stringify({ u: userKey, enabled }));
  } catch {
    // The live in-memory policy remains authoritative for this render.
  }
}

/** `true`/`false` for this user's last server verdict; `null` when unknown or another user's. */
export function readCachedNewUiRollout(userKey: string | null | undefined): boolean | null {
  if (typeof window === 'undefined' || !userKey) return null;
  try {
    const raw = localStorage.getItem(NEW_UI_ROLLOUT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.u !== userKey || typeof parsed.enabled !== 'boolean') return null;
    return parsed.enabled;
  } catch {
    return null;
  }
}

export function resolveEffectivePluginIds(pluginIds: readonly string[] = []): string[] {
  return pluginIds.filter((id) => id !== 'code-interpreter' && id !== 'artifacts' && id !== 'memory' && id !== 'web-search');
}
