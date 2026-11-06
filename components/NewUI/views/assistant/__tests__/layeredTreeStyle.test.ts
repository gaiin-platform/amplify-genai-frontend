import { describe, it, expect } from 'vitest';
import { DEPTH_COLORS, depthColor, tint } from '../layeredTreeStyle';

describe('depthColor', () => {
    it('gives each of the first levels its own colour', () => {
        expect(new Set(DEPTH_COLORS).size).toBe(DEPTH_COLORS.length);
        expect(depthColor(0)).toBe(DEPTH_COLORS[0]);
        expect(depthColor(3)).toBe(DEPTH_COLORS[3]);
    });
    it('cycles past the last level and tolerates a negative depth', () => {
        expect(depthColor(DEPTH_COLORS.length)).toBe(DEPTH_COLORS[0]);
        expect(depthColor(-1)).toBe(DEPTH_COLORS[DEPTH_COLORS.length - 1]);
    });
});

describe('tint', () => {
    it('mixes the colour over transparent so it works on light and dark surfaces', () => {
        expect(tint('#7c3aed', 16)).toBe('color-mix(in srgb, #7c3aed 16%, transparent)');
    });
});
