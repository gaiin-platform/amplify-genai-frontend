import { describe, it, expect } from 'vitest';
import { resolveRagConfiguration } from '@/utils/fileHandler';

describe('resolveRagConfiguration', () => {
    it('never RAGs chat uploads (disableRag omitted), even with ragEnabled on', () => {
        expect(resolveRagConfiguration({ ragEnabled: true })).toBe(false);
        expect(resolveRagConfiguration({ ragEnabled: true }, undefined)).toBe(false);
    });

    it('does not RAG when disableRag is true', () => {
        expect(resolveRagConfiguration({ ragEnabled: true }, true)).toBe(false);
    });

    it('RAGs assistant knowledge-base uploads (disableRag === false) when ragEnabled is on', () => {
        expect(resolveRagConfiguration({ ragEnabled: true }, false)).toBe(true);
    });

    it('never RAGs when the ragEnabled feature flag is off, even if the caller opts in', () => {
        expect(resolveRagConfiguration({ ragEnabled: false }, false)).toBe(false);
        expect(resolveRagConfiguration({}, false)).toBe(false);
        expect(resolveRagConfiguration(undefined, false)).toBe(false);
    });
});
