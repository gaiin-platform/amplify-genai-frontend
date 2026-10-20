/**
 * apiKeyActions — the request/response handling behind a card's Save and Rotate, kept out of
 * the component so it can be tested with fake services.
 *
 * Payloads are exactly what the legacy list sent (`updateApiKeys([{ apiKeyId, updates }])`,
 * `rotateApiKey(id)`); only the trigger changed (the legacy list waited for a `settingsSave`
 * event the New UI never fires).
 *
 * No React imports.
 */

import type { ApiKey } from '@/types/apikeys';
import { rotateApiKey, updateApiKeys } from '@/services/apiKeysService';
import { ApiKeyUpdates } from './apiKeyModel';

export interface KeyUpdatePayload {
  apiKeyId: string;
  updates: ApiKeyUpdates;
}

export type SaveOutcome =
  | { ok: true; payload: KeyUpdatePayload[]; key: ApiKey }
  | { ok: false; message: string };

/** The key as the list should show it after a successful save. */
export const applyUpdates = (key: ApiKey, updates: ApiKeyUpdates): ApiKey => ({
  ...key,
  ...(updates.account ? { account: updates.account } : null),
  ...(updates.rateLimit ? { rateLimit: updates.rateLimit } : null),
  ...('expirationDate' in updates ? { expirationDate: updates.expirationDate ?? null } : null),
  ...(updates.accessTypes ? { accessTypes: updates.accessTypes } : null),
});

export async function saveKeyUpdates(
  apiKey: ApiKey,
  updates: ApiKeyUpdates,
  update: (data: any) => Promise<any> = updateApiKeys,
): Promise<SaveOutcome> {
  if (Object.keys(updates).length === 0) return { ok: false, message: 'There are no changes to save.' };
  const payload: KeyUpdatePayload[] = [{ apiKeyId: apiKey.api_owner_id, updates }];
  try {
    const result = await update(payload);
    if (!result?.success) {
      return {
        ok: false,
        message: result?.failedKeys?.length
          ? "The server didn't accept these changes. The key may have expired or been deactivated — close this panel, refresh the list and try again."
          : result?.message || result?.error || "We couldn't save your changes. Please try again.",
      };
    }
    return { ok: true, payload, key: applyUpdates(apiKey, updates) };
  } catch {
    return { ok: false, message: "We couldn't reach the server. Check your connection and try again." };
  }
}

export type RotateOutcome = { ok: true; apiKey: string } | { ok: false; message: string };

export async function rotateKey(
  id: string,
  rotate: (id: string) => Promise<any> = rotateApiKey,
): Promise<RotateOutcome> {
  const fallback = 'Unable to rotate this API key right now. Please try again.';
  try {
    const result = await rotate(id);
    const newKey = result?.data?.apiKey;
    if (!result?.success || typeof newKey !== 'string' || !newKey) {
      return { ok: false, message: result?.error || result?.message || fallback };
    }
    return { ok: true, apiKey: newKey };
  } catch {
    return { ok: false, message: fallback };
  }
}
