import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupAccessType } from '@/types/groups';
import { AMPLIFY_ASSISTANTS_GROUP_NAME } from '@/utils/app/amplifyAssistants';

// Only the network call is faked, so these tests also run the real groups service: what
// they assert on is the request that would leave the app.
const mocks = vi.hoisted(() => ({ doRequestOp: vi.fn() }));

vi.mock('@/services/doRequestOp', () => ({ doRequestOp: mocks.doRequestOp }));

import {
    CREATE_GROUP_FALLBACK_ERROR,
    CREATE_GROUP_SIGN_IN_ERROR,
    buildCreateGroupPayload,
    collectOtherMembers,
    createGroupWithMembers,
    validateNewGroupName,
} from '../groupCreationModel';

beforeEach(() => {
    mocks.doRequestOp.mockReset();
});

describe('buildCreateGroupPayload', () => {
    it('uses exactly the key names POST /groups/create accepts', () => {
        const payload = buildCreateGroupPayload('Research Group', 'alice');
        expect(Object.keys(payload).sort()).toEqual([
            'amplify_groups',
            'group_name',
            'members',
            'system_users',
            'types',
        ]);
        expect(payload).toEqual({
            group_name: 'Research Group',
            members: { alice: GroupAccessType.ADMIN },
            types: [],
            amplify_groups: [],
            system_users: [],
        });
    });

    it('trims the name and keeps the other members with their access', () => {
        const payload = buildCreateGroupPayload('  Research Group ', 'alice', {
            bob: GroupAccessType.WRITE,
            carol: GroupAccessType.READ,
        });
        expect(payload.group_name).toBe('Research Group');
        expect(payload.members).toEqual({
            alice: GroupAccessType.ADMIN,
            bob: GroupAccessType.WRITE,
            carol: GroupAccessType.READ,
        });
    });

    it('keeps the creator an admin even if the member list says otherwise', () => {
        const payload = buildCreateGroupPayload('Research Group', 'alice', {
            alice: GroupAccessType.READ,
        });
        expect(payload.members).toEqual({ alice: GroupAccessType.ADMIN });
    });

});

// A copy of amplify-genai-backend object-access/schemata/create_admin_group_schema.py and
// members_schema.py (dev branch, 2026-11-19). Update it when the backend schema changes.
const CREATE_ADMIN_GROUP_SCHEMA = {
    type: 'object',
    properties: {
        group_name: { type: 'string' },
        members: {
            type: 'object',
            patternProperties: { '.*': { type: 'string', enum: ['write', 'read', 'admin'] } },
        },
        types: { type: 'array', items: { type: 'string' } },
        amplify_groups: { type: 'array', items: { type: 'string' } },
        system_users: { type: 'array', items: { type: 'string' } },
    },
    required: ['group_name', 'members'],
};

