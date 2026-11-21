// @vitest-environment jsdom
import React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import HomeContext, {
  type HomeContextProps,
} from '@/components/Home/home.context';
import { initialState } from '@/components/Home/home.state';
import { NewLogin } from '@/components/NewUI/home/NewLogin';
import { ApiKeysIntro } from '@/components/NewUI/settings/apiKeys/ApiKeysIntro';
import { AccountMenu } from '@/components/NewUI/sidebar/AccountMenu';
import { AmplifyHelperAssistant } from '@/components/NewUI/views/AmplifyHelperAssistant';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('NEXT_PUBLIC_BRAND_NAME', '');
  vi.stubEnv('NEXT_PUBLIC_ORGANIZATION_NAME', '');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function render(content: React.ReactNode, userDocumentationUrl = '') {
  const context = {
    state: { ...initialState, userDocumentationUrl },
    dispatch: vi.fn(),
  } as HomeContextProps;
  act(() =>
    root.render(
      <HomeContext.Provider value={context}>{content}</HomeContext.Provider>,
    ),
  );
}

const hrefs = () =>
  Array.from(host.querySelectorAll('a'), (link) => link.getAttribute('href'));
const docsUrl = 'https://docs.example.com/help';
const supportEmail = 'help@example.com';

describe('deployment branding', () => {
  it('adds and clears the Account menu link as admin configuration changes in place', () => {
    render(<AccountMenu />);
    act(() =>
      host
        .querySelector<HTMLButtonElement>('[aria-controls="account-menu"]')!
        .click(),
    );
    expect(host.querySelector('#account-menu')).toBeTruthy();
    expect(hrefs()).toEqual([]);

    render(<AccountMenu />, docsUrl);
    const link = host.querySelector('a[role="menuitem"]');
    expect(link?.textContent?.trim()).toBe('Documentation');
    expect(link?.getAttribute('href')).toBe(docsUrl);
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');

    render(<AccountMenu />, '');
    expect(hrefs()).toEqual([]);
    render(<AccountMenu />, 'https://user:password@docs.example.com');
    expect(hrefs()).toEqual([]);
  });

  it('uses neutral login copy', () => {
    render(<NewLogin />);
    expect(host.textContent).toContain('Welcome to Amplify');
    expect(host.textContent).toContain('Log in to your account.');
    expect(host.querySelector('#loginButton')?.textContent?.trim()).toBe(
      'Log in',
    );
  });

  it('shows only the configured resources and support in the Helper', () => {
    render(<AmplifyHelperAssistant onStartChat={vi.fn()} />);
    expect(host.textContent).toContain('Guide for all Amplify users');
    expect(host.textContent).not.toMatch(/Vanderbilt|Data classification/i);
    expect(hrefs()).toEqual([]);

    vi.stubEnv('NEXT_PUBLIC_BRAND_NAME', 'Acme AI');
    vi.stubEnv('NEXT_PUBLIC_ORGANIZATION_NAME', 'Acme');
    render(
      <AmplifyHelperAssistant
        onStartChat={vi.fn()}
        documentationUrl={docsUrl}
        supportEmail={supportEmail}
      />,
    );
    expect(host.textContent).toContain('Guide for all Acme AI users');
    expect(host.textContent).toContain('using Acme AI at Acme');
    expect(hrefs()).toEqual([docsUrl, 'mailto:help@example.com']);

    render(
      <AmplifyHelperAssistant
        onStartChat={vi.fn()}
        documentationUrl="http://docs.example.com"
      />,
    );
    expect(hrefs()).toEqual([]);
  });

  it('shows Documentation in API Access only for a valid configured link', () => {
    const intro = (documentationUrl?: string) => (
      <ApiKeysIntro
        hasBillingAccount
        onOpenAccountSettings={vi.fn()}
        documentationUrl={documentationUrl}
      />
    );
    render(intro());
    expect(hrefs()).toEqual([]);
    render(intro('https:///docs.example.com'));
    expect(hrefs()).toEqual([]);
    render(intro(docsUrl));
    expect(hrefs()).toEqual([docsUrl]);
    expect(host.querySelector('a')?.textContent?.trim()).toBe('Documentation');
  });
});
