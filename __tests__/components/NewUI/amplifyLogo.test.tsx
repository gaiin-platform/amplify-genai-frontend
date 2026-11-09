import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmplifyLogo } from '@/components/NewUI/shared/AmplifyLogo';

const render = () => renderToStaticMarkup(<AmplifyLogo size={24} radius={4} />);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AmplifyLogo white labeling', () => {
  it('renders the stock Amplify mark when nothing is configured', () => {
    const html = render();
    expect(html).toContain('src="/amplify-logo.png"');
    expect(html).toContain('alt="Amplify"');
  });

  it('renders the configured custom logo with the brand name as alt text', () => {
    vi.stubEnv('NEXT_PUBLIC_CUSTOM_LOGO', 'acme-mark.svg');
    vi.stubEnv('NEXT_PUBLIC_BRAND_NAME', 'Acme AI');
    const html = render();
    expect(html).toContain('src="/logos/acme-mark.svg"');
    expect(html).toContain('alt="Acme AI"');
    expect(html).not.toContain('/amplify-logo.png');
  });

  it('scales a non-square logo to fit instead of stretching it', () => {
    vi.stubEnv('NEXT_PUBLIC_CUSTOM_LOGO', 'wide.svg');
    expect(render()).toContain('object-fit:contain');
  });

  it('ignores an unsafe logo value and shows the stock mark', () => {
    vi.stubEnv('NEXT_PUBLIC_CUSTOM_LOGO', '../../etc/passwd');
    expect(render()).toContain('src="/amplify-logo.png"');
  });
});
