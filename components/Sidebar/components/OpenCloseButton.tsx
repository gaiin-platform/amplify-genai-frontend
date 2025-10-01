import { IconArrowBarLeft, IconArrowBarRight, IconLayoutSidebar, IconMessage, IconSparkles } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';

interface Props {
  onClick: any;
  side: 'left' | 'right';
  isHovered?: boolean;
}

export const CloseSidebarButton = ({ onClick, side, isHovered}: Props) => {
  const promptSide = () => side === 'right';

  const getSidebarWidth = () => {
    const container = document.querySelector(".sidebar");
    if (container) {
      return `${container.getBoundingClientRect().width - 38}px`;
    }
    return '240px';
  };

  const sidebarWidth = getSidebarWidth();
  
  const getPositionStyle = () => {
    return promptSide() ? { right: sidebarWidth } : { left: sidebarWidth };

  };

  // Determine visibility classes based on hover state
  const getVisibilityClasses = () => {
    if (isHovered === undefined) return 'opacity-100 scale-100';    
    return isHovered 
      ? `opacity-100 scale-100 translate-x-${promptSide() ? '1' : '0'}` 
      : `opacity-0 scale-95 translate-x-${promptSide() ? '0' : '1'}`;
  };

  return (
    <>
      <button
        className={`mt-1 ml-auto h-7 w-7 hover:text-gray-400 dark:text-neutral-200 dark:hover:text-gray-300 sm:top-4 sm:h-8 sm:w-8 sm:text-neutral-700 transition-all duration-300 ease-in-out transform ${getVisibilityClasses()}`}
        style={getPositionStyle()}
        onClick={onClick}
        title="Collapse Sidebar"
        id="collapseSidebar"
      >
        {promptSide() ? <IconArrowBarRight /> : <IconArrowBarLeft />}
      </button>
    </>
  );
};

export const OpenSidebarButton = ({ onClick, side }: Props) => {
  const promptSide = () => side === 'right';
  const [hide, setHide] = useState(false);
  useEffect(() => {
    const events = ['openFullScreenPanel'];
      const handleEvent = (event:any) => {
          const isInterfaceOpen = event.detail.isOpen;
          setHide(isInterfaceOpen);
      };

      events.forEach((e: string) =>  window.addEventListener(e, handleEvent));
      return () => events.forEach((e: string) =>  window.removeEventListener(e, handleEvent));
  }, []);

  const closedButton = () => (
    <div 
          title={`Open ${promptSide() ? 'Chat' : 'Assistant'} Sidebar`}
          className="p-2 text-neutral-800 bg-neutral-100 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 cursor-pointer animate-pop"
          style={{
              borderRadius: '10px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              animation: 'pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              transformOrigin: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1.0)';
          }}
          
      >
          {promptSide() ? <IconSparkles size={24} /> : <IconLayoutSidebar size={24} />}
          <style jsx>{`
            @keyframes pop {
              0% {
                transform: scale(0.8);
                opacity: 0.8;
              }
              50% {
                transform: scale(1.05);
              }
              100% {
                transform: scale(1.0);
                opacity: 1;
              }
            }
            .animate-pop {
              animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
          `}</style>
    </div>
  );

  return (
    <button
      className={`fixed top-4 ${promptSide() ? 'right-4' : 'left-4'} z-50`}
      onClick={onClick}
      id="expandSidebar"
      title="Expand Sidebar"
      disabled={hide}
    > 
      { !hide && closedButton()}
    </button>
  );
};
