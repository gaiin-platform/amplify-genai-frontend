import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconArrowUpRight, IconCode, IconCopy, IconDownload, IconX } from '@tabler/icons-react';
import type { ArtifactLibraryItem } from './artifactLibraryModel';

interface Props {
  item: ArtifactLibraryItem;
  onClose: () => void;
  onOpenChat?: () => void;
}

function csvRows(content: string): string[][] {
  return content.split(/\r?\n/).filter(Boolean).slice(0, 501).map((line) =>
    line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')),
  );
}

export const ArtifactPreviewModal: React.FC<Props> = ({ item, onClose, onOpenChat }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [showCode, setShowCode] = useState(item.nuiType === 'code');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!mounted || typeof document === 'undefined') return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permissions are optional; the content remains selectable.
    }
  };

  const download = () => {
    const extension = item.nuiType === 'spreadsheet' ? 'csv' : item.nuiType === 'code' ? 'txt' : 'md';
    const blob = new Blob([item.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${item.name.replace(/[^a-z0-9_.-]+/gi, '_') || 'artifact'}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const rows = item.nuiType === 'spreadsheet' && !showCode ? csvRows(item.content) : [];
  const body = item.nuiType === 'visualization' && !showCode ? (
    <iframe
      title={`${item.name} preview`}
      sandbox=""
      srcDoc={item.content}
      className="w-full h-full min-h-[360px] rounded-[8px] border"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'white' }}
    />
  ) : item.nuiType === 'spreadsheet' && !showCode ? (
    <div className="overflow-auto h-full">
      {rows.length ? (
        <table className="w-full text-[12px] border-collapse">
          <tbody>{rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                rowIndex === 0 ? (
                  <th key={cellIndex} className="text-left font-semibold border px-2 py-1" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>{cell}</th>
                ) : (
                  <td key={cellIndex} className="border px-2 py-1" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{cell}</td>
                )
              ))}
            </tr>
          ))}</tbody>
        </table>
      ) : <p style={{ color: 'var(--text-muted)' }}>No tabular content available.</p>}
    </div>
  ) : (
    <pre className="whitespace-pre-wrap break-words text-[13px] leading-6" style={{ color: 'var(--text-primary)' }}>
      {item.content || 'No content available.'}
    </pre>
  );

  return createPortal(
    <div className="fixed inset-0 z-[10011] flex items-center justify-center p-4" data-new-ui-shell="true" style={{ backgroundColor: 'rgba(0,0,0,.58)' }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="artifact-preview-title" className="flex flex-col w-full max-w-5xl h-[min(760px,90dvh)] rounded-[14px] border shadow-2xl" style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-subtle)' }}>
        <header className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="min-w-0 flex-1">
            <h2 id="artifact-preview-title" className="truncate text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</h2>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>{item.nuiType} · v{item.artifact.version}{item.source.conversation ? ` · ${item.source.conversation.name}` : item.source.conversationId ? ' · Source conversation' : ''}</p>
          </div>
          <div className="flex items-center gap-1">
            {(item.nuiType === 'code' || item.nuiType === 'visualization') && <button type="button" aria-label={showCode ? 'Show preview' : 'Show source'} title={showCode ? 'Show preview' : 'Show source'} onClick={() => setShowCode((value) => !value)} className="h-8 px-2 rounded-[7px] text-[12px] border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}><IconCode size={14} /></button>}
            <button type="button" aria-label={copied ? 'Copied' : 'Copy artifact content'} title="Copy" onClick={copy} className="h-8 w-8 rounded-[7px] flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>{copied ? '✓' : <IconCopy size={15} />}</button>
            <button type="button" aria-label="Download artifact" title="Download" onClick={download} className="h-8 w-8 rounded-[7px] flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}><IconDownload size={15} /></button>
            <button ref={closeRef} type="button" aria-label="Close artifact preview" title="Close" onClick={onClose} className="h-8 w-8 rounded-[7px] flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}><IconX size={17} /></button>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-auto p-5" style={{ backgroundColor: 'var(--bg-raised)' }}>{body}</div>
        <footer className="flex items-center justify-between px-5 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <span className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>{item.source.conversation ? `Generated in ${item.source.conversation.name}` : item.source.conversationId ? 'Generated in source conversation' : 'Source conversation unavailable'}</span>
          <button type="button" disabled={!item.source.conversationId || !onOpenChat} onClick={onOpenChat} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[12px] font-medium disabled:opacity-40" style={{ color: 'var(--accent-fg)', backgroundColor: 'var(--accent)' }}><IconArrowUpRight size={14} /> Open in chat</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};

export default ArtifactPreviewModal;
