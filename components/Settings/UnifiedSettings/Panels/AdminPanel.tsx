import React, { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import { IconCheck, IconFiles, IconPlus, IconSettings, IconTrashX, IconX } from '@tabler/icons-react';
import { AssistantModal } from '../../../Promptbar/components/AssistantModal';
import { Prompt } from '@/types/prompt';
import { Group, GroupAccessType, AstGroupTypeData, GroupUpdateType, Members } from '@/types/groups';
import { createEmptyPrompt } from '@/utils/app/prompts';
import { useSession } from 'next-auth/react';
import { EmailsAutoComplete } from '@/components/Emails/EmailsAutoComplete';
import { createAstAdminGroup, deleteAstAdminGroup, updateGroupAmplifyGroups, updateGroupAssistants, updateGroupMembers, updateGroupMembersPermissions, updateGroupSystemUsers, updateGroupTypes } from '@/services/groupsService';
import Search from '../../../Search';
import { TagsList } from '../../../Chat/TagsList';
import ExpansionComponent from '../../../Chat/ExpansionComponent';
import { AttachFile, handleFile } from '../../../Chat/AttachFile';
import { COMMON_DISALLOWED_FILE_EXTENSIONS } from '@/utils/app/const';
import { AssistantDefinition, AssistantProviderID } from '@/types/assistant';
import { DataSourceSelector } from '../../../DataSources/DataSourceSelector';
import { AttachedDocument } from '@/types/attacheddocument';
import { ExistingFileList, FileList } from "@/components/Chat/FileList";
import { ModelSelect } from '../../../Chat/ModelSelect';
import { getDate, getDateName } from '@/utils/app/date';
import { FolderInterface } from '@/types/folder';
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { getGroupAssistantConversations } from '@/services/groupAssistantService';
import { getGroupAssistantDashboards } from '@/services/groupAssistantService';
import { getGroupConversationData } from '@/services/groupAssistantService';
import toast from 'react-hot-toast';
import ActionButton from '../../../ReusableComponents/ActionButton';
import { LoadingDialog } from '../../../Loader/LoadingDialog';
import { InfoBox } from '../../../ReusableComponents/InfoBox';
import { includeGroupInfoBox } from '../../../Emails/EmailsList';
import Checkbox from '../../../ReusableComponents/CheckBox';
import { AMPLIFY_ASSISTANTS_GROUP_NAME } from '@/utils/app/amplifyAssistants';
import { Modal } from '../../../ReusableComponents/Modal';
import { AmplifyGroupSelect } from '../../../Admin/AdminUI';
import { getUserAmplifyGroups } from '@/services/adminService';
import { fetchAllSystemIds } from '@/services/apiKeysService';
import { checkAvailableModelId } from '@/utils/app/models';

interface Props {
  onSave?: () => void;
  onCancel?: () => void;
  isDirty?: (dirty: boolean) => void;
}

// Simplified version of AssistantAdminUI functionality for the panel
export const AdminPanel: FC<Props> = ({ onSave, onCancel, isDirty }) => {
  const { state: { featureFlags, statsService, groups, prompts, folders, syncingPrompts, amplifyUsers }, dispatch: homeDispatch } = useContext(HomeContext);
  const { data: session } = useSession();
  const { t } = useTranslation('settings');
  
  const user = session?.user?.email ?? "";
  const [isDirtyState, setIsDirtyState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const filteredForAdminAccess = (allGroups: Group[]) => {
    return allGroups.filter((g: Group) => [GroupAccessType.ADMIN, GroupAccessType.WRITE].includes(g.members[user]));
  }

  const [adminGroups, setAdminGroups] = useState<Group[]>(groups.length > 0 ? filteredForAdminAccess(groups) : []);
  const [selectedGroup, setSelectedGroup] = useState<Group | undefined>(adminGroups[0]);
  const [selectedAssistant, setSelectedAssistant] = useState<Prompt | undefined>(selectedGroup?.assistants[0]);

  // Notify parent about dirty state
  useEffect(() => {
    if (isDirty) {
      isDirty(isDirtyState);
    }
  }, [isDirty, isDirtyState]);

  useEffect(() => {
    if (!syncingPrompts) {
      setTimeout(() => {
        setAdminGroups((groups && groups.length > 0 ? filteredForAdminAccess(groups) : []));
        setIsLoading(false);
      }, 1000);
    }
  }, [syncingPrompts]);

  useEffect(() => {
    if (adminGroups.length > 0 && !selectedGroup) {
      setSelectedGroup(adminGroups[0]);
    }
  }, [adminGroups, selectedGroup]);

  useEffect(() => {
    if (selectedGroup && selectedGroup.assistants.length > 0 && !selectedAssistant) {
      setSelectedAssistant(selectedGroup.assistants[0]);
    }
  }, [selectedGroup, selectedAssistant]);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    setIsDirtyState(false);
  };

  const handleSave = () => {
    if (onSave) {
      onSave();
    }
    setIsDirtyState(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingIcon />
        <span className="ml-2">Loading Admin Interface...</span>
      </div>
    );
  }

  if (!featureFlags.adminInterface) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <IconSettings size={48} className="text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Admin Interface Not Available
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          You don&apos;t have access to the admin interface or it&apos;s not enabled for your account.
        </p>
      </div>
    );
  }

  if (adminGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <IconFiles size={48} className="text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No Admin Groups
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          You don&apos;t have admin access to any groups yet.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div className="admin-panel-content">
        <div className="admin-header-section mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Assistant Administration
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your assistant groups and configurations
          </p>
        </div>

        {/* Group Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Group
          </label>
          <select
            value={selectedGroup?.id || ''}
            onChange={(e) => {
              const group = adminGroups.find(g => g.id === e.target.value);
              setSelectedGroup(group);
              setIsDirtyState(true);
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {adminGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.assistants.length} assistants)
              </option>
            ))}
          </select>
        </div>

        {/* Group Info */}
        {selectedGroup && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              {selectedGroup.name}
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Members:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">
                  {Object.keys(selectedGroup.members).length}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Assistants:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">
                  {selectedGroup.assistants.length}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Types:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">
                  {selectedGroup.groupTypes.join(', ') || 'None'}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Your Access:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">
                  {selectedGroup.members[user]}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Assistant Selection */}
        {selectedGroup && selectedGroup.assistants.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Assistant
            </label>
            <select
              value={selectedAssistant?.data?.assistant?.definition.assistantId || ''}
              onChange={(e) => {
                const assistant = selectedGroup.assistants.find(
                  a => a.data?.assistant?.definition.assistantId === e.target.value
                );
                setSelectedAssistant(assistant);
                setIsDirtyState(true);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {selectedGroup.assistants.map((assistant) => (
                <option 
                  key={assistant.data?.assistant?.definition.assistantId} 
                  value={assistant.data?.assistant?.definition.assistantId}
                >
                  {assistant.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Assistant Info */}
        {selectedAssistant && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              {selectedAssistant.name}
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              {selectedAssistant.description || 'No description available'}
            </p>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              <div>ID: {selectedAssistant.data?.assistant?.definition.assistantId}</div>
              <div>Provider: {selectedAssistant.data?.assistant?.definition.providerId}</div>
            </div>
          </div>
        )}

        {/* Note about full admin interface */}
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-start">
            <IconSettings className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Limited Admin View
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                This is a simplified view of your admin groups and assistants. 
                For full management capabilities, access the complete admin interface.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};