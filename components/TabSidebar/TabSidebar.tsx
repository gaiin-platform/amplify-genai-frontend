import React, { useState, useEffect, ReactNode } from 'react';
import { useSidebar } from '@/components/Sidebar/SidebarContext';

interface TabProps {
    icon: ReactNode;
    children: ReactNode;
}

export const Tab: React.FC<TabProps> = ({ icon, children }) => (
    <>{children}</>
)

interface TabSidebarProps {
    side: 'left' | 'right';
    children: React.ReactElement<TabProps> | React.ReactElement<TabProps>[];
    footerComponent?: ReactNode;
}

export const TabSidebar: React.FC<TabSidebarProps> = ({ side, children, footerComponent }) => {
    const { leftSidebarOpen, setLeftSidebarOpen, rightSidebarOpen, setRightSidebarOpen } = useSidebar();
    const [activeTab, setActiveTab] = useState(0);

    const isOpen = side === 'left' ? leftSidebarOpen : rightSidebarOpen;

    const handleWindowSizeChange = () => {
        if (window.innerWidth < 768) { // Assuming 768px as the breakpoint for mobile screens
            setLeftSidebarOpen(false);
            setRightSidebarOpen(false);
        }
    };

    useEffect(() => {
        handleWindowSizeChange(); // Check on mount
        window.addEventListener('resize', handleWindowSizeChange); // Add resize listener

        // Cleanup function to remove the event listener
        return () => {
            window.removeEventListener('resize', handleWindowSizeChange);
        };
    }, []);

    const toggleOpen = () => {
        if (side === 'left') {
            setLeftSidebarOpen(!leftSidebarOpen);
        } else {
            setRightSidebarOpen(!rightSidebarOpen);
        }
    };

    const childrenArray = React.Children.toArray(children) as React.ReactElement<TabProps>[];
    const isMultipleTabs = childrenArray.length > 1;

    if (!isOpen) return null;

    return (
        <div className={`fixed top-0 ${side}-0 z-40 flex h-full w-[280px] flex-none ${side === 'left' ? 'border-r dark:border-r-[#202123]' : 'border-l dark:border-l-[#202123]'}
            flex-col space-y-0 bg-white text-black dark:text-white bg-neutral-100 dark:bg-[#202123] text-[14px] sm:relative sm:top-0`}>
            {isMultipleTabs && (
                <div className="flex flex-row gap-1 bg-neutral-100 dark:bg-[#202123] rounded-t">
                    {childrenArray.map((child, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveTab(index)}
                            className={`px-3 py-2 rounded-t ${activeTab === index ? 'border-l border-t border-r dark:border-gray-500 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                            {child.props.icon}
                        </button>
                    ))}
                </div>
            )}
            <div className="overflow-auto bg-neutral-100 dark:bg-[#202123] p-0 m-0 flex-grow">
                {childrenArray[activeTab].props.children}
            </div>
            <div className="w-full mt-auto p-2 bg-neutral-100 dark:bg-[#202123]">
                {footerComponent}
            </div>
        </div>
    )
};
