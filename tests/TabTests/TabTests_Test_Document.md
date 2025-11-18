# TabTests Documentation

## Overview
This folder contains tests for tab-based interfaces in Amplify, including artifacts management, settings configuration, and sharing features.

## Test Files

### test_Artifacts.py
**Test Class**: `ArtifactsTests`

#### Tests:
1. **test_artifacts_tab_visibility**
   - **Purpose**: Tests that the artifacts tab is visible and accessible
   - **Functionality**: Verifies:
     - Artifacts tab button present
     - Tab clickable
     - Tab content loads

2. **test_artifacts_list_display**
   - **Purpose**: Tests that artifacts generated in conversations are listed in the tab
   - **Functionality**: Tests:
     - Artifacts appear in list
     - Artifact metadata displayed (name, type, date)
     - Artifact preview/thumbnail shown if applicable

3. **test_download_artifact**
   - **Purpose**: Tests downloading an artifact from the artifacts tab
   - **Functionality**: Tests:
     - Clicking download button on artifact
     - Verifying download modal appears or file downloads
     - Testing different artifact types (images, documents, code)

4. **test_delete_artifact**
   - **Purpose**: Tests deleting an artifact
   - **Functionality**: Tests:
     - Selecting artifact
     - Clicking delete button
     - Confirming deletion
     - Verifying artifact removed from list

5. **test_filter_artifacts_by_type**
   - **Purpose**: Tests filtering artifacts by type (images, documents, code, etc.)
   - **Functionality**: Tests:
     - Using type filter dropdown/buttons
     - Verifying only matching artifacts shown
     - Clearing filters

---

### test_SettingsTab.py
**Test Class**: `SettingsTabTests`

#### Tests:
1. **test_settings_assistant_group_interface**
   - **Purpose**: This test ensures that the Assistant Groups interface is functional in the Settings tab
   - **Functionality**: Tests:
     - Opening Settings tab
     - Navigating to Assistant Groups section
     - Verifying interface elements present
     - Testing group creation/management

2. **test_settings_import_conversations**
   - **Purpose**: This test ensures that conversations can be imported through the Settings tab
   - **Functionality**: Tests:
     - Accessing import feature in Settings
     - Selecting import file
     - Verifying import process
     - Checking imported conversations appear

3. **test_settings_export_conversations**
   - **Purpose**: This test ensures that conversations can be exported through the Settings tab
   - **Functionality**: Tests:
     - Accessing export feature in Settings
     - Selecting export format
     - Initiating export
     - Verifying export completes

4. **test_settings_assistant_workflow**
   - **Purpose**: This test ensures that assistant workflow settings can be configured in the Settings tab
   - **Functionality**: Tests:
     - Accessing workflow settings
     - Configuring workflow parameters
     - Saving workflow settings
     - Verifying settings persist

5. **test_settings_manage_custom_apis**
   - **Purpose**: This test ensures that custom APIs can be managed through the Settings tab
   - **Functionality**: Tests:
     - Accessing API management interface
     - Adding/editing custom API
     - Testing API configuration fields
     - Verifying API settings save

6. **test_settings_manage_scheduled_tasks**
   - **Purpose**: This test ensures that scheduled tasks can be managed from the Settings tab
   - **Functionality**: Tests:
     - Accessing scheduled tasks interface
     - Creating/editing scheduled task
     - Setting task schedule
     - Verifying task appears in list

---

### test_ShareTab.py
**Test Class**: `ShareTabTests`

#### Tests:
1. **test_share_modal**
   - **Purpose**: Test the visibility of the Sharing Center modal
   - **Functionality**: Tests:
     - Opening Share tab
     - Verifying Share modal/panel appears
     - Checking modal title "Add People to Share With"
     - Verifying share interface elements

2. **test_share_refresh**
   - **Purpose**: Test the 'Refresh' button in the Share tab on the Chats Side Bar to ensure the 'Shared with you' results refresh
   - **Functionality**: Tests:
     - Locating refresh button
     - Clicking refresh
     - Verifying "Shared with you" section updates
     - Checking for loading indicator

3. **test_share_button**
   - **Purpose**: Test the 'Share with Other' button in the Share modal
   - **Functionality**: Tests:
     - Opening share interface
     - Clicking "Share with Other" button
     - Verifying user/group selection interface
     - Testing share functionality

---

## Common Test Patterns

### Tab Navigation Flow:
1. Locate tab button/link
2. Click to activate tab
3. Wait for tab content to load
4. Verify tab is active (styling/state)
5. Verify tab content displayed

### Artifacts Management Flow:
1. Navigate to Artifacts tab
2. Verify artifacts list populates
3. Perform action on artifact (view, download, delete, filter)
4. Verify action completed
5. Verify artifact state updated

### Settings Configuration Flow:
1. Navigate to Settings tab
2. Locate specific setting section
3. Modify settings as needed
4. Save settings
5. Verify settings persisted
6. Optionally verify settings take effect

### Sharing Flow:
1. Navigate to Share tab
2. View "Shared with you" section
3. Open share modal for specific item
4. Select users/groups to share with
5. Confirm sharing
6. Verify share successful
7. Check recipient list updated

## Notes
- Artifacts tab displays all created artifacts across conversations
- Artifacts include: code snippets, images, diagrams, visualizations, documents
- Settings tab provides centralized configuration for:
  - Assistant groups
  - Import/export functionality
  - Workflow configuration
  - Custom API management
  - Scheduled tasks
- Share tab provides two views:
  - Items shared with you (incoming shares)
  - Your items (outgoing shares)
- Share functionality includes:
  - User selection via checkboxes
  - Group sharing capabilities
  - Permission management
  - Share link generation
- Refresh button in Share tab updates shared items list
- Settings changes may require page reload or re-login for some features
