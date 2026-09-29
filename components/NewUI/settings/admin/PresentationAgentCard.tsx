/**
 * PresentationAgentCard — admin settings for the AgentCore presentation agent
 * (Feature Data tab of NewAdminModal).
 *
 * The model settings are controlled by NewAdminModal and saved with the modal's
 * Save button as the `presentationAgent` admin config. Template layout analysis
 * is an immediate action against the presentation service.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { IconLoader2, IconRefresh } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { SupportedModel } from '@/types/admin';
import {
  TemplateAnalysisStatus,
  analyzePresentationTemplate,
  getTemplateAnalysisStatus,
} from '@/components/NewUI/shared/presentationApi';

export const PRESENTATION_AGENT_CONFIG_KEY = 'presentationAgent';

export interface PresentationAgentConfig {
  modelId: string;
  visionModelId: string;
  imageModelId: string;
  maxReviewPasses: number;
}

export const DEFAULT_PRESENTATION_AGENT_CONFIG: PresentationAgentConfig = {
  modelId: 'us.anthropic.claude-opus-5',
  visionModelId: '',
  imageModelId: '',
  maxReviewPasses: 2,
};

export function normalizePresentationAgentConfig(raw: any): PresentationAgentConfig {
  const passes = Number(raw?.maxReviewPasses);
  return {
    modelId: typeof raw?.modelId === 'string' && raw.modelId ? raw.modelId : DEFAULT_PRESENTATION_AGENT_CONFIG.modelId,
    visionModelId: typeof raw?.visionModelId === 'string' ? raw.visionModelId : '',
    imageModelId: typeof raw?.imageModelId === 'string' ? raw.imageModelId : '',
    maxReviewPasses: Number.isFinite(passes) ? Math.min(4, Math.max(0, Math.round(passes))) : 2,
  };
}

interface Props {
  config: PresentationAgentConfig;
  onChange: (next: PresentationAgentConfig) => void;
  models: SupportedModel[];
  templateNames: string[];
}

const selectCls =
  'w-full p-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100';

const STATUS_LABEL: Record<TemplateAnalysisStatus['status'], string> = {
  not_analyzed: 'Not analyzed',
  queued: 'Queued',
  running: 'Analyzing…',
  completed: 'Analyzed',
  failed: 'Failed',
};

export const PresentationAgentCard: React.FC<Props> = ({ config, onChange, models, templateNames }) => {
  const [statuses, setStatuses] = useState<Record<string, TemplateAnalysisStatus>>({});
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  // Planner/reviewer candidates: chat models only; reviewer must accept images.
  const chatModels = models.filter((m) => !m.id.includes('embedding') && !m.supportsImageGeneration);
  const visionModels = chatModels.filter((m) => m.supportsImages);
  const withCurrent = (list: SupportedModel[], id: string) =>
    id && !list.some((m) => m.id === id) ? [{ id, name: id } as SupportedModel, ...list] : list;

  const refreshStatuses = useCallback(async () => {
    setLoadingStatus(true);
    const result = await getTemplateAnalysisStatus();
    setLoadingStatus(false);
    if (result.success && result.data) {
      setStatuses(result.data);
      setStatusError(null);
    } else {
      setStatusError(result.message || 'The presentation agent service is not reachable.');
    }
  }, []);

  useEffect(() => {
    refreshStatuses();
  }, [refreshStatuses, templateNames.length]);

  const handleAnalyze = async (name: string) => {
    setPending((prev) => new Set(prev).add(name));
    const result = await analyzePresentationTemplate(name);
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
    if (result.success) {
      toast(`Analyzing ${name}. This takes about a minute.`);
      setStatuses((prev) => ({ ...prev, [name]: { status: 'queued' } }));
    } else {
      toast.error(result.message || `Could not analyze ${name}`);
    }
  };

  return (
    <div className="admin-style-settings-card">
      <div className="admin-style-settings-card-header nui-config-card-header">
        <h3 className="admin-style-settings-card-title nui-config-title">Presentation Agent</h3>
        <p className="admin-style-settings-card-description nui-config-description">
          Models and review depth for &ldquo;Export as PowerPoint&rdquo;, which builds decks on Amazon Bedrock AgentCore
          from the templates above. Users also need the <code>presentationAgent</code> feature flag.
        </p>
      </div>

      <div className="mx-12 pb-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <label className="text-sm">
          <span className="block mb-1 font-medium">Planning model</span>
          <select
            className={selectCls}
            value={config.modelId}
            onChange={(e) => onChange({ ...config, modelId: e.target.value })}
          >
            {withCurrent(chatModels, config.modelId).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 font-medium">Review model (vision)</span>
          <select
            className={selectCls}
            value={config.visionModelId}
            onChange={(e) => onChange({ ...config, visionModelId: e.target.value })}
          >
            <option value="">Same as planning model</option>
            {withCurrent(visionModels, config.visionModelId).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 font-medium">Review passes</span>
          <select
            className={selectCls}
            value={config.maxReviewPasses}
            onChange={(e) => onChange({ ...config, maxReviewPasses: Number(e.target.value) })}
          >
            <option value={0}>0 · fastest, no visual review</option>
            <option value={1}>1</option>
            <option value={2}>2 · recommended</option>
            <option value={3}>3</option>
            <option value={4}>4 · highest quality, slowest</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 font-medium">Image model</span>
          <input
            className={selectCls}
            value={config.imageModelId}
            placeholder="Disabled (e.g. amazon.nova-canvas-v1:0)"
            onChange={(e) => onChange({ ...config, imageModelId: e.target.value.trim() })}
          />
        </label>
      </div>

      <div className="mx-12 pb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Template layout analysis</span>
          <button
            type="button"
            className="text-sm inline-flex items-center gap-1 opacity-80 hover:opacity-100"
            onClick={refreshStatuses}
            aria-label="Refresh template analysis status"
          >
            {loadingStatus ? <IconLoader2 size={14} className="motion-safe:animate-spin" /> : <IconRefresh size={14} />}
            Refresh
          </button>
        </div>
        {statusError ? (
          <p className="text-sm opacity-70">{statusError}</p>
        ) : templateNames.length === 0 ? (
          <p className="text-sm opacity-70">Upload a PowerPoint template to enable presentations.</p>
        ) : (
          <table className="modern-table w-full" style={{ boxShadow: 'none' }}>
            <thead>
              <tr>
                <th className="text-left">Template</th>
                <th className="text-left">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {templateNames.map((name) => {
                const status = statuses[name]?.status ?? 'not_analyzed';
                const busy = pending.has(name) || status === 'queued' || status === 'running';
                return (
                  <tr key={name}>
                    <td>{name}</td>
                    <td title={statuses[name]?.message}>{STATUS_LABEL[status] ?? status}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="text-sm underline disabled:opacity-50 disabled:no-underline"
                        disabled={busy}
                        onClick={() => handleAnalyze(name)}
                      >
                        {status === 'not_analyzed' ? 'Analyze' : 'Re-analyze'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-xs opacity-60 mt-2">
          New uploads are analyzed automatically. Unanalyzed templates still work, using the built-in layout detection.
        </p>
      </div>
    </div>
  );
};

export default PresentationAgentCard;
