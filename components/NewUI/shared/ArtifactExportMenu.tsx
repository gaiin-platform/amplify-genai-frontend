import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDownload,
} from '@tabler/icons-react';
import React, { useEffect, useRef, useState } from 'react';

import { downloadArtifacts } from '@/utils/app/artifacts';
import { extractCodeBlocksAndText } from '@/utils/app/codeblock';
import { generateXLSXBlob } from '@/utils/app/xlsxGenerator';

import Papa from 'papaparse';

export type ArtifactExportType =
  | 'document'
  | 'spreadsheet'
  | 'code'
  | 'visualization';

interface Props {
  type: ArtifactExportType;
  name: string;
  content: string;
  language?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

type ExportItem = {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  action: () => void | Promise<void>;
};

const CODE_EXTENSIONS: Record<string, string> = {
  python: '.py',
  javascript: '.js',
  typescript: '.ts',
  sql: '.sql',
  java: '.java',
  c: '.c',
  cpp: '.cpp',
  'c++': '.cpp',
  go: '.go',
  rust: '.rs',
  ruby: '.rb',
  php: '.php',
  swift: '.swift',
  kotlin: '.kt',
  scala: '.scala',
  r: '.r',
  bash: '.sh',
  shell: '.sh',
  yaml: '.yaml',
  toml: '.toml',
  html: '.html',
  css: '.css',
};

function slugify(name: string): string {
  return (
    name
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '') || 'artifact'
  );
}

function stripCodeFence(content: string): string {
  const match = content.match(/^```(?:\w+)?\s*\n([\s\S]*?)(?:```\s*$|$)/m);
  return match ? match[1] : content;
}

export const ArtifactExportMenu: React.FC<Props> = ({
  type,
  name,
  content,
  language,
  disabled = false,
  className,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const slugName = slugify(name);
  const codeExtension =
    CODE_EXTENSIONS[(language || '').toLowerCase()] || '.txt';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permissions are optional; the content remains selectable.
    }
    setOpen(false);
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const downloadWord = async () => {
    setOpen(false);
    try {
      await downloadArtifacts(
        slugName,
        content,
        extractCodeBlocksAndText(content),
      );
    } catch {
      // Keep the menu usable if conversion fails.
    }
  };

  const downloadExcel = async () => {
    setOpen(false);
    try {
      const parsed = Papa.parse<string[]>(content, {
        skipEmptyLines: true,
        header: false,
      });
      const blob = await generateXLSXBlob(
        parsed.data as string[][],
        name.slice(0, 31) || 'Sheet1',
      );
      triggerDownload(blob, `${slugName}.xlsx`);
    } catch {
      // CSV export remains available if Excel conversion fails.
    }
  };

  const items: ExportItem[] =
    type === 'spreadsheet'
      ? [
          {
            icon: <IconCopy size={14} />,
            label: 'Copy as CSV',
            sublabel: 'To clipboard',
            action: () => copyText(content),
          },
          {
            icon: <IconDownload size={14} />,
            label: 'Download CSV',
            sublabel: '.csv file',
            action: () =>
              triggerDownload(
                new Blob([content], { type: 'text/csv' }),
                `${slugName}.csv`,
              ),
          },
          {
            icon: <IconDownload size={14} />,
            label: 'Download Excel',
            sublabel: '.xlsx file',
            action: downloadExcel,
          },
        ]
      : type === 'code'
      ? [
          {
            icon: <IconCopy size={14} />,
            label: 'Copy code',
            sublabel: 'To clipboard',
            action: () => copyText(stripCodeFence(content)),
          },
          {
            icon: <IconDownload size={14} />,
            label: 'Download file',
            sublabel: `${codeExtension} file`,
            action: () =>
              triggerDownload(
                new Blob([stripCodeFence(content)], { type: 'text/plain' }),
                `${slugName}${codeExtension}`,
              ),
          },
        ]
      : type === 'visualization'
      ? [
          {
            icon: <IconCopy size={14} />,
            label: 'Copy code',
            sublabel: 'To clipboard',
            action: () => copyText(content),
          },
          {
            icon: <IconDownload size={14} />,
            label: 'Download',
            sublabel: content.trimStart().startsWith('<svg')
              ? '.svg file'
              : '.html file',
            action: () => {
              const isSvg = content.trimStart().startsWith('<svg');
              triggerDownload(
                new Blob([content], {
                  type: isSvg ? 'image/svg+xml' : 'text/html',
                }),
                `${slugName}${isSvg ? '.svg' : '.html'}`,
              );
            },
          },
        ]
      : [
          {
            icon: <IconCopy size={14} />,
            label: 'Copy as Markdown',
            sublabel: 'To clipboard',
            action: () => copyText(content),
          },
          {
            icon: <IconDownload size={14} />,
            label: 'Download Markdown',
            sublabel: '.md file',
            action: () =>
              triggerDownload(
                new Blob([content], { type: 'text/markdown' }),
                `${slugName}.md`,
              ),
          },
          {
            icon: <IconDownload size={14} />,
            label: 'Download Word',
            sublabel: '.docx file',
            action: downloadWord,
          },
        ];

  return (
    <div className="relative" style={style}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Export artifact"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={
          className ||
          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[7px] text-[12px] border'
        }
        style={{
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-subtle)',
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {copied ? <IconCheck size={14} /> : <IconDownload size={14} />}
        <span>Export</span>
        <IconChevronDown
          size={12}
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="absolute top-full right-0 mt-1 rounded-[9px] border py-1 min-w-[220px] z-20"
          style={{
            backgroundColor: 'var(--bg-raised)',
            borderColor: 'var(--border-subtle)',
            boxShadow: '0 8px 24px rgba(0,0,0,.3)',
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => void item.action()}
              className="flex items-center gap-2 w-full px-3.5 py-1.5 text-left"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                {item.icon}
              </span>
              <span>
                <span className="block text-[13px] leading-tight">
                  {item.label}
                </span>
                <span
                  className="block text-[11px] leading-tight"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.sublabel}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtifactExportMenu;
