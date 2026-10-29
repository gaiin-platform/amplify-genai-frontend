/**
 * NewGroupAssistantInsightsModal — Dashboard + Conversations for one group assistant.
 *
 * Replaces the old admin interface's `dashboard` and `conversations` tabs. Opened from the Teams
 * tab (`views/NewAssistantsView#GroupAssistantsTab`) for group admins. Data comes from the same two
 * endpoints and fires the same stats events as the old UI; each tab loads when first opened, and
 * every request is sequence-guarded so a late response for a different assistant can never land.
 *
 * Access needs both the group's approval and the assistant's own opt-in (`groupInsightsModel`);
 * when either is missing the modal says which, and what to do, instead of fetching.
 */

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IconChartBar } from '@tabler/icons-react';
import HomeContext from '@/components/Home/home.context';
import { Group } from '@/types/groups';
import { Prompt } from '@/types/prompt';
import { AssistantDefinition } from '@/types/assistant';
import { LayeredAssistant } from '@/types/layeredAssistant';
import { getGroupAssistantConversations, getGroupAssistantDashboards } from '@/services/groupAssistantService';
import { CreationModalShell } from '@/components/NewUI/shared/CreationModalShell';
import { SegmentedControl } from '@/components/NewUI/shared/SegmentedControl';
import { NewUILoadingStatus } from '@/components/NewUI/shared/NewUILoadingStatus';
import { NewGroupDashboard } from './NewGroupDashboard';
import { NewGroupConversationTable } from './NewGroupConversationTable';
import { leafNameMap as buildLeafNameMap } from './layeredTreeModel';
import { readLayeredSettings } from './layeredAssistantDataModel';
import {
    AstUserConversation,
    DashboardMetrics,
    insightsBlockReason,
} from './groupInsightsModel';

type InsightsTab = 'dashboard' | 'conversations';

type Load<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; data: T }
    | { status: 'error' };

export interface NewGroupAssistantInsightsModalProps {
    group: Group;
    /** A group assistant… */
    assistant?: Prompt;
    /** …or a group layered assistant (Routing and "Routed to" then show leaf names). */
    layeredAssistant?: LayeredAssistant;
    onClose: () => void;
}

const message: React.CSSProperties = {
    maxWidth: 520,
    margin: '48px auto',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: 13.5,
    lineHeight: 1.5,
};

