import { describe, expect, it } from 'vitest';
import { buildArtifactContentMap, pickBaseVersion } from '@/components/NewUI/shared/artifactContentMap';

const version = '# Title\n\nIntro text\n\n```html\n<p>hi</p>\n```\n\nOutro';

describe('buildArtifactContentMap', () => {
  it('numbers prose and code parts from A0, re-fencing code with its language', () => {
    const map = buildArtifactContentMap(version);
    expect(Object.keys(map)).toEqual(['A0', 'A1', 'A2']);
    expect(map.A0).toContain('Intro text');
    expect(map.A1).toContain('```html');
    expect(map.A1).toContain('<p>hi</p>');
    expect(map.A2).toContain('Outro');
  });

  it('is deterministic, so a rebuild after a reload matches the map the original request used', () => {
    expect(buildArtifactContentMap(version)).toEqual(buildArtifactContentMap(version));
  });
});

describe('pickBaseVersion', () => {
  it('builds on the latest version for a fresh run or a retry', () => {
    expect(pickBaseVersion(['v1', 'v2'], false)).toBe('v2');
  });
  it('builds on the version before the partial one when resuming', () => {
    expect(pickBaseVersion(['v1', 'v2', 'partial'], true)).toBe('v2');
  });
  it('has no base for a first artifact', () => {
    expect(pickBaseVersion([], false)).toBeUndefined();
    expect(pickBaseVersion(['partial'], true)).toBeUndefined();
  });
});
