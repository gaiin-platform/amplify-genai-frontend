/**
 * Jupyter Notebook Block Component
 *
 * Displays Jupyter notebook-style code cells with outputs, supporting:
 * - Syntax highlighted code
 * - Text/stream outputs
 * - Images (PNG, SVG)
 * - Errors with tracebacks
 * - Expandable/collapsible cells
 */

import React, { FC, useState, memo } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import {
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconChevronDown,
  IconChevronRight,
  IconClipboard,
  IconPhoto,
  IconCode,
  IconTerminal,
  IconAlertTriangle,
} from '@tabler/icons-react';

export interface JupyterCellOutput {
  type: 'text' | 'image' | 'error' | 'html';
  content: string;
  mimeType?: string;
}

export interface JupyterCell {
  id: string;
  type: 'code' | 'markdown';
  source: string;
  outputs?: JupyterCellOutput[];
  executionCount?: number;
  status?: 'idle' | 'running' | 'success' | 'error';
}

interface JupyterNotebookBlockProps {
  cells: JupyterCell[];
  title?: string;
  onRunCell?: (cellId: string) => void;
  onCopyCode?: (code: string) => void;
  editable?: boolean;
}

const CellExecutionBadge: FC<{ count?: number; status?: string }> = ({ count, status }) => {
  const baseClass = "w-8 h-6 flex items-center justify-center text-xs font-mono rounded";

  if (status === 'running') {
    return (
      <div className={`${baseClass} bg-yellow-500/20 text-yellow-500`}>
        <IconPlayerPlay size={14} className="animate-pulse" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`${baseClass} bg-red-500/20 text-red-500`}>
        <IconX size={14} />
      </div>
    );
  }

  if (count !== undefined) {
    return (
      <div className={`${baseClass} bg-blue-500/20 text-blue-400`}>
        [{count}]
      </div>
    );
  }

  return (
    <div className={`${baseClass} bg-neutral-700 text-neutral-500`}>
      [ ]
    </div>
  );
};

const OutputBlock: FC<{ output: JupyterCellOutput }> = ({ output }) => {
  const [expanded, setExpanded] = useState(true);

  if (output.type === 'image') {
    return (
      <div className="my-2 p-2 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2 mb-2 text-xs text-neutral-500">
          <IconPhoto size={14} />
          <span>Image Output</span>
        </div>
        <img
          src={`data:${output.mimeType || 'image/png'};base64,${output.content}`}
          alt="Jupyter output"
          className="max-w-full h-auto rounded"
          style={{ maxHeight: '500px' }}
        />
      </div>
    );
  }

  if (output.type === 'error') {
    return (
      <div className="my-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2 text-xs text-red-500">
          <IconAlertTriangle size={14} />
          <span>Error</span>
        </div>
        <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap overflow-x-auto">
          {output.content}
        </pre>
      </div>
    );
  }

  if (output.type === 'html') {
    return (
      <div className="my-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
        <div
          className="text-sm"
          dangerouslySetInnerHTML={{ __html: output.content }}
        />
      </div>
    );
  }

  // Text output
  const lines = output.content.split('\n');
  const isLong = lines.length > 10;

  return (
    <div className="my-2">
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 mb-1"
        >
          {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          {expanded ? 'Collapse' : `Expand (${lines.length} lines)`}
        </button>
      )}
      <pre className={`text-sm font-mono text-neutral-300 whitespace-pre-wrap ${!expanded ? 'max-h-40 overflow-hidden' : ''}`}>
        {output.content}
      </pre>
    </div>
  );
};

