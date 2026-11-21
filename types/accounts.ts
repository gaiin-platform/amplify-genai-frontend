import { RateLimit, noRateLimit } from './rateLimit';

export interface Account {
  id: string;
  name: string;
  isDefault?: boolean;
  rateLimit: RateLimit;
}

export const noCoaAccount: Account = {
  id: 'general_account',
  name: 'No COA On File',
  rateLimit: noRateLimit,
};

type StoredAccount = Omit<Account, 'rateLimit'> & {
  rateLimit?: RateLimit | null;
};

export function getDefaultAccount(accounts: readonly Account[]): Account {
  return (
    accounts.find((account) => account.isDefault) ??
    accounts.find((account) => account.id === noCoaAccount.id) ??
    noCoaAccount
  );
}

export function normalizeAccounts(
  accounts: readonly StoredAccount[],
  defaultId?: string,
): Account[] {
  const withGeneral = accounts.some((account) => account.id === noCoaAccount.id)
    ? accounts
    : [noCoaAccount, ...accounts];
  const selectedIndex = withGeneral.findIndex((account) =>
    defaultId === undefined ? account.isDefault : account.id === defaultId,
  );
  const defaultIndex =
    selectedIndex >= 0
      ? selectedIndex
      : withGeneral.findIndex((account) => account.id === noCoaAccount.id);

  return withGeneral.map((account, index) => ({
    ...account,
    isDefault: index === defaultIndex,
    rateLimit: account.rateLimit ?? { ...noRateLimit },
  }));
}
