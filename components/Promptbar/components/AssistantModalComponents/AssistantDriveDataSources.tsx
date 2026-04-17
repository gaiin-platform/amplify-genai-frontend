import React, { FC, useContext, useState, useEffect } from 'react';
import { IconAlertTriangle, IconFolder, IconFolders, IconTrash, IconFile, IconChevronRight, IconCaretDown, IconCaretRight, IconAlertCircle, IconReload } from '@tabler/icons-react';
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
import { getDriveFileIntegrationTypes, getIntegrationName } from '@/utils/app/integrations';
import { translateIntegrationIcon } from '@/components/Integrations/IntegrationsDialog';
import { embeddingDocumentStatus } from '@/services/adminService';
import { extractKey, getDocumentStatusConfig, shouldShowReprocessButton, isRecentlyReprocessed, startFileReprocessingWithPolling } from '@/utils/app/files';
import { StatusBadge } from '@/components/Chat/FileList';
import styled from 'styled-components';
import { FiCommand } from 'react-icons/fi';
import { animate } from '@/components/Loader/LoadingIcon';

const LoadingIcon = styled(FiCommand)`
  color: #777777;
  font-size: 1.1rem;
  font-weight: bold;
  animation: ${animate} 2s infinite;
`;

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
  disableSupportReprocess?: boolean;
  disableEdit?: boolean;
}

