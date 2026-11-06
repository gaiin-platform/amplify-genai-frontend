import { describe, expect, it } from 'vitest';
import {
  describeItem,
  formatItemTime,
  resultRows,
} from '@/components/NewUI/shared/toolStepResults';

const NOW = new Date('2026-10-15T15:55:00Z');
const OPTS = { now: NOW, locale: 'en-US', timeZone: 'America/Chicago' };

describe('describeItem', () => {
  it('reads an email as subject — sender — time', () => {
    const line = describeItem(
      {
        conversationId: 'AAQk',
        subject: 'Q3 numbers',
        from: { emailAddress: { name: 'Ann Lee', address: 'ann@example.com' } },
        receivedDateTime: '2026-10-15T14:02:11.0000000', // zone-less UTC, same day -> 9:02 AM in Chicago
        hasAttachments: false,
        isRead: true,
      },
      OPTS,
    );
    expect(line).toEqual({ title: 'Q3 numbers', meta: 'Ann Lee', time: '9:02 AM' });
  });

  it('shows the date for another day and accepts string senders and nested dateTime objects', () => {
    const line = describeItem({ title: 'Standup', organizer: 'Bo', start: { dateTime: '2026-10-14T18:30:00Z', timeZone: 'UTC' } }, OPTS);
    expect(line.title).toBe('Standup');
    expect(line.meta).toBe('Bo');
    expect(line.time).toBe('Oct 14, 1:30 PM');
  });

  it('falls back to the first plain values, and never returns an empty title', () => {
    expect(describeItem({ id: 'x1', count: 3, nested: { a: 1 } }).title).toBe('x1 · 3');
    expect(describeItem({}).title).toBe('Item');
    expect(describeItem(null).title).toBe('Item');
    expect(describeItem('plain').title).toBe('plain');
  });

  it('leaves an unparseable time as it came', () => {
    expect(formatItemTime('sometime soon', OPTS)).toBe('sometime soon');
  });
});

describe('resultRows', () => {
  it('lists every present field, skipping empty ones, with non-strings as compact JSON', () => {
    expect(resultRows({ a: 'x', b: null, c: undefined, d: '', e: false, f: { g: 1 } })).toEqual([
      { key: 'a', value: 'x' },
      { key: 'e', value: 'false' },
      { key: 'f', value: '{"g":1}' },
    ]);
  });
});
