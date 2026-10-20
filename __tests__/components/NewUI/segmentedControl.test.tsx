/**
 * SegmentedControl — the sliding highlight must be inset by the same amount whichever segment is
 * selected. Layout is evaluated numerically from the style the component emits (no DOM needed).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SegmentedControl,
  TRACK_PADDING_PX,
  segmentThumbStyle,
} from '@/components/NewUI/shared/SegmentedControl';

/** Left/right gap between the thumb and the track's inner edge, for a track whose padding box is W wide. */
const insets = (n: number, index: number, W: number) => {
  const { width, transform } = segmentThumbStyle(n, index);
  // width is `calc((100% - {pad}px) / {n})` — evaluate it against a W-wide padding box
  const m = /calc\(\(100% - ([\d.]+)px\) \/ (\d+)\)/.exec(width)!;
  const thumbW = (W - Number(m[1])) / Number(m[2]);
  // translateX percentages are relative to the thumb's own width
  const shift = (Number(/translateX\(([\d.]+)%\)/.exec(transform)![1]) / 100) * thumbW;
  const left = TRACK_PADDING_PX + shift;
  return { left, right: W - left - thumbW, thumbW };
};

describe('segmentThumbStyle', () => {
  for (const n of [2, 3, 4, 5]) {
    for (const W of [180, 216, 333.5]) {
      it(`insets the highlight equally on every segment (n=${n}, width=${W})`, () => {
        const first = insets(n, 0, W);
        expect(first.left).toBeCloseTo(TRACK_PADDING_PX, 6);
        for (let i = 0; i < n; i++) {
          const g = insets(n, i, W);
          expect(g.thumbW).toBeCloseTo(first.thumbW, 6); // same size on each segment
          expect(g.left).toBeCloseTo(TRACK_PADDING_PX + i * g.thumbW, 6); // sits exactly on segment i
        }
        // the last segment's highlight is inset the same as the first's
        expect(insets(n, n - 1, W).right).toBeCloseTo(TRACK_PADDING_PX, 6);
      });
    }
  }

  it('hides the highlight when nothing matches', () => {
    expect(segmentThumbStyle(3, -1).opacity).toBe(0);
    expect(segmentThumbStyle(3, 0).opacity).toBeUndefined();
  });
});

describe('SegmentedControl markup', () => {
  const html = renderToStaticMarkup(
    <SegmentedControl
      aria-label="Filter"
      items={[{ id: 'a', label: 'All' }, { id: 'b', label: 'Active' }, { id: 'c', label: 'Inactive' }]}
      value="c"
      onChange={() => undefined}
    />,
  );
  it('has equal inner padding and equal-width, centred segments', () => {
    expect(html).toContain('p-[3px]');
    expect(html.match(/flex-1 items-center justify-center/g)).toHaveLength(3);
  });
  it('places the highlight on the selected segment with the corrected geometry', () => {
    expect(html).toContain('translateX(200%)');
    expect(html).toContain('width:calc((100% - 6px) / 3)');
    expect(html).toContain('left:3px');
  });
});
