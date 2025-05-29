import React, { useState, useEffect, ReactNode, useContext, useRef } from 'react';
import { CloseSidebarButton, OpenSidebarButton } from "@/components/Sidebar/components/OpenCloseButton";
import HomeContext from '@/pages/api/home/home.context';
import { AssistantAdminUI } from '../Admin/AssistantAdminUI';
import { AdminUI } from '../Admin/AdminUI';
import { UserCostsModal } from '../Admin/UserCostModal';

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
    children: (React.ReactElement<TabProps> | null)[] | React.ReactElement<TabProps> | null;
    footerComponent?: ReactNode;
}

// detect mobile browser
const isMobileBrowser = () => {
    const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
};

export const TabSidebar: React.FC<TabSidebarProps> = ({ side, children, footerComponent }) => {
    const { state: { featureFlags, showChatbar, showPromptbar }, dispatch: homeDispatch } = useContext(HomeContext);
    const featureFlagsRef = useRef(featureFlags);

    const chatSide = () => side === 'left';

    useEffect(() => {
        featureFlagsRef.current = featureFlags;
        window.dispatchEvent(new Event('updateFeatureSettings'));
    }, [featureFlags]);

    const [activeTab, setActiveTab] = useState(0);
    // Set the initial state based on whether the user is on a mobile browser
    const [isOpen, setIsOpen] = useState(isMobileBrowser()? false : (chatSide() ? showChatbar : showPromptbar));
    const [isHovered, setIsHovered] = useState<boolean>(false);

    const childrenArray = React.Children.toArray(children) 
                                        .filter((child): child is React.ReactElement<TabProps> => 
                                            React.isValidElement(child) && child !== null
                                        ); 

    const toggleOpen = () => {
        const updateIsOpen = !isOpen;
        setIsOpen(updateIsOpen);
        const sideBar = chatSide() ? 'showChatbar' : 'showPromptbar';
        homeDispatch({ field: sideBar, 
                       value: updateIsOpen });
        localStorage.setItem(sideBar, JSON.stringify(updateIsOpen));
    }

    const isMultipleTabs = childrenArray.length > 1;


    useEffect(() => {
        const handleTabSwitchEvent = (event:any) => {
            if (isMultipleTabs) {
                const detail = event.detail;
                const eventSide = detail.side;
                if (side === eventSide && !isOpen) setIsOpen(true);
                // if (eventSide === 'right' && isArtifactsOpen) setIsArtifactsOpen(false);
                
                const switchToIndex = childrenArray.findIndex(
                    (child) => child.props.title === detail.tab
                );
                setActiveTab(switchToIndex);
                if (detail.action) {
                    setTimeout(() => {
                    detail.action();
                    console.log("detail.action", detail.action);
                    }, 50);
                }
            }
        };

        const handleArtifactEvent = (event:any) => {
            const isArtifactsOpen = event.detail.isOpen;
            if (isArtifactsOpen) {
                setIsOpen(false);
            } else {
                // honor users open state preference
                const showChatbar = localStorage.getItem('showChatbar');
                setIsOpen(!!showChatbar ? showChatbar === 'true' : true);
        
            }
        };

        window.addEventListener('openArtifactsTrigger', handleArtifactEvent);
        window.addEventListener('homeChatBarTabSwitch', handleTabSwitchEvent);

        return () => {
            window.removeEventListener('homeChatBarTabSwitch', handleTabSwitchEvent);
            window.removeEventListener('openArtifactsTrigger', handleArtifactEvent);
        };
    }, []);


    return isOpen ? (
        
        <div className={`fixed top-0 ${side}-0 flex h-full w-[280px] flex-none ${chatSide()? 'border-r dark:border-r-[#202123]' : 'border-l dark:border-l-[#202123]'}
            flex-col space-y-0 bg-white text-black dark:text-white bg-[#f3f3f3] dark:bg-[#202123] text-[14px] sm:relative sm:top-0`} 
            id="sideBar"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                zIndex: '20 !important'
              }}>
            {isMultipleTabs && (
                <div className="relative flex flex-row gap-1 px-3 pt-3 pb-0 bg-gradient-to-r from-neutral-100 to-neutral-50 dark:from-[#202123] dark:to-[#1c1c1e] overflow-hidden">
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50/30 via-purple-50/20 to-pink-50/30 dark:from-blue-900/5 dark:via-purple-900/5 dark:to-pink-900/5 animate-gradient-x"></div>
                    {!chatSide() && <CloseSidebarButton onClick={toggleOpen} side={side} isHovered={isHovered} /> } 
                    {childrenArray.map((child, index) => (
                        <button
                            key={index}
                            id="tabSelection"
                            onClick={() => setActiveTab(index)}
                            title={child.props.title}
                            className={`group relative px-5 pb-2.5 pt-2 rounded-t transition-all duration-300 overflow-hidden ${
                                activeTab === index 
                                    ? 'border-b bg-white dark:bg-[#2d2d3a] text-blue-600 dark:text-blue-400 shadow-lg z-10 translate-y-0 scale-105 font-medium' 
                                    : 'bg-neutral-200/50 dark:bg-[#27282f]/70 text-gray-500 dark:text-gray-400 hover:bg-neutral-100 dark:hover:bg-[#2a2b32] hover:-translate-y-1 translate-y-1 backdrop-blur-sm'
                                }`}>
                                {/* Tab highlight effect */}
                                <span className={`absolute inset-0 ${activeTab === index ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'} 
                                    transition-opacity duration-300 bg-gradient-to-br from-blue-100/50 to-indigo-200/30 
                                    dark:from-blue-800/20 dark:to-purple-900/10`}></span>
    
                                {/* Tab bottom border glow */}
                                <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                                    activeTab === index ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-transparent'
                                }`}></span>
    
                                {/* Icon wrapper with animations */}
                                <span className={`relative flex items-center justify-center transition-transform duration-300 ${
                                    activeTab === index ? 'scale-110 transform' : 'group-hover:scale-105'
                                }`}>
                                    {React.cloneElement(child.props.icon as React.ReactElement, {
                                        className: `transition-all duration-300 flex-shrink-0 h-6 mb-2 ${
                                            activeTab === index ? 'text-blue-500 filter drop-shadow-md' : 
                                            'text-gray-500 dark:text-gray-400 group-hover:text-blue-500/70 dark:group-hover:text-blue-400/70'
                                        }`
                                    })}
                                </span>
                        </button>
                    ))}
                    {chatSide() && <CloseSidebarButton onClick={toggleOpen} side={side} isHovered={isHovered} /> } 
                </div>
            )}
            <div className="relative overflow-hidden">
                {/* Content fade-in effect */}
                <div className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-20 bg-gradient-to-b from-blue-100 to-transparent dark:from-blue-900/30 h-8"></div>

                <div className="overflow-auto bg-white dark:bg-[#202123] p-0 m-0 flex-grow transition-all duration-300 ease-in-out">
                    <div className="animate-fade-in">
                        {childrenArray[activeTab].props.children}
                    </div>
                </div>
            </div>
            <div className="w-full mt-auto p-2 bg-white dark:bg-[#202123]">
                {footerComponent}
            </div>
        </div>
    ) : ( <OpenSidebarButton onClick={toggleOpen} side={side}/> );
};
