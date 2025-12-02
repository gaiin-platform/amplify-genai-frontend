import React, { FC, useContext, useState, useEffect } from 'react';
import { IconAlertTriangle, IconFolder, IconFolders } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { capitalize } from '@/utils/app/data';
import DataSourcesTableScrollingIntegrations from '@/components/DataSources/DataSourcesTableScrollingIntegrations';
import ExpansionComponent from '@/components/Chat/ExpansionComponent';
import { IntegrationTabs } from '@/components/Integrations/IntegrationsTab';
import { DriveFilesDataSources, IntegrationDriveData, IntegrationFileRecord, IntegrationsMap, integrationProviders } from '@/types/integrations';
import toast from 'react-hot-toast';
import { deleteFile } from '@/services/fileService';
import { Checkbox } from '@/components/ReusableComponents/CheckBox';
import { DAYS_OF_WEEK } from '@/components/Agent/CronScheduleBuilder';
import { SchedulerPanel, SchedulerAlarmButton } from '@/components/ReusableComponents/SchedulerPanel';
import { getScheduledTask } from '@/services/scheduledTasksService';
import { cronToDriveRescanSchedule } from '@/utils/app/scheduledTasks';
import { AssistantDefinition } from '@/types/assistant';
import { getDriveFileIntegrationTypes } from '@/utils/app/integrations';
import { translateIntegrationIcon } from '@/components/Integrations/IntegrationsDialog';


 // Add helper function to check if there are any files selected
 export const hasDriveData = (driveData: DriveFilesDataSources): boolean => {
  if (!driveData || typeof driveData !== 'object' || Object.keys(driveData).length === 0) {
    return false;
  }
  
  for (const [providerName, providerData] of Object.entries(driveData)) {
    if (providerData && typeof providerData === 'object') {
      // Check if folders has any data
      const folders = (providerData as IntegrationDriveData).folders || {};
      if (typeof folders === 'object' && Object.keys(folders).length > 0) {
        return true;
      }
      
      // Check if files has any data
      const files = (providerData as IntegrationDriveData).files || {};
      if (typeof files === 'object' && Object.keys(files).length > 0) {
        return true;
      }
    }
  }
  console.log('No drive files found');
  return false;
};

export interface DriveRescanSchedule {
  enabled: boolean;
  frequency: 'none' | 'daily' | 'weekly' | 'monthly';
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
}


interface Props {
  initAssistantDefintion: AssistantDefinition;
  selectedDataSources: DriveFilesDataSources;
  onSelectedDataSourcesChange: (selected: DriveFilesDataSources) => void;
  height?: string;
  minWidth?: string;
  disallowedFileExtensions?: string[];
  initRescanSchedule: DriveRescanSchedule | null;
  onRescanScheduleChange: (schedule: DriveRescanSchedule) => void; // Add callback prop
}

