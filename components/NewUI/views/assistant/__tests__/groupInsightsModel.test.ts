import { describe, it, expect } from 'vitest';
import {
    AstUserConversation,
    canViewInsights,
    columnLabel,
    defaultColumns,
    distributionToBars,
    filledStars,
    filterConversations,
    formatDecimal,
    insightsBlockReason,
    nextSort,
    normalizeRating,
    parseTranscript,
    routedLabel,
    selectableColumns,
    shortId,
    sortConversations,
    stripAssistantPrefix,
} from '../groupInsightsModel';

const conv = (over: Partial<AstUserConversation>): AstUserConversation => ({
    assistantName: 'Helper',
    user: 'ann',
    employeeType: 'Student',
    entryPoint: 'web',
    numberPrompts: 1,
    modelUsed: 'gpt',
    timestamp: '2025-01-01T00:00:00Z',
    s3Location: '',
    userRating: 0,
    systemRating: 0,
    category: 'Billing',
    userFeedback: '',
    conversationId: 'c1',
    assistantId: 'a1',
    routedToAssistantId: '',
    ...over,
});

describe('gating', () => {
    it('needs both group approval and the assistant opt-in', () => {
        expect(canViewInsights({ supportConvAnalysis: true }, { supportConvAnalysis: true })).toBe(true);
        expect(canViewInsights({ supportConvAnalysis: true }, { supportConvAnalysis: false })).toBe(false);
        expect(canViewInsights({ supportConvAnalysis: false }, { supportConvAnalysis: true })).toBe(false);
        expect(canViewInsights(undefined, undefined)).toBe(false);
    });
    it('says which one is missing, group first', () => {
        expect(insightsBlockReason({ supportConvAnalysis: false }, { supportConvAnalysis: false })).toBe('group-not-approved');
        expect(insightsBlockReason({ supportConvAnalysis: true }, {})).toBe('assistant-not-enabled');
        expect(insightsBlockReason({ supportConvAnalysis: true }, { supportConvAnalysis: true })).toBeNull();
    });
});

describe('ratings and numbers', () => {
    it('reads numbers and numeric strings, and treats everything else as no rating', () => {
        expect(normalizeRating(4.2)).toBe(4.2);
        expect(normalizeRating('3')).toBe(3);
        expect(normalizeRating(0)).toBeNull();
        expect(normalizeRating(null)).toBeNull();
        expect(normalizeRating('abc')).toBeNull();
        expect(normalizeRating(9)).toBe(5);
    });
    it('fills rounded stars', () => {
        expect(filledStars(3.6)).toBe(4);
        expect(filledStars(null)).toBe(0);
    });
    it('formats decimals defensively', () => {
        expect(formatDecimal(2.456)).toBe('2.46');
        expect(formatDecimal(undefined)).toBe('—');
    });
});

describe('distributionToBars', () => {
    it('sorts largest first, drops blanks/zeros and computes share and width', () => {
        const bars = distributionToBars({ web: 6, '': 4, mobile: 2, none: 0 });
        expect(bars.map((b) => b.label)).toEqual(['web', 'mobile']);
        expect(bars[0]).toMatchObject({ value: 6, percent: 75, width: 100 });
        expect(bars[1]).toMatchObject({ value: 2, percent: 25, width: 33 });
    });
    it('keeps a tiny value visible and respects limit', () => {
        const bars = distributionToBars({ a: 1000, b: 1, c: 1 }, { limit: 2 });
        expect(bars).toHaveLength(2);
        expect(bars[1].width).toBeGreaterThanOrEqual(4);
    });
    it('handles missing data', () => {
        expect(distributionToBars(undefined)).toEqual([]);
    });
});

