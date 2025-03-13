import React from 'react';

interface SimpleSidebarProps {
  side: 'left' | 'right';
}

/**
 * A simplified empty sidebar component that only provides the structure
 * with no content or interactive elements.
 */
const SimpleSidebar: React.FC<SimpleSidebarProps> = ({ side }) => {
  const baseClasses = 'h-full w-full p-2';
  const borderClasses = side === 'left' 
    ? 'border-r border-neutral-300 dark:border-neutral-800' 
    : 'border-l border-neutral-300 dark:border-neutral-800';
  
  return (
    <div className={`${baseClasses} ${borderClasses} bg-gray-50 dark:bg-[#202123]`}>
      {/* Empty sidebar - just maintaining structure */}
    </div>
  );
};

export default SimpleSidebar; 