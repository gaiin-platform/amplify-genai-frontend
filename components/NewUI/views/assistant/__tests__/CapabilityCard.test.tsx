import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CapabilityCard } from '../CapabilityCard';

const render = (props: Partial<React.ComponentProps<typeof CapabilityCard>> = {}) =>
  renderToStaticMarkup(
    <CapabilityCard icon={null} title="Skills" {...props}>
      <span>PANEL-BODY</span>
    </CapabilityCard>,
  );

describe('CapabilityCard lazy body', () => {
  it('does not render the body of a closed, unconfigured card', () => {
    expect(render()).not.toContain('PANEL-BODY');
  });

  it('renders the body when something is already configured (badge)', () => {
    expect(render({ badge: '2 selected' })).toContain('PANEL-BODY');
  });

  it('renders the body when it starts open', () => {
    expect(render({ defaultOpen: true })).toContain('PANEL-BODY');
  });

  it('still renders the header for a closed card', () => {
    expect(render()).toContain('Skills');
  });
});
