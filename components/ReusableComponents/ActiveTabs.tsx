import { FC, useState } from "react";

interface tab {
    label: string;
    title?: string;
    content: React.ReactElement;
}


interface Props {
    tabs: tab[];
}


export const ActiveTabs: FC<Props> = ({tabs}) => {
    const [activeTab, setActiveTab] = useState<number>(0);

    if (tabs && tabs.length === 0 ) return <></>;
    return ( 
        <div className="flex flex-col gap-2">
            <div className="mb-auto w-full flex flex-row gap-1 rounded-t border-b dark:border-white/20 z-60">
                    {tabs.map((tab: tab, index: number) => 
                        <button
                            title={tab.title}
                            key={index}
                            onClick={() => setActiveTab(index)}
                            className={`p-2 rounded-t flex flex-shrink-0 ${activeTab === index ? 'border-l border-t border-r dark:border-gray-500 dark:text-white  shadow-[1px_0_1px_rgba(0,0,0,0.1),-1px_0_1px_rgba(0,0,0,0.1)] dark:shadow-[1px_0_3px_rgba(0,0,0,0.3),-1px_0_3px_rgba(0,0,0,0.3)]' : 'text-gray-400 dark:text-gray-600'}`}>
                            <h3 className="text-xl">{tab.label}</h3> 
                        </button>
                    
                    )}
                    
            </div>
                        
            {tabs[activeTab].content} 

        </div>

       
    )
}