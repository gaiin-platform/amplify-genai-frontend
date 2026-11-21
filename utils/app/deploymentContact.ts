export const DOCUMENTATION_URL_ERROR =
  'Enter an absolute HTTPS URL without credentials, or leave it blank.';

const ABSOLUTE_HTTPS_URL =
  /^https:\/\/(?:\[[0-9a-f:.]+\]|[^/?#@:[\]\\\s%<>{}|^"]+)(?::[0-9]+)?(?:[/?#][^\\\s]*)?$/i;

/** Returns an empty string for a cleared setting and null for an invalid value. */
export function normalizeDocumentationUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return '';

  // URL accepts incomplete HTTPS URLs and may silently discard empty userinfo.
  if (!ABSOLUTE_HTTPS_URL.test(url) || /[\x00-\x1f\x7f-\x9f]/.test(url)) {
    return null;
  }

  try {
    return new URL(url).hostname ? url : null;
  } catch {
    return null;
  }
}

export function getActiveSupportEmail(
  config?: {
    isActive?: boolean;
    email?: string;
  } | null,
): string {
  return config?.isActive === true && typeof config.email === 'string'
    ? config.email.trim()
    : '';
}
