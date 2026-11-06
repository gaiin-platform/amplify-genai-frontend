import { describe, expect, it } from 'vitest';
import {
  COMPOSER_CHROME_PX,
  EDITOR_LINE_PX,
  composerCardMinHeight,
  editorFloorHeight,
} from '../composerLayout';

describe('editorFloorHeight', () => {
  it('adds no space above an empty or one-line editor', () => {
    expect(editorFloorHeight(EDITOR_LINE_PX)).toBe(EDITOR_LINE_PX);
    expect(editorFloorHeight(0)).toBe(EDITOR_LINE_PX);
  });

  it('tracks the content up to three lines', () => {
    expect(editorFloorHeight(48)).toBe(48);
    expect(editorFloorHeight(72)).toBe(72);
  });

  it('caps at three lines for long drafts', () => {
    expect(editorFloorHeight(600)).toBe(72);
  });
});

describe('composerCardMinHeight', () => {
  const rail = 174;

  it('equals the natural card height for a one-line draft (no dead space)', () => {
    expect(composerCardMinHeight(rail, EDITOR_LINE_PX)).toBe(COMPOSER_CHROME_PX + rail + EDITOR_LINE_PX);
  });

  it('keeps three lines of room for a long draft', () => {
    expect(composerCardMinHeight(rail, 600)).toBe(COMPOSER_CHROME_PX + rail + 72);
  });
});
