import { describe, expect, it } from 'vitest';
import {
    GROUP_PUBLIC_ACCESS,
    deriveAccessKind,
    isPublishedLink,
    isRestrictedLink,
    planAssistantPath,
} from '../assistantLinkModel';

const GEN = 'a-' + 'f'.repeat(32);
const restricted = (users: string[] = []) => ({ isPublic: false, accessTo: { amplifyGroups: [], users } });
const pub = (users: string[] = []) => ({ isPublic: true, accessTo: { amplifyGroups: [], users } });

describe('deriveAccessKind / isPublishedLink', () => {
    it('reads group, marked-private and path-bearing assistants', () => {
        expect(deriveAccessKind({ groupId: 'g', astPath: 'x' })).toBe('collaborative');
        expect(deriveAccessKind({ astPath: 'x', accessKind: 'private' })).toBe('private');
        expect(deriveAccessKind({ astPath: 'x' })).toBe('managed');
        expect(deriveAccessKind({})).toBe('private');
    });

    it('does not count an internal key as a published link, but does count a restricted named one', () => {
        expect(isPublishedLink('managed', GEN)).toBe(false);
        expect(isPublishedLink('managed', 'my-bot')).toBe(true);
        expect(isPublishedLink('private', 'my-bot')).toBe(true);
        expect(isPublishedLink('collaborative', 'askjerry')).toBe(true);
        expect(isPublishedLink('private', undefined)).toBe(false);
    });

    it('reads a restricted link, never for a group', () => {
        expect(isRestrictedLink('managed', restricted())).toBe(true);
        expect(isRestrictedLink('private', pub())).toBe(false);
        expect(isRestrictedLink('collaborative', restricted())).toBe(false);
        expect(isRestrictedLink('managed', undefined)).toBe(false);
    });
});

describe('planAssistantPath — just for me', () => {
    it('has no path when not published; taking a link down omits it', () => {
        expect(planAssistantPath({ kind: 'private', publish: false, slug: 'bot', existingPath: 'bot', existingAstPathData: pub() }))
            .toEqual({ data: {}, register: null, hasPath: false });
    });

    it('publishes for anyone with the link', () => {
        const plan = planAssistantPath({ kind: 'private', publish: true, slug: 'My-Bot' });
        expect(plan.register).toEqual({ path: 'my-bot', astPathData: pub() });
        expect(plan.data).toEqual({ astPathData: pub() });
        expect(plan.hasPath).toBe(true);
    });
});

describe('planAssistantPath — restricted links', () => {
    it('just for me: a named link only the owner can open', () => {
        const plan = planAssistantPath({ kind: 'private', publish: true, linkRestricted: true, slug: 'my-bot' });
        expect(plan.register).toEqual({ path: 'my-bot', astPathData: restricted() });
    });

    it('i manage it: a named link only the shared people can open', () => {
        const plan = planAssistantPath({ kind: 'managed', publish: true, linkRestricted: true, slug: 'my-bot', emails: ['a@x.edu'] });
        expect(plan.register).toEqual({ path: 'my-bot', astPathData: restricted(['a@x.edu']) });
    });

    it('narrowing an open link re-registers it and fails closed: the save releases the open link first', () => {
        const plan = planAssistantPath({ kind: 'managed', publish: true, linkRestricted: true, slug: 'my-bot', emails: ['a@x.edu'], existingPath: 'my-bot', existingAstPathData: pub(['a@x.edu']) });
        expect(plan.register).toEqual({ path: 'my-bot', astPathData: restricted(['a@x.edu']) });
        expect(plan.data.astPath).toBeUndefined();
    });

    it('opening a restricted link up keeps the old path in the save (a failure leaves it restricted)', () => {
        const plan = planAssistantPath({ kind: 'managed', publish: true, slug: 'my-bot', emails: ['a@x.edu'], existingPath: 'my-bot', existingAstPathData: restricted(['a@x.edu']) });
        expect(plan.register).toEqual({ path: 'my-bot', astPathData: pub(['a@x.edu']) });
        expect(plan.data.astPath).toBe('my-bot');
    });

    it('moving between open links keeps the old one in the save', () => {
        const plan = planAssistantPath({ kind: 'private', publish: true, slug: 'new-name', existingPath: 'old-name', existingAstPathData: pub() });
        expect(plan.data.astPath).toBe('old-name');
    });

    it('moving an open link to a restricted one fails closed too', () => {
        const plan = planAssistantPath({ kind: 'private', publish: true, linkRestricted: true, slug: 'new-name', existingPath: 'old-name', existingAstPathData: pub() });
        expect(plan.data.astPath).toBeUndefined();
        expect(plan.register).toEqual({ path: 'new-name', astPathData: restricted() });
    });

    it('treats an open link stored without access data as open when narrowing it', () => {
        const plan = planAssistantPath({ kind: 'managed', publish: false, slug: '', emails: ['a@x.edu'], generatedPath: GEN, existingPath: 'bot' });
        expect(plan.data.astPath).toBeUndefined();
    });

    it('a group link ignores the restriction (membership decides)', () => {
        const plan = planAssistantPath({ kind: 'collaborative', publish: true, linkRestricted: true, slug: 'team-bot' });
        expect(plan.register?.astPathData).toEqual(GROUP_PUBLIC_ACCESS);
    });
});