export const AssistantDriveDataSources: FC<Props> = ({
  initAssistantDefintion,
  selectedDataSources,
  onSelectedDataSourcesChange,
  height = '350px',
  minWidth = '620px',
  disallowedFileExtensions,
  initRescanSchedule,
  onRescanScheduleChange,
  disableSupportReprocess = false,
  disableEdit = false
}) => {
  const { state: { featureFlags, lightMode } } = useContext(HomeContext);
  const initAstData = initAssistantDefintion.data ?? {};
  const initDriveDataSources = initAstData.integrationDriveData;
  const [supportedDriveIntegrations, setSupportedDriveIntegrations] = useState<string[] | null>(null);

  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [selectedMicrosoftService, setSelectedMicrosoftService] = useState<'microsoft_drive' | 'microsoft_sharepoint'>('microsoft_drive');
  const [connectedDriveIntegrations, setConnectedDriveIntegrations] = useState<string[] | null>(null);
  const [currentFolderPath, setCurrentFolderPath] = useState<string[]>([]);
  const [currentFolderHistory, setCurrentFolderHistory] = useState<Array<{id: string | null, name: string}>>([]);

  const [shiftUp, setShiftUp] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Add state for embedding status tracking
  const [embeddingStatus, setEmbeddingStatus] = useState<{[key: string]: string} & { metadata?: {[key: string]: any}} | null>(null);
  const [pollingFiles, setPollingFiles] = useState<Set<string>>(new Set());
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);
  const [fileNameMap, setFileNameMap] = useState<{[fileId: string]: string}>({});

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
    const selectedFolders = Object.keys(integrationData.folders);
    const result = currentPath.find(folderId => selectedFolders.includes(folderId));
    return result;
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

  const handleDeselectAll = () => {
    const currentIntegration = selectedIntegration as keyof DriveFilesDataSources;

    // Create a deep copy
    const updatedSelectionDs: DriveFilesDataSources = {};

    Object.keys(selectedDataSources).forEach(key => {
      const integrationKey = key as keyof DriveFilesDataSources;
      if (selectedDataSources[integrationKey]) {
        updatedSelectionDs[integrationKey] = {
          folders: { ...selectedDataSources[integrationKey]!.folders },
          files: { ...selectedDataSources[integrationKey]!.files }
        };
      }
    });

    // Remove the current integration entirely (not just empty it)
    // This ensures cleanupRemovedDatasources properly detects the removal
    delete updatedSelectionDs[currentIntegration];

    onSelectedDataSourcesChange(updatedSelectionDs);
  };

  const handleFileSelection = (file: IntegrationFileRecord, isChecked: boolean) => {
    if (isChecked && file.name) setFileNameMap(prev => ({ ...prev, [file.id]: file.name }));
    const isFolder = /folder|directory|site|library/i.test(file.mimeType);
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
        // Deselection - this only applies to directly selected files
        // Auto-selected files (via parent folder) have disabled checkboxes and can't be unchecked
        delete integrationData.files[file.id];
      }
    }
    onSelectedDataSourcesChange(updatedSelectionDs);
  };

  // Batch selection handler for "Select All Items"
  const handleBatchFileSelection = (files: IntegrationFileRecord[]) => {
    setFileNameMap(prev => ({
      ...prev,
      ...Object.fromEntries(files.filter(f => f.name).map(f => [f.id, f.name]))
    }));
    const currentIntegration = selectedIntegration as keyof DriveFilesDataSources;

    // Create a proper deep copy
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

    // Initialize integration object if it doesn't exist
    if (!updatedSelectionDs[currentIntegration]) {
      updatedSelectionDs[currentIntegration] = {
        folders: {},
        files: {}
      };
    }

    const integrationData = updatedSelectionDs[currentIntegration]!;

    // Add all files in a single batch
    files.forEach(file => {
      const isFolder = /folder|directory|site|library/i.test(file.mimeType);

      if (isFolder) {
        const initFolderData = initDriveDataSources?.[currentIntegration]?.folders?.[file.id];
        integrationData.folders[file.id] = initFolderData || {};
      } else {
        const initFileData = initDriveDataSources?.[currentIntegration]?.files?.[file.id];
        integrationData.files[file.id] = initFileData || { type: file.type ?? file.mimeType };
      }
    });

    // Single state update for all files
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

  const isItemAutoSelected = (fileId: string, isFolder: boolean) => {
    const integrationData = selectedDataSources[selectedIntegration as keyof DriveFilesDataSources];
    if (!integrationData) {
      return false;
    }

    // Check if item is directly selected
    const isDirectlySelected = isFolder
      ? Object.keys(integrationData.folders).includes(fileId)
      : Object.keys(integrationData.files).includes(fileId);


    if (isDirectlySelected) return false; // Not auto-selected, it's directly selected

    // Check if a parent folder is selected (auto-selection)
    const currentPath = getCurrentFolderPath();
    const hasSelectedParent = !!getSelectedParentFolder(integrationData, currentPath);
    return hasSelectedParent;
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

  const getCollapsedSummary = () => {
    if (!supportedDriveIntegrations || supportedDriveIntegrations.length === 0) {
      return undefined;
    }

    const summaries: string[] = [];

    supportedDriveIntegrations.forEach(integration => {
      const provider = getProvider(integration);
      const displayName = provider === 'microsoft'
        ? (integration === 'microsoft_sharepoint' ? 'SharePoint' : 'OneDrive')
        : capitalize(provider);
      const { folderCount, fileCount } = getSelectionsCount(integration);

      if (folderCount === 0 && fileCount === 0) {
        return;
      }

      const parts = [];
      if (folderCount > 0) parts.push(`${folderCount} Folder${folderCount !== 1 ? 's' : ''}`);
      if (fileCount > 0) parts.push(`${fileCount} File${fileCount !== 1 ? 's' : ''}`);

      summaries.push(`${displayName}: ${parts.join(', ')}`);
    });

    return summaries.length > 0 ? summaries.join(' | ') : undefined;
  };

  const renderSelectionPreview = () => {
    // Check if there are any selections at all
    const hasSelections = Object.keys(selectedDataSources).some(integration => {
      const integrationData = selectedDataSources[integration as keyof DriveFilesDataSources];
      if (!integrationData) return false;
      const folderCount = Object.keys(integrationData.folders || {}).length;
      const fileCount = Object.keys(integrationData.files || {}).length;
      return folderCount > 0 || fileCount > 0;
    });

    if (!hasSelections) {
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

    // Generate previews from selectedDataSources (current state that updates on add/remove)
    const previews = selectedDataSources ? Object.entries(selectedDataSources).map(([integration, providerData]) => {
      if (!providerData || typeof providerData !== 'object') return null;

      const integrationData = providerData as any;
      const displayName = integration === 'microsoft_sharepoint' ? 'SharePoint'
                        : integration === 'microsoft_drive' ? 'OneDrive'
                        : capitalize(integration.replace('_drive', ''));

      const folderCount = Object.keys(integrationData.folders || {}).length;
      const fileCount = Object.keys(integrationData.files || {}).length;

      if (folderCount === 0 && fileCount === 0) {
        return null;
      }

      const parts = [];
      if (folderCount > 0) parts.push(`${folderCount} Folder${folderCount !== 1 ? 's' : ''}`);
      if (fileCount > 0) parts.push(`${fileCount} File${fileCount !== 1 ? 's' : ''}`);

      return `${displayName}: ${parts.join('  ')}`;
    }).filter(Boolean) : [];

    return (
      <div className="ml-6 mt-1">
        {contextMessage}
        {previews.length > 0 && (
          <div
            className="text-sm text-gray-600 dark:text-gray-400 px-3 py-1 bg-gray-50 dark:bg-gray-700 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            onClick={() => setIsSyncedFilesExpanded(!isSyncedFilesExpanded)}
          >
            {isSyncedFilesExpanded ? <IconCaretDown size={14} /> : <IconCaretRight size={14} />}
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

  // Fetch embedding status for all drive files
  useEffect(() => {
    if (!selectedDataSources) return;

    // Reset embedding status when selectedDataSources changes
    setEmbeddingStatus(null);

    const allDataSources: { key: string; type: string }[] = [];

    // Collect all datasources from folders and files
    Object.values(selectedDataSources).forEach((providerData) => {
      if (providerData && typeof providerData === 'object') {
        const integrationData = providerData as IntegrationDriveData;

        // From folders
        Object.values(integrationData.folders || {}).forEach((folderFiles) => {
          Object.values(folderFiles).forEach((fileData) => {
            if (fileData.datasource) {
              const key = extractKey(fileData.datasource);
              if (key) {
                allDataSources.push({ key, type: fileData.datasource.type });
              }
            }
          });
        });

        // From individual files
        Object.values(integrationData.files || {}).forEach((fileData) => {
          if (fileData.datasource) {
            const key = extractKey(fileData.datasource);
            if (key) {
              allDataSources.push({ key, type: fileData.datasource.type });
            }
          }
        });
      }
    });

    if (allDataSources.length > 0) {
      // Break keys into chunks of 25
      const chunkSize = 25;
      const chunks: Array<{ key: string; type: string }[]> = [];
      for (let i = 0; i < allDataSources.length; i += chunkSize) {
        chunks.push(allDataSources.slice(i, i + chunkSize));
      }

      // Make concurrent calls for each chunk
      const statusPromises = chunks.map((chunk) =>
        embeddingDocumentStatus(chunk)
          .then((response) => {
            if (response?.success && response?.data) {
              setEmbeddingStatus((prevStatus) => ({
                ...prevStatus,
                ...response.data,
                ...(response.metadata && {
                  metadata: { ...prevStatus?.metadata, ...response.metadata },
                }),
              }));
            }
            return response;
          })
          .catch((error) => {
            console.error('Failed to fetch embedding status for chunk:', error);
            return null;
          })
      );

      // Wait for all chunks to complete
      Promise.all(statusPromises).catch((error) => {
        console.error('Failed to fetch embedding status:', error);
      });
    }
  }, [selectedDataSources]);

  // File reprocessing handler
  const fileReprocessing = async (key: string, fileType: string) => {
    const effectiveGroupId = initAstData.groupId;

    await startFileReprocessingWithPolling({
      key,
      fileType,
      setPollingFiles,
      setEmbeddingStatus,
      groupId: effectiveGroupId,
    });
  };

  // Reprocess button for drive files
  const reprocessButton = (datasource: any) => {
    if (!datasource) return null;

    const key = extractKey(datasource);
    if (!key) return null;

    const status = embeddingStatus?.[key];
    const metadata = embeddingStatus?.metadata?.[key];
    const createdAt = datasource.metadata?.createdAt || new Date().toISOString();

    // Show loader if recently reprocessed or currently polling
    if (isRecentlyReprocessed(createdAt, status || 'unknown', metadata) || pollingFiles.has(key)) {
      return (
        <LoadingIcon
          style={{
            width: '14px',
            height: '14px',
            color: lightMode === 'dark' ? 'white' : 'gray',
          }}
        />
      );
    }

    // Show reprocess button if conditions are met
    if (disableSupportReprocess) return null;
    if (!shouldShowReprocessButton(createdAt, status || 'unknown', metadata)) {
      return null;
    }

    return (
      <button
        title="Regenerate text extraction and embeddings for this file."
        className="text-gray-400 hover:text-blue-600 transition-all"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (
            confirm(
              'Are you sure you want to regenerate the text extraction and embeddings for this file?'
            )
          ) {
            fileReprocessing(key, datasource.type);
          }
        }}
      >
        <IconReload size={14} />
      </button>
    );
  };

  // Embedding status indicator
  const embeddingStatusIndicator = (datasource: any) => {
    if (!embeddingStatus || !datasource) return null;
    const key = extractKey(datasource);
    if (!key) return null;
    const status = embeddingStatus[key];
    if (!status) return null;
    const config = getDocumentStatusConfig(status);
    return config?.showIndicatorWhenNotHovered ? (
      <span
        className={`${config.indicatorColor} text-sm ml-1 ${
          config.indicator === '●' ? 'text-xs' : 'text-sm'
        } ${config.animate ? 'animate-pulse' : ''}`}
      >
        {config.indicator}
      </span>
    ) : null;
  };

  // State to track if the entire synced files display is expanded
  const [isSyncedFilesExpanded, setIsSyncedFilesExpanded] = useState<boolean>(false);

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Render compact synced files display (when closed)
  const renderSyncedFilesDisplay = () => {
    if (!selectedDataSources || !isSyncedFilesExpanded) return null;

    const providers = Object.entries(selectedDataSources);
    if (providers.length === 0) return null;

    return (
      <div className="mt-3 ml-6 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">{/* Added left margin and grid layout */}
        {providers.map(([providerKey, providerData]) => {
          if (!providerData || typeof providerData !== 'object') return null;

          const integrationData = providerData as IntegrationDriveData;
          const displayName = providerKey === 'microsoft_sharepoint' ? 'SharePoint'
                            : providerKey === 'microsoft_drive' ? 'OneDrive'
                            : capitalize(providerKey.replace('_drive', ''));

          // Count files from folders and individual files
          const folderFileCount = Object.values(integrationData.folders || {}).reduce(
            (total, folderFiles) => total + Object.keys(folderFiles).length,
            0
          );
          const directFileCount = Object.keys(integrationData.files || {}).length;
          const totalFiles = folderFileCount + directFileCount;

          if (totalFiles === 0) return null;

          return (
            <div key={providerKey} className="text-sm mb-3">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium mb-2">
                {translateIntegrationIcon(providerKey)}
                <span>{displayName}</span>
              </div>
              {/* Show folders */}
              {Object.entries(integrationData.folders || {}).map(([folderId, folderFiles]) => {
                const folderPath = folderId.split(':').pop() || 'Unknown Folder';
                const fileCount = Object.keys(folderFiles).length;
                const isExpanded = expandedFolders.has(folderId);

                return (
                  <div key={folderId} className="mb-2">
                    <div
                      onClick={() => toggleFolder(folderId)}
                      className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded p-1.5 transition-colors"
                    >
                      {isExpanded ? <IconCaretDown size={14} /> : <IconCaretRight size={14} />}
                      <IconFolder size={14} />
                      <span className="truncate max-w-md">{folderPath}</span>
                      <span className="text-gray-500">({fileCount})</span>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 ml-6 flex flex-wrap gap-2 max-h-48 overflow-y-auto overflow-x-visible">
                        {Object.entries(folderFiles).map(([fileId, fileData]) => {
                          // Extract filename from fileId (format: "providerType:driveId:folderId:filename")
                          const fileIdParts = fileId.split(':');
                          const fileNameFromId = fileIdParts[fileIdParts.length - 1] || 'Unknown File';
                          const fileName = fileData.datasource?.name || fileNameMap[fileId] || fileNameFromId;
                          const isInInitData = !!initDriveDataSources?.[providerKey as keyof DriveFilesDataSources]?.folders?.[folderId]?.[fileId];
                          const isBlocked = isInInitData && !fileData.datasource;
                          const fileKey = fileData.datasource ? extractKey(fileData.datasource) : null;
                          const isHovered = hoveredFile === fileId;
                          const isPolling = fileKey && pollingFiles.has(fileKey);

                          return (
                            <div
                              key={fileId}
                              className={`relative flex items-center gap-1 text-xs px-2 py-1 rounded transition-all ${
                                isBlocked
                                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                  : isHovered
                                  ? 'bg-blue-100 dark:bg-blue-900/40'
                                  : 'bg-gray-100 dark:bg-gray-700'
                              }`}
                              title={
                                isBlocked
                                  ? `${fileName}: Could not be processed. This file may contain sensitive data or be blocked for security compliance.`
                                  : undefined
                              }
                              onMouseEnter={() => setHoveredFile(fileId)}
                              onMouseLeave={() => setHoveredFile(null)}
                            >
                              {isBlocked ? (
                                <IconAlertCircle size={12} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                              ) : (
                                <IconFile size={12} className="flex-shrink-0" />
                              )}
                              <span className="truncate max-w-[150px]">{fileName}</span>
                              {!isBlocked && fileData.datasource && embeddingStatusIndicator(fileData.datasource)}

                              {/* Hover tooltip for status badge and reprocess button */}
                              {!isBlocked && (isHovered || isPolling) && fileData.datasource && embeddingStatus && fileKey && embeddingStatus[fileKey] && (
                                <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 z-50 whitespace-nowrap">
                                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg px-2 py-1 flex items-center gap-2">
                                    <StatusBadge
                                      status={embeddingStatus[fileKey]}
                                      metadata={embeddingStatus?.metadata?.[fileKey]}
                                    />
                                    {reprocessButton(fileData.datasource)}
                                  </div>
                                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-[-4px] w-2 h-2 bg-white dark:bg-gray-800 border-l border-t border-gray-300 dark:border-gray-600 rotate-[-45deg]" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Show individual files */}
              {Object.entries(integrationData.files || {}).map(([fileId, fileData]) => {
                // Extract filename from fileId (format: "providerType:driveId:filename")
                const fileIdParts = fileId.split(':');
                const fileNameFromId = fileIdParts[fileIdParts.length - 1] || 'Unknown File';
                const fileName = fileData.datasource?.name || fileNameMap[fileId] || fileNameFromId;
                const isInInitData = !!initDriveDataSources?.[providerKey as keyof DriveFilesDataSources]?.files?.[fileId];
                const isBlocked = isInInitData && !fileData.datasource;
                const fileKey = fileData.datasource ? extractKey(fileData.datasource) : null;
                const isHovered = hoveredFile === `individual-${fileId}`;
                const isPolling = fileKey && pollingFiles.has(fileKey);

                return (
                  <div key={fileId} className="mb-1">
                    <div
                      className={`relative flex items-center gap-1.5 text-xs px-1.5 py-1 rounded transition-all ${
                        isBlocked
                          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                          : isHovered
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-gray-700 dark:text-gray-200'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                      title={
                        isBlocked
                          ? `${fileName}: Could not be processed. This file may contain sensitive data or be blocked for security compliance.`
                          : undefined
                      }
                      onMouseEnter={() => setHoveredFile(`individual-${fileId}`)}
                      onMouseLeave={() => setHoveredFile(null)}
                    >
                      {isBlocked ? (
                        <IconAlertCircle size={14} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                      ) : (
                        <IconFile size={14} className="flex-shrink-0" />
                      )}
                      <span className="truncate max-w-[200px]">{fileName}</span>
                      {!isBlocked && fileData.datasource && embeddingStatusIndicator(fileData.datasource)}
                     

                      {/* Hover tooltip for status badge and reprocess button */}
                      {!isBlocked && (isHovered || isPolling) && fileData.datasource && embeddingStatus && fileKey && embeddingStatus[fileKey] && (
                        <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 z-50 whitespace-nowrap">
                          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg px-2 py-1 flex items-center gap-2">
                            <StatusBadge
                              status={embeddingStatus[fileKey]}
                              metadata={embeddingStatus?.metadata?.[fileKey]}
                            />
                            {reprocessButton(fileData.datasource)}
                          </div>
                          <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-[-4px] w-2 h-2 bg-white dark:bg-gray-800 border-l border-t border-gray-300 dark:border-gray-600 rotate-[-45deg]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  if (supportedDriveIntegrations?.length === 0) {
    return null;
  }

  return (
    <div className="my-2">
    <ExpansionComponent title="Attach Drive Data Sources"
    onOpen={() => setShiftUp(true)}
    onClose={() => setShiftUp(false)}
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
              {/* Reset Button */}
              {(() => {
                const { folderCount, fileCount } = getSelectionsCount(selectedIntegration);
                const hasSelections = folderCount > 0 || fileCount > 0;

                if (hasSelections) {
              
                  const integrationName = getIntegrationName(selectedIntegration);
                  console.log('integrationName: ', selectedIntegration);
                  return (
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={handleDeselectAll}
                        title={`Remove all items selected within ${integrationName}`}
                        className="px-3 py-1 mr-10 mt-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors border border-red-200 dark:border-red-800 flex items-center gap-1.5"
                      >
                        <IconTrash size={16} />
                        Reset
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

                <DataSourcesTableScrollingIntegrations
                  key={selectedIntegration} // Force re-render when integration changes
                  driveId={selectedIntegration}
                  onItemSelected={handleFileSelection}
                  onBatchItemSelected={handleBatchFileSelection}
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
                  isItemAutoSelected={isItemAutoSelected}
                />
            </div>
          </div>
        </div>
           )}

        </>
        )}
        </div>
    }
    />
    {<div style={{"transform": shiftUp ? "translateY(-70px)" : ""}}>
      {renderSelectionPreview()}
      {renderSyncedFilesDisplay()}
    </div>}
    </div>
  );
};

export default AssistantDriveDataSources;


export const cleanupRemovedDatasources = async (
    initDriveDataSources: DriveFilesDataSources,
    currentIntegrationDataSources: DriveFilesDataSources
    ) => {
    // console.log("Cleaning up any unchecked drive datasources...");
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