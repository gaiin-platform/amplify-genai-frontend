import { useCallback, useRef, useState, useContext, useEffect } from 'react';
import { IconSparkles } from '@tabler/icons-react';
import { Plugin, PluginID, PluginList } from '@/types/plugin';
import { PluginSelector } from './PluginSelector';
import HomeContext from '@/pages/api/home/home.context';
import React from 'react';

interface Props {
    plugins: Plugin[];
    setPlugins: (p: Plugin[]) => void;
}

const FeaturePlugin = ({ plugins, setPlugins }: Props) => {
    const {
        state: { pluginLocation, showPromptbar, showChatbar, }, dispatch: homeDispatch
    } = useContext(HomeContext);

    const codeInterpreterPlugin:Plugin | undefined = PluginList.find((p:Plugin) => p.id === PluginID.CODE_INTERPRETER);

    const [hide, setHide] = useState(false);
    const [showPluginSelect, setShowPluginSelect] = useState(false);
    const showPluginSelectRef = useRef(showPluginSelect);
    const [isDragging, setIsDragging] = useState(false);
    const positionRef = useRef(pluginLocation); 
    const [startPosition, setStartPosition] = useState(positionRef.current);
    const draggableRef = useRef<HTMLDivElement | null>(null);

    const width = 34;

    useEffect(() => {
        showPluginSelectRef.current = showPluginSelect;
      }, [showPluginSelect]);


    useEffect(() => {
        const events = ['openFullScreenPanel'];
        const handleEvent = (event:any) => {
            const isInterfaceOpen = event.detail.isOpen;
            setHide(isInterfaceOpen);
        };

        events.forEach((e: string) =>  window.addEventListener(e, handleEvent));
        return () => events.forEach((e: string) =>  window.removeEventListener(e, handleEvent));
    }, []);


    useEffect(() => {
        const ensureWithinBounds = () => {
            if (!draggableRef.current) return;
    
        const bounds = getBounds();
        if (bounds) {
            let {leftBound, rightBound, topBound, bottomBound} = bounds;
                // Adjust position if it's out of bounds
                const currentPosition = positionRef.current;
                currentPosition.x = Math.max(leftBound, Math.min(currentPosition.x, rightBound));
                currentPosition.y = Math.max(topBound, Math.min(currentPosition.y, bottomBound));
    
                positionRef.current = currentPosition;
                draggableRef.current.style.transform = `translate(${currentPosition.x}px, ${currentPosition.y}px)`;
            }
        };
    
        // Call the function to ensure the plugin is within bounds
        ensureWithinBounds();
    }, [width, showPromptbar, showChatbar,]); // Dependencies array



    const getBounds = () => {
        const container = document.querySelector(".chatcontainer");
        if (container) {
            const containerRect = container.getBoundingClientRect();
        
            // Calculate boundaries
            const leftBound = 0;
            const rightBound = containerRect.right - containerRect.left - width;
            let topBound = 0 - containerRect.height;
            const bottomBound =   topBound + window.innerHeight - width;
            return {leftBound, rightBound, topBound, bottomBound}
        } 
        return null;
    }

    const onMouseDrag = useCallback((event: MouseEvent) => {
        if (!draggableRef.current || !draggableRef.current.parentNode) return;
    
        // Calculate new position
        const newPosition = {
            x: positionRef.current.x + event.movementX,
            y: positionRef.current.y + event.movementY
        };

        const bounds = getBounds();
        if (bounds) {
            let {leftBound, rightBound, topBound, bottomBound} = bounds;
            if (showPluginSelectRef.current) {
                const pluginSelector = document.querySelector(".pluginSelect");
                if (pluginSelector) topBound += pluginSelector.getBoundingClientRect().height - width;
            }  
            
            newPosition.x = Math.max(leftBound, Math.min(newPosition.x, rightBound));
            newPosition.y = Math.max(topBound, Math.min(newPosition.y, bottomBound));
  
            positionRef.current = newPosition;
            draggableRef.current.style.transform = `translate(${newPosition.x}px, ${newPosition.y}px)`;
        } 
        event.preventDefault();
    }, []);
    

    const startDragging = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        setIsDragging(true);
        setStartPosition(positionRef.current);
        event.preventDefault();
        draggableRef.current = event.currentTarget as HTMLDivElement;
        document.addEventListener('mousemove', onMouseDrag);
        document.addEventListener('mouseup', stopDragging);

    }, [onMouseDrag]);

    const stopDragging = useCallback(() => {
        if (draggableRef.current) {
            document.removeEventListener('mousemove', onMouseDrag);
            homeDispatch({ field: 'pluginLocation', value: positionRef.current });
            localStorage.setItem("pluginLocation", JSON.stringify(positionRef.current));
            setIsDragging(false);
        }
        document.removeEventListener('mouseup', stopDragging);
    }, [onMouseDrag]);


    const codeInterpreterEnabled = () => {
        return codeInterpreterPlugin ? !!plugins.find((p:Plugin) => p.id === PluginID.CODE_INTERPRETER) : false;
    }


    return ( hide ? <></> :
        <>
            <div className="relative inline-block z-20 max-h-full" 
                id="selectEnabledFeaturesDrag"
                draggable="true"
                onMouseDown={startDragging}
                onMouseUp={stopDragging}
                style={{
                    cursor: isDragging? "grabbing": "move",
                    transform: `translate(${positionRef.current.x}px, ${positionRef.current.y}px)`,
                    background: 'transparent'
                }}
                ref={draggableRef}
            >
                <div className={`${showPluginSelect ? 'pluginSelect bottom-full absolute mb-[-14px] rounded bg-white dark:bg-[#343541]' : 'hidden'}`}
                >
                    <PluginSelector
                        plugins={plugins}
                        onPluginChange={(selectedPlugins) => {
                            setPlugins(selectedPlugins);
                        }}
                        setShowPluginSelect={setShowPluginSelect}
                        isDragging={isDragging}
                    />
                </div>
                {!showPluginSelect && 
                <button // \nNote: You will not be able to use at the same time as a selected Assistant
                    title={`${!codeInterpreterEnabled() ? "Select Enabled Features" : codeInterpreterPlugin?.name}`}
                    className="p-1.5 text-neutral-800 bg-neutral-100 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-neutral-600 dark:text-white dark:hover:bg-neutral-500"
                    id="selectEnabledFeaturesClick" 
                    style={{
                        cursor: isDragging? "grabbing": "pointer",
                        borderRadius: '50%',
                        width: '34px',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
                        border: `${codeInterpreterEnabled() ? '1px solid #00ff00' : 'none'}`, 
                        transition: 'all 0.7s ease' 
                        
                    }}
                    onClick={() => {if ( startPosition === positionRef.current ) setShowPluginSelect(!showPluginSelect)}
                    }
                >
                    {showPluginSelect || !codeInterpreterEnabled() ? <IconSparkles size={24} /> : codeInterpreterPlugin && <codeInterpreterPlugin.iconComponent/>}
                </button>
            }

            </div>
        </>
    );
}

export default FeaturePlugin;
