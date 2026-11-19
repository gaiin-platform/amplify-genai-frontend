import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupAccessType } from '@/types/groups';

const mocks = vi.hoisted(() => ({ doRequestOp: vi.fn() }));

vi.mock('@/services/doRequestOp', () => ({ doRequestOp: mocks.doRequestOp }));

import { createAstAdminGroup, groupFromCreateResult } from '@/services/groupsService';

const payload = {
    group_name: 'Research Group',
    members: { alice: GroupAccessType.ADMIN },
    types: [],
    amplify_groups: [],
    system_users: [],
};

beforeEach(() => {
    mocks.doRequestOp.mockReset();
});

describe('createAstAdminGroup', () => {
    it('posts the payload unchanged to /groups/create', async () => {
        mocks.doRequestOp.mockResolvedValue({ success: true, data: { id: 'g1' } });

        await createAstAdminGroup(payload);

        expect(mocks.doRequestOp).toHaveBeenCalledWith({
            method: 'POST',
            path: '/groups',
            op: '/create',
            data: payload,
            service: 'groups',
        });
    });

    it('returns the whole response on success', async () => {
        const response = { success: true, message: 'created', data: { id: 'g1', name: 'Research Group' } };
        mocks.doRequestOp.mockResolvedValue(response);

        expect(await createAstAdminGroup(payload)).toEqual(response);
    });

    it('returns the failure with its message instead of null', async () => {
        const response = { success: false, message: "Failed to create group 'Research Group'" };
        mocks.doRequestOp.mockResolvedValue(response);

        expect(await createAstAdminGroup(payload)).toEqual(response);
    });
});

describe('groupFromCreateResult', () => {
    it('gives the created group for a successful create', () => {
        const group = { id: 'g1', name: 'Research Group' };
        expect(groupFromCreateResult({ success: true, data: group })).toBe(group);
    });

    it('gives nothing usable when the create failed or sent no group', () => {
        // The classic create-group dialog treats any falsy value as "could not create".
        expect(groupFromCreateResult({ success: false, message: 'nope' })).toBeNull();
        expect(groupFromCreateResult({ success: false, data: { id: 'g1' } })).toBeNull();
        expect(groupFromCreateResult({ success: true })).toBeFalsy();
        expect(groupFromCreateResult(null)).toBeNull();
        expect(groupFromCreateResult(undefined)).toBeNull();
    });
});
