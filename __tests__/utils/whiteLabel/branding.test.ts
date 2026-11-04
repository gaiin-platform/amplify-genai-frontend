import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BRAND_NAME,
  DEFAULT_LOGO_SRC,
  getBrandInitial,
  getBrandName,
  getCustomLogoSrc,
  getLogoSources,
  getOrganizationName,
  isCustomOrganization,
} from '@/utils/whiteLabel/branding';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('New UI branding (unbranded deployment)', () => {
  it('returns the stock Amplify behavior when nothing is configured', () => {
    expect(getBrandName()).toBe(DEFAULT_BRAND_NAME);
    expect(getBrandName()).toBe('Amplify');
    expect(getOrganizationName()).toBeNull();
    expect(isCustomOrganization()).toBe(false);
    expect(getCustomLogoSrc()).toBeNull();
    expect(getLogoSources()).toEqual([DEFAULT_LOGO_SRC]);
  });

  it('treats blank values as unset', () => {
    vi.stubEnv('NEXT_PUBLIC_BRAND_NAME', '   ');
    vi.stubEnv('NEXT_PUBLIC_ORGANIZATION_NAME', '  ');
    vi.stubEnv('NEXT_PUBLIC_CUSTOM_LOGO', ' ');
    expect(getBrandName()).toBe('Amplify');
    expect(getOrganizationName()).toBeNull();
    expect(getCustomLogoSrc()).toBeNull();
  });
});

describe('New UI branding (white-labeled deployment)', () => {
  it('uses the configured brand and organization names', () => {
    vi.stubEnv('NEXT_PUBLIC_BRAND_NAME', ' Acme AI ');
    vi.stubEnv('NEXT_PUBLIC_ORGANIZATION_NAME', 'Acme Corporation');
    expect(getBrandName()).toBe('Acme AI');
    expect(getOrganizationName()).toBe('Acme Corporation');
    expect(isCustomOrganization()).toBe(true);
  });

  it('tries the custom logo first, then the stock mark', () => {
    vi.stubEnv('NEXT_PUBLIC_CUSTOM_LOGO', 'acme-mark.svg');
    expect(getCustomLogoSrc()).toBe('/logos/acme-mark.svg');
    expect(getLogoSources()).toEqual(['/logos/acme-mark.svg', DEFAULT_LOGO_SRC]);
  });

  it('percent-encodes unusual filenames', () => {
    vi.stubEnv('NEXT_PUBLIC_CUSTOM_LOGO', 'my logo #1.png');
    expect(getCustomLogoSrc()).toBe('/logos/my%20logo%20%231.png');
  });

  it.each(['../secret.png', 'a/b.png', 'a\\b.png', '..'])(
    'rejects a logo value that is not a bare filename: %s',
    (value) => {
      vi.stubEnv('NEXT_PUBLIC_CUSTOM_LOGO', value);
      expect(getCustomLogoSrc()).toBeNull();
      expect(getLogoSources()).toEqual([DEFAULT_LOGO_SRC]);
    },
  );
});

describe('getBrandInitial', () => {
  it('uses the first letter of the brand, upper-cased', () => {
    expect(getBrandInitial('acme')).toBe('A');
    expect(getBrandInitial('  zeta labs')).toBe('Z');
  });

  it('handles non-ASCII and empty names', () => {
    expect(getBrandInitial('éclair')).toBe('É');
    expect(getBrandInitial('')).toBe('A');
  });
});
