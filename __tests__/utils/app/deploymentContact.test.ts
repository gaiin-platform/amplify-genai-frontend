import {
  getActiveSupportEmail,
  normalizeDocumentationUrl,
} from '@/utils/app/deploymentContact';

import { describe, expect, it } from 'vitest';

describe('normalizeDocumentationUrl', () => {
  it.each([
    ['', ''],
    [' \t\n ', ''],
    [
      ' https://docs.example.com/guide?q=a%20b#help ',
      'https://docs.example.com/guide?q=a%20b#help',
    ],
    ['HTTPS://docs.example.com:8443/', 'HTTPS://docs.example.com:8443/'],
    ['https://[2001:db8::1]:8443/', 'https://[2001:db8::1]:8443/'],
    ['https://ドキュメント.example.com/', 'https://ドキュメント.example.com/'],
  ])('normalizes %j', (value, expected) => {
    expect(normalizeDocumentationUrl(value)).toBe(expected);
  });

  it.each([
    null,
    123,
    '#',
    '//docs.example.com',
    'http://docs.example.com',
    'javascript:alert(1)',
    'data:text/html,example',
    'https:docs.example.com',
    'https:///docs.example.com',
    'https://user:password@docs.example.com',
    'https://@docs.example.com',
    'https://user%40docs.example.com',
    'https://docs.example.com:65536',
    'https://docs.example.com\\path',
    'https://docs.example.com/with spaces',
    'https://docs.example.com/path\u0001',
  ])('rejects %j', (value) => {
    expect(normalizeDocumentationUrl(value)).toBeNull();
  });
});

describe('getActiveSupportEmail', () => {
  it('trims the configured active email and clears missing or inactive emails', () => {
    expect(
      getActiveSupportEmail({ isActive: true, email: ' support@example.com ' }),
    ).toBe('support@example.com');
    expect(
      getActiveSupportEmail({ isActive: false, email: 'support@example.com' }),
    ).toBe('');
    expect(getActiveSupportEmail()).toBe('');
  });
});
