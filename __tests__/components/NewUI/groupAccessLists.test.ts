import { describe, expect, it } from 'vitest';
import {
  toAmplifyGroupNames,
  toSystemUserIds,
} from '@/components/NewUI/views/assistant/groupAccessLists';

describe('toSystemUserIds', () => {
  it('reads systemId from the API-key records the backend returns', () => {
    // Shape of /apiKeys/get_system_ids: raw DynamoDB items, not strings.
    const raw = [
      { owner: 'a@x.edu', applicationName: 'app1', systemId: 'sys-1', rateLimit: {} },
      { owner: 'a@x.edu', applicationName: 'app2', systemId: 'sys-2' },
    ];
    expect(toSystemUserIds(raw)).toEqual(['sys-1', 'sys-2']);
  });

  it('always returns plain strings, so they are safe to render', () => {
    const result = toSystemUserIds([{ systemId: 'sys-1', owner: 'o' }, 'sys-2']);
    expect(result.every((value) => typeof value === 'string')).toBe(true);
  });

  it('drops records with no usable systemId', () => {
    expect(
      toSystemUserIds([{ owner: 'o' }, { systemId: '' }, { systemId: null }, null, undefined, 7, { systemId: 'ok' }]),
    ).toEqual(['ok']);
  });

  it('merges extra ids (already saved on the group) without duplicates', () => {
    expect(toSystemUserIds([{ systemId: 'a' }, { systemId: 'b' }], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('survives responses that are not lists', () => {
    for (const bad of [undefined, null, {}, { success: false }, 'oops', 3]) {
      expect(toSystemUserIds(bad)).toEqual([]);
    }
    expect(toSystemUserIds(undefined, ['saved'])).toEqual(['saved']);
  });

  it('ignores a non-list extras argument', () => {
    expect(toSystemUserIds([{ systemId: 'a' }], 'nope' as any)).toEqual(['a']);
  });
});

describe('toAmplifyGroupNames', () => {
  it('unwraps a successful response', () => {
    expect(toAmplifyGroupNames({ success: true, data: ['g1', 'g2'] })).toEqual(['g1', 'g2']);
  });

  it('accepts a bare list', () => {
    expect(toAmplifyGroupNames(['g1'])).toEqual(['g1']);
  });

  it('returns an empty list for a failed response instead of the response object', () => {
    // The backend answers { success: false, message } when no Amplify Groups exist.
    expect(toAmplifyGroupNames({ success: false, message: 'No Amplify Groups Found' })).toEqual([]);
  });

  it('drops non-string and blank entries', () => {
    expect(toAmplifyGroupNames({ success: true, data: ['g1', '', null, 4, { a: 1 }] })).toEqual(['g1']);
  });

  it('survives malformed input', () => {
    for (const bad of [undefined, null, {}, 'x', 3, { success: true }, { success: true, data: {} }]) {
      expect(toAmplifyGroupNames(bad)).toEqual([]);
    }
  });
});
