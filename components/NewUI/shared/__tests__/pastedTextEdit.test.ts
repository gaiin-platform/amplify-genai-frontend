import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentRail } from '../AttachmentRail';
import { normalizePastePreview } from '../AttachmentCard';
import { buildPastedTextMessage, createPasteAttachment } from '../attachmentTypes';

describe('pasted-text edit behavior', () => {
  it('offers edit only for clipboard paste attachments in the composer rail', () => {
    const onEdit = vi.fn();
    const clipboardPaste = createPasteAttachment('clipboard content');
    const selectionReply = createPasteAttachment('selection content', 'message-1');
    const file = {
      ...clipboardPaste,
      id: 'file-1',
      kind: 'file' as const,
      name: 'notes.txt',
      ext: 'TXT',
      mime: 'text/plain',
    };
    const markup = renderToStaticMarkup(
      React.createElement(AttachmentRail, {
        attachments: [clipboardPaste, selectionReply, file],
        onRemove: () => {},
        onPreview: () => {},
        onEdit,
      }),
    );

    expect(markup.match(/aria-label="Edit pasted text"/g)).toHaveLength(1);
    expect(markup).toContain('title="Edit"');
  });

  it('normalizes whitespace for the preview without changing the stored paste', () => {
    const original = '  first\n\n  second\tword  ';
    const attachment = createPasteAttachment(original);

    expect(normalizePastePreview(attachment.bodyPreview)).toBe('first second word');
    expect(attachment.fullText).toBe(original);
  });

  it('keeps the send order aligned when edited text is restored after the prompt', () => {
    const editedText = 'original long pasted content';
    const remainingPaste = createPasteAttachment('another attached paste');
    const message = buildPastedTextMessage(
      `my prompt\n\n${editedText}`,
      [remainingPaste],
    );

    expect(message.content).toBe(
      'my prompt\n\noriginal long pasted content\n\nanother attached paste',
    );
    expect(message.content.match(/original long pasted content/g)).toHaveLength(1);
  });
});
