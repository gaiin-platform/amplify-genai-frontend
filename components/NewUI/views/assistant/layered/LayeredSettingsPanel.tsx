/**
 * LayeredSettingsPanel — settings of a *group* layered assistant that sit beside the tree (the old
 * admin interface's `LayeredAssistantConvConfigs`): publish to read-access members, enforce a model,
 * and — only when the group is approved for it — conversation tracking, analysis and categories.
 *
 * Controlled: the builder owns `LayeredSettings` so the save can read it. All rules (analysis implies
 * tracking, tracking off clears analysis, a model is dropped when enforcement is off) are in
 * `layeredAssistantDataModel`.
 */

import React, { useContext, useId } from 'react';
import HomeContext from '@/components/Home/home.context';
import { DefaultModels } from '@/types/model';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { ModelPicker } from '@/components/NewUI/shared/ModelPicker';
import { TagChipsInput } from '@/components/NewUI/shared/TagChipsInput';
import {
    LayeredSettings,
    setEnforcedModel,
    setLayeredAnalysis,
    setLayeredTracking,
} from '../layeredAssistantDataModel';

export interface LayeredSettingsPanelProps {
    settings: LayeredSettings;
    onChange: (next: LayeredSettings) => void;
    groupName: string;
    /** Group-level approval for tracking/analysis. */
    groupSupportsAnalysis: boolean;
}

const title: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' };
const muted: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' };

const Row: React.FC<{ id: string; heading: string; description: React.ReactNode; control: React.ReactNode }> = ({ id, heading, description, control }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
            <span id={id} style={title}>{heading}</span>
            <div style={muted}>{description}</div>
        </div>
        <div style={{ flexShrink: 0, paddingTop: 2 }}>{control}</div>
    </div>
);

export const LayeredSettingsPanel: React.FC<LayeredSettingsPanelProps> = ({ settings, onChange, groupName, groupSupportsAnalysis }) => {
    const base = useId();
    const { getDefaultModel } = useContext(HomeContext);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Row
                id={`${base}-publish`}
                heading="Publish to read-access members"
                description={`Members of ${groupName} who can only read can see and use this layered assistant.`}
                control={<ToggleSwitch checked={settings.isPublished} onChange={(isPublished) => onChange({ ...settings, isPublished })} aria-labelledby={`${base}-publish`} />}
            />

            <div>
                <Row
                    id={`${base}-model`}
                    heading="Enforce a model"
                    description="Everyone chatting with this layered assistant uses this model."
                    control={
                        <ToggleSwitch
                            checked={settings.enforceModel}
                            onChange={(on) => onChange(setEnforcedModel(settings, on, getDefaultModel(DefaultModels.DEFAULT)?.id))}
                            aria-labelledby={`${base}-model`}
                        />
                    }
                />
                {settings.enforceModel && (
                    <div style={{ marginTop: 10 }}>
                        <ModelPicker
                            selectedModelId={settings.model}
                            selectedEffort="off"
                            onModelChange={(model) => onChange({ ...settings, model })}
                            onEffortChange={() => { /* reasoning effort isn't part of an enforced layered model */ }}
                            isNewChat
                        />
                    </div>
                )}
            </div>

            {groupSupportsAnalysis ? (
                <>
                    <Row
                        id={`${base}-track`}
                        heading="Track conversations"
                        description="Enables the dashboard and conversation history for monitoring and review."
                        control={<ToggleSwitch checked={settings.trackConversations} onChange={(on) => onChange(setLayeredTracking(settings, on))} aria-labelledby={`${base}-track`} />}
                    />
                    <Row
                        id={`${base}-analyze`}
                        heading="Analyze conversations"
                        description="AI-powered categorization of conversations. Turning this on also turns tracking on; turning tracking off turns this off."
                        control={<ToggleSwitch checked={settings.supportConvAnalysis} onChange={(on) => onChange(setLayeredAnalysis(settings, on))} aria-labelledby={`${base}-analyze`} />}
                    />
                    <div style={{ opacity: settings.supportConvAnalysis ? 1 : 0.5 }}>
                        <span style={{ ...title, display: 'block', marginBottom: 6 }}>Analysis categories</span>
                        <TagChipsInput
                            tags={settings.analysisCategories}
                            onChange={(analysisCategories) => onChange({ ...settings, analysisCategories })}
                            ariaLabel="Analysis categories"
                            placeholder="e.g. Billing, Account access"
                            disabled={!settings.supportConvAnalysis}
                        />
                    </div>
                </>
            ) : (
                <p style={{ ...muted, margin: 0 }}>
                    Conversation tracking and analysis aren’t enabled for this group. Ask Amplify to approve them to see
                    dashboard metrics and conversation history.
                </p>
            )}
        </div>
    );
};
