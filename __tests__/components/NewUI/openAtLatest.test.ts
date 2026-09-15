import { describe, it, expect } from 'vitest';
import {
  nextOpenAtLatestTop,
  OPEN_AT_LATEST_TOLERANCE,
} from '@/components/NewUI/shared/openAtLatest';

/**
 * The rule behind "opening a conversation shows its newest message":
 * pin to the scroll maximum while the transcript settles, but never fight the
 * user once they scroll up.
 */
describe('nextOpenAtLatestTop', () => {
  it('targets the scroll maximum on the first frame', () => {
    // A freshly remounted .chatcontainer: scrollTop 0 (the bug — message #1).
    const target = nextOpenAtLatestTop(
      { scrollTop: 0, scrollHeight: 4000, clientHeight: 800 },
      null,
    );
    expect(target).toBe(3200);
  });

  it('re-targets the new maximum when late content grows the transcript', () => {
    // Frame 1 parked us at 3200; an image decoded and added 500px.
    const target = nextOpenAtLatestTop(
      { scrollTop: 3200, scrollHeight: 4500, clientHeight: 800 },
      3200,
    );
    expect(target).toBe(3700);
  });

  it('returns 0 for a transcript shorter than the viewport', () => {
    const target = nextOpenAtLatestTop(
      { scrollTop: 0, scrollHeight: 400, clientHeight: 800 },
      null,
    );
    expect(target).toBe(0);
  });

  it('stops when the user scrolls up past the tolerance', () => {
    const target = nextOpenAtLatestTop(
      { scrollTop: 3200 - (OPEN_AT_LATEST_TOLERANCE + 1), scrollHeight: 4000, clientHeight: 800 },
      3200,
    );
    expect(target).toBeNull();
  });

  it('keeps pinning through sub-tolerance drift (rounding, scroll clamping)', () => {
    const target = nextOpenAtLatestTop(
      { scrollTop: 3200 - (OPEN_AT_LATEST_TOLERANCE - 1), scrollHeight: 4000, clientHeight: 800 },
      3200,
    );
    expect(target).toBe(3200);
  });

  it('never stops on the first frame, however far from the bottom the node starts', () => {
    // lastAppliedTop === null means "we have not scrolled yet", so a scrollTop of
    // 0 is the state we are there to fix, not a user scroll to respect.
    const target = nextOpenAtLatestTop(
      { scrollTop: 0, scrollHeight: 9000, clientHeight: 800 },
      null,
    );
    expect(target).toBe(8200);
  });

  it('does not treat downward drift as a user takeover', () => {
    // Growth below the fold can only raise the maximum; scrollTop moving *down*
    // (e.g. our own clamped scroll landing a hair low) must not cancel the pin.
    const target = nextOpenAtLatestTop(
      { scrollTop: 3300, scrollHeight: 4200, clientHeight: 800 },
      3200,
    );
    expect(target).toBe(3400);
  });
});
