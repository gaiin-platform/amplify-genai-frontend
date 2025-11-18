# ModalTests Documentation

## Overview
This folder contains tests for various modal dialogs throughout the Amplify application, including admin configuration modals, user settings modals, and operational modals.

## Test Files

### Admin Configuration Modals

#### test_AdminModalApplicationVariables.py
**Test Class**: `AdminModalApplicationVariablesTests`

**Tests:**
1. **test_application_variables_modal_open**
   - **Purpose**: Tests opening the Application Variables modal from admin interface
   - **Functionality**: Verifies modal opens and displays correctly

2. **test_application_variables_display**
   - **Purpose**: Tests that application variables are displayed correctly
   - **Functionality**: Verifies variable names and values are shown

3. **test_edit_application_variable**
   - **Purpose**: Tests editing an application variable value
   - **Functionality**: Tests modifying variable and saving

4. **test_add_application_variable**
   - **Purpose**: Tests adding a new application variable
   - **Functionality**: Tests creating new variable with name and value

5. **test_delete_application_variable**
   - **Purpose**: Tests deleting an application variable
   - **Functionality**: Tests removing variable and confirming deletion

---

#### test_AdminModalConfigurations.py
**Test Class**: `AdminModalConfigurationsTests`

**Tests:**
1. **test_configurations_modal_open**
   - **Purpose**: Tests opening the Configurations modal
   - **Functionality**: Verifies modal accessibility

2. **test_configurations_display**
   - **Purpose**: Tests that configurations are displayed
   - **Functionality**: Verifies configuration list rendering

3. **test_edit_configuration**
   - **Purpose**: Tests editing a configuration value
   - **Functionality**: Tests modifying and saving configuration

4. **test_add_configuration**
   - **Purpose**: Tests adding a new configuration
   - **Functionality**: Tests creating configuration entry

5. **test_delete_configuration**
   - **Purpose**: Tests deleting a configuration
   - **Functionality**: Tests removing configuration entry

---

#### test_AdminModalEmbeddings.py
**Test Class**: `AdminModalEmbeddingsTests`

**Tests:**
1. **test_embeddings_modal_open**
   - **Purpose**: Tests opening the Embeddings configuration modal
   - **Functionality**: Verifies embeddings settings accessible

2. **test_embeddings_settings_display**
   - **Purpose**: Tests that embedding settings are displayed
   - **Functionality**: Verifies embedding configuration options shown

3. **test_update_embeddings_configuration**
   - **Purpose**: Tests updating embedding configuration settings
   - **Functionality**: Tests modifying embedding parameters

---

#### test_AdminModalFeatureData.py
**Test Class**: `AdminModalFeatureDataTests`

**Tests:**
1. **test_feature_data_modal_open**
   - **Purpose**: Tests opening the Feature Data modal
   - **Functionality**: Verifies feature data interface accessible

2. **test_feature_data_display**
   - **Purpose**: Tests that feature data is displayed correctly
   - **Functionality**: Verifies feature data rendering

3. **test_update_feature_data**
   - **Purpose**: Tests updating feature data values
   - **Functionality**: Tests modifying feature data entries

---

#### test_AdminModalFeatureFlags.py
**Test Class**: `AdminModalFeatureFlagsTests`

**Tests:**
1. **test_feature_flags_modal_open**
   - **Purpose**: Tests opening the Feature Flags modal
   - **Functionality**: Verifies feature flags interface accessible

2. **test_feature_flags_display**
   - **Purpose**: Tests that feature flags are displayed correctly
   - **Functionality**: Verifies flag list rendering

3. **test_toggle_feature_flag**
   - **Purpose**: Tests toggling a feature flag on/off
   - **Functionality**: Tests enabling/disabling features

4. **test_add_feature_flag**
   - **Purpose**: Tests adding a new feature flag
   - **Functionality**: Tests creating new flag entry

5. **test_delete_feature_flag**
   - **Purpose**: Tests deleting a feature flag
   - **Functionality**: Tests removing flag entry

---

#### test_AdminModalIntegrations.py
**Test Class**: `AdminModalIntegrationsTests`

**Tests:**
1. **test_integrations_modal_open**
   - **Purpose**: Tests opening the Integrations modal
   - **Functionality**: Verifies integrations interface accessible

