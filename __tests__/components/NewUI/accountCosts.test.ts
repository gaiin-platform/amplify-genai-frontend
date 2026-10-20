/**
 * Per-account spend for Settings → Account. Entry shapes are the ones the backend really
 * returns (billing/mtd.js#processAccountInfo): `<account>#NA`, and for API keys
 * `<account> (<application name>)#<api_owner_id>` or `<purpose>_account (...)#<api_owner_id>`.
 */

import { describe, it, expect } from 'vitest';
import {
  attributeAccountCosts,
  buildKeyAccountMap,
  describeAccountCost,
  splitAccountInfo,
} from '@/components/NewUI/settings/accountCosts';

const e = (accountInfo: string, daily: number, monthly: number) => ({
  accountInfo,
  dailyCost: daily,
  monthlyCost: monthly,
  totalCost: daily + monthly,
});

const KEY1 = 'me@x.edu/ownerKey/aaa';
const KEY2 = 'me@x.edu/ownerKey/bbb';

describe('splitAccountInfo', () => {
  it('splits like the backend and treats NA / missing as no actor', () => {
    expect(splitAccountInfo('COA-1#NA')).toEqual({ account: 'COA-1', actor: null });
    expect(splitAccountInfo('COA-1')).toEqual({ account: 'COA-1', actor: null });
    expect(splitAccountInfo(`COA-1 (App)#${KEY1}`)).toEqual({ account: 'COA-1 (App)', actor: KEY1 });
    expect(splitAccountInfo(undefined)).toEqual({ account: '', actor: null });
  });
});

describe('attributeAccountCosts', () => {
  const ids = ['COA-1', 'COA-2'];

  it('totalCost is month-to-date: today + earlier days (not "all time")', () => {
    const r = attributeAccountCosts([e('COA-1#NA', 0.004, 2.1)], ids);
    expect(r.get('COA-1')!.total.totalCost).toBeCloseTo(2.104, 6);
    expect(r.get('COA-1')!.total.dailyCost).toBeCloseTo(0.004, 6);
  });

  it('attributes API-key spend to its account even though the account text carries the app name', () => {
    const r = attributeAccountCosts(
      [e('COA-1#NA', 0, 1), e(`COA-1 (Nightly job)#${KEY1}`, 0.5, 2)],
      ids,
    );
    const c = r.get('COA-1')!;
    expect(c.total.totalCost).toBeCloseTo(3.5, 6);
    expect(c.keyCount).toBe(1);
    // the old UI's exact match only ever saw the #NA entry
    expect(c.exact.totalCost).toBeCloseTo(1, 6);
  });

  it('counts distinct keys by api_owner_id, once each', () => {
    const r = attributeAccountCosts(
      [e(`COA-1 (A)#${KEY1}`, 0, 1), e(`COA-1 (A)#${KEY1}`, 1, 0), e(`COA-1 (B)#${KEY2}`, 0, 1)],
      ids,
    );
    expect(r.get('COA-1')!.keyCount).toBe(2);
    expect(r.get('COA-1')!.total.totalCost).toBeCloseTo(3, 6);
  });

  it('uses the key map for purpose-renamed entries that lost the account text', () => {
    const entries = [e(`agents_account (Bot)#${KEY2}`, 0, 4)];
    const without = attributeAccountCosts(entries, ids);
    expect(without.get('COA-2')!.total.totalCost).toBe(0);
    const withMap = attributeAccountCosts(entries, ids, { [KEY2]: 'COA-2' });
    expect(withMap.get('COA-2')!.total.totalCost).toBe(4);
    expect(withMap.get('COA-2')!.keyCount).toBe(1);
  });

  it('trusts the billed account text over the key\'s CURRENT account (a key can be moved)', () => {
    const r = attributeAccountCosts([e(`COA-1 (App)#${KEY1}`, 0, 5)], ids, { [KEY1]: 'COA-2' });
    expect(r.get('COA-1')!.total.totalCost).toBe(5);
    expect(r.get('COA-2')!.total.totalCost).toBe(0);
  });

  it('never double counts an entry, and ignores spend it cannot attribute', () => {
    const r = attributeAccountCosts(
      [e('COA-1#NA', 0, 1), e('SOMEONE-ELSE#NA', 0, 9), e(`unknown_account (X)#legacy_amp-123`, 0, 9)],
      ids,
      { [KEY1]: 'COA-1' },
    );
    expect(r.get('COA-1')!.total.totalCost).toBe(1);
    expect(r.get('COA-2')!.total.totalCost).toBe(0);
  });

  it('does not confuse an id that is a prefix of another', () => {
    const r = attributeAccountCosts([e('COA-10#NA', 0, 7)], ['COA-1', 'COA-10']);
    expect(r.get('COA-1')!.total.totalCost).toBe(0);
    expect(r.get('COA-10')!.total.totalCost).toBe(7);
  });

  it('gives accounts with no spend zeros (so $0.00 can be shown) and tolerates no data', () => {
    expect(attributeAccountCosts([], ids).get('COA-2')).toMatchObject({ keyCount: 0, total: { totalCost: 0 } });
    expect(attributeAccountCosts(undefined, ids).get('COA-1')!.total.totalCost).toBe(0);
  });
});

describe('buildKeyAccountMap', () => {
  it('maps keys to their account and skips delegated keys (no account)', () => {
    expect(
      buildKeyAccountMap([
        { api_owner_id: KEY1, account: { id: 'COA-1' } },
        { api_owner_id: KEY2, account: null },
        { account: { id: 'COA-1' } },
      ]),
    ).toEqual({ [KEY1]: 'COA-1' });
    expect(buildKeyAccountMap(null)).toEqual({});
  });
});

describe('describeAccountCost', () => {
  it('explains the figure and mentions keys only when there are some', () => {
    const r = attributeAccountCosts([e(`COA-1 (A)#${KEY1}`, 0, 1)], ['COA-1']);
    expect(describeAccountCost(r.get('COA-1'), 'COA-1')).toBe('Month to date, including today. Includes 1 API key.');
    const none = attributeAccountCosts([], ['COA-1']);
    expect(describeAccountCost(none.get('COA-1'), 'COA-1')).toBe('Month to date, including today.');
    expect(describeAccountCost(r.get('COA-1'), 'general_account')).toBe('Month to date, including today.');
  });
});
