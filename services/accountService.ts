import { Account, normalizeAccounts } from '@/types/accounts';

import { doRequestOp } from './doRequestOp';

const URL_PATH = '/state/accounts';
const SERVICE_NAME = 'accounts';

export type AccountsVersion = string | null;

type AccountsFailure = { success: false; message?: string; code?: string };
type AccountsResult =
  | AccountsFailure
  | {
      success: true;
      data: Account[];
      version?: AccountsVersion;
    };
type SaveAccountsResult =
  | AccountsFailure
  | { success: true; version?: AccountsVersion };

export const saveAccounts = async (
  accounts: Account[],
  expectedVersion?: AccountsVersion,
): Promise<SaveAccountsResult> => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: '/save',
    data: {
      accounts,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    },
    service: SERVICE_NAME,
  };
  return await doRequestOp(op);
};

export const getAccounts = async (): Promise<AccountsResult> => {
  const op = {
    method: 'GET',
    path: URL_PATH,
    op: '/get',
    service: SERVICE_NAME,
  };
  const result = await doRequestOp(op);
  if (!result?.success || !Array.isArray(result.data)) {
    return {
      success: false,
      message: result?.message || 'Unable to load billing accounts.',
    };
  }
  return { ...result, data: normalizeAccounts(result.data) };
};
