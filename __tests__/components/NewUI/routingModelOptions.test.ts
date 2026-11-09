import { describe, expect, it } from 'vitest';
import {
  buildRoutingModelGroups,
  DEFAULT_ROUTING_MODEL_ID,
  isRoutingCapable,
  routingModelSelectValue,
} from '@/components/NewUI/settings/admin/routingModelOptions';

const catalog = {
  [DEFAULT_ROUTING_MODEL_ID]: { id: DEFAULT_ROUTING_MODEL_ID, name: 'Claude Haiku 4.5', provider: 'Bedrock' },
  'gpt-4o-mini': { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'OpenAI' },
  'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  'gemini-2.5-flash': { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Gemini' },
  'amazon.titan-embed-text-v2:0': { id: 'amazon.titan-embed-text-v2:0', name: 'Titan Embeddings', provider: 'Bedrock' },
  'gpt-image-1': { id: 'gpt-image-1', name: 'GPT Image', provider: 'OpenAI', supportsImageGeneration: true },
  mystery: { id: 'mystery', name: 'Mystery', provider: 'Unknown' },
};

describe('isRoutingCapable', () => {
  it('accepts text models on supported providers, case-insensitively', () => {
    expect(isRoutingCapable({ id: 'm', provider: 'OPENAI' })).toBe(true);
    expect(isRoutingCapable({ id: 'm', provider: 'azure' })).toBe(true);
  });
  it('rejects embedding, image-generation, unsupported-provider and malformed entries', () => {
    expect(isRoutingCapable(catalog['amazon.titan-embed-text-v2:0'])).toBe(false);
    expect(isRoutingCapable(catalog['gpt-image-1'])).toBe(false);
    expect(isRoutingCapable(catalog.mystery)).toBe(false);
    expect(isRoutingCapable({ id: 'm' })).toBe(false);
    expect(isRoutingCapable({ provider: 'OpenAI' })).toBe(false);
    expect(isRoutingCapable(null)).toBe(false);
  });
});

describe('buildRoutingModelGroups', () => {
  it('groups usable models by provider, sorted, without the default or unusable models', () => {
    const groups = buildRoutingModelGroups(catalog);
    expect(groups.map((g) => g.provider)).toEqual(['Gemini', 'OpenAI']);
    expect(groups[1].options.map((o) => o.id)).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });
  it('keeps the saved model visible when it is not in the catalog', () => {
    const groups = buildRoutingModelGroups(catalog, 'retired-model');
    const missing = groups.find((g) => g.provider === 'Not in catalog');
    expect(missing?.options[0]).toMatchObject({ id: 'retired-model' });
    expect(missing?.options[0].label).toMatch(/not in catalog/);
  });
  it('flags a saved model that is in the catalog but unusable', () => {
    const groups = buildRoutingModelGroups(catalog, 'gpt-image-1');
    expect(groups.find((g) => g.provider === 'Unsupported')?.options[0].id).toBe('gpt-image-1');
  });
  it('does not call a model missing while the catalog has not loaded', () => {
    const groups = buildRoutingModelGroups({}, 'gpt-4o-mini');
    expect(groups).toEqual([{ provider: 'Current', options: [{ id: 'gpt-4o-mini', label: 'gpt-4o-mini' }] }]);
  });
  it('adds nothing extra for a usable saved model, the default, or no value', () => {
    expect(buildRoutingModelGroups(catalog, 'gpt-4o-mini')).toEqual(buildRoutingModelGroups(catalog));
    expect(buildRoutingModelGroups(catalog, DEFAULT_ROUTING_MODEL_ID)).toEqual(buildRoutingModelGroups(catalog));
    expect(buildRoutingModelGroups(null)).toEqual([]);
  });
});

describe('routingModelSelectValue', () => {
  it('shows the built-in default, an empty value, or whitespace as the Default option', () => {
    expect(routingModelSelectValue(undefined)).toBe('');
    expect(routingModelSelectValue('  ')).toBe('');
    expect(routingModelSelectValue(DEFAULT_ROUTING_MODEL_ID)).toBe('');
  });
  it('passes a chosen model through', () => {
    expect(routingModelSelectValue('gpt-4o-mini')).toBe('gpt-4o-mini');
  });
});
