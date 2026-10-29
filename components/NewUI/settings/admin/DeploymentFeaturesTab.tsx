import React, { FC } from 'react';
import { AdminConfigTypes, DeploymentFeaturesConfig } from '@/types/admin';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import { SelectControl } from '@/components/NewUI/shared/FormControls';
import { InfoTooltip } from '@/components/NewUI/shared/InfoTooltip';
import { DeploymentConfigWithAnnouncement } from '@/components/NewUI/shared/announcement';
import { AnnouncementCard } from './AnnouncementCard';
import {
  buildRoutingModelGroups,
  DEFAULT_ROUTING_MODEL_NAME,
  RoutingModelCandidate,
  routingModelSelectValue,
} from './routingModelOptions';

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const ToggleRow: FC<ToggleRowProps> = ({ id, label, description, checked, onChange }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '14px 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          marginBottom: '2px',
          cursor: 'pointer',
        }}
      >
        {label}
      </label>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
    <div style={{ flexShrink: 0, paddingTop: '2px' }}>
      <ToggleSwitch
        id={id}
        checked={checked}
        onChange={onChange}
        aria-label={label}
      />
    </div>
  </div>
);

interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const SectionCard: FC<SectionCardProps> = ({ title, subtitle, children }) => (
  <div
    style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      padding: '20px',
    }}
  >
    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: subtitle ? '4px' : '16px' }}>
      {title}
    </h3>
    {subtitle && (
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
        {subtitle}
      </p>
    )}
    <div>{children}</div>
  </div>
);

interface DeploymentFeaturesTabProps {
  config: DeploymentConfigWithAnnouncement;
  setConfig: (c: DeploymentConfigWithAnnouncement) => void;
  updateUnsavedConfigs: (type: AdminConfigTypes) => void;
  /** The full model catalog (Supported Models), including models users cannot chat with. */
  availableModels?: Record<string, RoutingModelCandidate>;
}

const ROUTING_MODEL_INFO =
  'The model that reads each message and decides whether web search, artifacts or code interpreter ' +
  'should be used. It runs on every eligible message, so a fast, inexpensive model works best; a slow ' +
  'one can exceed the 5-second limit, in which case no optional tools are added. The model does not ' +
  'need to be available for chat. Its usage is billed like any other model.';

export const DeploymentFeaturesTab: FC<DeploymentFeaturesTabProps> = ({
  config,
  setConfig,
  updateUnsavedConfigs,
  availableModels,
}) => {
  const setAvailability = (key: keyof DeploymentFeaturesConfig['availability'], value: boolean) => {
    setConfig({
      ...config,
      availability: { ...config.availability, [key]: value },
    });
    updateUnsavedConfigs(AdminConfigTypes.DEPLOYMENT_FEATURES);
  };

  const setTopLevel = <K extends 'allowClassicUiSwitch' | 'routingEnabled'>(
    key: K,
    value: boolean,
  ) => {
    setConfig({ ...config, [key]: value });
    updateUnsavedConfigs(AdminConfigTypes.DEPLOYMENT_FEATURES);
  };

  const setRoutingModel = (modelId: string) => {
    setConfig({ ...config, routingModelId: modelId });
    updateUnsavedConfigs(AdminConfigTypes.DEPLOYMENT_FEATURES);
  };

  const av = config.availability ?? {};
  const routingGroups = buildRoutingModelGroups(availableModels, config.routingModelId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Site-wide announcement banner */}
      <AnnouncementCard config={config} setConfig={setConfig} updateUnsavedConfigs={updateUnsavedConfigs} />

      {/* Feature Availability */}
      <SectionCard
        title="Feature Availability"
        subtitle={
          'Deployment-wide availability switches for optional features. ' +
          'Disabled features are unavailable to all users regardless of individual settings. ' +
          'Prompt Highlighter and Memory default to disabled; other features default to enabled.'
        }
      >
        <ToggleRow
          id="dep-feat-highlighter"
          label="Prompt Highlighter"
          description="Allow the prompt highlighter feature to be used in conversations."
          checked={av.promptHighlighter ?? false}
          onChange={(v) => setAvailability('promptHighlighter', v)}
        />
        <ToggleRow
          id="dep-feat-artifacts"
          label="Artifacts"
          description="Allow artifact generation (documents, reports, downloadable files) in conversations."
          checked={av.artifacts ?? true}
          onChange={(v) => setAvailability('artifacts', v)}
        />
        <ToggleRow
          id="dep-feat-websearch"
          label="Web Search"
          description="Allow live web search to be used during conversations."
          checked={av.webSearch ?? true}
          onChange={(v) => setAvailability('webSearch', v)}
        />
        <ToggleRow
          id="dep-feat-codeinterpreter"
          label="Code Interpreter"
          description="Allow the code interpreter (sandboxed Python execution) to be used in conversations."
          checked={av.codeInterpreter ?? true}
          onChange={(v) => setAvailability('codeInterpreter', v)}
        />
        <ToggleRow
          id="dep-feat-memory"
          label="Memory"
          description="Allow conversation memory to be used and persisted across sessions."
          checked={av.memory ?? false}
          onChange={(v) => setAvailability('memory', v)}
        />
      </SectionCard>

      {/* UI Controls */}
      <SectionCard
        title="UI Controls"
        subtitle="Controls that govern user interface behavior deployment-wide."
      >
        <ToggleRow
          id="dep-feat-classic-ui"
          label="Allow Classic UI Switch"
          description={
            'When enabled, users may switch back to the classic UI from Settings → Appearance. ' +
            'When disabled, the switch is hidden and any stored classic preference is overridden to the new UI on the server.'
          }
          checked={config.allowClassicUiSwitch ?? true}
          onChange={(v) => setTopLevel('allowClassicUiSwitch', v)}
        />
        <ToggleRow
          id="dep-feat-routing"
          label="Automatic Ordinary-Chat Routing"
          description="When enabled, the backend may select web search, artifacts, or code interpreter for eligible ordinary-chat requests. Missing values default to off."
          checked={config.routingEnabled ?? false}
          onChange={(v) => setTopLevel('routingEnabled', v)}
        />
        <div style={{ padding: '14px 0 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <label
              htmlFor="dep-feat-routing-model"
              style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}
            >
              Routing model
            </label>
            <InfoTooltip text={ROUTING_MODEL_INFO} ariaLabel="About the routing model" />
          </div>
          <SelectControl
            id="dep-feat-routing-model"
            value={routingModelSelectValue(config.routingModelId)}
            disabled={!(config.routingEnabled ?? false)}
            onChange={(e) => setRoutingModel(e.target.value)}
          >
            <option value="">Default ({DEFAULT_ROUTING_MODEL_NAME})</option>
            {routingGroups.map((group) => (
              <optgroup key={group.provider} label={group.provider}>
                {group.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectControl>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>
            Used only while automatic routing is on. If the chosen model is missing or fails, the default is used.
          </p>
        </div>
      </SectionCard>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        These are deployment-wide availability switches, not per-user feature flags. Users cannot
        override a feature that is disabled here. To manage per-user exceptions, use the Feature Flags
        tab.
      </p>
    </div>
  );
};
