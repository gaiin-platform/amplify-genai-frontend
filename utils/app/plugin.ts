import { Plugin, PluginID, PluginList } from "@/types/plugin";
import { resolveEffectivePluginIds } from '@/components/NewUI/shared/deploymentFeaturePolicy';
import { Settings } from "@/types/settings";

const getPluginDefaults = (settings: Settings, featureFlags: any, classicUi = false) => {
    return PluginList.reduce<{ [key in PluginID]: boolean }>((acc, plugin) => {
      let defaultVal: boolean = plugin.default ?? false;
      if (!defaultVal) {
        switch (plugin.id) {
          case (PluginID.ARTIFACTS):
            defaultVal = classicUi ? featureFlags?.artifacts === true : settings.featureOptions.includeArtifacts;
            break;
          // case (PluginID.SMART_MESSAGES):
          //   defaultVal = settings.featureOptions.includeFocusedMessages;
          //   break;
          case (PluginID.MEMORY):
            defaultVal = classicUi ? featureFlags?.memory === true : settings.featureOptions.includeMemory;
            break;
          case (PluginID.WEB_SEARCH):
            // Classic: web search is routed automatically, so it defaults on when the admin flag
            // allows it (the selector can switch it off). Otherwise the old settings-driven default.
            defaultVal = classicUi ? featureFlags?.webSearch === true : (settings.featureOptions.includeWebSearch ?? false);
            break;
        }
      }
      acc[plugin.id] = defaultVal;
      return acc;
    }, {} as { [key in PluginID]: boolean });
  }



/**
 * `classicUi` restores the user-controlled plugin selector (code interpreter, artifacts,
 * memory, web search) for the classic UI only. The new UI leaves it unset and keeps the
 * server-routed behavior.
 */
export const getActivePlugins = (
    settings: Settings,
    featureFlags: any,
    validPlugins: Plugin[] = PluginList,
    { classicUi = false }: { classicUi?: boolean } = {},
) => {
        //local storage for on/off 
        const enabledPlugins = localStorage.getItem('enabledPlugins');
        let savedSelections: { [key in PluginID]: boolean } = enabledPlugins ? 
                                                  JSON.parse(enabledPlugins) : null;
        // in case we add new ones, we refer to both saved and defaults
        const defaults = getPluginDefaults(settings, featureFlags, classicUi);
    
        // we will base it off of the defaults if none have been saved yet
        if (!savedSelections) savedSelections = defaults;
        // For plugins whose active state is driven by featureOptions (user settings),
        // always let the settings value win over stale localStorage
        const settingsDrivenPlugins = [
            PluginID.ARTIFACTS,
            PluginID.MEMORY,
            PluginID.WEB_SEARCH,
          ];
        // Classic UI: the selector is the source of truth, so keep what the user picked
        // (falling back to the default only when nothing was ever saved for that plugin).
        for (const id of settingsDrivenPlugins) {
            if (classicUi && id in savedSelections) continue;
            savedSelections[id] = defaults[id];
        }
        // MCP has no user-facing toggle anymore, so a stale or missing localStorage
        // entry must not decide it. The admin flag is the gate; which servers/tools
        // actually go out is decided per-server (getEnabledMCPToolsForLLM).
        savedSelections[PluginID.MCP] = featureFlags?.mcp === true;
        // The old mode selector is removed. Ignore a stale browser selection so it
        // cannot reactivate code interpreter after the server-owned routing change.
        // Classic UI exposes the selector again, so its selection is honored there.
        if (!classicUi) savedSelections[PluginID.CODE_INTERPRETER] = false;
        if (enabledPlugins) {
            localStorage.setItem('enabledPlugins', JSON.stringify(savedSelections));
        }
        // Remove old mode/tool selections from the active list. RAG, MCP, and
        // skills are separate capabilities and remain independently selectable.
        const selectedIds = validPlugins.filter((plugin: Plugin) =>
            savedSelections && Object.keys(savedSelections).includes(plugin.id)
                ? savedSelections[plugin.id]
                : defaults[plugin.id],
        ).map((plugin) => plugin.id);
        const activeIds = classicUi ? selectedIds : resolveEffectivePluginIds(selectedIds);
        const activeIdSet = new Set(activeIds);
        return validPlugins.filter((plugin: Plugin) => activeIdSet.has(plugin.id));
}
