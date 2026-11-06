/**
 * Where in a document a retrieved source came from ("Page 8", "Slides 22-25", "Sheet Customers").
 *
 * A source's `locations` is a list of small objects, one per piece of text that matched, e.g.
 * [{ page_number: 8 }, { page_number: 9 }] or [{ slide_number: 3 }] or [{ sheet_name: 'Q1', row_number: 12 }].
 */

/** Which location key is shown first (lower number = more important). Shared with the classic source card. */
export const LOCATION_KEY_PRECEDENCE: { [key: string]: number } = {
  // Document structure (highest priority)
  slide_number: 1,
  page_number: 2,
  section_number: 3,
  section_title: 4,

  // Content structure
  paragraph_number: 5,
  line_number: 6,

  // Spreadsheet structure
  sheet_number: 7,
  sheet_name: 8,
  row_number: 9,
  cell_range: 10,
};

const LABELS: { [key: string]: [string, string] } = {
  slide_number: ['Slide', 'Slides'],
  page_number: ['Page', 'Pages'],
  section_number: ['Section', 'Sections'],
  section_title: ['Section', 'Sections'],
  paragraph_number: ['Paragraph', 'Paragraphs'],
  line_number: ['Line', 'Lines'],
  sheet_number: ['Sheet', 'Sheets'],
  sheet_name: ['Sheet', 'Sheets'],
  row_number: ['Row', 'Rows'],
  cell_range: ['Range', 'Ranges'],
};

/** [1, 2, 3, 7] -> "1-3, 7" */
export function numberRanges(values: number[]): string {
  const sorted = Array.from(new Set(values)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = start;
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === end + 1) {
      end = sorted[i];
      continue;
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    start = sorted[i];
    end = start;
  }
  return ranges.join(', ');
}

/**
 * A short label for where the text came from, or null when the source has no document position
 * (web pages, Bedrock knowledge-base files, sources without locations).
 * At most two kinds of position are shown, the most important first: "Page 8", "Sheet Q1 · Rows 2-40".
 */
export function formatSourceLocation(locations: any, maxParts = 2): string | null {
  if (!Array.isArray(locations) || locations.length === 0) return null;
  const entries = locations.filter((l) => l && typeof l === 'object');

  const keys = Array.from(new Set(entries.flatMap((l) => Object.keys(l))))
    .filter((key) => key in LOCATION_KEY_PRECEDENCE)
    .sort((a, b) => LOCATION_KEY_PRECEDENCE[a] - LOCATION_KEY_PRECEDENCE[b]);

  const parts: string[] = [];
  for (const key of keys) {
    const values = entries
      .map((l) => l[key])
      .filter((v) => v !== null && v !== undefined && v !== '');
    if (values.length === 0) continue;

    const numeric = values.filter((v) => typeof v === 'number') as number[];
    let text: string;
    let count: number;
    if (numeric.length === values.length) {
      text = numberRanges(numeric);
      count = new Set(numeric).size;
    } else {
      const unique = Array.from(new Set(values.map((v) => String(v))));
      text = unique.map((v) => (v.length > 24 ? `${v.slice(0, 24)}...` : v)).slice(0, 2).join(', ');
      count = unique.length;
    }
    const [singular, plural] = LABELS[key];
    parts.push(`${count > 1 ? plural : singular} ${text}`);
    if (parts.length >= maxParts) break;
  }
  return parts.length ? parts.join(' · ') : null;
}
