export type DeploymentFeatureKey =
  | 'promptHighlighter'
  | 'artifacts'
  | 'webSearch'
  | 'codeInterpreter'
  | 'memory';

export interface DeploymentFeatureFlags {
  [key: string]: any;
  deploymentFeatures?: {
    availability?: Partial<Record<DeploymentFeatureKey, boolean>>;
    allowClassicUiSwitch?: boolean;
  };
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

/** An absent/legacy policy allows classic UI; only an explicit false disables it. */
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

/** Cache only the restrictive policy so a settings fetch racing hydration cannot undo it. */
export function cacheClassicUiSwitchPolicy(allowed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (allowed) localStorage.removeItem(CLASSIC_UI_POLICY_CACHE_KEY);
    else localStorage.setItem(CLASSIC_UI_POLICY_CACHE_KEY, 'false');
  } catch {
    // The live in-memory policy remains authoritative for this render.
  }
}

export function isCachedClassicUiSwitchDisallowed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(CLASSIC_UI_POLICY_CACHE_KEY) === 'false';
  } catch {
    return false;
  }
}

export function resolveEffectivePluginIds(pluginIds: readonly string[] = []): string[] {
  return pluginIds.filter((id) => id !== 'code-interpreter' && id !== 'artifacts' && id !== 'memory' && id !== 'web-search');
}
