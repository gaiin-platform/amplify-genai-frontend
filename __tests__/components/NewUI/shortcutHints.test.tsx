// @vitest-environment jsdom
import React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import HomeContext, {
  type HomeContextProps,
} from '@/components/Home/home.context';
import { initialState } from '@/components/Home/home.state';
import { NewHome } from '@/components/NewUI/home/NewHome';
import { AccountMenu } from '@/components/NewUI/sidebar/AccountMenu';
import { SidebarHeader } from '@/components/NewUI/sidebar/SidebarHeader';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(content: React.ReactNode) {
  const context = {
    state: {
      ...initialState,
      featureFlags: { uploadDocuments: true },
    },
    dispatch: vi.fn(),
  } as HomeContextProps;

  act(() =>
    root.render(
      <HomeContext.Provider value={context}>{content}</HomeContext.Provider>,
    ),
  );
}

describe('New UI shortcut hints', () => {
  it('opens Settings from the account menu with a plain Settings label', () => {
    const onOpenSettings = vi.fn();
    render(<AccountMenu onOpenSettings={onOpenSettings} />);

    act(() =>
      host
        .querySelector<HTMLButtonElement>('[aria-controls="account-menu"]')!
        .click(),
    );
    const settings = host.querySelector<HTMLButtonElement>(
      '#account-menu [role="menuitem"]',
    )!;
    expect(settings.textContent?.trim()).toBe('Settings');

    act(() => settings.click());
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('keeps Search clickable with a plain tooltip', () => {
    const onSearch = vi.fn();
    render(<SidebarHeader onCollapse={vi.fn()} onSearch={onSearch} />);

    const search = host.querySelector<HTMLButtonElement>(
      '[aria-label="Search conversations"]',
    )!;
    expect(search.title).toBe('Search');
    search.click();
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('leaves Command+U to the browser', () => {
    render(<NewHome />);
    const picker = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    const openFilePicker = vi
      .spyOn(picker, 'click')
      .mockImplementation(() => {});
    const keydown = new KeyboardEvent('keydown', {
      key: 'u',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    act(() => document.dispatchEvent(keydown));
    expect(keydown.defaultPrevented).toBe(false);
    expect(openFilePicker).not.toHaveBeenCalled();
  });

  it('opens the file picker from Add files or photos with a plain menu label', async () => {
    render(<NewHome />);
    const picker = host.querySelector<HTMLInputElement>('input[type=file]')!;
    const openFilePicker = vi
      .spyOn(picker, 'click')
      .mockImplementation(() => {});

    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('button[aria-label="Add to chat"]')!
        .click(),
    );
    const addFiles = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.includes('Add files or photos'));
    expect(addFiles?.textContent?.trim()).toBe('Add files or photos');

    act(() => addFiles!.click());
    expect(openFilePicker).toHaveBeenCalledOnce();
  });
});