const CodeCell: FC<{
  cell: JupyterCell;
  onRunCell?: (cellId: string) => void;
  onCopyCode?: (code: string) => void;
}> = memo(({ cell, onRunCell, onCopyCode }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(cell.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopyCode?.(cell.source);
  };

  const hasOutputs = cell.outputs && cell.outputs.length > 0;

  return (
    <div className="mb-4 border border-neutral-700 rounded-lg overflow-hidden">
      {/* Cell header */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-800 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <CellExecutionBadge count={cell.executionCount} status={cell.status} />
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <IconCode size={14} />
            <span>Python</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
            title="Copy code"
          >
            {copied ? <IconCheck size={16} /> : <IconClipboard size={16} />}
          </button>
          {onRunCell && (
            <button
              onClick={() => onRunCell(cell.id)}
              className="p-1.5 rounded hover:bg-green-600/20 text-green-500 hover:text-green-400 transition-colors"
              title="Run cell"
            >
              <IconPlayerPlay size={16} />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* Code content */}
      {expanded && (
        <>
          <div className="bg-[#282c34]">
            <SyntaxHighlighter
              language="python"
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: '12px',
                background: 'transparent',
                fontSize: '13px',
              }}
              showLineNumbers
              lineNumberStyle={{
                minWidth: '2.5em',
                paddingRight: '1em',
                color: '#636d83',
                userSelect: 'none',
              }}
            >
              {cell.source}
            </SyntaxHighlighter>
          </div>

          {/* Outputs */}
          {hasOutputs && (
            <div className="px-3 py-2 bg-neutral-900 border-t border-neutral-700">
              <div className="flex items-center gap-2 mb-2 text-xs text-neutral-500">
                <IconTerminal size={14} />
                <span>Output</span>
              </div>
              {cell.outputs!.map((output, idx) => (
                <OutputBlock key={idx} output={output} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});
CodeCell.displayName = 'CodeCell';

const MarkdownCell: FC<{ cell: JupyterCell }> = memo(({ cell }) => {
  return (
    <div className="mb-4 px-4 py-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
      <div className="prose prose-invert prose-sm max-w-none">
        {/* Simple markdown rendering - could use a full markdown parser */}
        {cell.source.split('\n').map((line, idx) => {
          if (line.startsWith('# ')) {
            return <h1 key={idx} className="text-xl font-bold mb-2">{line.slice(2)}</h1>;
          }
          if (line.startsWith('## ')) {
            return <h2 key={idx} className="text-lg font-semibold mb-2">{line.slice(3)}</h2>;
          }
          if (line.startsWith('### ')) {
            return <h3 key={idx} className="text-base font-medium mb-2">{line.slice(4)}</h3>;
          }
          if (line.startsWith('- ')) {
            return <li key={idx} className="ml-4">{line.slice(2)}</li>;
          }
          if (line.trim() === '') {
            return <br key={idx} />;
          }
          return <p key={idx} className="text-sm text-neutral-300">{line}</p>;
        })}
      </div>
    </div>
  );
});
MarkdownCell.displayName = 'MarkdownCell';

export const JupyterNotebookBlock: FC<JupyterNotebookBlockProps> = ({
  cells,
  title,
  onRunCell,
  onCopyCode,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const codeCount = cells.filter(c => c.type === 'code').length;
  const outputCount = cells.filter(c => c.outputs && c.outputs.length > 0).length;

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-purple-500/30 bg-neutral-900">
      {/* Notebook header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900/50 to-purple-800/30 border-b border-purple-500/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <IconCode className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">
              {title || 'Jupyter Notebook'}
            </h3>
            <p className="text-xs text-purple-300/70">
              {codeCount} cell{codeCount !== 1 ? 's' : ''}
              {outputCount > 0 && ` | ${outputCount} with output`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-purple-500/20 text-purple-400 transition-colors"
        >
          {collapsed ? <IconChevronRight size={20} /> : <IconChevronDown size={20} />}
        </button>
      </div>

      {/* Notebook content */}
      {!collapsed && (
        <div className="p-4">
          {cells.map((cell) => (
            cell.type === 'code' ? (
              <CodeCell
                key={cell.id}
                cell={cell}
                onRunCell={onRunCell}
                onCopyCode={onCopyCode}
              />
            ) : (
              <MarkdownCell key={cell.id} cell={cell} />
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default JupyterNotebookBlock;
