/**
 * NewStorageSection — new-UI styled Conversation Storage settings section.
 * PORT: Logic ported from components/Settings/ConversationStorage.tsx
 *       DO NOT MODIFY the original component.
 *
 * What this section does (all from original):
 *  - Four card options: local-only | cloud-only | future-local | future-cloud
 *  - Pending selection pattern (local state, confirmed on save)
 *  - Confirmation dialog before save (same as handleSaveWithConfirmation)
 *  - Calls saveStorageSettings + handleStorageSelection on save
 *  - Progress bar during bulk migration (storageProcessing from HomeContext)
 *  - Wires settingsSave event exactly like the original
 */

import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { IconCloud, IconMessage, IconInfoCircle } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { handleStorageSelection, saveStorageSettings } from '@/utils/app/conversationStorage';
import { ConversationStorage } from '@/types/conversationStorage';
import { saveConversations } from '@/utils/app/conversation';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Storage option definitions (matches original's four choices)
// ─────────────────────────────────────────────────────────────────────────────

interface StorageOption {
  id: ConversationStorage;
  title: string;
  description: string;
}

const STORAGE_OPTIONS: StorageOption[] = [
  {
    id: 'local-only',
    title: 'Local only',
    description: 'All conversations stored in your browser. No cloud sync.',
  },
  {
    id: 'future-local',
    title: 'Local going forward',
    description:
      'New conversations saved locally. Existing conversations stay where they are.',
  },
  {
    id: 'cloud-only',
    title: 'Cloud only',
    description: 'All conversations synced to cloud. Access from any device.',
  },
  {
    id: 'future-cloud',
    title: 'Cloud going forward',
    description:
      'New conversations synced to cloud. Existing conversations stay where they are.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const NewStorageSection: FC = () => {
  const {
    dispatch: homeDispatch,
    state: {
      conversations,
      selectedConversation,
      folders,
      statsService,
      storageSelection,
      storageProcessing,
    },
  } = useContext(HomeContext);

  const [pendingSelection, setPendingSelection] = useState<ConversationStorage | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedOption: string = pendingSelection ?? (storageSelection || '');
  const hasChanges = pendingSelection !== null && pendingSelection !== storageSelection;

  // Refs for async closures (same pattern as original)
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const foldersRef = useRef(folders);
  useEffect(() => { foldersRef.current = folders; }, [folders]);

  // ── Confirmation message (ported verbatim from original)
  const confirmationMessage = (option: string): string => {
    switch (option) {
      case 'local-only':
        return 'Any conversations stored in the cloud will be moved locally to your browser. All conversations created in the future will be stored locally.';
      case 'cloud-only':
        return 'Any conversations stored locally will be moved to the cloud. All conversations created in the future will automatically be uploaded to the cloud.';
      case 'future-local':
        return 'Only new conversations will be stored locally. Existing conversations will remain where they are currently stored.';
      case 'future-cloud':
        return 'Only new conversations will be uploaded to the cloud. Existing conversations will remain where they are currently stored.';
      default:
        return '';
    }
  };

  // ── Core save logic (ported from original handleSave)
  const doSave = async (selection: ConversationStorage) => {
    setSaving(true);
    const isAllOption = selection === 'local-only' || selection === 'cloud-only';

    if (isAllOption) {
      homeDispatch({
        field: 'storageProcessing',
        value: {
          isProcessing: true,
          message:
            selection === 'local-only'
              ? 'Moving all conversations to local storage...'
              : 'Moving all conversations to cloud storage...',
          progress: 0,
          total: 0,
        },
      });
      // Small delay so the progress bar renders before async work starts
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    try {
      setPendingSelection(null);
      saveStorageSettings(selection as ConversationStorage);
      homeDispatch({ field: 'storageSelection', value: selection });

      const updatedConversations = await handleStorageSelection(
        selection,
        conversationsRef.current,
        foldersRef.current,
        statsService,
        (current, total) => {
          homeDispatch({
            field: 'storageProcessing',
            value: {
              isProcessing: true,
              message:
                selection === 'local-only'
                  ? 'Moving all conversations to local storage...'
                  : 'Moving all conversations to cloud storage...',
              progress: current,
              total,
            },
          });
        },
      );

      if (updatedConversations) {
        homeDispatch({ field: 'conversations', value: updatedConversations });
        saveConversations(updatedConversations);
        if (selectedConversation) {
          const updated = updatedConversations.find((c) => c.id === selectedConversation.id);
          homeDispatch({ field: 'selectedConversation', value: updated });
        }
      }

      toast('Storage Settings Saved');
    } catch (error) {
      console.error('[NewStorageSection] Error during save:', error);
      toast.error('Failed to save storage settings');
    } finally {
      homeDispatch({
        field: 'storageProcessing',
        value: { isProcessing: false, message: '', progress: 0, total: 0 },
      });
      setSaving(false);
    }
  };

  // ── Save with confirmation (ported from handleSaveWithConfirmation)
  const handleSave = async () => {
    if (!hasChanges || !pendingSelection) return;
    const message = confirmationMessage(pendingSelection);
    const confirmed = confirm(message);
    if (!confirmed) return;
    await doSave(pendingSelection);
  };

  // ── Wire settingsSave event (same pattern as original)
  useEffect(() => {
    window.addEventListener('settingsSave', handleSave);
    return () => window.removeEventListener('settingsSave', handleSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges, pendingSelection]);

  // ── Reset pending when unmounted without saving
  useEffect(() => {
    const handleCleanup = () => {
      setPendingSelection(null);
    };
    window.addEventListener('cleanupApiKeys', handleCleanup);
    return () => window.removeEventListener('cleanupApiKeys', handleCleanup);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ─── Static info callout ─── */}
      <div style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '4px solid var(--accent)',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        fontSize: '13px',
        color: 'var(--text-secondary)',
      }}>
        <IconInfoCircle size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent)' }} />
        <span>
          These are default settings that may be overridden at the conversation level.
          If you are concerned with privacy, store conversations locally — they will not be
          available across devices.{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            This configuration applies to the current browser only.
          </strong>
        </span>
      </div>

      {/* ─── Storage option cards ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
          Where would you like to store your conversations?
        </p>
        {STORAGE_OPTIONS.map((opt) => {
          const isSelected = selectedOption === opt.id;
          return (
            <label
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-subtle)',
                borderLeft: `4px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                borderRadius: '8px',
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'border-color 0.12s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLLabelElement).style.background = 'var(--bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLLabelElement).style.background = 'var(--bg-raised)';
                }
              }}
            >
              {/* Radio dot */}
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border-color 0.12s, background 0.12s',
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#fff',
                    }}
                  />
                )}
              </div>
              {/* Hidden real radio for a11y */}
              <input
                type="radio"
                name="storageOption"
                value={opt.id}
                checked={isSelected}
                onChange={() =>
                  setPendingSelection(
                    opt.id === storageSelection ? null : opt.id,
                  )
                }
                style={{ display: 'none' }}
              />
              {/* Text */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '2px',
                }}>
                  {opt.title}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {opt.description}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* ─── Pending change info callout ─── */}
      {hasChanges && pendingSelection && (
        <div style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-subtle)',
          borderLeft: '4px solid var(--accent)',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}>
          <IconInfoCircle size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent)' }} />
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>When saved: </strong>
            {confirmationMessage(pendingSelection)}
          </span>
        </div>
      )}

      {/* ─── Migration progress bar ─── */}
      {storageProcessing?.isProcessing && (
        <div>
          <div style={{
            height: '4px',
            background: 'var(--bg-active)',
            borderRadius: '2px',
            overflow: 'hidden',
            marginBottom: '6px',
          }}>
            <div style={{
              height: '100%',
              background: 'var(--accent)',
              width:
                storageProcessing.total > 0
                  ? `${Math.min(100, (storageProcessing.progress / storageProcessing.total) * 100)}%`
                  : '60%',
              transition: 'width 0.3s ease',
              borderRadius: '2px',
            }} />
          </div>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            {storageProcessing.message}
          </p>
        </div>
      )}

      {/* ─── Save button ─── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          style={{
            height: '36px',
            padding: '0 20px',
            borderRadius: '8px',
            border: 'none',
            background: hasChanges && !saving ? 'var(--accent)' : 'var(--bg-active)',
            color: hasChanges && !saving ? '#fff' : 'var(--text-muted)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default NewStorageSection;
