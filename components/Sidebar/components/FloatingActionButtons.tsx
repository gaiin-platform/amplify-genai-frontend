import React, { useState, useEffect, useRef } from 'react';
import { IconMessage, IconRobot } from '@tabler/icons-react';

interface Props {
  side: 'left' | 'right';
  onNewChat: () => void;
  onAssistantGallery: () => void;
}

export const FloatingActionButtons = ({ side, onNewChat, onAssistantGallery }: Props) => {
  const promptSide = () => side === 'right';
  const [hide, setHide] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const events = ['openFullScreenPanel'];
    const handleEvent = (event: any) => {
      const isInterfaceOpen = event.detail.isOpen;
      setHide(isInterfaceOpen);
    };

    events.forEach((e: string) => window.addEventListener(e, handleEvent));
    return () => events.forEach((e: string) => window.removeEventListener(e, handleEvent));
  }, []);

  // Mouse proximity detection
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!pillRef.current) return;

      const rect = pillRef.current.getBoundingClientRect();
      const proximityThreshold = 100; // pixels from the pill to trigger expansion

      // Calculate distance from mouse to pill
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      const pillCenterX = rect.left + rect.width / 2;
      const pillCenterY = rect.top + rect.height / 2;

      const distance = Math.sqrt(
        Math.pow(mouseX - pillCenterX, 2) + Math.pow(mouseY - pillCenterY, 2)
      );

      if (distance < proximityThreshold) {
        // Clear any pending collapse
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setIsExpanded(true);
      } else if (distance > proximityThreshold + 50) {
        // Add delay before collapsing
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => {
          setIsExpanded(false);
        }, 100);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  if (hide) return null;

  return (
    <>
      <div
        ref={pillRef}
        className={`fixed ${promptSide() ? 'right-4' : 'left-4'} z-30
          bg-neutral-100 dark:bg-gray-800
          rounded-b-[20px]
          shadow-lg
          transition-all duration-200 ease-out
          overflow-hidden`}
        style={{
          top: '56px', // Position right below the sidebar button (40px button + 16px top margin)
          width: '40px',
          maxHeight: isExpanded ? '100px' : '0px',
          opacity: isExpanded ? 1 : 0,
          paddingTop: isExpanded ? '8px' : '0px',
          paddingBottom: isExpanded ? '8px' : '0px',
          paddingLeft: '0px',
          paddingRight: '0px',
        }}
      >
        <div className="flex flex-col gap-2 items-center">
          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            title="New Chat"
            className="text-neutral-800 hover:bg-neutral-200 dark:text-white dark:hover:bg-gray-700
              cursor-pointer rounded-full transition-all duration-200 hover:scale-110"
            style={{
              width: '34px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconMessage size={24} />
          </button>

          {/* Assistant Gallery Button */}
          <button
            onClick={onAssistantGallery}
            title="Assistant Gallery"
            className="text-neutral-800 hover:bg-neutral-200 dark:text-white dark:hover:bg-gray-700
              cursor-pointer rounded-full transition-all duration-200 hover:scale-110"
            style={{
              width: '34px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconRobot size={25} />
          </button>
        </div>
      </div>
    </>
  );
};