describe('planAssistantPath — I manage it', () => {
    it('unpublished: a generated restricted key carries the shared people', () => {
        const plan = planAssistantPath({ kind: 'managed', publish: false, slug: '', emails: ['a@x.edu'], generatedPath: GEN });
        expect(plan.register).toEqual({ path: GEN, astPathData: restricted(['a@x.edu']) });
    });

    it('unpublished and already on its key: nothing to register while the people are unchanged', () => {
        const plan = planAssistantPath({ kind: 'managed', publish: false, slug: '', emails: ['a@x.edu'], generatedPath: 'a-' + '0'.repeat(32), existingPath: GEN, existingAstPathData: restricted(['a@x.edu']) });
        expect(plan.register).toBeNull();
        expect(plan.data).toEqual({ astPath: GEN, astPathData: restricted(['a@x.edu']) });
    });

    it('re-registers when the people change', () => {
        const plan = planAssistantPath({ kind: 'managed', publish: false, slug: '', emails: ['a@x.edu', 'b@x.edu'], existingPath: GEN, existingAstPathData: restricted(['a@x.edu']) });
        expect(plan.register).toEqual({ path: GEN, astPathData: restricted(['a@x.edu', 'b@x.edu']) });
        expect(plan.data.astPath).toBe(GEN);
    });

    it('published: a public link, still remembering who it is shared with', () => {
        const plan = planAssistantPath({ kind: 'managed', publish: true, slug: 'bot', emails: ['a@x.edu'], existingPath: GEN, existingAstPathData: restricted(['a@x.edu']) });
        expect(plan.register).toEqual({ path: 'bot', astPathData: pub(['a@x.edu']) });
        // the save keeps the old key so a failed registration leaves people able to open it
        expect(plan.data.astPath).toBe(GEN);
    });

    it('un-publishing moves back to a fresh key, not the old public name', () => {
        const plan = planAssistantPath({ kind: 'managed', publish: false, slug: 'bot', emails: ['a@x.edu'], generatedPath: GEN, existingPath: 'bot', existingAstPathData: pub(['a@x.edu']) });
        expect(plan.register?.path).toBe(GEN);
        // fail closed: if registering the key fails, the old public link must not still stand
        expect(plan.data.astPath).toBeUndefined();
    });
});

describe('planAssistantPath — group', () => {
    it('unpublishes by omitting the path when switched off', () => {
        expect(planAssistantPath({ kind: 'collaborative', publish: false, slug: 'askjerry', existingPath: 'askjerry', existingAstPathData: GROUP_PUBLIC_ACCESS }))
            .toEqual({ data: {}, register: null, hasPath: false });
    });

    it('treats an empty path as unpublished', () => {
        expect(planAssistantPath({ kind: 'collaborative', publish: true, slug: '  ' }).hasPath).toBe(false);
    });

    it('keeps the stored path and registers nothing when unchanged, keeping stored access', () => {
        const plan = planAssistantPath({ kind: 'collaborative', publish: true, slug: 'AskJerry', existingPath: 'askjerry', existingAstPathData: restricted(['a']) });
        expect(plan).toEqual({ data: { astPath: 'askjerry', astPathData: restricted(['a']) }, register: null, hasPath: true });
    });

    it('does not invent access data for a legacy path stored without it', () => {
        const plan = planAssistantPath({ kind: 'collaborative', publish: true, slug: 'askjerry', existingPath: 'askjerry' });
        expect(plan.data).toEqual({ astPath: 'askjerry' });
        expect(plan.register).toBeNull();
    });

    it('moves to a new path while the save keeps the old one', () => {
        const plan = planAssistantPath({ kind: 'collaborative', publish: true, slug: 'new-name', existingPath: 'old-name', existingAstPathData: restricted() });
        expect(plan.data).toEqual({ astPath: 'old-name', astPathData: restricted() });
        expect(plan.register).toEqual({ path: 'new-name', astPathData: restricted() });
    });
});
