/**
 * Branding helpers shared by the New UI.
 *
 * The classic UI reads `getWhiteLabelConfig()` (logo file, default theme, "Amplify GenAI"
 * brand name). The New UI needs the same inputs plus a plain product name ("Amplify") and
 * an optional organization name, so they live here instead of changing the shape that
 * `getWhiteLabelConfig()` returns.
 *
 * Everything is read from `NEXT_PUBLIC_*` variables, which Next.js inlines at BUILD time.
 * Each access must stay a literal `process.env.NEXT_PUBLIC_X` for that to work.
 *
 * With nothing configured every function returns today's behavior, so an unbranded
 * deployment looks exactly as it did before.
 */

/** Product name shown in the New UI when `NEXT_PUBLIC_BRAND_NAME` is not set. */
export const DEFAULT_BRAND_NAME = 'Amplify';

/** Where the default (unbranded) mark lives. */
export const DEFAULT_LOGO_SRC = '/amplify-logo.png';

/** The name shown next to the logo, in the login heading, loading text and alt text. */
export function getBrandName(): string {
  return process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || DEFAULT_BRAND_NAME;
}

/**
 * The deploying organization, or `null` for the stock Amplify deployment.
 *
 * Setting it marks the deployment as white-labeled for institution-specific content: the
 * Amplify Helper drops the Vanderbilt-only policy section, links and contact details.
 */
export function getOrganizationName(): string | null {
  return process.env.NEXT_PUBLIC_ORGANIZATION_NAME?.trim() || null;
}

/** True when this deployment is branded for an organization other than the stock one. */
export function isCustomOrganization(): boolean {
  return getOrganizationName() !== null;
}

/**
 * URL of the custom logo from `public/logos/`, or `null` when none is configured.
 * Path separators and `..` are rejected: the value must be a bare filename.
 */
export function getCustomLogoSrc(): string | null {
  const file = process.env.NEXT_PUBLIC_CUSTOM_LOGO?.trim();
  if (!file) return null;
  if (file.includes('/') || file.includes('\\') || file.includes('..')) return null;
  return `/logos/${encodeURIComponent(file)}`;
}

/** Ordered image sources to try, best first. The caller falls back to a letter tile after these. */
export function getLogoSources(): string[] {
  const custom = getCustomLogoSrc();
  return custom ? [custom, DEFAULT_LOGO_SRC] : [DEFAULT_LOGO_SRC];
}

/** One-letter mark used when no image can be loaded. */
export function getBrandInitial(brandName: string = getBrandName()): string {
  const first = Array.from(brandName.trim())[0];
  return first ? first.toUpperCase() : 'A';
}
