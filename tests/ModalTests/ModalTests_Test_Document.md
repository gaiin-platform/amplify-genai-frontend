# ModalTests Documentation

## Overview
This folder contains tests for various modal dialogs throughout the Amplify application, including admin configuration modals, user settings modals, and operational modals. Tests verify both UI presence and functional behavior of modal components.

## Test Files

### Admin Configuration Modals

#### test_AdminModalApplicationVariables.py
**Test Class**: `AccountModalTests`

**Tests:**
1. **test_manage_account_features**
   - **Purpose**: Test that the Application Variables tab in the Admin Interface displays all application secrets and variables fields
   - **Functionality**: Tests:
     - Navigating to Admin Interface > Application Variables tab
     - Verifying presence of Application Secrets fields (COGNITO_CLIENT_SECRET, NEXTAUTH_SECRET, OPENAI_API_KEY, GEMINI_API_KEY)
     - Verifying presence of Application Variables fields (DEFAULT_FUNCTION_CALL_MODEL, AZURE_DEPLOYMENT_ID, OPENAI_API_VERSION, etc.)
     - Confirming all expected configuration fields are present

2. **test_show_and_hide_secret**
   - **Purpose**: Test that the Show/Hide Secret toggle button works for revealing and hiding secret values
   - **Functionality**: Tests:
     - Clicking Show Secret button to reveal hidden values
     - Verifying Hide Secret button appears
     - Clicking Hide Secret button to mask values again

---

#### test_AdminModalConfigurations.py
**Test Class**: `AdminConfigurationsModalTests`

**Tests:**
1. **test_manage_account_features**
   - **Purpose**: Test all configuration management features including admin management, conversation storage settings, and Amplify group creation
   - **Functionality**: Tests:
     - Expanding "Add Admins" section
     - Adding and removing admin users
     - Verifying admin deletion hover actions
     - Checking support email configuration
     - Testing rate limit selection
     - Verifying conversation storage checkboxes (Local/Cloud)
     - Testing prompt cost alert checkbox
     - Creating and managing Amplify Groups

2. **test_search_group**
   - **Purpose**: Test searching for specific Amplify Groups in the Configurations tab
   - **Functionality**: Tests:
     - Displaying all groups in the table
     - Verifying table headers (Group Name, Members, Membership by Amplify Groups, Created By)
     - Searching for specific groups (e.g., "api_test", "Admins")
     - Verifying search results match expected groups

3. **test_search_no_group**
   - **Purpose**: Test searching for a non-existent group returns no results
   - **Functionality**: Tests:
     - Searching for non-existent group name (e.g., "bimbus")
     - Verifying no results are returned

4. **test_prompt_cost_alert**
   - **Purpose**: Test enabling and configuring the prompt cost alert feature
   - **Functionality**: Tests:
     - Toggling prompt cost alert checkbox
     - Entering cost threshold value
     - Toggling checkbox again to save
     - Handling unsaved changes alert when closing

5. **test_add_empty_email**
   - **Purpose**: Test that attempting to add an admin with an empty email field does not create a new admin
   - **Functionality**: Tests:
     - Expanding "Add Admins" section
     - Clicking add button with empty email field
     - Verifying no new admin was created

---

#### test_AdminModalEmbeddings.py
**Test Class**: `AccountModalTests`

**Tests:**
1. **test_presence_of_embeddings**
   - **Purpose**: Test that the Embeddings tab in Admin Interface displays the Retrieve Embeddings button
   - **Functionality**: Tests:
     - Navigating to Admin Interface > Embeddings tab
     - Verifying Retrieve Embeddings button is present and clickable

---

#### test_AdminModalFeatureData.py
**Test Class**: `AccountModalTests`

**Tests:**
1. **test_upload_docs_and_admin_group_check**
   - **Purpose**: Test that the Feature Data tab displays upload buttons for various document types and API documentation
   - **Functionality**: Tests:
     - Verifying general upload file button is present
     - Expanding/collapsing Upload API Docs section
     - Verifying specific upload buttons (API PDF, API CSV, Postman Collection)
     - Checking presence of exactly 3 addAssistantCopy buttons

