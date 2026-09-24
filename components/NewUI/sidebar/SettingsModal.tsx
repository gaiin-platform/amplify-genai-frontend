/**
 * SettingsModal — two-column settings panel for the new UI.
 * Opens as a modal overlay (not a sidebar tab).
 * Left rail: nav sections | Right: scrollable content
 *
 * Wraps the existing SettingDialog logic by simply rendering it.
 * In a future phase, sections can be rebuilt with the new design language.
 */
import React, { useEffect, useRef } from 'react';
import { IconX } from '@tabler/icons-react';
import { SettingDialog } from '@/components/Settings/SettingDialog';

interface SettingsModalProps {
  onClose: () => void;
  openToTab?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, openToTab }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on overlay click (but not panel click)
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(2px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      {/* Delegate to existing SettingDialog — passes open=true and the onClose handler */}
      <SettingDialog open={true} onClose={onClose} openToTab={openToTab} />
    </div>
  );
};

export default SettingsModal;
