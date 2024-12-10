import { FC, useState, useEffect, useRef, useContext } from 'react';
import { Plugin, PluginID, PluginList } from '@/types/plugin';
import { IconGripVertical, IconSparkles, IconX } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';

interface Props {
  plugin: Plugin | null;
  onPluginChange: (plugin: Plugin | null) => void;
  setShowPluginSelect: (e:boolean) => void;
  isDragging: boolean;
}

export const PluginSelect: FC<Props> = ({
  plugin,
  onPluginChange,
  setShowPluginSelect,
  isDragging
}) => {

 const {state: { featureFlags }, dispatch: homeDispatch } = useContext(HomeContext);

  //FEATURE FLAG CONSIDERATIONS
  const filterPlugInList = () => {
    return PluginList.filter(plugin => {
             // Do not include the plugin in the list if ragEnabled is false
              if (plugin.id === PluginID.NO_RAG && !featureFlags.ragEnabled) return false; 
              if (plugin.id === PluginID.CODE_INTERPRETER && !featureFlags.codeInterpreterEnabled) return false;
              return true; // Include the plugin in the list if no flags block it
          });
  }

  const validPlugins = filterPlugInList();
  const pluginLen = validPlugins.length;
  const optionsRef = useRef<(HTMLDivElement | null)[]>([]); 
  const [isUsingKeys, setIsUsingKeys] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);


  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    setIsUsingKeys(true);
    e.preventDefault();
    const maxIndex = pluginLen + 1;
    let newIndex = index;

    if (e.key === 'ArrowDown') {
      newIndex = (index + 1) % maxIndex;
    } else if (e.key === 'ArrowUp') {
      newIndex = (index - 1 + maxIndex) % maxIndex;
    } else if (e.key === 'Enter') {
      onPluginChange(index < pluginLen ? validPlugins[newIndex] : null);
    }
    setFocusedIndex(newIndex);
    optionsRef.current[newIndex]?.focus();  
  };

  useEffect(() => {
    if (plugin) {
      const index = validPlugins.findIndex((p:Plugin) => p.id === plugin.id);
      if (index !== -1) {
        optionsRef.current[index]?.focus(); 
        setFocusedIndex(index); 
      }
    } else  {
      optionsRef.current[pluginLen]?.focus();
      setFocusedIndex(pluginLen);
    }
  }, [plugin]);



  return (
    <div className="rounded flex flex-col cursor-pointer border border-neutral-600 bg-neutral-200 dark:bg-[#282834]" 
    style={{ boxShadow: '0 6px 10px rgba(0, 0, 0, 0.3)'}}
      >
      {[...validPlugins, null].map((p, index) => (
        <div
          key={p ? p.id : 'none'}
          ref={el => (optionsRef.current[index] = el)}  
          tabIndex={0}
          className={`border-b border-neutral-600 p-1 ${plugin?.id === p?.id ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-600"} hover:text-neutral-900 dark:hover:text-neutral-100`}
          onClick={() => onPluginChange(plugin?.id === p?.id ? null : p)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          style={{ outline: `${isUsingKeys && focusedIndex === index ? '2px solid #4287f5':'none'}` }} 
          title={ p ? p.title : 'No Feature'}
        >
            {p ? <p.iconComponent /> : <IconX size={24}/>}
        </div>
      ))}

      <div
        className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'} text-neutral-400 border-b border-neutral-600`}
        title='Click and Drag'
      >
        <IconGripVertical className='ml-2 my-1' size={18}  />
      </div>
      
      <div
        className='flex w-full text-neutral-700 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-600'
        onClick={() => setShowPluginSelect(false)}
        title='Close'
      >    
        <IconSparkles className='ml-1' />
           
      </div>
      
    </div>
  );
};