/**
 * Turns the raw responses behind the group-management "Access" section into the plain
 * string lists the UI renders. React-free so it is unit-testable.
 *
 * Why this exists: `fetchAllSystemIds()` returns the backend's API-key RECORDS
 * (`{ owner, applicationName, systemId, ... }`), not ids. Using that array as `string[]`
 * and rendering each entry as `{su}` throws "Objects are not valid as a React child", which
 * Next shows as "Application error: a client-side exception has occurred" the moment the
 * Access section is opened. Only users who own an active system API key were affected.
 * The classic admin UI does the same `.systemId` extraction.
 */

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * System user ids from a `get_system_ids` response (API-key records), merged with ids
 * already saved on the group. Never throws and always returns de-duplicated strings.
 */
export function toSystemUserIds(raw: unknown, extraIds: unknown = []): string[] {
  const fromRecords = Array.isArray(raw)
    ? raw.map((entry) => {
        if (isNonEmptyString(entry)) return entry;
        if (entry && typeof entry === 'object') return (entry as { systemId?: unknown }).systemId;
        return undefined;
      })
    : [];
  const extras = Array.isArray(extraIds) ? extraIds : [];
  return Array.from(new Set([...fromRecords, ...extras].filter(isNonEmptyString)));
}

/**
 * Amplify Group names from a `getUserAmplifyGroups()` response. That call answers
 * `{ success: false, message }` when no groups exist, which must read as "none", not be
 * used as the list.
 */
export function toAmplifyGroupNames(raw: unknown): string[] {
  const list =
    Array.isArray(raw) ? raw
    : raw && typeof raw === 'object' && (raw as { success?: unknown }).success === true
      ? (raw as { data?: unknown }).data
      : [];
  return Array.isArray(list) ? list.filter(isNonEmptyString) : [];
}
