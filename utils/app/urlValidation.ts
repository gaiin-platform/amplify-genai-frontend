export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
  'metadata.goog',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.corp',
  '.lan',
  '.intranet',
];

function isPrivate172(hostname: string): boolean {
  if (!hostname.startsWith('172.')) return false;
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  const secondOctet = Number(parts[1]);
  return Number.isInteger(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
}

function isCarrierGradeNat(hostname: string): boolean {
  if (!hostname.startsWith('100.')) return false;
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  const secondOctet = Number(parts[1]);
  return Number.isInteger(secondOctet) && secondOctet >= 64 && secondOctet <= 127;
}

function isBlockedIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc00:') ||
    normalized.startsWith('fd00:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    normalized.startsWith('::ffff:169.254.')
  );
}

export function validateUrlForSSRF(url: string): UrlValidationResult {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: false, error: 'URL is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only http:// and https:// protocols are allowed' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs with embedded credentials are not allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { valid: false, error: 'URL must have a valid hostname' };
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: 'Access to internal/metadata hosts is not allowed' };
  }

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { valid: false, error: 'Access to internal network domains is not allowed' };
  }

  if (hostname === '169.254.169.254' || hostname === '169.254.170.2' || hostname === 'fd00:ec2::254') {
    return { valid: false, error: 'Access to cloud metadata endpoints is not allowed' };
  }

  if (
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('127.') ||
    hostname.startsWith('0.') ||
    hostname.startsWith('169.254.') ||
    isPrivate172(hostname) ||
    isCarrierGradeNat(hostname)
  ) {
    return { valid: false, error: 'Access to private/internal network addresses is not allowed' };
  }

  if (isBlockedIpv6(hostname)) {
    return { valid: false, error: 'Access to private/internal network addresses is not allowed' };
  }

  return { valid: true };
}