2. **test_manage_assistant_admin_groups**
   - **Purpose**: Test managing Assistant Admin Groups including display, search, and visibility toggle
   - **Functionality**: Tests:
     - Expanding/collapsing Manage Assistant Admin Groups section
     - Verifying assistantAdminGroupsTable visibility toggles correctly
     - Displaying all groups in the table
     - Searching for specific groups with various queries
     - Testing search with no results

3. **test_powerpoint_template**
   - **Purpose**: Test that the PowerPoint Template table displays with correct headers
   - **Functionality**: Tests:
     - Verifying powerpointTemplateTable is present
     - Checking table headers (Template Name, Public, Available to User via Amplify Group Membership)

4. **test_add_powerpoint_template**
   - **Purpose**: Test opening the Add PowerPoint Template modal and verifying input fields
   - **Functionality**: Tests:
     - Clicking Add PowerPoint Template button
     - Verifying pptx_upload button is present
     - Verifying template name input field is present
     - Verifying status availability field is present

---

#### test_AdminModalFeatureFlags.py
**Test Class**: `AccountModalTests`

**Tests:**
1. **test_add_feature_flags**
   - **Purpose**: Test the Add Feature Flag modal and its input fields
   - **Functionality**: Tests:
     - Clicking Add Feature button
     - Entering feature name
     - Verifying status toggle is present
     - Entering user email for exceptions
     - Verifying Add User button is present
     - Testing Confirm and Cancel action buttons

2. **test_feature_flags_table**
   - **Purpose**: Test that the Feature Flags table displays with correct headers
   - **Functionality**: Tests:
     - Verifying featureFlagsTable is present
     - Checking table headers (Feature, Status, User Exceptions, User Exceptions by Amplify Group Membership)

3. **test_search_feature_flags**
   - **Purpose**: Test searching feature flags by name
   - **Functionality**: Tests:
     - Displaying all feature flags (39 total expected flags)
     - Searching for specific features (e.g., "tools" returns "Agent Tools")
     - Searching for multiple results (e.g., "admin" returns 2 features)
     - Verifying search results match expected features

---

#### test_AdminModalIntegrations.py
**Test Class**: `AccountModalTests`

**Tests:**
1. **test_presence_of_integrations_google**
   - **Purpose**: Test that the Google integrations section displays all Google service configurations
   - **Functionality**: Tests:
     - Expanding Google integration section
     - Verifying integration configuration fields (client_id, client_secret, tenant_id)
     - Checking all Google service checkboxes (Calendar, Sheets, Docs, Drive, Forms, Gmail, Contacts)

2. **test_presence_of_integrations_microsoft**
   - **Purpose**: Test that the Microsoft integrations section displays all Microsoft service configurations
   - **Functionality**: Tests:
     - Expanding Microsoft integration section
     - Verifying integration configuration fields (client_id, client_secret, tenant_id)
     - Checking all Microsoft service checkboxes (Calendar, Drive, Excel, OneNote, Outlook, Word, Planner, SharePoint, Teams, Contacts, User Groups)

3. **test_presence_of_reload_interface_button**
   - **Purpose**: Test that the Reload Interface button is present and both integration sections are visible
   - **Functionality**: Tests:
     - Verifying adminModalReloadButton is present
     - Confirming Google and Microsoft expand buttons are visible

---

#### test_AdminModalOpenAI.py
**Test Class**: `AccountModalTests`

**Tests:**
1. **test_expected_endpoints**
   - **Purpose**: Test that all expected OpenAI model endpoints are displayed in the OpenAI Endpoints tab
   - **Functionality**: Tests:
     - Navigating to Admin Interface > OpenAI Endpoints tab
     - Extracting all endpoint model names
     - Verifying the complete list matches expected models (14 models: gpt-4-turbo, o1-preview, o1, o1-mini, o3, o3-mini, o4-mini, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4o, gpt-35-turbo, text-embedding-ada-002, code-interpreter)