// Just enough JSON Schema to read the copy above: type, enum, required, properties, items,
// and patternProperties with the match-everything pattern it uses.
const schemaErrors = (value: any, schema: any, path = 'body'): string[] => {
    const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
    if (schema.type === 'object' && !isObject) return [`${path} is not an object`];
    if (schema.type === 'array' && !Array.isArray(value)) return [`${path} is not an array`];
    if (schema.type === 'string' && typeof value !== 'string') return [`${path} is not a string`];

    const errors: string[] = [];
    if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path} is not one of ${schema.enum.join('/')}`);
    }
    for (const key of schema.required ?? []) {
        if (!(key in value)) errors.push(`${path}.${key} is required`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
        if (isObject && key in value) errors.push(...schemaErrors(value[key], sub, `${path}.${key}`));
    }
    for (const sub of Object.values(schema.patternProperties ?? {})) {
        for (const [key, entry] of Object.entries(isObject ? value : {})) {
            errors.push(...schemaErrors(entry, sub, `${path}.${key}`));
        }
    }
    if (schema.items && Array.isArray(value)) {
        value.forEach((entry, i) => errors.push(...schemaErrors(entry, schema.items, `${path}[${i}]`)));
    }
    return errors;
};

describe('the create request against the backend schema', () => {
    it('is accepted, with and without other members', () => {
        expect(schemaErrors(buildCreateGroupPayload('Research Group', 'alice'), CREATE_ADMIN_GROUP_SCHEMA)).toEqual([]);
        const withMembers = buildCreateGroupPayload('Research Group', 'alice', {
            bob: GroupAccessType.READ,
            carol: GroupAccessType.WRITE,
            dave: GroupAccessType.ADMIN,
        });
        expect(schemaErrors(withMembers, CREATE_ADMIN_GROUP_SCHEMA)).toEqual([]);
    });

    it('is refused in the shape the old dialogs sent, because both required fields are missing', () => {
        const oldBody = { name: 'Research Group', groupTypes: [], amplifyGroups: [], systemUsers: [] };
        expect(schemaErrors(oldBody, CREATE_ADMIN_GROUP_SCHEMA)).toEqual([
            'body.group_name is required',
            'body.members is required',
        ]);
    });

    it('would be refused with an access level the backend does not know', () => {
        const payload = buildCreateGroupPayload('Research Group', 'alice', {
            bob: 'owner' as GroupAccessType,
        });
        expect(schemaErrors(payload, CREATE_ADMIN_GROUP_SCHEMA)).toEqual([
            'body.members.bob is not one of write/read/admin',
        ]);
    });
});

describe('validateNewGroupName', () => {
    const existing = [{ name: 'Research Group' }, { name: 'Finance' }];

    it('accepts a new name', () => {
        expect(validateNewGroupName('Biology Lab', existing)).toBe('');
        expect(validateNewGroupName('Biology Lab', [])).toBe('');
    });

    it('rejects a blank name', () => {
        expect(validateNewGroupName('', existing)).toMatch(/required/);
        expect(validateNewGroupName('   ', existing)).toMatch(/required/);
    });

    it('rejects the reserved Amplify assistants group name', () => {
        expect(validateNewGroupName(AMPLIFY_ASSISTANTS_GROUP_NAME, [])).toMatch(/isn't available/);
        expect(validateNewGroupName(` ${AMPLIFY_ASSISTANTS_GROUP_NAME.toLowerCase()} `, [])).toMatch(
            /isn't available/,
        );
    });

    it('rejects a name another of the user’s groups already has, ignoring case and outer spaces', () => {
        expect(validateNewGroupName('Research Group', existing)).toMatch(/unique/);
        expect(validateNewGroupName('  research group ', existing)).toMatch(/unique/);
    });

    it('does not treat a longer or shorter name as a duplicate', () => {
        expect(validateNewGroupName('Research', existing)).toBe('');
        expect(validateNewGroupName('Research Group 2', existing)).toBe('');
    });

    it('ignores groups that have no usable name', () => {
        const broken = [{ name: undefined as unknown as string }, { name: '' }];
        expect(validateNewGroupName('Biology Lab', broken)).toBe('');
    });
});

describe('collectOtherMembers', () => {
    // username -> email, the shape of HomeContext `amplifyUsers`
    const amplifyUsers = { alice: 'alice@example.edu', bob: 'bob@example.edu', carol: 'carol@example.edu' };

    it('maps each email to its username, with write access by default', () => {
        expect(collectOtherMembers(['bob@example.edu', 'carol@example.edu'], 'alice', amplifyUsers)).toEqual({
            bob: GroupAccessType.WRITE,
            carol: GroupAccessType.WRITE,
        });
    });

    it('uses the access picked for each email', () => {
        const members = collectOtherMembers(['bob@example.edu', 'carol@example.edu'], 'alice', amplifyUsers, {
            'bob@example.edu': GroupAccessType.READ,
            'carol@example.edu': GroupAccessType.ADMIN,
        });
        expect(members).toEqual({ bob: GroupAccessType.READ, carol: GroupAccessType.ADMIN });
    });

    it('leaves the creator out, so the picker cannot change their access', () => {
        const members = collectOtherMembers(['alice@example.edu', 'bob@example.edu'], 'alice', amplifyUsers, {
            'alice@example.edu': GroupAccessType.READ,
        });
        expect(members).toEqual({ bob: GroupAccessType.WRITE });
    });

    it('matches emails without case or outer spaces', () => {
        expect(collectOtherMembers(['  BOB@Example.edu '], 'alice', amplifyUsers)).toEqual({
            bob: GroupAccessType.WRITE,
        });
    });

    it('keeps an address no user has, for the backend to accept or drop', () => {
        expect(collectOtherMembers(['nobody@example.edu'], 'alice', amplifyUsers)).toEqual({
            'nobody@example.edu': GroupAccessType.WRITE,
        });
        expect(collectOtherMembers(['nobody@example.edu'], 'alice', null)).toEqual({
            'nobody@example.edu': GroupAccessType.WRITE,
        });
    });

    it('trims an address no user has, and still finds the access picked for it', () => {
        const padded = '  Nobody@Example.edu ';
        expect(collectOtherMembers([padded], 'alice', amplifyUsers, { [padded]: GroupAccessType.READ })).toEqual({
            'Nobody@Example.edu': GroupAccessType.READ,
        });
        expect(
            collectOtherMembers([padded], 'alice', amplifyUsers, { 'Nobody@Example.edu': GroupAccessType.ADMIN }),
        ).toEqual({ 'Nobody@Example.edu': GroupAccessType.ADMIN });
    });

    it('skips blank entries and returns nothing for an empty list', () => {
        expect(collectOtherMembers(['', '   '], 'alice', amplifyUsers)).toEqual({});
        expect(collectOtherMembers([], 'alice', amplifyUsers)).toEqual({});
    });
});

describe('createGroupWithMembers', () => {
    const created = {
        id: 'ResearchGroup_123',
        name: 'Research Group',
        members: { alice: 'admin', bob: 'write' },
        assistants: [],
        groupTypes: [],
        amplifyGroups: [],
        systemUsers: [],
    };
    const request = (over: Record<string, unknown> = {}) => ({
        name: 'Research Group',
        creator: 'alice',
        existingGroups: [{ name: 'Finance' }],
        ...over,
    });

    it('sends group_name and members, with the creator as admin, in one request', async () => {
        mocks.doRequestOp.mockResolvedValue({ success: true, data: created });

        await createGroupWithMembers(
            request({ name: ' Research Group ', otherMembers: { bob: GroupAccessType.WRITE } }),
        );

        expect(mocks.doRequestOp).toHaveBeenCalledTimes(1);
        const op = mocks.doRequestOp.mock.calls[0][0];
        expect(op).toMatchObject({ method: 'POST', path: '/groups', op: '/create' });
        const sent = op.data;
        expect(sent).toEqual({
            group_name: 'Research Group',
            members: { alice: GroupAccessType.ADMIN, bob: GroupAccessType.WRITE },
            types: [],
            amplify_groups: [],
            system_users: [],
        });
        // The keys the old dialogs sent in place of the ones above.
        for (const stale of ['name', 'groupTypes', 'amplifyGroups', 'systemUsers']) {
            expect(sent).not.toHaveProperty(stale);
        }
    });

    it('returns the created group', async () => {
        mocks.doRequestOp.mockResolvedValue({ success: true, data: created });

        const outcome = await createGroupWithMembers(
            request({ otherMembers: { bob: GroupAccessType.WRITE } }),
        );

        expect(outcome).toEqual({
            ok: true,
            group: { ...created, layeredAssistants: [] },
        });
    });

    it('uses the member list the backend saved, which may leave out unknown users', async () => {
        mocks.doRequestOp.mockResolvedValue({
            success: true,
            data: { ...created, members: { alice: 'admin' } },
        });

        const outcome = await createGroupWithMembers(
            request({ otherMembers: { 'nobody@example.com': GroupAccessType.WRITE } }),
        );

        expect(outcome.ok && outcome.group.members).toEqual({ alice: 'admin' });
    });

    it('reports the group as the backend saved it even if the creator is missing from it', async () => {
        // Not seen in practice: the backend only drops usernames it does not recognise, and the
        // signed-in user is one it does. Pinned so that turning this into an error is a decision.
        mocks.doRequestOp.mockResolvedValue({
            success: true,
            data: { ...created, members: { bob: 'write' } },
        });

        const outcome = await createGroupWithMembers(
            request({ otherMembers: { bob: GroupAccessType.WRITE } }),
        );

        expect(outcome.ok && outcome.group.members).toEqual({ bob: 'write' });
    });

    it('fills in the fields a sparse response leaves out', async () => {
        mocks.doRequestOp.mockResolvedValue({ success: true, data: { id: 'g1' } });

        const outcome = await createGroupWithMembers(request({ name: '  Research Group ' }));

        expect(outcome).toEqual({
            ok: true,
            group: {
                id: 'g1',
                name: 'Research Group',
                members: { alice: GroupAccessType.ADMIN },
                assistants: [],
                layeredAssistants: [],
                groupTypes: [],
                amplifyGroups: [],
                systemUsers: [],
            },
        });
    });

    it('sends nothing and says why when the name cannot be used', async () => {
        const cases: Array<[Record<string, unknown>, RegExp]> = [
            [{ name: '   ' }, /required/],
            [{ name: AMPLIFY_ASSISTANTS_GROUP_NAME }, /isn't available/],
            [{ name: 'finance' }, /unique/],
        ];
        for (const [over, reason] of cases) {
            const outcome = await createGroupWithMembers(request(over));
            expect(outcome.ok).toBe(false);
            expect(!outcome.ok && outcome.message).toMatch(reason);
        }
        expect(mocks.doRequestOp).not.toHaveBeenCalled();
    });

    it('sends nothing when nobody is signed in', async () => {
        for (const creator of [null, undefined, '']) {
            expect(await createGroupWithMembers(request({ creator }))).toEqual({
                ok: false,
                message: CREATE_GROUP_SIGN_IN_ERROR,
            });
        }
        expect(mocks.doRequestOp).not.toHaveBeenCalled();
    });

    it('reports the reason the request gave when it fails', async () => {
        mocks.doRequestOp.mockResolvedValue({
            success: false,
            message: "Failed to create group 'Research Group'",
        });

        expect(await createGroupWithMembers(request())).toEqual({
            ok: false,
            message: "Failed to create group 'Research Group'",
        });
    });

    it('falls back to the generic message when no reason came back', async () => {
        for (const result of [
            { success: false },
            { success: false, message: '   ' },
            { success: false, message: 42 },
            { success: false, message: { detail: 'not text' } },
            { success: true, message: 'created', data: {} },
            { success: true },
            null,
            undefined,
        ]) {
            mocks.doRequestOp.mockResolvedValue(result);
            expect(await createGroupWithMembers(request())).toEqual({
                ok: false,
                message: CREATE_GROUP_FALLBACK_ERROR,
            });
        }
    });
});
