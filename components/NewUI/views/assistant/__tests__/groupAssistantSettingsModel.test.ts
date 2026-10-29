import { describe, it, expect } from 'vitest';
import {
    buildGroupData,
    finalizeGroupTypeData,
    hasPendingGroupTypeUploads,
    preserveUnmanagedData,
    readGroupSettings,
    setConvAnalysis,
    setTracking,
    toggleType,
} from '../groupAssistantSettingsModel';

const group = { groupTypes: ['Student', 'Staff'], supportConvAnalysis: true };

describe('readGroupSettings', () => {
    it('defaults a never-configured assistant', () => {
        const s = readGroupSettings({}, group);
        expect(s.isPublished).toBe(false);
        expect(s.selectedTypes).toEqual([]);
        expect(Object.keys(s.groupTypeData)).toEqual(['Student', 'Staff']);
        expect(s.groupUserTypeQuestion).toBe('');
    });

    it('drops types the group no longer offers and selects the saved ones', () => {
        const s = readGroupSettings(
            { groupTypeData: { Student: { additionalInstructions: 'hi' }, Retired: { additionalInstructions: 'x' } } },
            group,
        );
        expect(s.selectedTypes).toEqual(['Student']);
        expect(s.groupTypeData.Retired).toBeUndefined();
        expect(s.groupTypeData.Student.additionalInstructions).toBe('hi');
    });

    it('treats saved sources as complete and gives them a key', () => {
        const s = readGroupSettings({ groupTypeData: { Student: { dataSources: [{ id: 's3://g/a.pdf' }] } } }, group);
        const entry = s.groupTypeData.Student;
        expect(entry.dataSources[0].key).toBe('s3://g/a.pdf');
        expect(entry.documentState['s3://g/a.pdf']).toBe(100);
    });

    it('tolerates malformed stored values', () => {
        const s = readGroupSettings({ analysisCategories: ['ok', 3, null], groupTypeData: 'nope' } as any, group);
        expect(s.analysisCategories).toEqual(['ok']);
        expect(s.selectedTypes).toEqual([]);
    });
});

describe('analysis / tracking rules', () => {
    const base = readGroupSettings({}, group);
    it('analysis on forces tracking on', () => {
        expect(setConvAnalysis(base, true).trackConversations).toBe(true);
    });
    it('analysis off leaves tracking as it was', () => {
        const on = setConvAnalysis(base, true);
        expect(setConvAnalysis(on, false).trackConversations).toBe(true);
    });
    it('tracking cannot be turned off while analysis is on', () => {
        const on = setConvAnalysis(base, true);
        const result = setTracking(on, false);
        expect(result.blocked).toBe(true);
        expect(result.settings.trackConversations).toBe(true);
    });
    it('tracking toggles freely otherwise', () => {
        expect(setTracking(base, true).settings.trackConversations).toBe(true);
        expect(setTracking(base, false).blocked).toBe(false);
    });
});

describe('types and uploads', () => {
    it('toggleType adds and removes without duplicating', () => {
        const s = readGroupSettings({}, group);
        const withStudent = toggleType(s, 'Student', true);
        expect(toggleType(withStudent, 'Student', true)).toBe(withStudent);
        expect(toggleType(withStudent, 'Student', false).selectedTypes).toEqual([]);
    });

    it('reports pending uploads only for selected types', () => {
        let s = readGroupSettings({}, group);
        s = { ...s, groupTypeData: { ...s.groupTypeData, Staff: { ...s.groupTypeData.Staff, dataSources: [{ id: 'f' }], documentState: { f: 40 } } } };
        expect(hasPendingGroupTypeUploads(s)).toBe(false);
        expect(hasPendingGroupTypeUploads(toggleType(s, 'Staff', true))).toBe(true);
    });

    it('a source with no progress entry yet counts as pending', () => {
        let s = toggleType(readGroupSettings({}, group), 'Staff', true);
        s = { ...s, groupTypeData: { ...s.groupTypeData, Staff: { ...s.groupTypeData.Staff, dataSources: [{ id: 'f' }] } } };
        expect(hasPendingGroupTypeUploads(s)).toBe(true);
    });
});

