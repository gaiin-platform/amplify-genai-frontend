/**
 * Group-assistant insights — the rules behind the Dashboard and Conversations views that replace the
 * old admin interface's `Dashboard` / `ConversationTable` (components/Admin/AssistantAdminComponents).
 *
 * Everything that is a decision rather than a pixel lives here so it can be tested without a DOM:
 * who may see insights, how a distribution becomes bars, how a rating is read, how the table sorts
 * and searches, and how a stored transcript becomes messages.
 *
 * No React imports.
 */

import type { DashboardMetrics } from '@/components/Admin/AssistantAdminComponents/Dashboard';
import type { AstUserConversation } from '@/components/Admin/AssistantAdminComponents/ConversationTable';

export type { DashboardMetrics, AstUserConversation };

// ── Gating ─────────────────────────────────────────────────────────────────────

/**
 * Insights need BOTH the group's approval (`supportConvAnalysis` on the group — granted by Amplify)
 * and the assistant's own opt-in. Mirrors the old admin interface's check.
 */
export function canViewInsights(
    group: { supportConvAnalysis?: boolean } | undefined,
    assistantData: { supportConvAnalysis?: boolean } | undefined,
): boolean {
    return !!group?.supportConvAnalysis && !!assistantData?.supportConvAnalysis;
}

export type InsightsBlockReason = 'group-not-approved' | 'assistant-not-enabled' | null;

/** Why insights can't be shown (so the UI can say what to do), or null when they can. */
export function insightsBlockReason(
    group: { supportConvAnalysis?: boolean } | undefined,
    assistantData: { supportConvAnalysis?: boolean } | undefined,
): InsightsBlockReason {
    if (!group?.supportConvAnalysis) return 'group-not-approved';
    if (!assistantData?.supportConvAnalysis) return 'assistant-not-enabled';
    return null;
}

// ── Ratings & numbers ──────────────────────────────────────────────────────────

/** A rating from the backend may be a number, a numeric string, or absent. Returns null for "none". */
export function normalizeRating(value: unknown): number | null {
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
    return Math.min(5, n);
}

/** How many of 5 stars to fill for a rating (rounded), 0 when there is none. */
export function filledStars(rating: number | null): number {
    return rating === null ? 0 : Math.round(rating);
}

export function formatDecimal(value: unknown, digits = 2): string {
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

// ── Distributions ──────────────────────────────────────────────────────────────

export interface DistributionBar {
    label: string;
    value: number;
    /** Share of the total, 0–100, one decimal. */
    percent: number;
    /** Bar length relative to the largest value, 0–100 (never below `minWidth` for a non-zero value). */
    width: number;
}

/**
 * Turn a `{label: count}` map into bars, largest first. Blank labels and non-positive or
 * non-numeric counts are dropped; `minWidth` keeps a tiny value visible.
 */
export function distributionToBars(
    distribution: Record<string, number> | null | undefined,
    { minWidth = 4, limit }: { minWidth?: number; limit?: number } = {},
): DistributionBar[] {
    const rows = Object.entries(distribution ?? {})
        .filter(([label, value]) => !!label && typeof value === 'number' && Number.isFinite(value) && value > 0)
        .sort((a, b) => b[1] - a[1]);
    const total = rows.reduce((sum, [, value]) => sum + value, 0);
    const max = rows.length ? rows[0][1] : 0;
    const bars = rows.map(([label, value]) => ({
        label,
        value,
        percent: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
        width: max > 0 ? Math.max(minWidth, Math.round((value / max) * 100)) : 0,
    }));
    return limit ? bars.slice(0, limit) : bars;
}

// ── Conversations table ────────────────────────────────────────────────────────

export type ConversationColumn = keyof AstUserConversation;
export type SortDirection = 'asc' | 'desc';

const BASE_COLUMNS: ConversationColumn[] = ['assistantName', 'user', 'numberPrompts', 'modelUsed', 'timestamp', 'userRating'];
const ANALYSIS_COLUMNS: ConversationColumn[] = ['employeeType', 'entryPoint', 'category', 'systemRating'];

/** Columns shown by default. Analysis columns only exist when analysis is enabled. */
export function defaultColumns(supportConvAnalysis: boolean, hasRouting = false): ConversationColumn[] {
    const base: ConversationColumn[] = hasRouting
        ? [BASE_COLUMNS[0], 'routedToAssistantId', ...BASE_COLUMNS.slice(1)]
        : BASE_COLUMNS;
    return [...base, ...(supportConvAnalysis ? ANALYSIS_COLUMNS : [])];
}

/** Every column the user may switch on. */
export function selectableColumns(supportConvAnalysis: boolean): ConversationColumn[] {
    return [...defaultColumns(supportConvAnalysis), 'userFeedback', 'conversationId', 'assistantId'];
}

export function columnLabel(column: ConversationColumn): string {
    if (column === 'routedToAssistantId') return 'Routed to';
    if (column === 'employeeType') return 'Group type';
    const spaced = String(column).replace(/([A-Z])/g, ' $1').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

const NUMERIC_COLUMNS: ConversationColumn[] = ['userRating', 'systemRating', 'numberPrompts'];

/** Click on a header: same column flips direction, a new column starts ascending. */
export function nextSort(
    current: { column: ConversationColumn; direction: SortDirection },
    column: ConversationColumn,
): { column: ConversationColumn; direction: SortDirection } {
    if (current.column === column) return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    return { column, direction: 'asc' };
}

export function sortConversations(
    conversations: AstUserConversation[],
    column: ConversationColumn,
    direction: SortDirection,
): AstUserConversation[] {
    const sign = direction === 'asc' ? 1 : -1;
    return [...conversations].sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (av == null && bv == null) return 0;
        // Missing values always sort last, whichever way the column runs.
        if (av == null) return 1;
        if (bv == null) return -1;
        if (column === 'timestamp') return sign * (new Date(av as string).getTime() - new Date(bv as string).getTime());
        if (NUMERIC_COLUMNS.includes(column)) return sign * (Number(av) - Number(bv));
        return sign * String(av).localeCompare(String(bv));
    });
}