2. **test_created_endpoint**
   - **Purpose**: Test creating and deleting a new endpoint for a model
   - **Functionality**: Tests:
     - Clicking Add Endpoint button for gpt-4-turbo
     - Entering URL and API key
     - Hovering over created endpoint to reveal delete button
     - Clicking delete button to remove endpoint
     - Verifying endpoint is removed
     - Closing the modal

3. **test_created_multiple_endpoints_one_model**
   - **Purpose**: Test creating and deleting multiple endpoints for a single model
   - **Functionality**: Tests:
     - Creating two endpoints for o1-preview model
     - Entering URL and key for both endpoints
     - Deleting endpoints one by one via hover and delete actions
     - Verifying all endpoints are removed
     - Closing the modal

---

#### test_AdminModalOps.py
**Test Class**: `AccountModalTests`

**Tests:**
1. **test_register_ops**
   - **Purpose**: Test the Register Ops form and its input fields
   - **Functionality**: Tests:
     - Clicking Add Op button
     - Filling in tags, name, URL, and description fields
     - Verifying Select Request Type dropdown is present
     - Verifying Add Op Parameter button is present
     - Verifying Register Ops button is present

2. **test_manage_ops_search_name**
   - **Purpose**: Test searching operations by function name
   - **Functionality**: Tests:
     - Collapsing Understanding Ops section
     - Expanding Manage Ops section
     - Verifying table headers (Function Name, Tags, Path, Method, Parameters, Description)
     - Verifying Name/Tag toggle buttons are present
     - Searching by name (e.g., "addattachment" returns 6 functions)
     - Testing search with no results (e.g., "Guts")

3. **test_manage_ops_search_tags**
   - **Purpose**: Test searching operations by tags
   - **Functionality**: Tests:
     - Collapsing Understanding Ops section
     - Toggling to Tags search mode
     - Searching by tag (e.g., "google_docs" returns 25 functions)
     - Testing search with no results (e.g., "Intimidate")

---

#### test_AdminModalSupportedModels.py
**Test Class**: `AccountModalTests`

**Tests:**
1. **test_view_models**
   - **Purpose**: Test that all model category dropdowns are present and can be clicked to view options
   - **Functionality**: Tests:
     - Navigating to Admin Interface > Supported Models tab
     - Clicking UserModel dropdown
     - Clicking AdvancedModel dropdown
     - Clicking CheapestModel dropdown
     - Clicking AgentModel dropdown
     - Clicking EmbeddingsModel dropdown

2. **test_add_model**
   - **Purpose**: Test adding a new model to the supported models list
   - **Functionality**: Tests adding model configuration (implementation details in full file)

3. **test_table_presence**
   - **Purpose**: Test that the supported models table displays with correct headers
   - **Functionality**: Tests table presence and structure

4. **test_search_individual**
   - **Purpose**: Test searching for a single specific model
   - **Functionality**: Tests individual model search functionality

5. **test_search_multiple**
   - **Purpose**: Test searching that returns multiple model results
   - **Functionality**: Tests multi-result search functionality

6. **test_search_none**
   - **Purpose**: Test searching with a query that returns no results
   - **Functionality**: Tests empty search results handling

---

### User-Facing Modals

#### test_AccountModal.py
**Test Class**: `AccountModalTests`

**Tests:**
1. **test_manage_account_features**
   - **Purpose**: Test creating and managing user accounts in the Settings > Accounts tab
   - **Functionality**: Tests:
     - Navigating to Settings > Accounts tab
     - Entering account name
     - Entering COA string
     - Selecting rate limit type through all options
     - Clicking Add Account button
     - Verifying account is added to account select dropdown

2. **test_multiple_and_duplicate_accounts**
   - **Purpose**: Test creating multiple accounts and handling duplicate accounts
   - **Functionality**: Tests account creation and duplication handling (implementation details in full file)

3. **test_api_documentation_view**
   - **Purpose**: Test viewing API documentation in the Accounts tab
   - **Functionality**: Tests API documentation display and navigation

---

#### test_AssistantModal.py
**Test Class**: `AssistantModalTests`

