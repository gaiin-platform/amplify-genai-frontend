import { Plugin, PluginID, PluginList } from "@/types/plugin";
import { resolveEffectivePluginIds } from '@/components/NewUI/shared/deploymentFeaturePolicy';
import { Settings } from "@/types/settings";

const getPluginDefaults = (settings: Settings, featureFlags: any) => {
    return PluginList.reduce<{ [key in PluginID]: boolean }>((acc, plugin) => {
      let defaultVal: boolean = plugin.default ?? false;
      if (!defaultVal) {
        switch (plugin.id) {
          case (PluginID.ARTIFACTS):
            defaultVal = settings.featureOptions.includeArtifacts;
            break;
          // case (PluginID.SMART_MESSAGES):
          //   defaultVal = settings.featureOptions.includeFocusedMessages;
          //   break;
          case (PluginID.MEMORY):
            defaultVal = settings.featureOptions.includeMemory;
            break;
          case (PluginID.WEB_SEARCH):
            defaultVal = settings.featureOptions.includeWebSearch ?? false;
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
    
        // we will base it off of the defaults if none have been saved yet
        if (!savedSelections) savedSelections = defaults;
        // For plugins whose active state is driven by featureOptions (user settings),
        // always let the settings value win over stale localStorage
        const settingsDrivenPlugins = [
            PluginID.ARTIFACTS,
            PluginID.MEMORY,
            PluginID.WEB_SEARCH,
          ];
        for (const id of settingsDrivenPlugins) {
            savedSelections[id] = defaults[id];
        }
        // The old mode selector is removed. Ignore a stale browser selection so it
        // cannot reactivate code interpreter after the server-owned routing change.
        savedSelections[PluginID.CODE_INTERPRETER] = false;
        if (enabledPlugins) {
            localStorage.setItem('enabledPlugins', JSON.stringify(savedSelections));
        }
        // Remove old mode/tool selections from the active list. RAG, MCP, and
        // skills are separate capabilities and remain independently selectable.
        const activeIds = resolveEffectivePluginIds(
            validPlugins.filter((plugin: Plugin) =>
                savedSelections && Object.keys(savedSelections).includes(plugin.id)
                    ? savedSelections[plugin.id]
                    : defaults[plugin.id],
            ).map((plugin) => plugin.id),
        );
        const activeIdSet = new Set(activeIds);
        return validPlugins.filter((plugin: Plugin) => activeIdSet.has(plugin.id));
}
