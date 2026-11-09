/**
 * Options for Admin → Deployment → "Routing model" — the model that decides which optional
 * tools (web search, artifacts, code interpreter) an ordinary chat gets.
 *
 * The choice is stored as a model id in `deploymentFeatures.routingModelId`; an empty value
 * means the backend's built-in default. The backend only accepts text models on providers its
 * classifier can call, so the list is filtered to match — offering a model it would silently
 * ignore would make the setting misreport what is in use.
 *
 * No React imports.
 */

/** The backend's built-in classifier model (`ROUTING_MODEL` in ordinaryChatRouter.js). */
export const DEFAULT_ROUTING_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
export const DEFAULT_ROUTING_MODEL_NAME = 'Claude Haiku 4.5';

/** Providers the backend classifier can call (`ROUTING_MODEL_PROVIDERS`), lower-cased. */
const SUPPORTED_PROVIDERS = new Set(['openai', 'azure', 'gemini', 'bedrock']);

export interface RoutingModelCandidate {
  id?: string;
  name?: string;
  provider?: string;
  supportsImageGeneration?: boolean;
}

export interface RoutingModelOption {
  id: string;
  label: string;
}

export interface RoutingModelGroup {
  provider: string;
  options: RoutingModelOption[];
}

/** Can the backend classify with this catalog entry? Mirrors `isUsableRoutingModel`. */
export function isRoutingCapable(model: RoutingModelCandidate | null | undefined): boolean {
  if (!model || typeof model.id !== 'string' || !model.id) return false;
  if (typeof model.provider !== 'string' || !SUPPORTED_PROVIDERS.has(model.provider.toLowerCase())) return false;
  if (model.supportsImageGeneration === true) return false;
  return !/embed/i.test(model.id);
}

/**
 * Group the catalog's routing-capable models by provider, sorted by name. The built-in default
 * is left out (it is the "Default" choice). `currentId` always survives: a saved model that has
 * since left the catalog — or become unusable — is listed as such rather than silently shown
 * as "Default", which is what the backend will actually fall back to.
 */
export function buildRoutingModelGroups(
  models: Record<string, RoutingModelCandidate> | null | undefined,
  currentId?: string,
): RoutingModelGroup[] {
  const byProvider = new Map<string, RoutingModelOption[]>();
  const add = (provider: string, option: RoutingModelOption) => {
    const list = byProvider.get(provider) ?? [];
    list.push(option);
    byProvider.set(provider, list);
  };

  const entries = Object.entries(models ?? {});
  for (const [key, model] of entries) {
    const id = typeof model?.id === 'string' && model.id ? model.id : key;
    if (id === DEFAULT_ROUTING_MODEL_ID || !isRoutingCapable({ ...model, id })) continue;
    add(model.provider as string, { id, label: model.name || id });
  }

  const current = (currentId ?? '').trim();
  if (current && current !== DEFAULT_ROUTING_MODEL_ID && !entries.some(([, m]) => m?.id === current)) {
    // An empty catalog usually means it hasn't loaded yet — don't claim the model is missing.
    if (entries.length === 0) add('Current', { id: current, label: current });
    else add('Not in catalog', { id: current, label: `${current} (not in catalog — default is used)` });
  } else if (current && current !== DEFAULT_ROUTING_MODEL_ID) {
    const known = entries.find(([, m]) => m?.id === current)?.[1];
    if (known && !isRoutingCapable(known)) {
      add('Unsupported', { id: current, label: `${known.name || current} (unsupported — default is used)` });
    }
  }

  const groups: RoutingModelGroup[] = [];
  byProvider.forEach((options, provider) => {
    groups.push({ provider, options: options.sort((a, b) => a.label.localeCompare(b.label)) });
  });
  return groups.sort((a, b) => a.provider.localeCompare(b.provider));
}

/** The select's value: the built-in default is stored as an empty string. */
export function routingModelSelectValue(routingModelId: string | undefined): string {
  const id = (routingModelId ?? '').trim();
  return id === DEFAULT_ROUTING_MODEL_ID ? '' : id;
}