**Tests:**
1. **test_assistant_fields**
   - **Purpose**: Test all basic fields in the Assistant creation/edit modal
   - **Functionality**: Tests:
     - Assistant name input
     - Description field
     - Instructions textarea
     - Basic configuration options
     - Save functionality

2. **test_assistant_fields_auto**
   - **Purpose**: Test auto-populated fields and automatic configuration options
   - **Functionality**: Tests automatic field population and default values

3. **test_assistant_advanced_fields**
   - **Purpose**: Test advanced configuration fields in the Assistant modal
   - **Functionality**: Tests:
     - Advanced settings section
     - Model selection
     - Temperature and other parameter controls
     - Advanced configuration options

4. **test_assistant_data_source_options**
   - **Purpose**: Test data source configuration options for assistants
   - **Functionality**: Tests:
     - Data source selection
     - Data source configuration
     - Available data source types

5. **test_assistant_document_and_sources**
   - **Purpose**: Test document upload and source management for assistants
   - **Functionality**: Tests:
     - Document upload functionality
     - Managing document sources
     - Viewing attached documents

---

#### test_DownloadModal.py
**Test Class**: `DownloadModalTests`

**Tests:**
1. **test_download_chat_modal_fields**
   - **Purpose**: Test that the Download Chat modal displays all expected format options and fields
   - **Functionality**: Tests:
     - Opening download modal for a chat conversation
     - Verifying format selection options are present
     - Checking all input fields and checkboxes

2. **test_download_chat**
   - **Purpose**: Test executing a chat conversation download
   - **Functionality**: Tests:
     - Creating a chat with messages
     - Opening download modal
     - Selecting download format
     - Triggering download action

3. **test_download_response_modal_fields**
   - **Purpose**: Test that the Download Response modal displays all expected fields for downloading individual responses
   - **Functionality**: Tests:
     - Opening download modal for a specific response
     - Verifying format options for response download
     - Checking response-specific download fields

4. **test_download_response_modal**
   - **Purpose**: Test executing a single response download
   - **Functionality**: Tests:
     - Selecting a specific response
     - Opening download modal
     - Downloading the response

---

#### test_MemoryModal.py
**Test Class**: `MemoryModalTests`

**Tests:**
1. **test_settings_features**
   - **Purpose**: Test memory/context management features in settings
   - **Functionality**: Tests memory configuration and management options

---

#### test_PromptModal.py
**Test Class**: `PromptModalTests`

**Tests:**
1. **test_prompt_field_variables_optimization**
   - **Purpose**: Test prompt template variables and optimization features
   - **Functionality**: Tests:
     - Variable insertion in prompts
     - Optimization suggestions
     - Variable management

2. **test_prompt_assistants_field**
   - **Purpose**: Test associating assistants with prompt templates
   - **Functionality**: Tests:
     - Assistant selection for prompts
     - Assistant configuration in prompt context

3. **test_prompt_field_tags**
   - **Purpose**: Test adding and managing tags for prompt templates
   - **Functionality**: Tests:
     - Adding tags to prompts
     - Tag input and validation
     - Tag display

---

#### test_ScheduledTasksModal.py
**Test Class**: `ScheduledTasksModalTests` (inferred)

**Tests:**
1. **test_settings_export_conversations**
   - **Purpose**: Test the export conversations scheduled task feature
   - **Functionality**: Tests:
     - Opening scheduled tasks for conversation export
     - Configuring export settings

2. **test_save_a_task**
   - **Purpose**: Test creating and saving a new scheduled task
   - **Functionality**: Tests:
     - Creating new task
     - Configuring task parameters
     - Saving task successfully

3. **test_error_check**
   - **Purpose**: Test error handling and validation in scheduled task creation
   - **Functionality**: Tests:
     - Invalid input handling
     - Required field validation
     - Error message display

4. **test_schedule_check**
   - **Purpose**: Test schedule configuration and cron expression validation
   - **Functionality**: Tests:
     - Schedule input
     - Cron expression validation
     - Schedule preview