2. **test_integrations_list_display**
   - **Purpose**: Tests that integrations list is displayed
   - **Functionality**: Verifies integration entries shown

3. **test_add_integration**
   - **Purpose**: Tests adding a new integration
   - **Functionality**: Tests creating integration configuration

4. **test_edit_integration**
   - **Purpose**: Tests editing an existing integration
   - **Functionality**: Tests modifying integration settings

5. **test_delete_integration**
   - **Purpose**: Tests deleting an integration
   - **Functionality**: Tests removing integration

---

#### test_AdminModalOpenAI.py
**Test Class**: `AdminModalOpenAITests`

**Tests:**
1. **test_openai_modal_open**
   - **Purpose**: Tests opening the OpenAI configuration modal
   - **Functionality**: Verifies OpenAI settings accessible

2. **test_openai_settings_display**
   - **Purpose**: Tests that OpenAI settings are displayed
   - **Functionality**: Verifies API key fields and configuration options

3. **test_update_openai_configuration**
   - **Purpose**: Tests updating OpenAI API configuration settings
   - **Functionality**: Tests modifying API keys and parameters

---

#### test_AdminModalOps.py
**Test Class**: `AdminModalOpsTests`

**Tests:**
1. **test_ops_modal_open**
   - **Purpose**: Tests opening the Operations modal
   - **Functionality**: Verifies operations interface accessible

2. **test_ops_actions_display**
   - **Purpose**: Tests that operational actions are displayed
   - **Functionality**: Verifies operation buttons and options shown

3. **test_execute_ops_action**
   - **Purpose**: Tests executing an operational action from the modal
   - **Functionality**: Tests triggering operations (cache clear, etc.)

---

#### test_AdminModalSupportedModels.py
**Test Class**: `AdminModalSupportedModelsTests`

**Tests:**
1. **test_supported_models_modal_open**
   - **Purpose**: Tests opening the Supported Models modal
   - **Functionality**: Verifies models interface accessible

2. **test_supported_models_display**
   - **Purpose**: Tests that supported models list is displayed
   - **Functionality**: Verifies model list rendering

3. **test_add_supported_model**
   - **Purpose**: Tests adding a new model to the supported models list
   - **Functionality**: Tests adding model configuration

4. **test_edit_supported_model**
   - **Purpose**: Tests editing a supported model's configuration
   - **Functionality**: Tests modifying model parameters

5. **test_delete_supported_model**
   - **Purpose**: Tests deleting a model from the supported models list
   - **Functionality**: Tests removing model entry

---

### User-Facing Modals

#### test_AccountModal.py
**Test Class**: `AccountModalTests`

**Tests:**
1. **test_account_modal_open**
   - **Purpose**: Tests opening the account modal
   - **Functionality**: Verifies account settings accessible

2. **test_account_information_display**
   - **Purpose**: Tests that account information is displayed correctly
   - **Functionality**: Verifies user profile fields shown

3. **test_edit_account_details**
   - **Purpose**: Tests editing account details
   - **Functionality**: Tests modifying profile information

4. **test_save_account_changes**
   - **Purpose**: Tests saving changes to account information
   - **Functionality**: Tests persisting account updates

---

#### test_AssistantModal.py
**Test Class**: `AssistantModalTests`

**Tests:**
1. **test_assistant_modal_open**
   - **Purpose**: Tests opening the assistant configuration modal
   - **Functionality**: Verifies assistant settings accessible

2. **test_assistant_details_display**
   - **Purpose**: Tests that assistant details are displayed
   - **Functionality**: Verifies assistant configuration fields shown

3. **test_edit_assistant_configuration**
   - **Purpose**: Tests editing assistant configuration
   - **Functionality**: Tests modifying assistant parameters

4. **test_save_assistant_changes**
   - **Purpose**: Tests saving changes to assistant settings
   - **Functionality**: Tests persisting assistant updates

---

#### test_DownloadModal.py
**Test Class**: `DownloadModalTests`

**Tests:**
1. **test_download_modal_open**
   - **Purpose**: Tests opening the download modal
   - **Functionality**: Verifies download interface accessible

2. **test_download_formats_available**
   - **Purpose**: Tests that different download format options are available
   - **Functionality**: Verifies format options (PDF, TXT, JSON, etc.)

3. **test_execute_download**
   - **Purpose**: Tests executing a file download from the modal
   - **Functionality**: Tests triggering download action

---

