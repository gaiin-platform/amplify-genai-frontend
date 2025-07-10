import { FC, useState, useEffect, useRef, useContext } from 'react';
import { Plugin, PluginID, PluginList, Plugins } from '@/types/plugin';
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
              if (plugin.id === PluginID.RAG_EVAL && (!featureFlags.ragEnabled || !featureFlags.ragEvaluation)) return false; 
              if (plugin.id === PluginID.CODE_INTERPRETER && !featureFlags.codeInterpreterEnabled) return false;
              if (plugin.id === PluginID.ARTIFACTS && (!featureFlags.artifacts || !settingRef.current?.featureOptions.includeArtifacts)) return false;
              if (plugin.id === PluginID.SMART_MESSAGES && !settingRef.current?.featureOptions.includeFocusedMessages) return false;
              if (plugin.id === PluginID.MEMORY && (!featureFlags.memory || !settingRef.current?.featureOptions.includeMemory)) return false;
              return true; // Include the plugin in the list if no flags block it
          });
  }

  const [validPlugins, setValidPlugins] = useState<Plugin[]>(filterPlugInList());
  const optionsRef = useRef<(HTMLDivElement | null)[]>([]); 
  const [isUsingKeys, setIsUsingKeys] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);


  useEffect(() => {
    settingRef.current = getSettings(featureFlags);
    // we always do this in case the valid plugins change
    const activePlugins:Plugin[] = getActivePlugins(settingRef.current, featureFlags, validPlugins);

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

    if (isActivePlugin(plugin)) { // turn off
        // turning off RAG means RAG_EVAL needs to be off as well 
        let updatedPlugins = plugins.filter((p:Plugin) => p.id !== plugin?.id &&
                                            (plugin?.id === PluginID.RAG ? 
                                                   p.id !== PluginID.RAG_EVAL : true));
        onPluginChange(updatedPlugins);
    } else { // turn on
        // turning on RAG_EVAL means RAG is required to be on as well
        const updatedPlugins = [...plugins, plugin];
        if (plugin.id === PluginID.RAG_EVAL && !isActivePlugin(Plugins[PluginID.RAG])) {
          updatedPlugins.push(Plugins[PluginID.RAG]);
        }

        onPluginChange(updatedPlugins);
    }

    const index = validPlugins.findIndex((p:Plugin) => p.id === plugin.id);
    if (index !== -1) {
      optionsRef.current[index]?.focus(); 
      setFocusedIndex(index);
    }
    
  }

  const handleClickWithAnimation = (plugin: Plugin | null, index: number) => {
    // Trigger animation
    setAnimatingIndex(index);
    
    // Call the original handler
    handlePluginChange(plugin);
    
    // Reset animation after it completes
    setTimeout(() => {
      setAnimatingIndex(null);
    }, 200);
  };

  return (
    <div className="rounded flex flex-col cursor-pointer border border-neutral-600 bg-neutral-200 dark:bg-[#282834]" 
    id="enabledFeaturesMenu"
    style={{ boxShadow: '0 6px 10px rgba(0, 0, 0, 0.3)'}}
      >
      {[...validPlugins, null].map((p, index) => (
        <div
          key={p ? p.id : 'none'}
          id="enabledFeatureIndex"
          ref={el => (optionsRef.current[index] = el)}  
          tabIndex={0}
          className={`border-b border-neutral-600 p-1 ${isActivePlugin(p) ? "text-neutral-600 dark:text-neutral-300" : "text-neutral-400 dark:text-neutral-600"} hover:text-black dark:hover:text-white transition-all duration-200 ease-out ${
            animatingIndex === index 
              ? 'transform scale-125 shadow-lg bg-blue-100 dark:bg-blue-900/50' 
              : ''
          }`}
          onClick={() => handleClickWithAnimation(p, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          style={{ 
            outline: `${isUsingKeys && focusedIndex === index ? '2px solid #4287f5':'none'}`,
            transformOrigin: 'center'
          }} 
          title={ p ? p.title : 'Clear All Enabled Features'}
        >
            {p ? <p.iconComponent /> : <IconX size={24}/>}
        </div>
      ))}

      <div
        className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'} text-neutral-400 border-b border-neutral-600`}
        title='Click and Drag'
        id="clickAndDragEnabledFeaturesMenu"
      >
        <IconGripVertical className='ml-2 my-1' size={18}  />
      </div>
      
      <div
        className='flex w-full text-neutral-700 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-600'
        onClick={() => setShowPluginSelect(false)}
        id="closeEnabledFeaturesMenu"
        title='Close'
      >    
        <IconSparkles className='ml-1 sparkles-rainbow-stroke' />
           
      </div>
      
    </div>
  );
};