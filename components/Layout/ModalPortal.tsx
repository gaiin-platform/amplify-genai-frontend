import React, { useEffect, useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import HomeContext from '@/pages/api/home/home.context';

interface ModalPortalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export const ModalPortal: React.FC<ModalPortalProps> = ({ 
  children, 
  isOpen, 
  onClose 
}) => {
  const { state: { lightMode } } = useContext(HomeContext);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Only create or access the portal container when the modal is open
  useEffect(() => {
    if (!isOpen) {
      setPortalContainer(null);
      return;
    }

    // Create a div for the portal if it doesn't exist
    let modalRoot = document.getElementById('modal-portal-root');

    if (!modalRoot) {
      modalRoot = document.createElement('div');
      modalRoot.id = 'modal-portal-root';

      // Apply theme based on lightMode from context
      if (lightMode) {
        modalRoot.classList.add('light');
        modalRoot.classList.remove('dark');
      } else {
        modalRoot.classList.add('dark');
        modalRoot.classList.remove('light');
      }

      document.body.appendChild(modalRoot);
    } else {
      // Update theme based on lightMode from context
      if (lightMode) {
        modalRoot.classList.add('light');
        modalRoot.classList.remove('dark');
      } else {
        modalRoot.classList.add('dark');
        modalRoot.classList.remove('light');
      }
    }

    setPortalContainer(modalRoot);

    // Prevent scrolling when modal is open
    document.body.style.overflow = 'hidden';

    // Clean up function
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, lightMode]);

  // Listen for escape key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // Handle backdrop click to close
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !portalContainer) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white dark:bg-[#202123] rounded-lg shadow-xl max-h-[90vh] max-w-[90vw] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    portalContainer
  );
};

export default ModalPortal;
