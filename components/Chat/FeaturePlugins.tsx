import { useCallback, useRef, useState, useContext } from 'react';
import { IconSparkles } from '@tabler/icons-react';
import { Plugin } from '@/types/plugin';
import { PluginSelect } from './PluginSelect';
import HomeContext from '@/pages/api/home/home.context';

interface Props {
    plugin: Plugin | null,
    setPlugin: (p: Plugin) => void
}

const FeaturePlugins = ({ plugin, setPlugin }: Props) => {
    const {
        state: { featureFlags },
    } = useContext(HomeContext);

    const [showPluginSelect, setShowPluginSelect] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const positionRef = useRef({ x: 0, y: 0 });
    const draggableRef = useRef<HTMLDivElement | null>(null);

    const onMouseDrag = useCallback((event: MouseEvent) => {
        const newPosition = {
            x: positionRef.current.x + event.movementX,
            y: positionRef.current.y + event.movementY
        };
        positionRef.current = newPosition;
        if (draggableRef.current) {
            draggableRef.current.style.transform = `translate(${newPosition.x}px, ${newPosition.y}px)`;
        }
        event.preventDefault();
    }, []);

    const startDragging = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        positionRef.current = position; // Sync position with state when starting
        event.preventDefault();
        draggableRef.current = event.currentTarget as HTMLDivElement;
        draggableRef.current.addEventListener('mousemove', onMouseDrag);
        document.addEventListener('mouseup', stopDragging);
    }, [onMouseDrag]);

    const stopDragging = useCallback(() => {
        if (draggableRef.current) {
            draggableRef.current.removeEventListener('mousemove', onMouseDrag);
            setPosition(positionRef.current); // Update React state on stop
        }
        document.removeEventListener('mouseup', stopDragging);
    }, [onMouseDrag]);

    return (
        <>
            <div
                draggable="true"
                onMouseDown={startDragging}
                onMouseUp={stopDragging}
                onMouseLeave={stopDragging}
                style={{
                    position: 'absolute',
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    cursor: 'move',
                    
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    background: 'transparent', 
                }}
                ref={draggableRef}
            >
                <button
                    title='Features'
                    className="p-1 text-neutral-800 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-neutral-600 dark:text-white dark:hover:bg-neutral-500"
                    style={{
                        borderRadius: '50%',
                        width: '34px',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
                        border: 'none',  
                    }}
                >
                    {showPluginSelect ? <IconSparkles size={20} /> : <IconSparkles size={20} />}
                </button>
            </div>

            {/* {showPluginSelect && (
                <div className="absolute left-0 bottom-14 rounded bg-white dark:bg-[#343541]">
                    <PluginSelect
                        plugin={plugin}
                        onPluginChange={(selectedPlugin) => {
                            handle seletc plugin. 1 set home dispatch to no selectedAssistant 
                            setPlugin(selectedPlugin);
                        }}
                    />
                </div>
            )} */}
        </>
    );
}

export default FeaturePlugins;
