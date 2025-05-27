import { FC, useEffect, useRef, useState } from "react";

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
    depth?: number
    overflow?: string
}


export const ActiveTabs: FC<Props> = ({id, tabs, initialActiveTab, onTabChange, depth=0, overflow}) => {
    const activeTabIdx = () => {
        if (typeof initialActiveTab === 'number') return initialActiveTab;
        return tabs.findIndex((tab) => tab.label === initialActiveTab);
    }
    const [activeTab, setActiveTab] = useState<number>(initialActiveTab ? activeTabIdx() : 0);

    const colors = [
        { name: 'blue', value: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.5)' },
        { name: 'purple', value: '#8b5cf6', shadow: 'rgba(139, 92, 246, 0.5)' },
        { name: 'pink', value: '#ec4899', shadow: 'rgba(236, 72, 153, 0.5)' },
        { name: 'green', value: '#10b981', shadow: 'rgba(16, 185, 129, 0.5)' },
        { name: 'red', value: '#ef4444', shadow: 'rgba(239, 68, 68, 0.5)' }
    ];
    const tabRef = useRef<HTMLDivElement>(null); 
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
        if (tabRef.current) {
            setContainerWidth(tabRef.current.offsetWidth);
        }
    }, []);

    useEffect(() => {
        const updateWidth = () => {
            if (tabRef.current) {
                setContainerWidth(tabRef.current.offsetWidth);
            }
        };
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const isActiveTab = (index: number) => {
        return activeTab === index;
    }
    

    if (tabs && tabs.length === 0 ) return <></>;
    return ( 
        <div ref={tabRef} id={id} className={`flex flex-col gap-2 ${overflow}`}>
            <div className={`fixed flex flex-row gap-1 rounded-t border-b-2 dark:border-white/40 bg-neutral-100 dark:bg-[#2b2c36]`}
              style={{
                width: containerWidth,
                overflowY: 'hidden', 
                paddingTop: depth * 40, 
                transform: `translateY(${depth * -40}px)`,
                zIndex: 50 - depth // Higher depth gets lower z-index to prevent overlap
              }}>
                    {tabs.map((tab: Tabs, index: number) => 
                        <button
                            title={tab.title}
                            key={index}
                            id={tab.id}
                            onClick={() => {
                                setActiveTab(index);
                                if (tabRef && tabRef.current) tabRef.current.scrollIntoView({ block: 'start' });
                                if (onTabChange) onTabChange(index, tab.label);
                            }}
                            className={`group relative p-2 rounded-t flex flex-shrink-0 transition-all duration-300 overflow-hidden ${
                                isActiveTab(index) 
                                    ? `px-6 py-3 border-b bg-white dark:bg-[#2d2d3a] dark:text-white shadow-lg z-10 translate-y-0 scale-105 font-medium` 
                                    : 'bg-neutral-200/50 dark:bg-[#27282f]/70 text-gray-500 dark:text-gray-400 hover:bg-neutral-100 dark:hover:bg-[#2a2b32] hover:-translate-y-1 translate-y-1 backdrop-blur-sm'
                                }`} 
                            style={{color: isActiveTab(index) ? colors[depth]?.value : ''}}>
                            {/* Tab highlight effect */}
                            <span className={`absolute inset-0 ${isActiveTab(index)  ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'} 
                                transition-opacity duration-300 bg-gradient-to-br from-blue-100/50 to-indigo-200/30 
                                dark:from-blue-800/20 dark:to-purple-900/10`}></span>
    
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
                    
            </div>      
            <div className="pt-[80px] mr-6"> 
                {tabs[activeTab]?.content}
            </div>

        </div>

       
    )
}