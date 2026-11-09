import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// next/image needs the Next runtime; the logo only matters as an <img>.
vi.mock('next/image', () => ({
  default: (props: any) => React.createElement('img', { src: props.src, alt: props.alt, 'data-testid': 'brand-icon' }),
}));
vi.mock('@/components/Home/home.context', () => ({
  default: React.createContext({ state: { selectedArtifacts: null } }),
}));

import { ChatStatusIndicator } from '@/components/NewUI/chat/ChatStatusIndicator';
import { ThinkingRow } from '@/components/NewUI/chat/ToolStepViews';
import { ChatLoader } from '@/components/Chat/ChatLoader';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('ChatStatusIndicator', () => {
  it('renders the logo mark and the label, tagged with its source', () => {
    const out = html(<ChatStatusIndicator label="Sending…" source="sending" />);
    expect(out).toContain('Sending…');
    expect(out).toContain('data-source="sending"');
    expect(out).toContain('data-nui-status');
    expect(out).toContain('data-testid="brand-icon"');
    expect(out).toMatch(/nui-status-mark" aria-hidden="true"/); // decorative
  });

  it('is not a live region of its own (callers already announce, twice would be noisy)', () => {
    const out = html(<ChatStatusIndicator label="Thinking…" source="status" />);
    expect(out).not.toContain('aria-live');
    expect(out).not.toContain('role=');
  });

  it('starts its animations mid-cycle through negative delays, so a swapped-in node does not restart', () => {
    const out = html(<ChatStatusIndicator label="Thinking…" source="awaiting" />);
    expect(out).toMatch(/--nui-status-pulse-delay:\s*-?\d+ms/);
    expect(out).toMatch(/--nui-status-shimmer-delay:\s*-?\d+ms/);
    const pulse = Number(/--nui-status-pulse-delay:\s*(-?\d+)ms/.exec(out)![1]);
    expect(pulse).toBeLessThanOrEqual(0);
    expect(pulse).toBeGreaterThan(-1400);
  });

  it('can be shown static (no pulse / shimmer) when inactive', () => {
    expect(html(<ChatStatusIndicator label="Thinking…" source="thinking" active={false} />)).toContain(
      'data-active="false"',
    );
    expect(html(<ChatStatusIndicator label="Thinking…" source="thinking" />)).toContain('data-active="true"');
  });
});

describe('the sources share the one indicator', () => {
  it('ThinkingRow uses it (and no longer draws its own dot)', () => {
    const out = html(<ThinkingRow active />);
    expect(out).toContain('data-source="thinking"');
    expect(out).toContain('Thinking…');
    expect(out).not.toContain('nui-thinking-dot');
  });

  it('ChatLoader uses it for "Sending…" (and no longer draws the ▍ cursor)', () => {
    const out = html(<ChatLoader />);
    expect(out).toContain('data-source="sending"');
    expect(out).toContain('Sending…');
    expect(out).not.toContain('▍');
  });
});
