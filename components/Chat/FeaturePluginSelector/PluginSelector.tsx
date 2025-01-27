import { FC, useState, useEffect, useRef, useContext } from 'react';
import { Plugin, PluginID, PluginList } from '@/types/plugin';
import { IconGripVertical, IconSparkles, IconX } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { getSettings } from '@/utils/app/settings';
import { getActivePlugins } from '@/utils/app/plugin';
import { Settings } from '@/types/settings';

interface Props {
  plugins: Plugin[];
  onPluginChange: (plugin: Plugin[]) => void;
  setShowPluginSelect: (e:boolean) => void;
  isDragging: boolean;
}

export const PluginSelector: FC<Props> = ({
  plugins,
  onPluginChange,
  setShowPluginSelect,
  isDragging
}) => {

 const {state: { featureFlags }, dispatch: homeDispatch } = useContext(HomeContext);

 let settingRef = useRef<Settings | null>(null);
  // prevent recalling the getSettings function
  if (settingRef.current === null) settingRef.current = getSettings(featureFlags);
  

  //FEATURE FLAG CONSIDERATIONS
  const filterPlugInList = () => {
    return PluginList.filter(plugin => {
             // Do not include the plugin in the list if ragEnabled is false
              if (plugin.id === PluginID.RAG && !featureFlags.ragEnabled) return false; 
              if (plugin.id === PluginID.CODE_INTERPRETER && !featureFlags.codeInterpreterEnabled) return false;
              if (plugin.id === PluginID.ARTIFACTS && (!featureFlags.artifacts || !settingRef.current?.featureOptions.includeArtifacts)) return false;
              if (plugin.id === PluginID.SMART_MESSAGES && !settingRef.current?.featureOptions.includeFocusedMessages) return false;
              return true; // Include the plugin in the list if no flags block it
          });
  }

  const [validPlugins, setValidPlugins] = useState<Plugin[]>(filterPlugInList());
  const optionsRef = useRef<(HTMLDivElement | null)[]>([]); 
  const [isUsingKeys, setIsUsingKeys] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);


  useEffect(() => {
    settingRef.current = getSettings(featureFlags);
    // we always do this in case the valid plugins change
    const activePlugins:Plugin[] = getActivePlugins(settingRef.current, validPlugins);

    onPluginChange(activePlugins);
    // save localStorage 
    savePluginSelection(activePlugins);
  }, [validPlugins]);


  // trigger for updated settings, will cause a recheck on the validPlugins
    useEffect(() => {
        const handleEvent = (event:any) => {
          settingRef.current = getSettings(featureFlags);
          setValidPlugins(filterPlugInList());
        }
    
        window.addEventListener('updateFeatureSettings', handleEvent);
        return () => window.removeEventListener('updateFeatureSettings', handleEvent);
    }, []);

  const savePluginSelection = (activePlugins: Plugin[]) => {
    const activePluginIds = activePlugins.map((p: Plugin) => p.id);

    const savePlugins = validPlugins.reduce<{ [key in PluginID]: boolean }>((acc, plugin) => {
        acc[plugin.id] = activePluginIds.includes(plugin.id);
        return acc;
    }, {} as { [key in PluginID]: boolean });

    // console.log("Save, ", savePlugins);
    localStorage.setItem('enabledPlugins', JSON.stringify(savePlugins));
  }

  useEffect(() => { // update selections in local storage
    savePluginSelection(plugins);
  }, [plugins]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    setIsUsingKeys(true);
    e.preventDefault();
    const maxIndex = validPlugins.length + 1;
    let newIndex = index;

    if (e.key === 'ArrowDown') {
      newIndex = (index + 1) % maxIndex;
    } else if (e.key === 'ArrowUp') {
      newIndex = (index - 1 + maxIndex) % maxIndex;
    } else if (e.key === 'Enter') {
      handlePluginChange(index < validPlugins.length ? validPlugins[newIndex] : null);
    }
    setFocusedIndex(newIndex);
    optionsRef.current[newIndex]?.focus();  
  };


  const isActivePlugin = (plugin:Plugin | null) => {
    if (!plugin) return false;
    return !!plugins.find((p:Plugin) => p.id === plugin.id);
  }

  const handlePluginChange = (plugin:Plugin | null) => {
    if (!plugin) { // clear all 
        onPluginChange([]);
        const pluginLen = validPlugins.length;
        optionsRef.current[pluginLen]?.focus();
        setFocusedIndex(pluginLen);
        return;
    } 

    if (isActivePlugin(plugin)) {
        onPluginChange(plugins.filter((p:Plugin) => p.id !== plugin?.id));
    } else {
        onPluginChange([...plugins, plugin]);
    }

    const index = validPlugins.findIndex((p:Plugin) => p.id === plugin.id);
    if (index !== -1) {
      optionsRef.current[index]?.focus(); 
      setFocusedIndex(index); 
    }
    
  }

  return (
    <div className="rounded flex flex-col cursor-pointer border border-neutral-600 bg-neutral-200 dark:bg-[#282834]" 
    style={{ boxShadow: '0 6px 10px rgba(0, 0, 0, 0.3)'}}
      >
      {[...validPlugins, null].map((p, index) => (
        <div
          key={p ? p.id : 'none'}
          ref={el => (optionsRef.current[index] = el)}  
          tabIndex={0}
          className={`border-b border-neutral-600 p-1 ${isActivePlugin(p) ? "text-neutral-600 dark:text-neutral-300" : "text-neutral-400 dark:text-neutral-600"} hover:text-black dark:hover:text-white`}
          onClick={() => handlePluginChange(p)}
            //onPluginChange(plugin?.id === p?.id ? null : p)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          style={{ outline: `${isUsingKeys && focusedIndex === index ? '2px solid #4287f5':'none'}` }} 
          title={ p ? p.title : 'Clear All Enabled Features'}
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