import { describe, expect, it } from 'vitest';

import { validateUrlForSSRF } from '@/utils/app/urlValidation';

describe('validateUrlForSSRF', () => {
  describe('valid URLs', () => {
    it('allows valid https URLs', () => {
      expect(validateUrlForSSRF('https://api.example.com/mcp')).toEqual({ valid: true });
    });

    it('allows valid http URLs with public IPs', () => {
      expect(validateUrlForSSRF('http://203.0.113.1:8080/mcp')).toEqual({ valid: true });
    });

    it('allows valid domain names', () => {
      expect(validateUrlForSSRF('https://mcp-server.company.com/v1')).toEqual({ valid: true });
    });
  });

  describe('blocked protocols', () => {
    it('rejects ftp protocol', () => {
      const result = validateUrlForSSRF('ftp://example.com/file');
      expect(result.valid).toBe(false);
    });

    it('rejects file protocol', () => {
      const result = validateUrlForSSRF('file:///etc/passwd');
      expect(result.valid).toBe(false);
    });
  });

  describe('blocked private IPs', () => {
    it('blocks 10.x.x.x range', () => {
      const result = validateUrlForSSRF('http://10.0.0.1:8080/mcp');
      expect(result.valid).toBe(false);
    });

    it('blocks 192.168.x.x range', () => {
      const result = validateUrlForSSRF('http://192.168.1.1/mcp');
      expect(result.valid).toBe(false);
    });

    it('blocks 172.16-31.x.x range', () => {
      const result = validateUrlForSSRF('http://172.16.0.1/mcp');
      expect(result.valid).toBe(false);
    });

    it('allows 172.32.x.x (not private)', () => {
      expect(validateUrlForSSRF('http://172.32.0.1/mcp')).toEqual({ valid: true });
    });

    it('blocks 127.x.x.x (loopback)', () => {
      const result = validateUrlForSSRF('http://127.0.0.1:3000/mcp');
      expect(result.valid).toBe(false);
    });
  });

  describe('blocked cloud metadata', () => {
    it('blocks AWS metadata endpoint', () => {
      const result = validateUrlForSSRF('http://169.254.169.254/latest/meta-data/');
      expect(result.valid).toBe(false);
    });

    it('blocks link-local range', () => {
      const result = validateUrlForSSRF('http://169.254.1.1/');
      expect(result.valid).toBe(false);
    });
  });

  describe('blocked hostnames', () => {
    it('blocks localhost', () => {
      const result = validateUrlForSSRF('http://localhost:8080/mcp');
      expect(result.valid).toBe(false);
    });

    it('blocks metadata.google.internal', () => {
      const result = validateUrlForSSRF('http://metadata.google.internal/computeMetadata/v1/');
      expect(result.valid).toBe(false);
    });
  });

  describe('blocked internal TLDs', () => {
    it('blocks .internal domains', () => {
      const result = validateUrlForSSRF('http://service.internal/api');
      expect(result.valid).toBe(false);
    });

    it('blocks .local domains', () => {
      const result = validateUrlForSSRF('http://myserver.local/mcp');
      expect(result.valid).toBe(false);
    });

    it('blocks .corp domains', () => {
      const result = validateUrlForSSRF('http://api.corp/service');
      expect(result.valid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('rejects empty string', () => {
      const result = validateUrlForSSRF('');
      expect(result.valid).toBe(false);
    });

    it('rejects malformed URL', () => {
      const result = validateUrlForSSRF('not-a-url');
      expect(result.valid).toBe(false);
    });

    it('blocks IPv6 loopback', () => {
      const result = validateUrlForSSRF('http://[::1]:8080/mcp');
      expect(result.valid).toBe(false);
    });

    it('blocks URL with userinfo', () => {
      const result = validateUrlForSSRF('https://user:pass@example.com/path');
      expect(result.valid).toBe(false);
    });
  });
});
