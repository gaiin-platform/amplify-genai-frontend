/**
 * Relative model cost ("Low" / "Moderate" / "High") for the model hover card.
 *
 * Mirrors the classic UI's `components/Chat/ModelSelect#getCostIcon`, which is
 * private and returns JSX, so it cannot be imported. Keep the thresholds in sync.
 *
 * Units: `Model.inputTokenCost` / `outputTokenCost` are USD per 1K tokens (the
 * classic Settings → pricing table multiplies by 1000 to show per-million).
 * So 0.001 = $1 / 1M tokens.
 *
 * The tier is the HIGHER of the input and output tiers, so a model that is cheap
 * to read but expensive to write is not shown as cheap.
 */

export type ModelCostTier = 'low' | 'moderate' | 'high';

interface CostFields {
  inputTokenCost?: unknown;
  outputTokenCost?: unknown;
}

const INPUT_LOW_BELOW = 0.001;
const INPUT_MODERATE_UP_TO = 0.01;
const OUTPUT_LOW_BELOW = 0.005;
const OUTPUT_MODERATE_UP_TO = 0.02;

const RANK: Record<ModelCostTier, number> = { low: 0, moderate: 1, high: 2 };

function tierFor(cost: number, lowBelow: number, moderateUpTo: number): ModelCostTier {
  if (cost < lowBelow) return 'low';
  if (cost <= moderateUpTo) return 'moderate';
  return 'high';
}

/** Payloads can carry costs as strings (§17); anything not a finite number ≥ 0 is "unknown". */
function toCost(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * `null` when the model has no usable price (both costs missing or 0). An admin
 * who has not configured pricing must not see the model advertised as "Low".
 */
export function getModelCostTier(model: CostFields | null | undefined): ModelCostTier | null {
  if (!model) return null;
  const input = toCost(model.inputTokenCost);
  const output = toCost(model.outputTokenCost);
  if (!input && !output) return null;

  const tiers: ModelCostTier[] = [];
  if (input !== null) tiers.push(tierFor(input, INPUT_LOW_BELOW, INPUT_MODERATE_UP_TO));
  if (output !== null) tiers.push(tierFor(output, OUTPUT_LOW_BELOW, OUTPUT_MODERATE_UP_TO));
  return tiers.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
}

export const MODEL_COST_LABEL: Record<ModelCostTier, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
};

/** "$", "$$", "$$$" — shape, not colour, carries the meaning. */
export const MODEL_COST_GLYPHS: Record<ModelCostTier, string> = {
  low: '$',
  moderate: '$$',
  high: '$$$',
};
