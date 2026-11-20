import { describe, expect, it } from 'vitest';
import { activeSeasonalTheme } from '@/components/NewUI/home/seasonalTheme';

const oct = new Date(2026, 9, 20);
const nov = new Date(2026, 10, 19);
const dec = new Date(2026, 11, 5);

describe('activeSeasonalTheme', () => {
  it('is off when no flags are set', () => {
    expect(activeSeasonalTheme(undefined, nov)).toBeNull();
    expect(activeSeasonalTheme(null, nov)).toBeNull();
    expect(activeSeasonalTheme({}, nov)).toBeNull();
  });

  it('only turns on for an explicit true', () => {
    expect(activeSeasonalTheme({ thanksgiving: false, halloween: false }, nov)).toBeNull();
    expect(activeSeasonalTheme({ thanksgiving: true }, oct)).toBe('thanksgiving');
    expect(activeSeasonalTheme({ halloween: true }, nov)).toBe('halloween');
  });

  it('never shows both: November prefers Thanksgiving, other months prefer Halloween', () => {
    const both = { halloween: true, thanksgiving: true };
    expect(activeSeasonalTheme(both, nov)).toBe('thanksgiving');
    expect(activeSeasonalTheme(both, oct)).toBe('halloween');
    expect(activeSeasonalTheme(both, dec)).toBe('halloween');
  });
});
