import React, { useState, ReactNode } from 'react';
import { CloseSidebarButton, OpenSidebarButton } from "@/components/Sidebar/components/OpenCloseButton";

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
    const [activeTab, setActiveTab] = useState(0);
    const [isOpen, setIsOpen] = useState(true);
    const childrenArray = React.Children.toArray(children) as React.ReactElement<TabProps>[]; // here we assert that all children are ReactElements
    const toggleOpen = () => setIsOpen(!isOpen);

    const isMultipleTabs = childrenArray.length > 1;

    return isOpen ? (
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
            <CloseSidebarButton onClick={toggleOpen} side={side} />
        </div>
    ) : (
        <OpenSidebarButton onClick={toggleOpen} side={side} />
    );
};


/**
 *
 *



 */


// Usage:
// <TabSidebar side='left' footerComponent={YourFooterComponent}>
//   <Tab icon={<YourIcon1 />}>Content for Tab 1</Tab>
//   <Tab icon={<YourIcon2 />}>Content for Tab 2</Tab>
// </TabSidebar>