import { describe, it, expect } from 'vitest';
import {
    conversionDialogCopy,
    copyModalTitle,
    copyName,
    crossesGroupBoundary,
} from '../assistantTypeSwitch';

describe('crossesGroupBoundary', () => {
    it('is false for private <-> shared', () => {
        expect(crossesGroupBoundary(false, 'private')).toBe(false);
        expect(crossesGroupBoundary(false, 'managed')).toBe(false);
    });
    it('is true when a non-group assistant targets group', () => {
        expect(crossesGroupBoundary(false, 'collaborative')).toBe(true);
    });
    it('is true when a group assistant targets private or shared', () => {
        expect(crossesGroupBoundary(true, 'private')).toBe(true);
        expect(crossesGroupBoundary(true, 'managed')).toBe(true);
    });
    it('is false for group -> group', () => {
        expect(crossesGroupBoundary(true, 'collaborative')).toBe(false);
    });
});

describe('copy naming', () => {
    it('suffixes the name with the target kind', () => {
        expect(copyName('Helper', 'collaborative')).toBe('Helper (Group copy)');
        expect(copyName('Helper', 'private')).toBe('Helper (Private copy)');
        expect(copyName('Helper', 'managed')).toBe('Helper (Shared copy)');
        expect(copyName(undefined, 'private')).toBe('Untitled assistant (Private copy)');
        expect(copyName('  ', 'managed')).toBe('Untitled assistant (Shared copy)');
    });
    it('titles the modal by kind', () => {
        expect(copyModalTitle('collaborative')).toBe('Make a Group Copy');
        expect(copyModalTitle('managed')).toBe('Make a Shared Copy');
    });
});

describe('conversionDialogCopy', () => {
    it('names the requested regular kind for a group source', () => {
        const copy = conversionDialogCopy(true, 'managed');
        expect(copy.message).toContain('group assistant');
        expect(copy.message).toContain('create a shared assistant');
    });
    it('offers a group copy for a non-group source', () => {
        expect(conversionDialogCopy(false, 'collaborative').message).toContain('create a group assistant');
    });
});
