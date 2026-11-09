import { describe, expect, it } from 'vitest';
import { formatSourceLocation, numberRanges } from '../sourceLocation';

describe('numberRanges', () => {
  it('joins consecutive numbers into ranges and sorts them', () => {
    expect(numberRanges([9, 8, 10, 27])).toBe('8-10, 27');
    expect(numberRanges([8, 8])).toBe('8');
  });
});

describe('formatSourceLocation', () => {
  it('shows a single page', () => {
    expect(formatSourceLocation([{ page_number: 8 }])).toBe('Page 8');
  });

  it('shows several pages as a range and uses the plural label', () => {
    expect(formatSourceLocation([{ page_number: 8 }, { page_number: 9 }, { page_number: 27 }])).toBe('Pages 8-9, 27');
  });

  it('shows slides for a deck', () => {
    expect(formatSourceLocation([{ slide_number: 22 }, { slide_number: 23 }])).toBe('Slides 22-23');
  });

  it('shows at most two kinds of position, the most important first', () => {
    expect(
      formatSourceLocation([{ page_number: 3, paragraph_number: 4, line_number: 10 }]),
    ).toBe('Page 3 · Paragraph 4');
  });

  it('names sheets and rows for a spreadsheet', () => {
    expect(formatSourceLocation([{ sheet_name: 'Customers', row_number: 2 }, { sheet_name: 'Customers', row_number: 3 }]))
      .toBe('Sheet Customers · Rows 2-3');
  });

  it('shows nothing when there is no document position', () => {
    expect(formatSourceLocation(undefined)).toBeNull();
    expect(formatSourceLocation([])).toBeNull();
    expect(formatSourceLocation([{ source: 's3://bucket/file.pdf' }])).toBeNull();
    expect(formatSourceLocation([{ page_number: '' }])).toBeNull();
  });
});
