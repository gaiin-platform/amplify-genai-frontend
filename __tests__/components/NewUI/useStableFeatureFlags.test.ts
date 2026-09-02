/**
 * Tests for the feature-flag resolution rule behind useStableFeatureFlags (UI-003).
 *
 * The bug this guards: state.featureFlags is `{}` from mount until /feature_flags
 * resolves — and stays `{}` for the whole session if that request fails — which made
 * the flag-gated sidebar rows (Workflows, Scheduled Tasks, Notebook) intermittently
 * vanish along with their preference toggles.
 */
import { describe, it, expect } from 'vitest';
import { resolveFeatureFlags } from '@/components/NewUI/shared/useStableFeatureFlags';

const cached = { createAssistantWorkflows: true, scheduledTasks: true, notebook: true };

describe('resolveFeatureFlags', () => {
    it('falls back to the cached set while the fetch is still in flight', () => {
        expect(resolveFeatureFlags({}, cached)).toEqual(cached);
    });

    it('falls back to the cached set when the fetch never lands (undefined/null state)', () => {
        expect(resolveFeatureFlags(undefined, cached)).toEqual(cached);
        expect(resolveFeatureFlags(null, cached)).toEqual(cached);
    });

    it('prefers server flags once they arrive, so an admin turning a flag off is honoured', () => {
        const server = { createAssistantWorkflows: false, scheduledTasks: true, notebook: true };
        expect(resolveFeatureFlags(server, cached)).toEqual(server);
    });

    it('does not merge — a flag dropped from the server response is not resurrected from cache', () => {
        const server = { scheduledTasks: true };
        expect(resolveFeatureFlags(server, cached)).toEqual(server);
        expect(resolveFeatureFlags(server, cached).createAssistantWorkflows).toBeUndefined();
    });

    it('is empty on a genuine first visit with nothing cached', () => {
        expect(resolveFeatureFlags({}, {})).toEqual({});
    });
});