const Notice: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
    <div style={message}>
        <IconChartBar size={36} aria-hidden="true" style={{ opacity: 0.45, marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
        <p style={{ margin: '6px 0 0' }}>{children}</p>
        {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
);

export const NewGroupAssistantInsightsModal: React.FC<NewGroupAssistantInsightsModalProps> = ({
    group,
    assistant,
    layeredAssistant,
    onClose,
}) => {
    const { state: { statsService } } = useContext(HomeContext);

    // What is being inspected: its id, display name, own analysis opt-in, and (layered) leaf names.
    const target = useMemo(() => {
        if (layeredAssistant) {
            return {
                assistantId: layeredAssistant.assistantId,
                name: layeredAssistant.name,
                data: { supportConvAnalysis: readLayeredSettings(layeredAssistant).supportConvAnalysis },
                leafNames: buildLeafNameMap(layeredAssistant.rootNode),
                isLayered: true,
            };
        }
        const definition = assistant?.data?.assistant?.definition as AssistantDefinition | undefined;
        return {
            assistantId: definition?.assistantId,
            name: assistant?.name ?? '',
            data: (definition?.data ?? assistant?.data) as { supportConvAnalysis?: boolean } | undefined,
            leafNames: undefined as Record<string, string> | undefined,
            isLayered: false,
        };
    }, [assistant, layeredAssistant]);
    const assistantId = target.assistantId;
    const blocked = insightsBlockReason(group, target.data);

    const [tab, setTab] = useState<InsightsTab>('dashboard');
    const [dashboard, setDashboard] = useState<Load<DashboardMetrics | null>>({ status: 'idle' });
    const [conversations, setConversations] = useState<Load<AstUserConversation[]>>({ status: 'idle' });
    const dashboardSeq = useRef(0);
    const conversationsSeq = useRef(0);

    const loadDashboard = useCallback(async () => {
        if (!assistantId) return;
        const seq = ++dashboardSeq.current;
        setDashboard({ status: 'loading' });
        try {
            statsService?.getGroupAssistantDashboardsEvent?.(assistantId);
            const result = await getGroupAssistantDashboards(assistantId);
            if (seq !== dashboardSeq.current) return;
            setDashboard(
                result?.success
                    ? { status: 'ready', data: (result.data?.dashboardData as DashboardMetrics | undefined) ?? null }
                    : { status: 'error' },
            );
        } catch {
            if (seq === dashboardSeq.current) setDashboard({ status: 'error' });
        }
    }, [assistantId, statsService]);

    const loadConversations = useCallback(async () => {
        if (!assistantId) return;
        const seq = ++conversationsSeq.current;
        setConversations({ status: 'loading' });
        try {
            statsService?.getGroupAssistantConversationsEvent?.(assistantId);
            const result = await getGroupAssistantConversations(assistantId);
            if (seq !== conversationsSeq.current) return;
            setConversations(
                result?.success
                    ? { status: 'ready', data: Array.isArray(result.data) ? result.data : [] }
                    : { status: 'error' },
            );
        } catch {
            if (seq === conversationsSeq.current) setConversations({ status: 'error' });
        }
    }, [assistantId, statsService]);

    // Each tab loads the first time it is shown. (Not "once per mount": a failed load stays 'error'
    // until Retry, so this effect never loops on a failing endpoint.)
    useEffect(() => {
        if (blocked || !assistantId) return;
        if (tab === 'dashboard' && dashboard.status === 'idle') void loadDashboard();
        if (tab === 'conversations' && conversations.status === 'idle') void loadConversations();
    }, [tab, blocked, assistantId, dashboard.status, conversations.status, loadDashboard, loadConversations]);

    // Invalidate in-flight work on unmount.
    useEffect(() => () => { dashboardSeq.current++; conversationsSeq.current++; }, []);

    const retry = (
        <button
            type="button"
            onClick={() => (tab === 'dashboard' ? loadDashboard() : loadConversations())}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            style={{
                height: 34,
                padding: '0 16px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-raised)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
            }}
        >
            Try again
        </button>
    );

    const renderBody = () => {
        if (!assistantId) {
            return <Notice title="Not available">This assistant hasn’t been saved yet, so it has no activity to show.</Notice>;
        }
        if (blocked === 'group-not-approved') {
            return (
                <Notice title="Not available for this group">
                    Dashboard metrics and conversation history aren’t enabled for {group.name}. To request access, reach
                    out to Amplify for approval.
                </Notice>
            );
        }
        if (blocked === 'assistant-not-enabled') {
            return (
                <Notice title="Conversation analysis is off for this assistant">
                    Turn on <strong>Track conversations</strong> and <strong>Analyze conversations</strong> (with categories)
                    in this {target.isLayered ? 'layered assistant’s' : 'assistant’s'} Group settings. Conversations will then start generating dashboard data.
                </Notice>
            );
        }

        const load = tab === 'dashboard' ? dashboard : conversations;
        if (load.status === 'idle' || load.status === 'loading') {
            return (
                <NewUILoadingStatus
                    open
                    variant="inline"
                    message={tab === 'dashboard' ? 'Loading dashboard…' : 'Loading conversations…'}
                />
            );
        }
        if (load.status === 'error') {
            return (
                <Notice title="Couldn’t load this data" action={retry}>
                    Something went wrong while fetching it. Check your connection and try again.
                </Notice>
            );
        }

        if (tab === 'dashboard') {
            const metrics = (load as { data: DashboardMetrics | null }).data;
            return metrics ? (
                <NewGroupDashboard metrics={metrics} supportConvAnalysis leafNameMap={target.leafNames} />
            ) : (
                <Notice title="No dashboard data yet">
                    There’s nothing to show for {target.name} yet. Metrics appear once people have conversations with it
                    and analysis categories are set.
                </Notice>
            );
        }
        return (
            <NewGroupConversationTable
                conversations={(load as { data: AstUserConversation[] }).data}
                supportConvAnalysis
                leafNameMap={target.leafNames}
            />
        );
    };

    return (
        <CreationModalShell title={`Insights · ${target.name}`} onClose={onClose}>
            <div data-new-ui-shell="true" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SegmentedControl
                    items={[
                        { id: 'dashboard', label: 'Dashboard' },
                        { id: 'conversations', label: 'Conversations' },
                    ]}
                    value={tab}
                    onChange={(id) => setTab(id as InsightsTab)}
                    aria-label="Insights view"
                />
                <div role="region" aria-label={tab === 'dashboard' ? 'Dashboard' : 'Conversations'}>
                    {renderBody()}
                </div>
            </div>
        </CreationModalShell>
    );
};
