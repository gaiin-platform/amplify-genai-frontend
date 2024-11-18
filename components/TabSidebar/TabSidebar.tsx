import React, { useState, useEffect, ReactNode, useContext, useRef } from 'react';
import { CloseSidebarButton, OpenSidebarButton } from "@/components/Sidebar/components/OpenCloseButton";
import HomeContext from '@/pages/api/home/home.context';
import { AssistantAdminUI, CreateAdminDialog } from '../Admin/AssistantAdminUI';
import { AdminUI } from '../Admin/AdminUI';

interface TabProps {
    icon: ReactNode;
    children: ReactNode;
    title?: string;
}

export const Tab: React.FC<TabProps> = ({ icon, children }) => (
    <>{children}</>
)

interface TabSidebarProps {
    side: 'left' | 'right';
    children: React.ReactElement<TabProps> | React.ReactElement<TabProps>[];
    footerComponent?: ReactNode;
}

// detect mobile browser
const isMobileBrowser = () => {
    const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
};

export const TabSidebar: React.FC<TabSidebarProps> = ({ side, children, footerComponent }) => {
    const { state: { page, syncingPrompts }, dispatch: homeDispatch } = useContext(HomeContext);
    const [activeTab, setActiveTab] = useState(0);
    // Set the initial state based on whether the user is on a mobile browser
    const [isOpen, setIsOpen] = useState(!isMobileBrowser());
    const [showAssistantAdmin, setShowAssistantAdmin] = useState<boolean>(false);
    const [showAdminInterface, setShowAdminInterface] = useState<boolean>(false);

    const [isArtifactsOpen, setIsArtifactsOpen] = useState<boolean>(false);
    const [groupModalData, setGroupModalData] = useState<any>(undefined);


    const childrenArray = React.Children.toArray(children) as React.ReactElement<TabProps>[]; // here we assert that all children are ReactElements
    const toggleOpen = () => setIsOpen(!isOpen);

    const isMultipleTabs = childrenArray.length > 1;

    const handleAdmin = (isOpen: boolean) => {
        if (isOpen && isArtifactsOpen)  window.dispatchEvent(new CustomEvent('openArtifactsTrigger', { detail: { isOpen: false }} ));
        setIsOpen(!isOpen);
    }

    useEffect(() => {
        const handleAstAdminEvent = (event:any) => {
            const isAdminOpen = event.detail.isOpen;
            handleAdmin(isAdminOpen);
            setGroupModalData(event.detail.data);
            setShowAssistantAdmin(isAdminOpen);  
        };

        const handleAdminEvent = (event:any) => {
            const isAdminOpen = event.detail.isOpen;
            handleAdmin(isAdminOpen);
            setShowAdminInterface(isAdminOpen);  
        };

        const handleArtifactEvent = (event:any) => {
            const isArtifactsOpen = event.detail.isOpen;
            setIsOpen(!isArtifactsOpen);
            setIsArtifactsOpen(isArtifactsOpen);
        };

        window.addEventListener('openAstAdminInterfaceTrigger', handleAstAdminEvent);
        window.addEventListener('openAdminInterfaceTrigger', handleAdminEvent);
        window.addEventListener('openArtifactsTrigger', handleArtifactEvent);
        return () => {
            window.removeEventListener('openAstAdminInterfaceTrigger', handleAstAdminEvent);
            window.removeEventListener('openAdminInterfaceTrigger', handleAdminEvent);
            window.removeEventListener('openArtifactsTrigger', handleArtifactEvent);
        };
    }, []);

    
    useEffect(() => {
        if ( isOpen) setShowAssistantAdmin(false);
    }, [isOpen]);

    const triggerOnce = () => {
        return side === 'left'
    };

    return isOpen ? (
        
        <div className={`fixed top-0 ${side}-0 flex h-full w-[280px] flex-none ${side === 'left' ? 'border-r dark:border-r-[#202123]' : 'border-l dark:border-l-[#202123]'}
            flex-col space-y-0 bg-white text-black dark:text-white bg-[#f3f3f3] dark:bg-[#202123] text-[14px] sm:relative sm:top-0`} 
            
            style={{
                zIndex: '20 !important'
              }}>
            {isMultipleTabs && (
                <div className="mt-1 ml-1 flex flex-row gap-1 bg-neutral-100 dark:bg-[#202123] rounded-t">
                    {childrenArray.map((child, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveTab(index)}
                            title={child.props.title}
                            className={`px-3 py-2 rounded-t ${activeTab === index ? 'border-l border-t border-r dark:border-gray-500 dark:text-white shadow-[1px_0_1px_rgba(0,0,0,0.1),-1px_0_1px_rgba(0,0,0,0.1)] dark:shadow-[1px_0_3px_rgba(0,0,0,0.3),-1px_0_3px_rgba(0,0,0,0.3)]' : 'text-gray-400 dark:text-gray-600'}`}>
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
        //if we are going to use collapse side bars, interface takes up whole page, we can list the item here 
        <>
        {(isArtifactsOpen && triggerOnce() || !isArtifactsOpen) && <OpenSidebarButton onClick={toggleOpen} side={side} isDisabled={showAssistantAdmin}/>}
        
        <AssistantAdminUI
            open={showAssistantAdmin && triggerOnce()}
            openToGroup={groupModalData?.group}
            openToAssistant={groupModalData?.assistant}
        />

        <AdminUI
            open={showAdminInterface && triggerOnce()}
            onClose={() => {
                window.dispatchEvent(new CustomEvent('openAdminInterfaceTrigger', { detail: { isOpen: false }} ));
            }  }
        />
        </>
        
    );
};


// Usage:
// <TabSidebar side='left' footerComponent={YourFooterComponent}>
//   <Tab icon={<YourIcon1 />}>Content for Tab 1</Tab>
//   <Tab icon={<YourIcon2 />}>Content for Tab 2</Tab>
// </TabSidebar>