/** Free-text search across the human-readable fields (analysis fields only when enabled). */
export function filterConversations(
    conversations: AstUserConversation[],
    term: string,
    supportConvAnalysis: boolean,
): AstUserConversation[] {
    const q = term.trim().toLowerCase();
    if (!q) return conversations;
    const fields: ConversationColumn[] = ['assistantName', 'routedToAssistantId', 'user', 'modelUsed', 'userFeedback'];
    if (supportConvAnalysis) fields.push('category', 'employeeType', 'entryPoint');
    return conversations.filter((conv) =>
        fields.some((field) => {
            const value = conv[field];
            return !!value && String(value).toLowerCase().includes(q);
        }),
    );
}

/** `astgp/1234` → `1234`: the backend prefixes ids, people want the tail. */
export function stripAssistantPrefix(id: string | null | undefined): string {
    return String(id ?? '').replace(/^ast[gpr]{0,2}\//, '');
}

/**
 * How a routed-to assistant id reads: the leaf's name when the caller knows it (layered assistants
 * pass `leafNameMap` built from their tree), otherwise the id without its backend prefix.
 */
export function routedLabel(id: string | null | undefined, names?: Record<string, string>): string {
    const key = String(id ?? '');
    return names?.[key] ?? stripAssistantPrefix(key);
}

export function formatTimestamp(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

/** First characters of an id with an ellipsis, for ids that are only useful as a reference. */
export function shortId(id: string | null | undefined, length = 10): string {
    const s = String(id ?? '');
    return s.length > length ? `${s.slice(0, length)}…` : s;
}

// ── Transcript ─────────────────────────────────────────────────────────────────

export interface TranscriptMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    /** Set when a layered assistant routed this turn to a leaf assistant. */
    routedTo?: string;
}

/** The stored transcript escapes newlines and tags attached data sources; undo both. */
export function cleanTranscript(raw: string): string {
    return raw.replace(/\\n/g, '\n').replace(/#dataSource:/g, '');
}

/**
 * Parse "User Prompt: … AI Response: …" pairs into messages. Anything that doesn't match is
 * returned as a single system block rather than dropped.
 */
export function parseTranscript(raw: string): TranscriptMessage[] {
    const text = cleanTranscript(raw);
    const pattern = /User Prompt:([\s\S]*?)(?:AI Response:([\s\S]*?)(?=User Prompt:|$))/g;
    const messages: TranscriptMessage[] = [];
    for (const match of Array.from(text.matchAll(pattern))) {
        messages.push({ role: 'user', content: match[1].trim() });
        if (match[2]) {
            // The capture starts right after "AI Response:", i.e. with a space, so anchor after trimming.
            const body = match[2].trimStart();
            const routing = body.match(/^\[Routed To: ([^\]]+)\]\n?/);
            messages.push({
                role: 'assistant',
                content: (routing ? body.replace(routing[0], '') : body).trim(),
                ...(routing ? { routedTo: routing[1] } : {}),
            });
        }
    }
    return messages.length > 0 ? messages : [{ role: 'system', content: text }];
}
