import { describe, expect, it, vi } from 'vitest';
import {
  createUiPreferenceResolver,
  type ResolvedUiPolicy,
} from '@/components/NewUI/shared/uiPreferenceResolver';
import type { UIPreference } from '@/components/NewUI/shared/uiPreferenceResolution';

const FLAGS_ON = { notebook: true, newUi: true };
const FLAGS_OFF = { notebook: true, newUi: false };
const FLAGS_ABSENT = { notebook: true };

function setup(opts: { local?: UIPreference; cachedRollout?: boolean | null; cachedClassicDisallowed?: boolean } = {}) {
  const onResolved = vi.fn<[ResolvedUiPolicy], void>();
  const resolver = createUiPreferenceResolver({
    local: opts.local ?? null,
    cachedRollout: opts.cachedRollout ?? null,
    cachedClassicDisallowed: opts.cachedClassicDisallowed ?? false,
    onResolved,
  });
  const last = () => onResolved.mock.calls[onResolved.mock.calls.length - 1]?.[0];
  return { resolver, onResolved, last };
}

describe('uiPreferenceResolver — flag matrix', () => {
  it.each([
    // [flags, local, server, expected]
    [FLAGS_ABSENT, null, undefined, 'classic'], // absent = off by default
    [FLAGS_ABSENT, 'new', 'new', 'classic'],
    [FLAGS_ON, null, undefined, 'new'],
    [FLAGS_ON, 'classic', undefined, 'classic'],
    [FLAGS_ON, 'new', undefined, 'new'],
    [FLAGS_ON, 'new', 'classic', 'classic'],   // conflicting: server wins
    [FLAGS_ON, 'classic', 'new', 'new'],
    [FLAGS_OFF, null, undefined, 'classic'],
    [FLAGS_OFF, 'new', 'new', 'classic'],      // stale localStorage + server pref
    [FLAGS_OFF, 'classic', 'classic', 'classic'],
  ] as const)('flags=%j local=%s server=%s → %s', (flags, local, server, expected) => {
    const { resolver, last } = setup({ local });
    resolver.receiveSettings(server);
    resolver.receiveFlags(flags);
    expect(last().effective).toBe(expected);
  });

  it('does not decide until both responses have arrived', () => {
    const { resolver, onResolved } = setup({ local: 'new' });
    resolver.receiveSettings('new');
    expect(onResolved).not.toHaveBeenCalled();
    resolver.receiveFlags(FLAGS_OFF);
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it('is order-independent for concurrent responses', () => {
    const a = setup({ local: 'new' });
    a.resolver.receiveFlags(FLAGS_OFF);
    a.resolver.receiveSettings('new');
    const b = setup({ local: 'new' });
    b.resolver.receiveSettings('new');
    b.resolver.receiveFlags(FLAGS_OFF);
    expect(a.last()).toEqual(b.last());
    expect(a.last().effective).toBe('classic');
  });

  it('never decides New for a deployment that forbids Classic over a stored Classic choice', () => {
    const { resolver, last } = setup({ local: 'classic' });
    resolver.receiveSettings('classic');
    resolver.receiveFlags({ ...FLAGS_ON, deploymentFeatures: { allowClassicUiSwitch: false } });
    expect(last()).toMatchObject({ allowClassic: false, effective: 'new' });
  });
});

describe('uiPreferenceResolver — failures, timeouts and late responses', () => {
  it('fails closed when /feature_flags fails and nothing is cached', () => {
    const { resolver, last } = setup({ local: 'new' });
    resolver.receiveSettings('new');
    resolver.receiveFlags(null);
    expect(last()).toMatchObject({ rollout: false, rolloutSource: 'failClosed', effective: 'classic' });
  });

  it('falls back to this user\'s cached verdict when /feature_flags fails', () => {
    const on = setup({ local: 'new', cachedRollout: true });
    on.resolver.receiveSettings('new');
    on.resolver.receiveFlags(null);
    expect(on.last()).toMatchObject({ rolloutSource: 'cache', effective: 'new' });

    const off = setup({ local: 'new', cachedRollout: false });
    off.resolver.receiveSettings('new');
    off.resolver.receiveFlags(null);
    expect(off.last()).toMatchObject({ rolloutSource: 'cache', effective: 'classic' });
  });

  it('treats an untrusted payload as a failed request and never as "enabled"', () => {
    for (const bad of [{}, [], 'oops', { smartMessages: true }]) {
      const { resolver, last } = setup({ local: 'new' });
      resolver.receiveSettings('new');
      resolver.receiveFlags(bad);
      expect(last()).toMatchObject({ rolloutSource: 'failClosed', effective: 'classic' });
    }
  });

  it('decides from fallbacks on timeout, never asking, and a late "disabled" then wins', () => {
    const { resolver, onResolved, last } = setup({ local: 'new', cachedRollout: true });
    resolver.timeout();
    expect(last()).toMatchObject({ rollout: true, effective: 'new' });

    resolver.receiveFlags(FLAGS_OFF); // arrives after the timeout
    expect(last()).toMatchObject({ rollout: false, rolloutSource: 'server', effective: 'classic' });
    expect(onResolved).toHaveBeenCalledTimes(2);
  });

  it('timeout with no cache and no preference is Classic, then re-enables on a late success', () => {
    const { resolver, last } = setup();
    resolver.timeout();
    expect(last().effective).toBe('classic');
    resolver.receiveFlags(FLAGS_ON);
    expect(last()).toMatchObject({ rollout: true, effective: 'new' });
  });

  it('a late server preference after the timeout re-resolves', () => {
    const { resolver, last } = setup({ local: 'new', cachedRollout: true });
    resolver.timeout();
    expect(last().effective).toBe('new');
    resolver.receiveSettings('classic');
    expect(last().effective).toBe('classic');
  });

  it('does not re-report when a late response changes nothing', () => {
    const { resolver, onResolved } = setup({ local: 'new', cachedRollout: true });
    resolver.timeout();
    resolver.receiveFlags(FLAGS_ON);
    expect(onResolved).toHaveBeenCalledTimes(2); // cache → server source is a change
    resolver.receiveSettings('new');
    expect(onResolved).toHaveBeenCalledTimes(2);
  });

  it('failed settings keep the local choice', () => {
    const { resolver, last } = setup({ local: 'classic' });
    resolver.receiveSettings(undefined);
    resolver.receiveFlags(FLAGS_ON);
    expect(last().effective).toBe('classic');
  });

  it('a disabled → re-enabled sequence restores the stored choice (never overwritten)', () => {
    const off = setup({ local: 'classic' });
    off.resolver.receiveSettings('classic');
    off.resolver.receiveFlags(FLAGS_OFF);
    expect(off.last().effective).toBe('classic');

    const on = setup({ local: 'new' });
    on.resolver.receiveSettings('new');
    on.resolver.receiveFlags(FLAGS_ON);
    expect(on.last().effective).toBe('new');
  });
});

describe('uiPreferenceResolver — staying current after startup', () => {
  const started = (flags: unknown, local: UIPreference = 'new') => {
    const ctx = setup({ local });
    ctx.resolver.receiveSettings('new');
    ctx.resolver.receiveFlags(flags);
    return ctx;
  };

  it('an old tab flips to Classic when a re-check says disabled, and back when re-enabled', () => {
    const { resolver, last } = started(FLAGS_ON);
    expect(last().effective).toBe('new');
    resolver.revalidate(FLAGS_OFF);
    expect(last()).toMatchObject({ rollout: false, effective: 'classic' });
    resolver.revalidate(FLAGS_ON);
    expect(last()).toMatchObject({ rollout: true, effective: 'new' });
  });

  it('ignores an untrusted re-check payload instead of changing the verdict', () => {
    const { resolver, onResolved } = started(FLAGS_OFF);
    const calls = onResolved.mock.calls.length;
    for (const bad of [null, undefined, {}, [], 'err', { smartMessages: true }]) resolver.revalidate(bad);
    expect(onResolved).toHaveBeenCalledTimes(calls);
  });

  it('adopts a verdict published by another tab of the same user immediately', () => {
    const { resolver, last } = started(FLAGS_ON);
    resolver.adoptPeerVerdict(false);
    expect(last()).toMatchObject({ rollout: false, effective: 'classic' });
    resolver.adoptPeerVerdict(true);
    expect(last().effective).toBe('new');
  });
});