describe('late changes to the group', () => {
    it('ticking a type that has no entry yet creates one instead of doing nothing', () => {
        const s = readGroupSettings({}, { groupTypes: ['A'], supportConvAnalysis: false });
        const stale = { ...s, groupTypeData: {} };
        const next = toggleType(stale, 'A', true);
        expect(next.selectedTypes).toEqual(['A']);
        expect(next.groupTypeData.A).toBeDefined();
        expect(Object.keys(finalizeGroupTypeData(next, 'g1'))).toEqual(['A']);
    });
    it('files under a type with chat turned off do not block saving', () => {
        let s = toggleType(readGroupSettings({}, group), 'Staff', true);
        s = { ...s, groupTypeData: { ...s.groupTypeData, Staff: { ...s.groupTypeData.Staff, isDisabled: true, dataSources: [{ id: 'f' }], documentState: { f: 10 } } } };
        expect(hasPendingGroupTypeUploads(s)).toBe(false);
    });
});

describe('finalizeGroupTypeData', () => {
    it('keeps selected types only, prefixes ids, stamps groupId and strips documentState', () => {
        let s = toggleType(readGroupSettings({}, group), 'Student', true);
        s = {
            ...s,
            groupTypeData: {
                ...s.groupTypeData,
                Student: { ...s.groupTypeData.Student, dataSources: [{ id: 'k1' }, { id: 's3://g/k2', key: 'g/k2' }], documentState: { k1: 100 } },
            },
        };
        const out = finalizeGroupTypeData(s, 'g1');
        expect(Object.keys(out)).toEqual(['Student']);
        expect(out.Student.documentState).toBeUndefined();
        expect(out.Student.dataSources).toEqual([
            { id: 's3://k1', key: 'k1', groupId: 'g1' },
            { id: 's3://g/k2', key: 'g/k2', groupId: 'g1' },
        ]);
    });
});

describe('preserveUnmanagedData / buildGroupData', () => {
    it('carries forward keys the editor does not manage', () => {
        expect(
            preserveUnmanagedData({ astIcon: { id: 'i' }, scheduledTaskIds: { a: 1 }, sharedAssistant: { sharedBy: 'x' }, skills: ['x'] }),
        ).toEqual({ astIcon: { id: 'i' }, scheduledTaskIds: { a: 1 }, sharedAssistant: { sharedBy: 'x' } });
        expect(preserveUnmanagedData(undefined)).toEqual({});
    });

    it('does not carry the thinking level any more — it is a managed field (enforcedEffortModel)', () => {
        expect(preserveUnmanagedData({ thinkingLevel: 'high', enforceThinkingLevel: true })).toEqual({});
    });

    it('keeps email events for a group assistant only (its editor hides that panel)', () => {
        const data = { emailEvents: { tag: 't' } };
        expect(preserveUnmanagedData(data, { isGroup: true })).toEqual(data);
        expect(preserveUnmanagedData(data)).toEqual({});
    });

    it('writes tracking/analysis only when the group is approved, else keeps the stored values', () => {
        const settings = setConvAnalysis(readGroupSettings({}, { ...group, supportConvAnalysis: true }), true);
        const approved = buildGroupData(settings, group, 'g1');
        expect(approved.supportConvAnalysis).toBe(true);
        expect(approved.trackConversations).toBe(true);

        const unapproved = { ...group, supportConvAnalysis: false };
        const kept = buildGroupData(settings, unapproved, 'g1', { supportConvAnalysis: true, analysisCategories: ['a'] });
        expect(kept.supportConvAnalysis).toBe(true);
        expect(kept.analysisCategories).toEqual(['a']);
        expect(buildGroupData(settings, unapproved, 'g1').supportConvAnalysis).toBeUndefined();
    });

    it('always writes publish, group types and the user question', () => {
        const out = buildGroupData({ ...readGroupSettings({}, group), isPublished: true, groupUserTypeQuestion: 'Who?' }, group, 'g1');
        expect(out.isPublished).toBe(true);
        expect(out.groupTypeData).toEqual({});
        expect(out.groupUserTypeQuestion).toBe('Who?');
    });
});
