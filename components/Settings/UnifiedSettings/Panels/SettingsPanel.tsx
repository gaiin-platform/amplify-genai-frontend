import { FC, useContext, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { featureOptionFlags, getSettings, saveSettings } from '@/utils/app/settings';

import { Settings, Theme } from '@/types/settings';

import HomeContext from '@/pages/api/home/home.context';
import React, { useCallback } from 'react';
import { StorageDialog } from '@/components/Settings/StorageDialog';
import FlagsMap, { Flag } from '@/components/ReusableComponents/FlagsMap';
// Modal import removed - this is now a panel component
import { saveUserSettings } from '@/services/settingsService';
import { Model } from '@/types/model';
import toast from 'react-hot-toast';
import LegacyWorkspaces from '@/components/Workspace/LegacyWorkspace';
import { capitalize } from '@/utils/app/data';

interface Props {
  onSave?: () => void;
  onCancel?: () => void;
  isDirty?: (dirty: boolean) => void;
  openToTab?: string;
}

export const modelOptionFlags = [
  {
    "label": "OpenAI",
    "key": "allOpenAI",
    "defaultValue": false,
    "identifiers": ['gpt', 'o1', 'o3']
  },
  {
    "label": "Claude",
    "key": "allClaude",
    "defaultValue": false,
    "identifiers": ['anthropic']
  },
  {
    "label": "Mistral",
    "key": "allMistral",
    "defaultValue": false,
    "identifiers": ['mistral']
  },
  {
    "label": "Amazon",
    "key": "allAmazon",
    "defaultValue": false,
    "identifiers": ['amazon', 'nova']
  },
  {
    "label": "Meta",
    "key": "allMeta",
    "defaultValue": false,
    "identifiers": ['llama', 'meta']
  },
  {
    "label": "DeepSeek",
    "key": "allDeepSeek",
    "defaultValue": false,
    "identifiers": ['deepseek']
  },
  {
    "label": "Google",
    "key": "allGemini",
    "defaultValue": false,
    "identifiers": ['gemini']
  },
];

type ModelKey = (typeof modelOptionFlags)[number]["key"];

export const SettingsPanel: FC<Props> = ({ onSave, onCancel, isDirty, openToTab }) => {
  const { t } = useTranslation('settings');
  const { dispatch: homeDispatch, state: { statsService, featureFlags, availableModels: allAvailableModels, defaultModelId, workspaces } } = useContext(HomeContext);

  let initSettingsRef = useRef<Settings | null>(null);
  // prevent recalling the getSettings function
  if (initSettingsRef.current === null) initSettingsRef.current = getSettings(featureFlags);

  const [hiddenModelIds, setHiddenModelIds] = useState<string[]>(
      initSettingsRef.current?.hiddenModelIds.filter((id: string) => id !== defaultModelId) || []
  );

  const getAvailableModels = () => {
    const models: Model[] = Object.values(allAvailableModels);

    type ModelsMap = {
      [K in ModelKey]: Model[];
    };

    const modelsMap = modelOptionFlags.reduce((acc, flag) => {
      acc[flag.key] = [];
      return acc;
    }, {} as ModelsMap);

    models.forEach((model) => {
      const matchedOption = modelOptionFlags.find(flag => {
        // Check if any pattern matches the model.id
        const identifiers = flag.identifiers;
        return !!identifiers.find((identifier: string) => model.id.includes(identifier));
      });

      if (matchedOption) modelsMap[matchedOption.key].push(model);
    });

    const sortModelFlags = (a: string, b: string) => {
      const bLength = modelsMap[b].length;
      const aLength = modelsMap[a].length;
      if (bLength === aLength) {
        // Find the labels for comparison
        const aFlag = modelOptionFlags.find(flag => flag.key === a);
        const bFlag = modelOptionFlags.find(flag => flag.key === b);
        return (aFlag?.label || '').localeCompare(bFlag?.label || '');
      }
      return bLength - aLength;
    }

    // Create a new ordered object with sorted keys
    const orderedSortedModels: Record<ModelKey, any[]> = {};
    Object.keys(modelsMap)
        .sort(sortModelFlags)
        .forEach(key => {
          orderedSortedModels[key as ModelKey] = modelsMap[key as ModelKey];
        });

    Object.entries(orderedSortedModels).forEach(([key, models]) =>
        orderedSortedModels[key as ModelKey] = (models as any).sort((a: any, b: any) => a.name.localeCompare(b.name)),
    );

    return orderedSortedModels;
  }

  const availableModels = getAvailableModels();

  const initModelOption = () => {
    return modelOptionFlags.reduce((acc: { [key: string]: boolean }, x) => {
      const k = x.key as ModelKey;
      const allModels = availableModels && Object.keys(availableModels).includes(k) ? availableModels[k] : [];
      acc[x.key] = allModels.length > 0 && allModels.every((model: any) => !hiddenModelIds.includes(model.id));
      return acc;
    }, {});
  }

  const [featureOptions, setFeatureOptions] = useState<{ [key: string]: boolean }>(
      initSettingsRef.current?.featureOptions || {}
  );
  const [theme, setTheme] = useState<Theme>(initSettingsRef.current?.theme || 'dark');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [modelOptions, setModelOptions] = useState<{ [key: string]: boolean }>(initModelOption());
  const [activeTab, setActiveTab] = useState<string>(openToTab || 'configurations');

  const featuresChanged = () => {
    return JSON.stringify(featureOptions) !== JSON.stringify(initSettingsRef.current?.featureOptions);
  }

  const handleSave = useCallback(async () => {
    if (Object.values(allAvailableModels).every((model: Model) => hiddenModelIds.includes(model.id) || model.id === defaultModelId)) {
      alert("All models are currently set to be hidden. At least one model needs to remain visible, please adjust your selection.");
      return;
    }

    if (theme !== initSettingsRef.current?.theme) statsService.setThemeEvent(theme);
    homeDispatch({ field: 'lightMode', value: theme });

    const updatedSettings: Settings = {
      theme: theme,
      featureOptions: featureOptions,
      hiddenModelIds: hiddenModelIds.filter((id: string) => id !== defaultModelId)
    };

    statsService.saveSettingsEvent(updatedSettings);
    saveSettings(updatedSettings);
    
    // update plugin in selector according to new feature settings
    if (featuresChanged()) window.dispatchEvent(new Event('updateFeatureSettings'));

    const result = await saveUserSettings(updatedSettings);
    if (!result) {
      alert("Settings failed to update in the cloud at the time. However, your changes have been saved and applied locally within this browser.");
    } else {
      toast("Settings saved successfully");
    }

    // Reset dirty state and call parent callback
    setHasUnsavedChanges(false);
    if (onSave) onSave();
  }, [allAvailableModels, hiddenModelIds, defaultModelId, theme, featureOptions, statsService, homeDispatch, onSave, featuresChanged]);

  // Notify parent about dirty state
  useEffect(() => {
    if (isDirty) {
      isDirty(hasUnsavedChanges);
    }
  }, [hasUnsavedChanges, isDirty]);

  // Listen for save events from parent
  useEffect(() => {
    const handleSaveEvent = () => {
      handleSave();
    };

    window.addEventListener('saveSettingsChanges', handleSaveEvent);

    return () => {
      window.removeEventListener('saveSettingsChanges', handleSaveEvent);
    };
  }, [handleSave]);

  useEffect(() => {
    const hasChanges = theme !== initSettingsRef.current?.theme || featuresChanged() ||
        JSON.stringify(hiddenModelIds) !== JSON.stringify(initSettingsRef.current?.hiddenModelIds);
    setHasUnsavedChanges(hasChanges);
  }, [theme, featureOptions, hiddenModelIds]);

  useEffect(() => {
    if (availableModels) {
      const updatedModelOptions = {...modelOptions};
      Object.keys(availableModels).forEach((key) => {
        const allVisible = Object.keys(availableModels).includes(key) &&
            availableModels[key as ModelKey].every((model: any) => !hiddenModelIds.includes(model.id));
        updatedModelOptions[key] = allVisible;
      });

      if (JSON.stringify(modelOptions) !== JSON.stringify(updatedModelOptions)) {
        setModelOptions(updatedModelOptions);
      }
    }
  }, [hiddenModelIds, availableModels, modelOptions]);

  const handleCancel = () => {
    if (onCancel) onCancel();
  };

  const handleModelOptionChange = (key: ModelKey, isChecked: boolean) => {
    setModelOptions({...modelOptions, [key]: isChecked});
    const optionModels = availableModels[key];
    if (isChecked) {
      const optionModelsIds = optionModels.map((m: any) => m.id);
      setHiddenModelIds(hiddenModelIds.filter((id: string) => !optionModelsIds.includes(id)));
    } else {
      const hiddenModelSet = new Set(hiddenModelIds);
      optionModels.forEach((m: any) => hiddenModelSet.add(m.id));
      setHiddenModelIds(Array.from(hiddenModelSet));
    }
  }

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('gpt') || modelId.includes('o1') || modelId.includes('o3')) return '🤖';
    if (modelId.includes('claude') || modelId.includes('anthropic')) return '🧠';
    if (modelId.includes('gemini')) return '💎';
    if (modelId.includes('llama') || modelId.includes('meta')) return '🦙';
    if (modelId.includes('mistral')) return '🌟';
    if (modelId.includes('deepseek')) return '🔍';
    if (modelId.includes('amazon') || modelId.includes('nova')) return '☁️';
    return '⚡';
  };

  const getModelProvider = (modelId: string) => {
    if (modelId.includes('gpt') || modelId.includes('o1') || modelId.includes('o3')) return 'OpenAI';
    if (modelId.includes('claude') || modelId.includes('anthropic')) return 'Anthropic';
    if (modelId.includes('gemini')) return 'Google';
    if (modelId.includes('llama') || modelId.includes('meta')) return 'Meta';
    if (modelId.includes('mistral')) return 'Mistral';
    if (modelId.includes('deepseek')) return 'DeepSeek';
    if (modelId.includes('amazon') || modelId.includes('nova')) return 'Amazon';
    return 'Unknown';
  };

  const ModelCard = ({ modelId, name }: { modelId: string; name: string }) => {
    const isVisible = !hiddenModelIds.includes(modelId);
    const isDisabled = modelId === defaultModelId;
    const provider = getModelProvider(modelId);
    const icon = getModelIcon(modelId);
    
    return (
      <div 
        key={modelId} 
        className={`model-card ${isVisible ? 'model-card-visible' : 'model-card-hidden'} ${isDisabled ? 'model-card-disabled' : ''}`}
      >
        <button
          disabled={isDisabled}
          title={isDisabled ? "Default model can't be hidden" : `${isVisible ? "Hide" : "Show"} model from selection menus`}
          className="model-card-button"
          onClick={() => {
            if (isVisible) {
              setHiddenModelIds([...hiddenModelIds, modelId]);
            } else {
              setHiddenModelIds(hiddenModelIds.filter((id: string) => id !== modelId));
            }
          }}
        >
          <div className="model-card-content">
            <div className="model-card-header">
              <span className="model-card-icon">{icon}</span>
              <div className="model-card-status">
                {isDisabled && <span className="model-card-badge model-card-badge-default">Default</span>}
                {isVisible && !isDisabled && <span className="model-card-badge model-card-badge-visible">Visible</span>}
                {!isVisible && !isDisabled && <span className="model-card-badge model-card-badge-hidden">Hidden</span>}
              </div>
            </div>
            <div className="model-card-info">
              <div className="model-card-name">{name}</div>
              <div className="model-card-provider">{provider}</div>
            </div>
          </div>
        </button>
      </div>
    );
  };

  // Create tabs data structure
  const tabs = [
    {
      id: 'configurations',
      label: 'Configurations',
      count: hasUnsavedChanges ? '*' : '',
      content: (
        <>
          <div className="settings-card">
            <div className="settings-card-header">
              <h3 className="settings-card-title">{t('Theme')}</h3>
              <p className="settings-card-description">Choose your preferred visual theme</p>
            </div>
            <div className="settings-card-content">
              <div className="settings-theme-options">
                {["dark", "light"].map((color) => (
                    <label className="settings-theme-option" id={"theme"+color} key={color}>
                      <input
                          type="radio"
                          name="theme"
                          value={color}
                          checked={theme === color}
                          onChange={(event) => setTheme(event.target.value as Theme)}
                          className="settings-theme-radio"
                      />
                      <div className="settings-theme-option-content">
                        <div className="settings-theme-option-icon">
                          {color === 'dark' ? '🌙' : '☀️'}
                        </div>
                        <span className="settings-theme-option-label">
                          {t(`${capitalize(color)} mode`)}
                        </span>
                      </div>
                    </label>
                ))}
              </div>
            </div>
          </div>

          {Object.keys(allAvailableModels).length > 0 && (
              <div className="settings-card">
                <div className="settings-card-header">
                  <h3 className="settings-card-title">{t('Models')}</h3>
                  <p className="settings-card-description">Choose which models appear in selection menus. Click to toggle visibility.</p>
                </div>
                <div className="settings-card-content">
                  <div className="settings-models-new-layout">
                    {/* Quick Controls */}
                    <div className="settings-models-quick-controls">
                      <div className="settings-models-quick-controls-header">
                        <h4 className="settings-models-quick-controls-title">Quick Controls</h4>
                        <p className="settings-models-quick-controls-subtitle">Toggle entire provider groups</p>
                      </div>
                      <div className="settings-models-provider-toggles">
                        <FlagsMap
                            id={'modelOptionFlags'}
                            flags={modelOptionFlags
                                .filter((f: Flag) => availableModels[f.key].length > 0)
                                .sort((a, b) => {
                                  // Get the keys in the order they appear in availableModels
                                  const orderedKeys = Object.keys(availableModels);
                                  return orderedKeys.indexOf(a.key) - orderedKeys.indexOf(b.key);
                                })}
                            state={modelOptions}
                            flagChanged={(key, value) => {
                              handleModelOptionChange(key as ModelKey, value);
                            }}
                        />
                      </div>
                    </div>
                    
                    {/* Models Grid */}
                    <div className="settings-models-display">
                      <div className="settings-models-display-header">
                        <h4 className="settings-models-display-title">Available Models</h4>
                        <div className="settings-models-legend">
                          <div className="settings-models-legend-item">
                            <div className="settings-models-legend-dot settings-models-legend-visible"></div>
                            <span>Visible</span>
                          </div>
                          <div className="settings-models-legend-item">
                            <div className="settings-models-legend-dot settings-models-legend-hidden"></div>
                            <span>Hidden</span>
                          </div>
                          <div className="settings-models-legend-item">
                            <div className="settings-models-legend-dot settings-models-legend-default"></div>
                            <span>Default</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="settings-models-providers">
                        {Object.entries(availableModels).map(([key, modelsArray]) => {
                          const flag = modelOptionFlags.find(f => f.key === key);
                          if (!flag || modelsArray.length === 0) return null;
                          
                          return (
                            <div key={key} className="settings-models-provider-section">
                              <div className="settings-models-provider-header">
                                <span className="settings-models-provider-name">{flag.label}</span>
                                <span className="settings-models-provider-count">{modelsArray.length} models</span>
                              </div>
                              <div className="settings-models-cards-grid">
                                {modelsArray.map((model: { id: string; name: string }) => (
                                  <ModelCard key={model.id} modelId={model.id} name={model.name} />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          )}

          <div className="settings-card">
            <div className="settings-card-header">
              <h3 className="settings-card-title">{t('Features')}</h3>
              <p className="settings-card-description">Enable or disable advanced features</p>
            </div>
            <div className="settings-card-content">
              <FlagsMap
                  id={'featureOptionFlags'}
                  flags={featureOptionFlags.filter((f: Flag) =>
                      Object.keys(initSettingsRef.current ? initSettingsRef.current.featureOptions: {}).includes(f.key)
                  )}
                  state={featureOptions}
                  flagChanged={(key, value) => {
                    setFeatureOptions({...featureOptions, [key]: value});
                  }}
              />
            </div>
          </div>
        </>
      )
    },
    {
      id: 'storage',
      label: 'Conversation Storage',
      count: '',
      content: (
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">Conversation Storage</h3>
            <p className="settings-card-description">Enable conversations to sync across devices or keep them private</p>
          </div>
          <div className="settings-card-content">
            {featureFlags.storeCloudConversations && <StorageDialog open={open} />}
          </div>
        </div>
      )
    },
    ...(workspaces && workspaces.length > 0 ? [{
      id: 'workspaces',
      label: 'Legacy Workspaces',
      count: '',
      content: (
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">Legacy Workspaces</h3>
            <p className="settings-card-description">Manage your legacy workspace configurations</p>
          </div>
          <div className="settings-card-content">
            <LegacyWorkspaces/>
          </div>
        </div>
      )
    }] : []),
    {
      id: 'pricing',
      label: 'Model Pricing',
      count: '',
      content: (
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">Model Pricing</h3>
            <p className="settings-card-description">View pricing information for all available models (per million tokens)</p>
          </div>
          <div className="settings-card-content">
            <div className="settings-pricing-table-wrapper">
              <table className="settings-pricing-table">
                <thead>
                <tr>
                  {["Model", "Input Tokens", "Output Tokens", "Cached Tokens"].map((title, index) => (
                      <th key={index} className="settings-pricing-table-header">
                        {title}
                      </th>
                  ))}
                </tr>
                </thead>
                <tbody>
                {modelOptionFlags
                    .filter((f: Flag) => availableModels[f.key].length > 0)
                    .map((f: Flag, i: number) => (
                        <React.Fragment key={f.key}>
                          {/* Section label */}
                          <tr>
                            <td colSpan={4} className="settings-pricing-section-header">
                              {f.label}
                            </td>
                          </tr>
                          {/* Models in the section */}
                          {availableModels[f.key].map((model: Model) => (
                              <tr key={model.id} className="settings-pricing-table-row">
                                <td className="settings-pricing-model-name">
                                  <div>{model.name}</div>
                                </td>
                                {["inputTokenCost", "outputTokenCost", "cachedTokenCost"].map((s: string, idx: number) => (
                                    <td key={idx} className="settings-pricing-table-cell">
                                      <div>
                                        {model[s as keyof Model] !== 0 ? (
                                            `$${((model[s as keyof Model] as number) * 1000)
                                                .toFixed(2)
                                                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
                                        ) : (
                                            <span className="settings-pricing-na">N/A</span>
                                        )}
                                      </div>
                                    </td>
                                ))}
                              </tr>
                          ))}
                        </React.Fragment>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
    }
  ];

  // Panel is always rendered
  return (
    <div className="space-y-6">
              <div className="settings-content">
                <div className="settings-header-section">
                  <p className="settings-description">
                    Customize your experience and manage your preferences
                    {hasUnsavedChanges && <span className="settings-unsaved-indicator"> • Unsaved changes</span>}
                  </p>
                </div>
                
                {/* Custom tab pills */}
                <div className="settings-tab-bar">
                  <div className="settings-tab-pills">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        className={`settings-tab-pill ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <span className="settings-tab-label">{tab.label}</span>
                        {tab.count && <span className="settings-tab-count">{tab.count}</span>}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="settings-scrollable-content">
                  {tabs.find(tab => tab.id === activeTab)?.content}
                </div>
      </div>
    </div>
  );
};