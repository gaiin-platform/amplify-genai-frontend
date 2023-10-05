import { useState, ReactNode } from 'react';
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
    children: React.ReactElement<TabProps>[];
    footerComponent?: ReactNode;
}

export const TabSidebar: React.FC<TabSidebarProps> = ({ side, children, footerComponent }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [isOpen, setIsOpen] = useState(true);

    const toggleOpen = () => {
        setIsOpen(!isOpen);
    };

    return isOpen ? (
        <div
            className={`fixed top-0 ${side}-0 z-40 flex h-full w-[280px] flex-none 
            flex-col space-y-2 bg-[#202123] text-[14px] sm:relative sm:top-0`}>
            <div className="flex flex-row gap-1 bg-[#202123] rounded-t">
                {children.map((child, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveTab(index)}
                        className={`px-3 py-2 rounded-t ${activeTab === index ? 'border-l-2 border-t-2 border-r-2 border-gray-500 text-white' : 'text-gray-600'}`}
                    >
                        {child.props.icon}
                    </button>
                ))}
            </div>
            {/* wrap the children's content into a div with a css class that includes overflow management */}
            <div className="overflow-auto bg-[#202123] p-0 m-0 flex-grow">
                {children[activeTab].props.children}
            </div>
            {/* Ensure that the footer is always at the bottom */}
            <div className="w-full mt-auto p-2 bg-[#202123]">
                {footerComponent}
            </div>
            <CloseSidebarButton onClick={toggleOpen} side={side} />
        </div>
    ) : (
        <OpenSidebarButton onClick={toggleOpen} side={side} />
    );
};

// Usage:
// <TabSidebar side='left' footerComponent={YourFooterComponent}>
//   <Tab icon={<YourIcon1 />}>Content for Tab 1</Tab>
//   <Tab icon={<YourIcon2 />}>Content for Tab 2</Tab>
// </TabSidebar>