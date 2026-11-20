import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SeasonalControls } from '@/components/NewUI/home/SeasonalControls';
import { HALLOWEEN_CONTROLS, THANKSGIVING_CONTROLS } from '@/components/NewUI/home/seasonalControlsConfig';
import { isAnimationReady } from '@/components/NewUI/home/thanksgivingLottie';

const store = new Map<string, string>();

describe('seasonal controls config', () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    vi.stubGlobal('window', { dispatchEvent: () => true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the two holidays fully separate', () => {
    expect(HALLOWEEN_CONTROLS.idPrefix).not.toBe(THANKSGIVING_CONTROLS.idPrefix);
    expect(HALLOWEEN_CONTROLS.changedEvent).not.toBe(THANKSGIVING_CONTROLS.changedEvent);
  });

  it('maps "send" to each holiday\'s own transition without touching the other', () => {
    THANKSGIVING_CONTROLS.setEnabled('send', false);
    expect(THANKSGIVING_CONTROLS.getEnabled('send')).toBe(false);
    expect(THANKSGIVING_CONTROLS.getEnabled('theme')).toBe(true);
    expect(HALLOWEEN_CONTROLS.getEnabled('send')).toBe(true);

    HALLOWEEN_CONTROLS.setEnabled('theme', false);
    expect(HALLOWEEN_CONTROLS.getEnabled('theme')).toBe(false);
    expect(THANKSGIVING_CONTROLS.getEnabled('theme')).toBe(true);
  });

  it('renders the pill with the holiday title and icon', () => {
    const html = renderToStaticMarkup(<SeasonalControls config={THANKSGIVING_CONTROLS} />);
    expect(html).toContain('Thanksgiving effects');
    expect(html).toContain('🦃');
    expect(html).not.toContain('Halloween');
  });
});

describe('thanksgivingLottie readiness', () => {
  it('reports not ready before any animation has been mounted', () => {
    expect(isAnimationReady('falling-leaves')).toBe(false);
    expect(isAnimationReady('turkey-walking')).toBe(false);
  });
});
