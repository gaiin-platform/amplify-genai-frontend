/**
 * accountCosts — per-account spend for Settings → Account → "Your Accounts".
 *
 * Source: `POST /billing/list-user-mtd-costs` (services/mtdCostService#getUserMtdCosts). Each
 * entry is `{ accountInfo: "<account>#<actor>", dailyCost, monthlyCost, totalCost }` where
 *   - `dailyCost`   is today's spend,
 *   - `monthlyCost` is spend from EARLIER days this month (the nightly job folds each day in,
 *                   and zeroes it on the 1st),
 *   - `totalCost`   = daily + monthly, i.e. MONTH-TO-DATE including today. It is NOT all-time.
 *
 * What the old UI got wrong, and this module fixes:
 *   The backend rewrites `accountInfo` for API-key spend (`processAccountInfo` in billing/mtd.js)
 *   to `"<account> (<application name>)#<api_owner_id>"` (or `"<purpose>_account (...)#…"`).
 *   The old `split('#')[0] === account.id` match therefore never attributed key spend to its
 *   account, and its "unique API keys" test (`startsWith('amp-')`) never passed because the part
 *   after `#` is now an `api_owner_id`.
 *
 * Attribution, per entry, first match wins:
 *   1. the account part IS an account id            ("COA-1#NA")
 *   2. the account part is an id plus the app name   ("COA-1 (My app)#user/ownerKey/…")
 *   3. the actor is one of the user's own keys       (purpose-renamed entries lose the account
 *      text, so the key's current account is the best remaining evidence)
 * Text is tried before the key map on purpose: it records the account that was actually billed,
 * even if the key was moved to another account since.
 *
 * `exact` keeps the OLD matching (rule 1 only). The rate-limit banner uses it: the backend checks
 * an account's limit against the cost record for that exact `account#actor`, not against spend
 * summed across keys.
 *
 * No React imports.
 */

export interface CostEntry {
  accountInfo: string;
  dailyCost: number;
  monthlyCost: number;
  totalCost: number;
}

export interface CostTriple {
  dailyCost: number;
  monthlyCost: number;
  /** daily + monthly: month-to-date, including today. */
  totalCost: number;
}

export interface AccountCost {
  /** Everything attributed to the account, API keys included. */
  total: CostTriple;
  /** Only entries whose account part equals the account id (the old UI's match). */
  exact: CostTriple;
  /** Distinct API keys (by api_owner_id) whose spend is included in `total`. */
  keyCount: number;
}

/** api_owner_id → the account id the key currently belongs to. */
export type KeyAccountMap = Record<string, string>;

const zero = (): CostTriple => ({ dailyCost: 0, monthlyCost: 0, totalCost: 0 });

const add = (into: CostTriple, e: CostEntry) => {
  into.dailyCost += Number(e.dailyCost) || 0;
  into.monthlyCost += Number(e.monthlyCost) || 0;
  into.totalCost += Number(e.totalCost) || 0;
};

/** `"<account>#<actor>"` → parts. The actor is null for none / `NA`. Mirrors the backend's split('#'). */
export const splitAccountInfo = (info: unknown): { account: string; actor: string | null } => {
  const [account = '', actor] = String(info ?? '').split('#');
  return { account, actor: actor && actor !== 'NA' ? actor : null };
};

/** Which known account (if any) does this account text belong to? Longest id wins. */
const matchAccountText = (text: string, accountIds: string[]): { id: string; exact: boolean } | null => {
  let best: { id: string; exact: boolean } | null = null;
  for (const id of accountIds) {
    if (!id) continue;
    const exact = text === id;
    if (!exact && !(text.startsWith(`${id} (`) && text.endsWith(')'))) continue;
    if (!best || id.length > best.id.length) best = { id, exact };
  }
  return best;
};

/** Build `api_owner_id → account id` from the user's keys (delegated keys have no account and are skipped). */
export const buildKeyAccountMap = (
  keys: ReadonlyArray<{ api_owner_id?: string; account?: { id?: string } | null }> | null | undefined,
): KeyAccountMap => {
  const map: KeyAccountMap = {};
  for (const k of keys ?? []) {
    if (k?.api_owner_id && k.account?.id) map[k.api_owner_id] = k.account.id;
  }
  return map;
};

/** Spend for every account id (accounts with no spend get zeros, so $0.00 can be shown). */
export function attributeAccountCosts(
  entries: ReadonlyArray<CostEntry> | null | undefined,
  accountIds: string[],
  keyAccounts: KeyAccountMap = {},
): Map<string, AccountCost> {
  const result = new Map<string, AccountCost>();
  const keysSeen = new Map<string, Set<string>>();
  for (const id of accountIds) {
    result.set(id, { total: zero(), exact: zero(), keyCount: 0 });
    keysSeen.set(id, new Set());
  }

  for (const entry of entries ?? []) {
    const { account, actor } = splitAccountInfo(entry.accountInfo);

    let target: string | null = null;
    let isExact = false;
    const byText = matchAccountText(account, accountIds);
    if (byText) {
      target = byText.id;
      isExact = byText.exact;
    } else if (actor && keyAccounts[actor] && result.has(keyAccounts[actor])) {
      target = keyAccounts[actor];
    }
    if (!target) continue;

    const cost = result.get(target)!;
    add(cost.total, entry);
    if (isExact) add(cost.exact, entry);
    // Count keys whether the entry matched by text or by the key map; "legacy_" ids are unresolved keys.
    if (actor) keysSeen.get(target)!.add(actor);
  }

  keysSeen.forEach((set, id) => {
    result.get(id)!.keyCount = set.size;
  });
  return result;
}

/** Hover text for an account's cost figure. */
export const describeAccountCost = (cost: AccountCost | undefined, accountId: string): string => {
  const base = 'Month to date, including today.';
  if (!cost || accountId === 'general_account' || cost.keyCount === 0) return base;
  return `${base} Includes ${cost.keyCount} API key${cost.keyCount === 1 ? '' : 's'}.`;
};
