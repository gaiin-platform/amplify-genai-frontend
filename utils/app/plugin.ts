import { Plugin, PluginID, PluginList } from "@/types/plugin";
import { Settings } from "@/types/settings";

const getPluginDefaults = (settings: Settings, featureFlags: any) => {
    return PluginList.reduce<{ [key in PluginID]: boolean }>((acc, plugin) => {
      let defaultVal: boolean = plugin.default ?? false;
      if (!defaultVal) {
        switch (plugin.id) {
          case (PluginID.ARTIFACTS):
            defaultVal = settings.featureOptions.includeArtifacts;
            break;
          case (PluginID.SMART_MESSAGES):
            defaultVal = settings.featureOptions.includeFocusedMessages;
            break;
          case (PluginID.MEMORY):
            defaultVal = settings.featureOptions.includeMemory;
            break;
          case (PluginID.RAG): // Rag is off by default if cached documents is on
            defaultVal = !(featureFlags?.cachedDocuments ?? false);
            break;
        }
      }
      acc[plugin.id] = defaultVal;
      return acc;
    }, {} as { [key in PluginID]: boolean });
  }



export const getActivePlugins = (settings: Settings, featureFlags: any, validPlugins: Plugin[] = PluginList) => {
        //local storage for on/off 
        const enabledPlugins = localStorage.getItem('enabledPlugins');
        let savedSelections: { [key in PluginID]: boolean } = enabledPlugins ? 
                                                  JSON.parse(enabledPlugins) : null;
        // in case we add new ones, we refer to both saved and defaults
        const defaults = getPluginDefaults(settings, featureFlags);
    
        // we will base it off of the defaults in none have been saved yet
        if (!savedSelections) savedSelections = defaults; 
        // we always do this in case the valid plugins change
        return validPlugins.filter((plugin: Plugin) => 
                      savedSelections && Object.keys(savedSelections).includes(plugin.id) ?
                                          savedSelections[plugin.id] : defaults[plugin.id]
        );
}
