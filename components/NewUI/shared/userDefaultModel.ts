/**
 * userDefaultModel — user-configurable personal default model.
 *
 * When a user picks a default model in Settings → General, that choice is stored
 * here (localStorage key `amplify_user_default_model_id`).
 *
 * This is distinct from the admin-configured `defaultModelId` (the "user" entry in
 * DefaultModelsConfig).  The personal default takes precedence over the admin one
 * when deciding which model to pre-select on a new conversation.
 *
 * No React imports — call from ModelPicker, NewHome, or GeneralSection without
 * worrying about hook constraints.
 */

export const USER_DEFAULT_MODEL_KEY = 'amplify_user_default_model_id';

/** Returns the user's personally chosen default model id, or null if not set. */
export function getUserDefaultModelId(): string | null {
  try {
    return localStorage.getItem(USER_DEFAULT_MODEL_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Persists the user's personal default model id.
 * Pass `null` (or empty string) to clear it and fall back to the admin default.
 */
export function setUserDefaultModelId(id: string | null): void {
  try {
    if (id && id.trim()) {
      localStorage.setItem(USER_DEFAULT_MODEL_KEY, id.trim());
    } else {
      localStorage.removeItem(USER_DEFAULT_MODEL_KEY);
    }
  } catch {
    // storage unavailable — silently ignore
  }
}