describe('table columns and sorting', () => {
    it('adds analysis columns only when enabled', () => {
        expect(defaultColumns(false)).not.toContain('category');
        expect(defaultColumns(true)).toContain('category');
        expect(selectableColumns(true)).toContain('conversationId');
    });
    it('shows "Routed to" by default when conversations were routed (layered assistants)', () => {
        expect(defaultColumns(false, true)).toContain('routedToAssistantId');
        expect(defaultColumns(false, true)[1]).toBe('routedToAssistantId');
        expect(defaultColumns(false)).not.toContain('routedToAssistantId');
    });
    it('labels columns for people', () => {
        expect(columnLabel('numberPrompts')).toBe('Number prompts');
        expect(columnLabel('employeeType')).toBe('Group type');
        expect(columnLabel('routedToAssistantId')).toBe('Routed to');
    });
    it('flips direction on the same column, resets on a new one', () => {
        expect(nextSort({ column: 'user', direction: 'asc' }, 'user')).toEqual({ column: 'user', direction: 'desc' });
        expect(nextSort({ column: 'user', direction: 'desc' }, 'category')).toEqual({ column: 'category', direction: 'asc' });
    });
    it('sorts numbers numerically, text alphabetically and dates chronologically', () => {
        const rows = [
            conv({ conversationId: 'a', numberPrompts: 10, user: 'bob', timestamp: '2025-03-01T00:00:00Z' }),
            conv({ conversationId: 'b', numberPrompts: 2, user: 'ann', timestamp: '2025-01-01T00:00:00Z' }),
        ];
        expect(sortConversations(rows, 'numberPrompts', 'asc').map((r) => r.conversationId)).toEqual(['b', 'a']);
        expect(sortConversations(rows, 'user', 'asc').map((r) => r.conversationId)).toEqual(['b', 'a']);
        expect(sortConversations(rows, 'timestamp', 'desc').map((r) => r.conversationId)).toEqual(['a', 'b']);
    });
    it('sorts missing values last in both directions and does not mutate', () => {
        const rows = [conv({ conversationId: 'x', category: undefined as any }), conv({ conversationId: 'y', category: 'A' })];
        expect(sortConversations(rows, 'category', 'asc')[1].conversationId).toBe('x');
        expect(sortConversations(rows, 'category', 'desc')[1].conversationId).toBe('x');
        expect(rows[0].conversationId).toBe('x');
    });
});

describe('filterConversations', () => {
    const rows = [conv({ user: 'ann', category: 'Billing' }), conv({ user: 'bob', category: 'Access', userFeedback: 'Great help' })];
    it('returns everything for a blank term', () => {
        expect(filterConversations(rows, '  ', true)).toBe(rows);
    });
    it('searches user and feedback', () => {
        expect(filterConversations(rows, 'BOB', false)).toHaveLength(1);
        expect(filterConversations(rows, 'great', false)).toHaveLength(1);
    });
    it('searches analysis fields only when analysis is on', () => {
        expect(filterConversations(rows, 'billing', true)).toHaveLength(1);
        expect(filterConversations(rows, 'billing', false)).toHaveLength(0);
    });
});

describe('ids', () => {
    it('strips the backend prefix', () => {
        expect(stripAssistantPrefix('astgp/abc')).toBe('abc');
        expect(stripAssistantPrefix('astr/abc')).toBe('abc');
        expect(stripAssistantPrefix(undefined)).toBe('');
    });
    it('shortens long ids', () => {
        expect(shortId('0123456789abcdef')).toBe('0123456789…');
        expect(shortId('abc')).toBe('abc');
    });
});

describe('routedLabel', () => {
    it('prefers a known leaf name, else strips the backend prefix', () => {
        expect(routedLabel('astp/leaf', { 'astp/leaf': 'Billing Helper' })).toBe('Billing Helper');
        expect(routedLabel('astp/other', { 'astp/leaf': 'Billing Helper' })).toBe('other');
        expect(routedLabel('astgp/x')).toBe('x');
        expect(routedLabel(undefined)).toBe('');
    });
});

describe('parseTranscript', () => {
    it('parses prompt/response pairs and unescapes newlines', () => {
        const messages = parseTranscript('User Prompt: Hi\\nthere AI Response: Hello! User Prompt: Bye AI Response: See you');
        expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
        expect(messages[0].content).toBe('Hi\nthere');
        expect(messages[3].content).toBe('See you');
    });
    it('extracts the routing marker from an assistant turn', () => {
        const messages = parseTranscript('User Prompt: Q AI Response: [Routed To: astgp/leaf]\nAnswer');
        expect(messages[1]).toEqual({ role: 'assistant', content: 'Answer', routedTo: 'astgp/leaf' });
    });
    it('falls back to one system block when nothing matches', () => {
        expect(parseTranscript('plain #dataSource:text')).toEqual([{ role: 'system', content: 'plain text' }]);
    });
});
