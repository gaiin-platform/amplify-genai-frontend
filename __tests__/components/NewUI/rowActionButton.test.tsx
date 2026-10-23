/**
 * RowActionButton — the hover action used at the end of assistant rows.
 * An icon-only button must always expose an accessible name and be a plain
 * (non-submitting) button; destructive actions are tinted with the error token.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RowActionButton } from '@/components/NewUI/shared/RowActionButton';

const render = (props: Partial<React.ComponentProps<typeof RowActionButton>> = {}) =>
  renderToStaticMarkup(
    <RowActionButton aria-label="Duplicate Research Bot" onClick={() => {}} {...props}>
      <svg />
    </RowActionButton>,
  );

describe('RowActionButton', () => {
  it('exposes the aria-label and reuses it as the tooltip', () => {
    const html = render();
    expect(html).toContain('aria-label="Duplicate Research Bot"');
    expect(html).toContain('title="Duplicate Research Bot"');
  });

  it('lets an explicit title differ from the accessible name', () => {
    expect(render({ title: 'Duplicate' })).toContain('title="Duplicate"');
  });

  it('is a non-submitting button', () => {
    expect(render()).toContain('type="button"');
  });

  it('tints only destructive actions with the error token', () => {
    expect(render({ danger: true })).toContain('hover:text-[--text-error]');
    expect(render()).not.toContain('--text-error');
  });

  it('renders disabled when asked', () => {
    expect(render({ disabled: true })).toContain('disabled=""');
  });
});
