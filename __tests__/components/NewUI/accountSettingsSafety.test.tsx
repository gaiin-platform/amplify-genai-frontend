// @vitest-environment jsdom
import React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { noCoaAccount } from '@/types/accounts';
import { noRateLimit } from '@/types/rateLimit';

import HomeContext, {
  type HomeContextProps,
} from '@/components/Home/home.context';
import { NewAccountSection } from '@/components/NewUI/settings/NewAccountSection';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/services/doRequestOp', () => ({ doRequestOp: request }));
vi.mock('@/services/adminService', () => ({
  getAdminConfigs: vi.fn().mockResolvedValue({ success: false }),
}));
vi.mock('@/services/apiKeysService', () => ({ fetchAllApiKeys: vi.fn() }));
vi.mock('@/services/mtdCostService', () => ({ getUserMtdCosts: vi.fn() }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null }) }));

let host: HTMLDivElement;
let root: Root;
const dispatch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  request.mockReset();
  dispatch.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const render = async () => {
  await act(async () => {
    root.render(
      <HomeContext.Provider value={{ dispatch } as unknown as HomeContextProps}>
        <NewAccountSection />
      </HomeContext.Provider>,
    );
  });
};

const getSelect = () =>
  host.querySelector<HTMLSelectElement>('#accountSelect')!;
const save = async () => {
  await act(async () => {
    window.dispatchEvent(new Event('settingsSave'));
  });
};

function selectDefault(id: string) {
  act(() => {
    const select = getSelect();
    select.value = id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function deleteAccount(id: string) {
  const idText = [...host.querySelectorAll('div')].find(
    (el) => el.textContent === id,
  )!;
  const row = idText.parentElement!.parentElement!;
  act(() => row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  act(() =>
    row
      .querySelector<HTMLButtonElement>('button[title="Delete account"]')!
      .click(),
  );
}

const saveRequest = () =>
  request.mock.calls.filter(([op]) => op.op === '/save');

describe('Account settings', () => {
  it('keeps editing and saving unavailable after a failed read and enables them after retry', async () => {
    request
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true, version: null, data: [] });
    await render();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to load billing accounts',
    );
    expect(host.querySelectorAll('input, select')).toHaveLength(0);
    expect(host.textContent).not.toContain('Save Changes');
    await save();
    expect(saveRequest()).toHaveLength(0);

    await act(async () =>
      host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click(),
    );
    expect(getSelect().value).toBe(noCoaAccount.id);
    expect([...getSelect().options].map((option) => option.value)).toEqual([
      noCoaAccount.id,
    ]);
    expect(host.textContent).toContain('Add Account');
  });

  it('deletes only the selected duplicate-name row and falls back to one default', async () => {
    request
      .mockResolvedValueOnce({
        success: true,
        version: 'loaded',
        data: [
          { id: 'coa-one', name: 'Research', isDefault: true },
          { id: 'coa-two', name: 'Research' },
        ],
      })
      .mockResolvedValueOnce({ success: true, version: 'saved' });
    await render();
    expect(getSelect().value).toBe('coa-one');

    deleteAccount('coa-one');
    expect(getSelect().value).toBe(noCoaAccount.id);
    expect([...getSelect().options].map((option) => option.value)).toEqual([
      noCoaAccount.id,
      'coa-two',
    ]);
    await save();
    const [{ data }] = saveRequest()[0];
    expect(data.expectedVersion).toBe('loaded');
    expect(
      data.accounts.filter(
        ({ isDefault }: { isDefault: boolean }) => isDefault,
      ),
    ).toEqual([{ ...noCoaAccount, isDefault: true }]);
    expect(data.accounts[1]).toEqual({
      id: 'coa-two',
      name: 'Research',
      isDefault: false,
      rateLimit: noRateLimit,
    });
  });

  it('allows explicitly deleting the last billing account and keeps the General account', async () => {
    request
      .mockResolvedValueOnce({
        success: true,
        version: null,
        data: [{ id: 'coa-one', name: 'Research' }],
      })
      .mockResolvedValueOnce({ success: true, version: 'saved' });
    await render();

    deleteAccount('coa-one');
    await save();

    expect(saveRequest()[0][0].data).toEqual({
      expectedVersion: null,
      accounts: [{ ...noCoaAccount, isDefault: true }],
    });
  });

  it('saves a missing legacy rate limit and reuses the version returned by the save', async () => {
    request
      .mockResolvedValueOnce({
        success: true,
        version: 'loaded',
        data: [{ id: 'legacy', name: 'Legacy' }],
      })
      .mockResolvedValueOnce({ success: true, version: 'saved' })
      .mockResolvedValueOnce({ success: true, version: 'saved-again' });
    await render();

    selectDefault('legacy');
    await save();
    selectDefault(noCoaAccount.id);
    await save();

    const [first, second] = saveRequest().map(([op]) => op.data);
    expect(first.expectedVersion).toBe('loaded');
    expect(first.accounts[1]).toEqual({
      id: 'legacy',
      name: 'Legacy',
      isDefault: true,
      rateLimit: noRateLimit,
    });
    expect(second.expectedVersion).toBe('saved');
  });

  it('allows another account with the same display name and a different identifier', async () => {
    request
      .mockResolvedValueOnce({
        success: true,
        version: 'loaded',
        data: [{ id: 'one', name: 'Research' }],
      })
      .mockResolvedValueOnce({ success: true, version: 'saved' });
    await render();

    const name = host.querySelector<HTMLInputElement>(
      '[placeholder="Enter account name"]',
    )!;
    const id = host.querySelector<HTMLInputElement>(
      '[placeholder="Enter COA string"]',
    )!;
    const add = [...host.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Add Account',
    )!;
    act(() => {
      name.value = 'Research';
      id.value = 'two';
      add.click();
    });
    await save();

    expect(
      saveRequest()[0][0].data.accounts.map(({ id }: { id: string }) => id),
    ).toEqual([noCoaAccount.id, 'one', 'two']);
  });

  it('shows the conflicting save message and keeps the changes dirty', async () => {
    const message =
      'Billing accounts changed since they were loaded. Reload Accounts and try again.';
    request
      .mockResolvedValueOnce({
        success: true,
        version: 'loaded',
        data: [{ id: 'one', name: 'One' }],
      })
      .mockResolvedValueOnce({
        success: false,
        code: 'ACCOUNTS_CHANGED',
        message,
      });
    await render();
    selectDefault('one');
    await save();

    expect(host.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(getSelect().value).toBe('one');
    expect(dispatch).not.toHaveBeenCalled();
    const saveButton = [...host.querySelectorAll('button')].find(
      (el) => el.textContent === 'Save Changes',
    );
    expect(saveButton?.disabled).toBe(false);
  });
});
