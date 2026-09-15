/**
 * AdminsCard — New-UI replacement for the "Admins" section of ConfigurationsTab.
 *
 * Why this exists (Phase 67 follow-up):
 *   The original ConfigurationsTab renders the delete icon conditionally on hover
 *   (React state: hoveredUser), which inserts/removes the button from the DOM and
 *   causes a layout shift. It also showed raw UUIDs with no fallback and lacked
 *   aria-labels on destructive actions.
 *
 *   This wrapper keeps the same card structure and visual language but fixes:
 *   - Hover layout shift: delete icon is always in the DOM (opacity:0 → 1 on hover
 *     via CSS `.new-ui-admin-chip:hover .new-ui-admin-chip-delete`). No React state
 *     change on hover → no reflow.
 *   - UUID fallback: raw UUIDs show "Unknown user" + amber warning icon + full UUID
 *     in the native title tooltip.
 *   - Destructive safety: per-chip confirm() before removal; aria-label on every
 *     delete button.
 *   - Remove mode: "Remove Admins" button toggles `.new-ui-admin-chips--removing`
 *     on the chip list, making all delete icons visible without per-chip hover.
 *   - Contrast: chip text uses var(--text-primary); unknown-user chips use amber
 *     accent border so they stand out as needing attention.
 *
 * The original admins card in ConfigurationsTab is hidden via CSS:
 *   [data-new-ui-admin-content="true"] .admin-style-settings-card:has(#csvUploadButton)
 * so it does not double-render alongside this component.
 *
 * Imports: only old-UI code is imported (not modified). CSV portal pattern mirrors
 * the original ConfigurationsTab exactly.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconAlertTriangle, IconFileImport, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { AdminConfigTypes } from '@/types/admin';
import { AddEmailWithAutoComplete } from '@/components/Emails/AddEmailsAutoComplete';
import { CsvUpload } from '@/components/ReusableComponents/CsvUpload';
import { CsvPreviewModal } from '@/components/ReusableComponents/CsvPreviewModal';
import { useCsvUpload } from '@/hooks/useCsvUpload';
import { AdminCsvUploadConfig, AdminCsvPreviewConfig } from '@/config/csvUploadConfigs';
import toast from 'react-hot-toast';

// ── UUID helpers (mirrors Configurations.tsx) ─────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRawUUID = (s: string) => UUID_RE.test(s?.trim() ?? '');

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  admins: string[];
  setAdmins: (a: string[]) => void;
  amplifyUsers: { [key: string]: string };
  allEmails: string[] | null;
  updateUnsavedConfigs: (t: AdminConfigTypes) => void;
  /** Notify parent when a portal modal opens so the Escape guard can activate */
  onModalStateChange?: (hasOpenModal: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const AdminsCard: React.FC<Props> = ({
  admins,
  setAdmins,
  amplifyUsers,
  allEmails,
  updateUnsavedConfigs,
  onModalStateChange,
}) => {
  const [showAddInput, setShowAddInput] = useState(false);
  const [isRemoving, setIsRemoving]     = useState(false);

  // ── CSV upload ──────────────────────────────────────────────────────────────
  const adminCsvUpload = useCsvUpload({
    uploadConfig: AdminCsvUploadConfig,
    previewConfig: AdminCsvPreviewConfig,
    existingItems: admins,
    onImportComplete: async (newAdmins: string[]) => {
      handleUpdateAdmins([...admins, ...newAdmins]);
    },
    onImportSuccess: (newAdmins: string[]) => {
      toast.success(`Successfully imported ${newAdmins.length} admin(s)`);
    },
    onImportError: () => {
      toast.error('Failed to import admins. Please try again.');
    },
  });

  // Notify parent when portal modals open/close
  useEffect(() => {
    onModalStateChange?.(adminCsvUpload.hasOpenModal);
  }, [adminCsvUpload.hasOpenModal, onModalStateChange]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const handleUpdateAdmins = (updated: string[]) => {
    setAdmins(updated);
    updateUnsavedConfigs(AdminConfigTypes.ADMINS);
  };

  /**
   * Returns the display string for a stored username/UUID.
   * Returns null when the entry is an unresolvable raw UUID.
   */
  const getDisplayName = (user: string): string | null => {
    const mapped = amplifyUsers[user];
    // amplifyUsers maps username → email; if it resolves to a non-UUID, use it
    if (mapped && !isRawUUID(mapped)) return mapped;
    // sometimes the entry itself is stored as an email directly
    if (user.includes('@')) return user;
    // raw UUID with no mapping → unknown identity
    if (isRawUUID(user)) return null;
    return user;
  };

  const confirmAndRemove = (user: string) => {
    const display = getDisplayName(user);
    const label   = display ?? `unknown user (${user.slice(0, 8)}…)`;
    if (
      confirm(
        `Remove "${label}" as an admin?\n\nThis change takes effect when you save.`,
      )
    ) {
      handleUpdateAdmins(admins.filter((a) => a !== user));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="admin-style-settings-card" style={{ marginBottom: 16 }}>

      {/* ── Card header ── */}
      <div className="admin-style-settings-card-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 className="admin-style-settings-card-title">Admins</h3>
            <p className="admin-style-settings-card-description">
              Manage the admins of the admin panel
            </p>
          </div>

          {/* Upload Admins CSV button */}
          <button
            id="csvUploadButton_newui"          /* distinct id — original is hidden via CSS */
            title="Import Admins from CSV"
            onClick={adminCsvUpload.openUpload}
            style={{ flexShrink: 0 }}
            className="flex items-center cursor-pointer group px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <div className="icon-pop-group"><IconFileImport size={18} /></div>
            <span style={{ marginLeft: 10 }}>Upload Admins</span>
          </button>
        </div>
      </div>

      {/* ── Action toolbar ── */}
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

        {/* Add Admins */}
        <button
          className="new-ui-admin-action-btn"
          onClick={() => { setShowAddInput(!showAddInput); setIsRemoving(false); }}
          title="Add Admins"
          aria-expanded={showAddInput}
        >
          {showAddInput ? <IconX size={15} /> : <IconPlus size={15} />}
          <span>{showAddInput ? 'Cancel' : 'Add Admins'}</span>
        </button>

        {/* Remove Admins — visually destructive */}
        {admins.length > 0 && (
          <button
            className={`new-ui-admin-action-btn new-ui-admin-action-btn--danger${isRemoving ? ' new-ui-admin-action-btn--active' : ''}`}
            onClick={() => { setIsRemoving(!isRemoving); setShowAddInput(false); }}
            title={isRemoving ? 'Exit remove mode' : 'Remove Admins'}
            aria-pressed={isRemoving}
          >
            <IconTrash size={15} />
            <span>{isRemoving ? 'Done' : 'Remove Admins'}</span>
          </button>
        )}
      </div>

      {/* ── Add-admin email input (shown when Add Admins clicked) ── */}
      {showAddInput && (
        <div style={{ padding: '0 16px 12px' }}>
          <AddEmailWithAutoComplete
            id={String(AdminConfigTypes.ADMINS)}
            emails={admins.map((u) => amplifyUsers[u] || u)}
            allEmails={allEmails ?? []}
            handleUpdateEmails={(updatedEmails: string[]) => {
              const usernames = updatedEmails.map((email) => {
                const username = Object.keys(amplifyUsers).find(
                  (k) => amplifyUsers[k] === email,
                );
                return username || email;
              });
              handleUpdateAdmins(usernames);
            }}
          />
        </div>
      )}

      {/* ── Admin chips list ── */}
      <div
        style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}
        className={isRemoving ? 'new-ui-admin-chips--removing' : ''}
        aria-label="Admin list"
      >
        {admins.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No admins configured
          </span>
        ) : (
          admins.map((user, idx) => {
            const display   = getDisplayName(user);
            const isUnknown = display === null;
            const chipLabel = display ?? 'Unknown user';
            const tooltip   = isUnknown
              ? `Unresolved identity — UUID: ${user}`
              : display!;

            return (
              <div
                key={idx}
                className={`new-ui-admin-chip${isUnknown ? ' new-ui-admin-chip--unknown' : ''}`}
                title={tooltip}
                role="listitem"
              >
                {/* Warning icon for unresolvable UUIDs */}
                {isUnknown && (
                  <IconAlertTriangle
                    size={12}
                    aria-hidden="true"
                    className="new-ui-admin-chip-warn"
                  />
                )}

                {/* Email / display name — always truncated with ellipsis */}
                <span className="new-ui-admin-chip-label">{chipLabel}</span>

                {/* Delete button — always in DOM so layout never shifts.
                    opacity controlled by CSS on hover / in removing mode.  */}
                <button
                  className="new-ui-admin-chip-delete"
                  type="button"
                  aria-label={`Remove ${chipLabel} as admin`}
                  tabIndex={isRemoving ? 0 : -1} /* keyboard-reachable in remove mode */
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmAndRemove(user);
                  }}
                >
                  <IconTrash size={12} aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── CSV Upload portal ── */}
      {adminCsvUpload.showUpload &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black bg-opacity-50"
              onClick={adminCsvUpload.handleCancel}
            />
            <div className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <CsvUpload
                config={AdminCsvUploadConfig}
                existingItems={admins}
                onUploadSuccess={adminCsvUpload.handleUploadSuccess}
                onClose={adminCsvUpload.handleCancel}
              />
            </div>
          </div>,
          document.body,
        )}

      {/* ── CSV Preview portal ── */}
      {createPortal(
        <CsvPreviewModal
          open={adminCsvUpload.showPreview}
          result={adminCsvUpload.uploadResult}
          config={AdminCsvPreviewConfig}
          onConfirm={adminCsvUpload.handleImportConfirm}
          onCancel={adminCsvUpload.handleCancel}
          isProcessing={adminCsvUpload.isProcessing}
        />,
        document.body,
      )}
    </div>
  );
};

export default AdminsCard;