5. **test_task_type_check**
   - **Purpose**: Test different task type options and their configurations
   - **Functionality**: Tests:
     - Available task types
     - Task type specific fields
     - Task type selection

6. **test_save_task_type**
   - **Purpose**: Test saving tasks with different task type configurations
   - **Functionality**: Tests:
     - Saving different task types
     - Verifying task type persistence

---

#### test_SettingsModal.py
**Test Class**: `SettingsModalTests` (inferred)

**Tests:**
1. **test_settings_theme**
   - **Purpose**: Test theme selection and switching in settings
   - **Functionality**: Tests:
     - Opening Settings modal
     - Switching between theme options (Light, Dark, System)
     - Verifying theme changes apply

2. **test_settings_models**
   - **Purpose**: Test model selection and configuration in user settings
   - **Functionality**: Tests:
     - Viewing available models
     - Selecting default model
     - Configuring model preferences

3. **test_settings_features**
   - **Purpose**: Test feature toggles and configurations in settings
   - **Functionality**: Tests:
     - Feature flag toggles
     - Feature-specific settings
     - Saving feature preferences

4. **test_settings_conversation_storage**
   - **Purpose**: Test conversation storage preferences (Local vs Cloud)
   - **Functionality**: Tests:
     - Selecting storage location
     - Configuring storage preferences
     - Verifying storage settings

---

## Common Test Patterns

### Helper Method: `settings_admin_interface()`
- Navigates to Admin Interface from User Menu
- Selects specific admin tab
- Used by all admin modal test files
- Includes waits for UI rendering

### Helper Method: `settings_manage_accounts()`
- Navigates to Settings Interface from User Menu
- Selects Accounts tab
- Used by account management tests

### Helper Method: `create_assistant(assistant_name)`
- Creates a new assistant with given name
- Navigates to Assistants tab
- Adds assistant and verifies it appears in list
- Used by assistant modal tests

### Helper Method: `create_chat(chat_name)`
- Creates and names a new chat conversation
- Renames from "New Conversation" to custom name
- Used by download and chat-related tests

### Helper Method: `send_message(chat_name, message)`
- Sends a message in a specified chat
- Waits for response completion
- Used for testing chat-dependent features

### Helper Method: `delete_all_chats()`
- Cleanup method to remove all conversations
- Uses Prompt Handler with Select All functionality
- Used to ensure clean test environment

### Helper Method: `upload_file(filename)`
- Uploads a file from test_files directory
- Makes hidden file input visible via JavaScript
- Used by assistant and document tests

### Modal Opening Flow:
1. Navigate to feature location (Admin/Settings/Chat area)
2. Click trigger element (button/menu item)
3. Wait for modal to appear (modal overlay + content)
4. Verify modal title and key elements
5. Optionally verify modal ID attributes

### Admin Modal Pattern:
- Navigate via User Menu > Admin Interface
- Select specific admin tab
- Most admin modals follow CRUD pattern (Create, Read, Update, Delete)
- Typically include table/list view of items
- Action buttons for add/edit/delete
- Confirmation dialogs for destructive actions
- Save/Close buttons for edits

### Settings Modal Pattern:
- Navigate via User Menu > Settings Interface
- Select specific settings tab
- Form-based inputs with Save/Cancel buttons
- Some settings use toggle switches or dropdowns

## Notes
- All tests run in headless mode by default (except test_AdminModalSupportedModels.py which runs with headless=False)
- Tests use explicit waits for element presence (WebDriverWait)
- Admin modals typically require admin privileges to access
- Modal tests verify both UI presence and functional behavior
- Many test files reuse the class name `AccountModalTests` (appears to be a copy-paste artifact)
- Confirmation buttons often have ID "confirmationButton" and are identified by their text content
- Expandable sections use ID pattern "expandComponent-{SectionName}"
- Tables often use ID pattern for headers matching the column name
- Search functionality uses ID "SearchBar"
- Time.sleep() is used extensively for waiting on UI updates (varies from 1-15 seconds)
- Form validation is tested where applicable
- Close/Cancel actions often trigger unsaved changes alerts