#### test_MemoryModal.py
**Test Class**: `MemoryModalTests`

**Tests:**
1. **test_memory_modal_open**
   - **Purpose**: Tests opening the memory/context modal
   - **Functionality**: Verifies memory interface accessible

2. **test_memory_display**
   - **Purpose**: Tests that memory/context information is displayed
   - **Functionality**: Verifies memory entries shown

3. **test_clear_memory**
   - **Purpose**: Tests clearing memory/context
   - **Functionality**: Tests removing memory entries

4. **test_edit_memory**
   - **Purpose**: Tests editing memory entries
   - **Functionality**: Tests modifying stored context

---

#### test_PromptModal.py
**Test Class**: `PromptModalTests`

**Tests:**
1. **test_prompt_modal_open**
   - **Purpose**: Tests opening the prompt modal
   - **Functionality**: Verifies prompt input interface accessible

2. **test_prompt_input**
   - **Purpose**: Tests entering text into the prompt modal
   - **Functionality**: Tests text input functionality

3. **test_prompt_submit**
   - **Purpose**: Tests submitting a prompt from the modal
   - **Functionality**: Tests submitting and closing modal

4. **test_prompt_cancel**
   - **Purpose**: Tests canceling the prompt modal
   - **Functionality**: Tests canceling without submission

---

#### test_ScheduledTasksModal.py
**Test Class**: `ScheduledTasksModalTests`

**Tests:**
1. **test_scheduled_tasks_modal_visibility**
   - **Purpose**: Tests that the Scheduled Tasks modal appears and has the correct title when opened
   - **Functionality**: Verifies modal title is "Scheduled Tasks"

2. **test_scheduled_tasks_list_display**
   - **Purpose**: Tests that scheduled tasks are listed in the modal with proper formatting
   - **Functionality**: Verifies task list rendering

3. **test_add_scheduled_task**
   - **Purpose**: Tests adding a new scheduled task through the modal interface
   - **Functionality**: Tests creating task with schedule

4. **test_edit_scheduled_task**
   - **Purpose**: Tests editing an existing scheduled task configuration
   - **Functionality**: Tests modifying task parameters

5. **test_delete_scheduled_task**
   - **Purpose**: Tests deleting a scheduled task and verifying it's removed from the list
   - **Functionality**: Tests removing scheduled task

6. **test_task_execution_status**
   - **Purpose**: Tests that task execution status is displayed correctly (pending, running, completed, failed)
   - **Functionality**: Verifies status indicators

---

#### test_SettingsModal.py
**Test Class**: `SettingsModalTests`

**Tests:**
1. **test_settings_modal_open**
   - **Purpose**: Tests opening the settings modal
   - **Functionality**: Verifies settings interface accessible

2. **test_settings_tabs_present**
   - **Purpose**: Tests that all settings tabs are present and accessible
   - **Functionality**: Verifies tab navigation

3. **test_navigate_settings_tabs**
   - **Purpose**: Tests navigating between different settings tabs
   - **Functionality**: Tests tab switching

4. **test_save_settings**
   - **Purpose**: Tests saving settings changes
   - **Functionality**: Tests persisting settings

5. **test_cancel_settings**
   - **Purpose**: Tests canceling settings changes
   - **Functionality**: Tests discarding unsaved changes

---

## Common Test Patterns

### Modal Opening Flow:
1. Locate trigger element (button/menu item)
2. Click to open modal
3. Wait for modal to appear (modal overlay + content)
4. Verify modal title and key elements
5. Optionally verify modal ID attributes

### Modal Interaction Flow:
1. Open modal
2. Locate form fields/inputs
3. Modify values as needed
4. Submit or cancel
5. Verify modal closes or shows confirmation
6. Verify changes persisted (if applicable)

### Admin Modal Pattern:
- Most admin modals follow CRUD pattern (Create, Read, Update, Delete)
- Typically include table/list view of items
- Action buttons for add/edit/delete
- Confirmation dialogs for destructive actions
- Save/cancel buttons for edits

## Notes
- Admin modals typically require admin privileges to access
- Modal tests verify both UI presence and functional behavior
- Download modal may trigger browser download dialogs
- Settings modal contains multiple tabs for different setting categories
- Scheduled tasks modal includes cron expression builder
- Most modals use "modalTitle" ID for title verification
- Form validation is tested where applicable
