/**
 * seasonalTheme — decides which seasonal landing-page theme (if any) is active.
 *
 * Each theme is gated by its own admin feature flag (admin → Feature Flags →
 * Add Feature). Only an explicit `true` turns a theme on.
 *
 * If an admin leaves `halloween` on after October and also turns on
 * `thanksgiving`, November shows Thanksgiving; any other month shows Halloween.
 * This keeps the two from ever rendering at once.
 */

export type SeasonalTheme = 'halloween' | 'thanksgiving' | null;

export function activeSeasonalTheme(
  featureFlags?: { [key: string]: boolean } | null,
  now: Date = new Date(),
): SeasonalTheme {
  const halloween = featureFlags?.halloween === true;
  const thanksgiving = featureFlags?.thanksgiving === true;
  if (halloween && thanksgiving) return now.getMonth() === 10 ? 'thanksgiving' : 'halloween';
  if (thanksgiving) return 'thanksgiving';
  if (halloween) return 'halloween';
  return null;
}
