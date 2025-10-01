import { FC, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ActionButton from "./ActionButton";
import { IconX } from "@tabler/icons-react";

export interface Tabs {
    label: string;
    title?: string;
    content: React.ReactElement;
    id?: string;
}


interface Props {
    id: string;
    tabs: Tabs[];
    initialActiveTab?: number | string;
    onTabChange?: (tabIndex: number, label: string) => void;
    depth?: number;
    onClose?: () => void;
}


export const ActiveTabs: FC<Props> = ({id, tabs, initialActiveTab, onTabChange, depth=0, onClose}) => {
    const activeTabIdx = () => {
        if (typeof initialActiveTab === 'number') return initialActiveTab;
        return tabs.findIndex((tab) => tab.label === initialActiveTab);
    }
    const [activeTab, setActiveTab] = useState<number>(initialActiveTab ? activeTabIdx() : 0);
    const [mounted, setMounted] = useState(false);

    const colors = [
        { name: 'blue', value: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.5)' },
        { name: 'purple', value: '#8b5cf6', shadow: 'rgba(139, 92, 246, 0.5)' },
        { name: 'pink', value: '#ec4899', shadow: 'rgba(236, 72, 153, 0.5)' },
        { name: 'green', value: '#10b981', shadow: 'rgba(16, 185, 129, 0.5)' },
        { name: 'red', value: '#ef4444', shadow: 'rgba(239, 68, 68, 0.5)' }
    ];

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const isActiveTab = (index: number) => {
        return activeTab === index;
    }

    // Find modal content container that has relative positioning
    const getModalContainer = () => {
        const modal = document.getElementById('modal');
        return modal;
    };

    // Calculate the offset needed to position this depth level below all previous depths
    const getTabOffset = () => {
        if (depth === 0) return 0; // Depth 0 stays at natural position
        
        // For nested tabs, we need to account for:
        // 1. The modal header/title area (roughly 60-80px)
        // 2. All previous tab levels (60px each)
        const modalHeaderOffset = 80; // Approximate modal header height
        const previousTabsHeight = depth * 60; // All previous tab levels
        return modalHeaderOffset + previousTabsHeight - 20;
    };
    

    if (tabs && tabs.length === 0 ) return <></>;

    const isNested = depth > 0;
    const modalContainer = isNested ? getModalContainer() : null;

    const tabsElement = (
        <div 
            className="flex flex-row border-b-2 dark:border-white/40 bg-neutral-100 dark:bg-[#2b2c36] overflow-x-auto"
            style={{
                position: isNested ? 'absolute' : 'sticky',
                paddingTop: isNested ? `30px` : '0px',
                top: isNested ? `${getTabOffset()}px` : '0px', // Cumulative positioning for nested tabs
                width: isNested ? '96%' : undefined,
                zIndex: 60 + (10 - depth), // Higher than modal's z-50
                minHeight: '60px',
                overflow: 'hidden',
            }}
        >
            {tabs.map((tab: Tabs, index: number) => 
                <button
                    title={tab.title}
                    key={index}
                    id={tab.id}
                    onClick={() => {
                        setActiveTab(index);
                        if (onTabChange) onTabChange(index, tab.label);
                    }}
                    className={`group relative flex flex-shrink-0 transition-all duration-300 overflow-hidden whitespace-nowrap ${
                        isActiveTab(index) 
                            ? `px-6 py-3 border-b bg-white dark:bg-[#2d2d3a] dark:text-white shadow-lg z-10 translate-y-0 scale-105 font-medium` 
                            : 'px-2 bg-neutral-200/50 dark:bg-[#27282f]/70 text-gray-500 dark:text-gray-400 hover:bg-neutral-100 dark:hover:bg-[#2a2b32] hover:-translate-y-1 translate-y-1 backdrop-blur-sm'
                        }`} 
                    style={{
                        color: isActiveTab(index) ? colors[depth]?.value : '',
                        borderTopLeftRadius: isActiveTab(index) ? '10px' : '0px',
                        borderTopRightRadius: isActiveTab(index) ? '10px' : '0px',
                    }}
                >
                    {/* Tab highlight effect */}
                    <span className={`absolute inset-0 ${isActiveTab(index)  ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'} 
                        transition-opacity duration-300 bg-gradient-to-br from-blue-100/50 to-indigo-200/30 
                        dark:from-blue-800/20 dark:to-purple-900/10`}
                    ></span>

                    {/* Tab bottom border glow */}
                    <span className={`absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-300 ${
                        isActiveTab(index) ? 'opacity-100' : 'opacity-0'
                    }`} 
                    style={{
                        backgroundColor: isActiveTab(index) ? colors[depth]?.value || colors[0].value : 'transparent',
                        boxShadow: isActiveTab(index) ? `0 0 8px ${colors[depth]?.shadow || colors[0].shadow}` : 'none'
                    }}></span>

                    {/* Content wrapper */}
                    <span className={`relative flex items-center justify-center transition-transform duration-300 ${
                        isActiveTab(index) ? 'scale-108 transform' : 'group-hover:scale-105'
                    }`}>
                        <h3 id="tabName" className="text-[18px]">{tab.label}</h3> 
                    </span>
                </button>
            )}

                  {onClose && 
                  <div className="ml-auto mr-2">
                  <ActionButton
                        handleClick={() => {
                            onClose?.();
                        }}
                        title={"Close"}>
                        <IconX size={26}/>
                    </ActionButton>
                    </div>}
        </div>
    );

    return ( 
        <div id={id} className="flex flex-col h-full">
            {/* Portal nested tabs to modal container for absolute positioning */}
            {isNested && mounted && modalContainer ? (
                createPortal(tabsElement, modalContainer)
            ) : (
                tabsElement
            )}
            
            <div 
                className="flex-1 overflow-auto p-4"
                style={{
                    marginTop: isNested ? `${60}px` : undefined, // Space for absolute tabs
                }}
            > 
                {tabs[activeTab]?.content}
            </div>

        </div>

       
    )
}