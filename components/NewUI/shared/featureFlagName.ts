/**
 * Feature-flag name normalisation for the admin "Add Feature" input.
 *
 * The admin types a human label ("New UI", "API Keys") and the stored key must be the
 * camelCase the code reads (`newUi`, `apiKeys`). The previous inline regex only upper-cased
 * the letter after a space, so "New UI" became `newUI` — a flag nothing reads. Rules:
 *
 *   - words are split on whitespace and joined camelCase
 *   - an ALL-CAPS word is treated as an acronym and lower-cased first ("UI" → "Ui", "API" → "api")
 *   - a single already-camelCase token ("promptOptimizer") is kept as typed
 *   - reserved names are canonicalised, so `newUI`/`NEWUI` can never create a dead flag
 *
 * React-free so it is unit-testable.
 */

/** Flags whose exact spelling is read by code, keyed by their lower-cased, space-free form. */
const RESERVED_FLAG_NAMES: Record<string, string> = {
  newui: 'newUi',
};

export function normalizeFeatureFlagName(input: string): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const reserved = RESERVED_FLAG_NAMES[words.join('').toLowerCase()];
  if (reserved) return reserved;

  const isAcronym = (word: string) => word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase();
  const tidy = (word: string) => (isAcronym(word) ? word.toLowerCase() : word);

  return words
    .map((word, index) => {
      const w = tidy(word);
      return index === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join('');
}
