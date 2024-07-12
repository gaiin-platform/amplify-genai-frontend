import { useCallback, useRef, useState, useContext, useEffect } from 'react';
import { IconSparkles } from '@tabler/icons-react';
import { Plugin } from '@/types/plugin';
import { PluginSelect } from './PluginSelect';
import HomeContext from '@/pages/api/home/home.context';

interface Props {
    plugin: Plugin | null,
    setPlugin: (p: Plugin | null) => void
}

const FeaturePlugins = ({ plugin, setPlugin }: Props) => {
    const {
        state: { pluginLocation }, dispatch: homeDispatch
    } = useContext(HomeContext);


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

    const onMouseDrag = useCallback((event: MouseEvent) => {
        if (!draggableRef.current || !draggableRef.current.parentNode) return;
    
        // Calculate new position
        const newPosition = {
            x: positionRef.current.x + event.movementX,
            y: positionRef.current.y + event.movementY
        };

        const container = document.querySelector(".container");
        if (container) {
            const containerRect = container.getBoundingClientRect();
        
            // Calculate boundaries
            const leftBound = 0;
            const rightBound = containerRect.right - containerRect.left - width;
            let topBound = 0 - containerRect.height + width;
            const bottomBound =   topBound + window.innerHeight - width;

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



    return (
        <>
            <div className="`relative inline-block z-20 " 
                draggable="true"
                onMouseDown={startDragging}
                onMouseUp={stopDragging}
                style={{
                    cursor: isDragging? "grabbing": "move",
                    transform: `translate(${positionRef.current.x}px, ${positionRef.current.y}px)`,
                    background: 'transparent', 
                }}
                ref={draggableRef}
            >
                {showPluginSelect ?
                (
                <div className="pluginSelect bottom-full absolute mb-[-14px] rounded bg-white dark:bg-[#343541]"
                >
                    <PluginSelect
                        plugin={plugin}
                        onPluginChange={(selectedPlugin) => {
                            setPlugin(selectedPlugin);
                        }}
                        setShowPluginSelect={setShowPluginSelect}
                        isDragging={isDragging}
                    />
                </div>
                ) :
                (
                <button
                    title={`${!plugin ? "Select Feature\nNote: You will not be able to use at the same time as a selected Assistant" : plugin.name}`}
                    className="p-1.5 text-neutral-800 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-neutral-600 dark:text-white dark:hover:bg-neutral-500"
                    style={{
                        cursor: isDragging? "grabbing": "pointer",
                        borderRadius: '50%',
                        width: '34px',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
                        border: `${plugin && !showPluginSelect ? '1px solid #00ff00' : 'none'}`, 
                        transition: 'all 0.7s ease' 
                        
                    }}
                    onClick={() => {if ( startPosition === positionRef.current ) setShowPluginSelect(!showPluginSelect)}
                    }
                >
                    {showPluginSelect || !plugin? <IconSparkles size={24} /> : <plugin.iconComponent/>}
                </button>
            )}

            </div>
        </>
    );
}

export default FeaturePlugins;
