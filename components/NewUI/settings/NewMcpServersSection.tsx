/**
 * NewMcpServersSection — Settings → MCP Servers.
 *
 * Owns the whole page in the New UI: the intro row (docs link + "Add server"), the add flow
 * (`mcp/McpAddServerForm`) and the server list (`mcp/McpServerList`, state in `mcp/useMcpServers`).
 * It no longer renders the legacy `Settings/MCPServersTab`; that component is untouched and still
 * serves the classic settings dialog.
 *
 * Reports "leaving would lose something" (a half-filled form) to the modal via `onLeaveGuardChange`.
 *
 * Location: components/NewUI/settings/NewMcpServersSection.tsx
 */

import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { IconExternalLink, IconPlus } from '@tabler/icons-react';
import { NewUILoadingStatus } from '@/components/NewUI/shared/NewUILoadingStatus';
import { McpAddServerForm, MCP_NAME_FIELD_ID } from './mcp/McpAddServerForm';
import { McpServerList } from './mcp/McpServerList';
import { useMcpServers } from './mcp/useMcpServers';
import { btnPrimary } from './apiKeys/buttonStyles';
import { LeaveGuard, UNSAVED_MCP_SERVER_GUARD } from './leaveGuard';

const MCP_DOCS_URL = 'https://modelcontextprotocol.io/docs';
const OPEN_BUTTON_ID = 'nui-open-mcp-add';

export interface NewMcpServersSectionProps {
  onLeaveGuardChange: (guard: LeaveGuard | null) => void;
}

export const NewMcpServersSection: FC<NewMcpServersSectionProps> = ({ onLeaveGuardChange }) => {
  const formRef = useRef<HTMLDivElement>(null);
  const servers = useMcpServers();
  const { reload } = servers;
  const [formOpen, setFormOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    onLeaveGuardChange(formOpen && dirty ? UNSAVED_MCP_SERVER_GUARD : null);
  }, [formOpen, dirty, onLeaveGuardChange]);
  useEffect(() => () => onLeaveGuardChange(null), [onLeaveGuardChange]);

  const openForm = () => {
    setFormOpen(true);
    requestAnimationFrame(() => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      formRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      document.getElementById(MCP_NAME_FIELD_ID)?.focus({ preventScroll: true });
    });
  };

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setDirty(false);
    // The focused control unmounts with the form; hand focus back to the "Add server" button.
    requestAnimationFrame(() => document.getElementById(OPEN_BUTTON_ID)?.focus());
  }, []);

  const handleAdded = useCallback(() => {
    void reload();
    closeForm();
  }, [reload, closeForm]);

  if (servers.loading) {
    return <NewUILoadingStatus open message="Loading MCP servers…" variant="inline" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-primary)' }}>
      {/* Intro row: one line of context + docs link; the Add button hides while the form is open */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', minWidth: 0 }}>
          Servers you add are available in all your conversations.{' '}
          <a
            href={MCP_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            style={{ color: 'var(--text-primary)' }}
          >
            Learn more about MCP <IconExternalLink size={13} aria-hidden="true" />
          </a>
        </p>
        {!formOpen && (
          <button id={OPEN_BUTTON_ID} type="button" className={btnPrimary} onClick={openForm}>
            <IconPlus size={15} aria-hidden="true" />
            Add server
          </button>
        )}
      </div>

      {formOpen && (
        <div ref={formRef}>
          <McpAddServerForm onAdded={handleAdded} onCancel={closeForm} onDirtyChange={setDirty} />
        </div>
      )}

      <McpServerList
        servers={servers}
        hideEmpty={formOpen}
        emptyHint={'Use “Add server” to connect one.'}
      />
    </div>
  );
};