export const AssistantDriveDataSources: FC<Props> = ({
  initAssistantDefintion,
  selectedDataSources,
  onSelectedDataSourcesChange,
  height = '350px',
  minWidth = '620px',
  disallowedFileExtensions,
  initRescanSchedule,
  onRescanScheduleChange
}) => {
  const { state: { featureFlags } } = useContext(HomeContext);
  const initAstData = initAssistantDefintion.data ?? {};
  const initDriveDataSources = initAstData.integrationDriveData;
  const [supportedDriveIntegrations, setSupportedDriveIntegrations] = useState<string[] | null>(null);

  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [selectedMicrosoftService, setSelectedMicrosoftService] = useState<'microsoft_drive' | 'microsoft_sharepoint'>('microsoft_drive');
  const [connectedDriveIntegrations, setConnectedDriveIntegrations] = useState<string[] | null>(null);
  const [currentFolderPath, setCurrentFolderPath] = useState<string[]>([]);
  const [currentFolderHistory, setCurrentFolderHistory] = useState<Array<{id: string | null, name: string}>>([]);

  // Add state for the rescan scheduler
  const [showRescanScheduler, setShowRescanScheduler] = useState(false);
  const [rescanSchedule, setRescanSchedule] = useState<DriveRescanSchedule>({
    enabled: false,
    frequency: 'none',
    time: '09:00',
    dayOfWeek: 1, // Monday
    dayOfMonth: 1
  });


  // Add helper functions after the existing helper functions
  const getCurrentFolderPath = (): string[] => {
    return currentFolderPath || [];
  };

  const getSelectedParentFolder = (integrationData: IntegrationDriveData, currentPath: string[]) => {
    return currentPath.find(folderId => Object.keys(integrationData.folders).includes(folderId));
  };

  const getSelectedParentFolderName = (selectedFolderId: string, folderHistory: Array<{id: string | null, name: string}>) => {
    return folderHistory.find(f => f.id === selectedFolderId)?.name || 'Unknown Folder';
  };

  // Add callback to handle folder path changes from child component
  const handleFolderPathChange = (folderHistory: Array<{id: string | null, name: string}>) => {
    const path = folderHistory.map(folder => folder.id).filter(Boolean) as string[];
    setCurrentFolderPath(path);
    setCurrentFolderHistory(folderHistory);
  };

  // Add rescan schedule handlers
  const handleRescanScheduleChange = (newSchedule: DriveRescanSchedule) => {
    setRescanSchedule(newSchedule);
    onRescanScheduleChange(newSchedule);
  };

  // Sync local state with prop when initRescanSchedule changes
  useEffect(() => {
    if (initRescanSchedule !== null) {
      setRescanSchedule(initRescanSchedule);
    }
  }, [initRescanSchedule]);

  const getScheduleDescription = () => {
    if (!rescanSchedule.enabled || rescanSchedule.frequency === 'none') {
      return 'One-time pull only';
    }
    
    const time = rescanSchedule.time || '09:00';
    const [hour, minute] = time.split(':');
    const timeStr = new Date(0, 0, 0, parseInt(hour), parseInt(minute)).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    switch (rescanSchedule.frequency) {
      case 'daily':
        return `Daily at ${timeStr}`;
      case 'weekly':
        const days = DAYS_OF_WEEK.map(day => day.label);
        return `Weekly on ${days[rescanSchedule.dayOfWeek || 1]} at ${timeStr}`;
      case 'monthly':
        return `Monthly on day ${rescanSchedule.dayOfMonth || 1} at ${timeStr}`;
      default:
        return 'One-time pull only';
    }
  };

  // Render the rescan scheduler panel
  const renderRescanScheduler = () => (
    <SchedulerPanel
      isOpen={showRescanScheduler}
      onClose={() => setShowRescanScheduler(false)}
      title="Drive Rescan Schedule"
      scheduleDescription={getScheduleDescription()}
      className="top-[62px]"
      isLoading={!initRescanSchedule}
      scheduledTaskId={initAstData.scheduledTaskIds?.driveFiles}
    >
      <div className="space-y-4">
        <div>
          <Checkbox
            id="enable-rescan-schedule"
            checked={rescanSchedule.enabled}
            onChange={(checked) => handleRescanScheduleChange({
              ...rescanSchedule,
              enabled: checked,
              frequency: checked ? (rescanSchedule.frequency === 'none' ? 'daily' : rescanSchedule.frequency) : 'none'
            })}
            label="Enable Automatic Rescanning"
          />
        </div>

        {rescanSchedule.enabled && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Frequency
              </label>
              <select
                value={rescanSchedule.frequency}
                onChange={(e) => handleRescanScheduleChange({
                  ...rescanSchedule,
                  frequency: e.target.value as DriveRescanSchedule['frequency']
                })}
                className="w-full p-2 border border-gray-300 dark:border-[#454652] rounded-md bg-white dark:bg-[#40414F] text-gray-900 dark:text-white text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time
              </label>
              <input
                type="time"
                value={rescanSchedule.time}
                onChange={(e) => handleRescanScheduleChange({
                  ...rescanSchedule,
                  time: e.target.value
                })}
                className="w-full p-2 border border-gray-300 dark:border-[#454652] rounded-md bg-white dark:bg-[#40414F] text-gray-900 dark:text-white text-sm"
              />
            </div>

            {rescanSchedule.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Day of Week
                </label>
                <select
                  value={rescanSchedule.dayOfWeek}
                  onChange={(e) => handleRescanScheduleChange({
                    ...rescanSchedule,
                    dayOfWeek: parseInt(e.target.value)
                  })}
                  className="w-full p-2 border border-gray-300 dark:border-[#454652] rounded-md bg-white dark:bg-[#40414F] text-gray-900 dark:text-white text-sm"
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>
            )}

            {rescanSchedule.frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Day of Month
                </label>
                <select
                  value={rescanSchedule.dayOfMonth}
                  onChange={(e) => handleRescanScheduleChange({
                    ...rescanSchedule,
                    dayOfMonth: parseInt(e.target.value)
                  })}
                  className="w-full p-2 border border-gray-300 dark:border-[#454652] rounded-md bg-white dark:bg-[#40414F] text-gray-900 dark:text-white text-sm"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>
    </SchedulerPanel>
  );

  const handleFileSelection = (file: IntegrationFileRecord, isChecked: boolean) => {
    const isFolder = file.mimeType.toLowerCase().includes("folder");
    const currentIntegration = selectedIntegration as keyof DriveFilesDataSources;
    
    // Create a proper deep copy FIRST before any modifications
    const updatedSelectionDs: DriveFilesDataSources = {};
    
    // Deep copy each integration
    Object.keys(selectedDataSources).forEach(key => {
      const integrationKey = key as keyof DriveFilesDataSources;
      if (selectedDataSources[integrationKey]) {
        updatedSelectionDs[integrationKey] = {
          folders: { ...selectedDataSources[integrationKey]!.folders },
          files: { ...selectedDataSources[integrationKey]!.files }
        };
      }
    });
    
    // Initialize integration object if it doesn't exist (on the COPY, not original)
    if (!updatedSelectionDs[currentIntegration]) {
      updatedSelectionDs[currentIntegration] = {
        folders: {},
        files: {}
      };
    }

    const integrationData = updatedSelectionDs[currentIntegration]!;
    const currentPath = getCurrentFolderPath();
    const selectedParentFolder = getSelectedParentFolder(integrationData, currentPath);

    if (isFolder) {
      if (isChecked) {
        // Check if folder exists in init data to preserve existing data
        const initFolderData = initDriveDataSources?.[currentIntegration]?.folders?.[file.id];
        integrationData.folders[file.id] = initFolderData || {};
        
      } else {
        // Deselect folder
        delete integrationData.folders[file.id];
      }
    } else {
      // File selection
      if (isChecked) {
        if (selectedParentFolder) {
          // Show helpful message instead of selecting
          const folderName = getSelectedParentFolderName(selectedParentFolder, currentFolderHistory);
          toast(`This file is already included via the "${folderName}" folder selection.`);
          return;
        } else {
          // Normal file selection
          const initFileData = initDriveDataSources?.[currentIntegration]?.files?.[file.id];
          integrationData.files[file.id] = initFileData || { type: file.type ?? file.mimeType };
        }
      } else {
        if (selectedParentFolder) {
          // Offer to deselect parent folder
          const folderName = getSelectedParentFolderName(selectedParentFolder, currentFolderHistory);
          const shouldDeselect = window.confirm(
            `This file is selected because the "${folderName}" folder is selected.\n\n` +
            `Would you like to deselect the entire "${folderName}" folder so you can select individual files?`
          );
          
          if (shouldDeselect) {
            delete integrationData.folders[selectedParentFolder];
            // User wanted to uncheck this specific file, so we don't add it back
            // They've chosen to break down the folder selection to exclude this file
          } 
        } else {
          // Normal file deselection
          delete integrationData.files[file.id];
        }
      }
    }
    onSelectedDataSourcesChange(updatedSelectionDs);
  };

  const isItemSelected = (fileId: string, isFolder: boolean) => {
    const integrationData = selectedDataSources[selectedIntegration as keyof DriveFilesDataSources];
    if (!integrationData) return false;

    if (isFolder) {
      // Check direct folder selection first
      if (Object.keys(integrationData.folders).includes(fileId)) return true;
      
      // Check parent folder selection (same logic as files)
      const currentPath = getCurrentFolderPath();
      return !!getSelectedParentFolder(integrationData, currentPath);
    } else {
      // Check direct selection first
      if (Object.keys(integrationData.files).includes(fileId)) return true;
      
      // Check parent folder selection
      const currentPath = getCurrentFolderPath();
      return !!getSelectedParentFolder(integrationData, currentPath);
    }
  };

  const getSelectionsCount = (integration: string) => {
    const integrationData = selectedDataSources[integration as keyof DriveFilesDataSources];
    if (!integrationData) {
      return { folderCount: 0, fileCount: 0 };
    }
    
    return {
      folderCount: Object.keys(integrationData.folders || {}).length,
      fileCount: Object.keys(integrationData.files || {}).length
    };
  };

  const getProvider = (integration: string) => {
    return integration.split("_")[0];
  }

  const renderSelectionPreview = () => {
    if (!supportedDriveIntegrations || supportedDriveIntegrations.length === 0) {
      return null;
    }

    const integrationData = selectedDataSources[selectedIntegration as keyof DriveFilesDataSources];
    const currentPath = getCurrentFolderPath();
    const selectedParentFolder = integrationData ? getSelectedParentFolder(integrationData, currentPath) : null;

    // Show context for current folder view
    const contextMessage = selectedParentFolder ? (
      <div className="text-sm text-blue-600 dark:text-blue-400 mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center gap-2">
        <IconFolder size={16} />
        <span>{`All files in "${getSelectedParentFolderName(selectedParentFolder, currentFolderHistory)}" are selected`}</span>
      </div>
    ) : null;

    // Regular selection counts
    const previews = supportedDriveIntegrations.map(integration => {
      const provider = getProvider(integration);
      const { folderCount, fileCount } = getSelectionsCount(integration);
      
      if (folderCount === 0 && fileCount === 0) {
        return null;
      }
      
      const parts = [];
      if (folderCount > 0) parts.push(`${folderCount} Folder${folderCount !== 1 ? 's' : ''}`);
      if (fileCount > 0) parts.push(`${fileCount} File${fileCount !== 1 ? 's' : ''}`);
      
      return `${capitalize(provider)}: ${parts.join('  ')}`;
    }).filter(Boolean);

    return (
      <div className="mt-2">
        {contextMessage}
        {previews.length > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded">
            {previews.join(' | ')}
          </div>
        )}
      </div>
    );
  };

  const handleOnConnectedIntegrations = (integrations: string[]) => {
    const driveConnected = getDriveFileIntegrationTypes(integrations);
    setConnectedDriveIntegrations(driveConnected);
  }

  const handleOnSupportedIntegrations = (integrations: IntegrationsMap) => {
    const driveSupported = Object.values(integrations).flatMap(providerArray =>
      getDriveFileIntegrationTypes(providerArray.map(integration => integration.id))
    );
    setSupportedDriveIntegrations(driveSupported);
    if (driveSupported.length > 0) setSelectedIntegration(driveSupported.sort()[0]);
  }

  const handleOnTabChange = (integrationProvider: string) => {
    if (integrationProvider.toLowerCase() === 'microsoft') {
      // For Microsoft, use the selected service (OneDrive or SharePoint)
      setSelectedIntegration(selectedMicrosoftService);
    } else {
      const integration = integrationProvider.toLowerCase() + "_drive";
      setSelectedIntegration(integration);
    }
  }

  // Get list of supported Microsoft services
  const getSupportedMicrosoftServices = (): Array<'microsoft_drive' | 'microsoft_sharepoint'> => {
    if (!supportedDriveIntegrations) return [];
    return supportedDriveIntegrations.filter(
      integration => integration === 'microsoft_drive' || integration === 'microsoft_sharepoint'
    ) as Array<'microsoft_drive' | 'microsoft_sharepoint'>;
  };

  const getServiceDisplayName = (service: 'microsoft_drive' | 'microsoft_sharepoint'): string => {
    return service === 'microsoft_drive' ? 'OneDrive' : 'SharePoint';
  };

      // Initialize drive rescan schedule from existing scheduled tasks
    useEffect(() => {
        const initializeDriveRescanSchedule = async () => {
            const defaultSchedule: DriveRescanSchedule = { enabled: false,
                                                           frequency: 'none',
                                                           time: '09:00',
                                                           dayOfWeek: 1,
                                                           dayOfMonth: 1
                                                        }
            if (initAstData.scheduledTaskIds?.driveFiles) {
                try {
                    const taskResult = await getScheduledTask(initAstData.scheduledTaskIds.driveFiles);
                    // console.log("init taskResult", taskResult);
                    if (taskResult.success && taskResult.data?.task?.cronExpression && taskResult.data.task.active ) {
                        const schedule = cronToDriveRescanSchedule(taskResult.data.task.cronExpression);
                        onRescanScheduleChange(schedule);
                        return;
                    }
                } catch (error) {
                    console.error('Error initializing drive rescan schedule:', error);
                }
            }
            // No existing scheduled task, set defaults
            onRescanScheduleChange(defaultSchedule);
        };

        if (initRescanSchedule === null) initializeDriveRescanSchedule();
    }, [initAstData.scheduledTaskIds?.driveFiles, initRescanSchedule]);


  if (supportedDriveIntegrations?.length === 0) {
    return null;
  }

  return ( 
    <div className="mt-2">
    <ExpansionComponent title="Attach Drive Data Sources" 
    closedWidget= { <IconFolders size={18} />} 
    content={ 
        (connectedDriveIntegrations?.length === 0) ? 
        <p className="text-gray-500 dark:text-gray-400">
            No drive integrations connected. Please connect a drive integration first.
        </p> :
        <div className="transform scale-y-90 origin-top-left relative">
            {/* Layered alarm button - positioned absolutely without affecting layout */}
            {featureFlags.scheduledTasks && hasDriveData(selectedDataSources) && <div className="relative">
              <SchedulerAlarmButton
                onClick={() => setShowRescanScheduler(!showRescanScheduler)}
                isActive={rescanSchedule.enabled && rescanSchedule.frequency !== 'none'}
                title="Configure drive rescan schedule"
                style={{zIndex: "1000"}}
                className="absolute top-2 right-0 p-2 hover:bg-gray-100 dark:hover:bg-[#40414F] rounded-md transition-colors group"
                size={28}
              />

              {/* Render the rescan scheduler panel right here, relative to the button */}
              {renderRescanScheduler()}
            </div>}

         <IntegrationTabs open={true}
           onConnectedIntegrations={handleOnConnectedIntegrations}
           onSupportedIntegrations={handleOnSupportedIntegrations}
           onTabChange={handleOnTabChange}
           allowedIntegrations={[
             ...Object.values(integrationProviders).map(provider => provider + "_drive"),
             'microsoft_sharepoint' // Add SharePoint explicitly
           ]}
          />

        {/* Microsoft Service Selector - only shown when multiple services are supported */}
        {selectedIntegration && (selectedIntegration.startsWith('microsoft_')) && (() => {
          const supportedMicrosoftServices = getSupportedMicrosoftServices();
          
          // If only one service is supported, don't show selector at all
          if (supportedMicrosoftServices.length <= 1) {
            return null;
          }
          
          // Multiple services supported - show dropdown
          return (
            <div className="mb-4 px-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <span className="flex items-center gap-2">
                  Select Service
                </span>
                {/* Connection status indicator */}
                {connectedDriveIntegrations?.includes(selectedMicrosoftService) ? (
                  <span className="ml-auto text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Connected
                  </span>
                ) : (
                  <span className="ml-auto text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Disconnected
                  </span>
                )}
              </label>
              <div className="relative">
                <select
                  value={selectedMicrosoftService}
                  onChange={(e) => {
                    const newService = e.target.value as 'microsoft_drive' | 'microsoft_sharepoint';
                    setSelectedMicrosoftService(newService);
                    setSelectedIntegration(newService);
                  }}
                  className="w-full p-2 pl-10 border border-gray-300 dark:border-[#454652] rounded-md bg-white dark:bg-[#40414F] text-gray-900 dark:text-white text-sm cursor-pointer"
                >
                  {supportedMicrosoftServices.map(service => (
                    <option key={service} value={service}>
                      {getServiceDisplayName(service)}
                    </option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {translateIntegrationIcon(selectedMicrosoftService)}
                </div>
              </div>
            </div>
          );
        })()}

        {/* File Display */}
        {selectedIntegration && (
        <>
        {connectedDriveIntegrations && !connectedDriveIntegrations.includes(selectedIntegration) ? (
                <div className="flex items-center justify-center w-full">
                  <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <IconAlertTriangle className="w-5 h-5 text-red-500" />
                    <span className="text-red-700 dark:text-red-300">
                      It appears this integration has been disconnected. Please reconnect to continue file selection.
                    </span>
                  </div>
                </div>
              ) : (
        <div className="flex rounded-xl border dark:border-[#454652] bg-[#e5e7eb] dark:bg-[#343541]">    
          <div
            className="p-0 bg-[#ffffff] text-medium text-gray-500 dark:text-gray-400 dark:bg-[#343541] rounded-lg w-full"
            style={{ height, minWidth, minHeight: '400px' }}
          >
            <div className="relative">
              
                <DataSourcesTableScrollingIntegrations
                  key={selectedIntegration} // Force re-render when integration changes
                  driveId={selectedIntegration}
                  onItemSelected={handleFileSelection}
                  onFolderPathChange={handleFolderPathChange}
                  disallowedFileExtensions={disallowedFileExtensions}
                  height={height}
                  visibleColumns={["name", "mimeType", "size"]}
                  tableParams={{
                    enableGlobalFilter: false,
                    enableColumnDragging: false,
                    enableColumnFilters: true,
                    enableDensityToggle: false,
                    enableTopToolbar: false,
                    enableEditing: false,
                    enableHiding: false,
                  }}
                  enableDownload={false}
                  isItemSelected={isItemSelected}
                />
            </div>
          </div>
        </div>
           )} 
           
        </>
        )}
        {renderSelectionPreview()}
        </div>
    }
    />
    </div>
  );
};

export default AssistantDriveDataSources;


export const cleanupRemovedDatasources = async (
    initDriveDataSources: DriveFilesDataSources,
    currentIntegrationDataSources: DriveFilesDataSources
    ) => {
    console.log("Cleaning up any unchecked drive datasources...");
    const deletionPromises: Promise<void>[] = [];
    
    // Iterate through each integration provider (google, microsoft, etc.)
    for (const [providerKey, initProviderData] of Object.entries(initDriveDataSources)) {
        if (!initProviderData || typeof initProviderData !== 'object') continue;
        
        // Cast to proper type
        const initData: IntegrationDriveData = initProviderData as IntegrationDriveData;
        const currentProviderData = currentIntegrationDataSources[providerKey as keyof DriveFilesDataSources];
        
        // Handle direct files
        if (initData.files) {
        for (const [fileId, fileMetadata] of Object.entries(initData.files)) {
            if (fileMetadata.datasource?.id) {
            const stillSelected = currentProviderData?.files?.[fileId];
            if (!stillSelected) {
                deletionPromises.push(
                deleteFile(fileMetadata.datasource.id).catch(err => 
                    console.error(`Failed to delete file datasource ${fileMetadata.datasource?.id}:`, err)
                ));
            }
            }
        }
        }
        
        // Handle folder files
        if (initData.folders) {
        for (const [folderId, folderFiles] of Object.entries(initData.folders)) {
            const folderStillSelected = currentProviderData?.folders?.[folderId];
            
            for (const [fileId, fileMetadata] of Object.entries(folderFiles)) {
            if (fileMetadata.datasource?.id) {
                const fileStillInFolder = folderStillSelected && currentProviderData?.folders?.[folderId]?.[fileId];
                const fileIndividuallySelected = currentProviderData?.files?.[fileId];
                
                if (!fileStillInFolder && !fileIndividuallySelected) {
                deletionPromises.push(
                    deleteFile(fileMetadata.datasource.id).catch(err => 
                    console.error(`Failed to delete folder file datasource ${fileMetadata.datasource?.id}:`, err)
                    )
                );
                }
            }
            }
        }
        }
    }
    
    // Execute all deletions
    await Promise.allSettled(deletionPromises);
    if (deletionPromises.length > 0) {
        console.log(`Attempted to delete ${deletionPromises.length} drive datasources`);
    }
    };