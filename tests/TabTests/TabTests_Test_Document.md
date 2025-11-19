# TabTests Documentation

## Overview
This folder contains tests for tab-based interfaces in Amplify, including artifacts management, settings configuration, and sharing features. These tests verify the functionality of specialized tabs that provide access to generated artifacts, application settings, and content sharing capabilities.

## Test Files

### test_Artifacts.py
**Test Class**: `ArtifactsTests`

#### Tests:
1. **test_preview_and_view_code**
   - **Purpose**: Test that the Artifact preview displays and shows the viewable code
   - **Functionality**: Tests:
     - Creating an artifact from a chat message
     - Finding and clicking the Preview Artifact button
     - Verifying the preview is displayed in srcdoc format
     - Checking that rendered content is visible

2. **test_save_artifact**
   - **Purpose**: Test saving an artifact
   - **Functionality**: Tests:
     - Creating an artifact
     - Triggering save functionality
     - Verifying artifact is saved

3. **test_upload_artifact**
   - **Purpose**: Test uploading an artifact file
   - **Functionality**: Tests:
     - Accessing upload functionality
     - Uploading artifact file
     - Verifying artifact is uploaded and displayed

4. **test_add_copy_to_artifact_list**
   - **Purpose**: Test adding a copy to the artifact list
   - **Functionality**: Tests:
     - Creating or copying an artifact
     - Verifying copy appears in artifact list
     - Checking artifact list updates correctly

5. **test_copy**
   - **Purpose**: Test copying an artifact
   - **Functionality**: Tests:
     - Hovering over artifact to reveal actions
     - Clicking Copy button
     - Verifying artifact is copied

6. **test_download**
   - **Purpose**: Test downloading an artifact
   - **Functionality**: Tests:
     - Hovering over artifact to reveal actions
     - Clicking Download button
     - Verifying download modal appears or download initiates

7. **test_email**
   - **Purpose**: Test emailing an artifact
   - **Functionality**: Tests:
     - Hovering over artifact to reveal actions
     - Clicking Email button
     - Verifying email modal or functionality appears

8. **test_share**
   - **Purpose**: Test sharing an artifact
   - **Functionality**: Tests:
     - Hovering over artifact to reveal actions
     - Clicking Share button
     - Verifying share modal appears

9. **test_share_modal**
   - **Purpose**: Test the artifact share modal functionality
   - **Functionality**: Tests:
     - Opening share modal for artifact
     - Verifying modal displays correctly
     - Testing share options and user selection

10. **test_edit**
    - **Purpose**: Test editing an artifact
    - **Functionality**: Tests:
      - Hovering over artifact to reveal actions
      - Clicking Edit button
      - Modifying artifact content
      - Saving edited artifact

11. **test_delete**
    - **Purpose**: Test deleting an artifact
    - **Functionality**: Tests:
      - Hovering over artifact to reveal actions
      - Clicking Delete button
      - Confirming deletion
      - Verifying artifact is removed from list

12. **test_version_switch**
    - **Purpose**: Test switching between artifact versions
    - **Functionality**: Tests:
      - Creating multiple versions of an artifact
      - Switching between versions
      - Verifying correct version is displayed

13. **test_version_switch_delete**
    - **Purpose**: Test deleting a specific version of an artifact
    - **Functionality**: Tests:
      - Creating multiple artifact versions
      - Selecting specific version
      - Deleting selected version
      - Verifying version is removed while others remain

14. **test_close_artifact_version**
    - **Purpose**: Test closing an artifact version view
    - **Functionality**: Tests:
      - Opening artifact version
      - Clicking Close button
      - Verifying artifact version view closes

15. **test_delete_from_chat**
    - **Purpose**: Test deleting an artifact directly from the chat interface
    - **Functionality**: Tests:
      - Creating artifact in chat
      - Deleting artifact from chat view
      - Verifying artifact is removed

---

### test_SettingsTab.py
**Test Class**: `SettingsTabTests`

#### Tests:
1. **test_settings_assistant_group_interface**
   - **Purpose**: This test ensures that the Assistant Groups interface is functional in the Settings tab
   - **Functionality**: Tests:
     - Opening Settings tab via User Menu
     - Navigating to Assistant Groups section
     - Verifying interface elements are present
     - Testing group management functionality
     - Verifying group creation and configuration options

2. **test_settings_import_conversations**
   - **Purpose**: This test ensures that conversations can be imported through the Settings tab
   - **Functionality**: Tests:
     - Accessing Settings tab
     - Navigating to import conversations feature
     - Verifying import interface is present
     - Testing import file selection
     - Verifying import process works correctly

3. **test_settings_export_conversations**
   - **Purpose**: This test ensures that conversations can be exported through the Settings tab
   - **Functionality**: Tests:
     - Accessing Settings tab
     - Navigating to export conversations feature
     - Verifying export interface is present
     - Testing export format selection
     - Initiating export and verifying completion

4. **test_settings_assistant_workflow**
   - **Purpose**: This test ensures that assistant workflow settings can be configured in the Settings tab
   - **Functionality**: Tests:
     - Accessing Settings tab
     - Navigating to workflow settings
     - Configuring workflow parameters
     - Saving workflow settings
     - Verifying settings persist correctly

5. **test_settings_manage_custom_apis**
   - **Purpose**: This test ensures that custom APIs can be managed through the Settings tab
   - **Functionality**: Tests:
     - Accessing Settings tab
     - Navigating to API management interface
     - Adding or editing custom API configurations
     - Testing API configuration fields
     - Verifying API settings save correctly

6. **test_settings_manage_scheduled_tasks**
   - **Purpose**: This test ensures that scheduled tasks can be managed from the Settings tab
   - **Functionality**: Tests:
     - Accessing Settings tab
     - Navigating to scheduled tasks interface
     - Creating or editing scheduled tasks
     - Setting task schedules
     - Verifying tasks appear in list

---

### test_ShareTab.py
**Test Class**: `ShareTabTests`

#### Tests:
1. **test_share_modal**
   - **Purpose**: Test the visibility of the Sharing Center modal
   - **Functionality**: Tests:
     - Opening User Menu
     - Clicking Sharing Center button
     - Verifying Share modal appears
     - Checking modal title is "Sharing Center"
     - Verifying share interface elements are present

2. **test_share_refresh**
   - **Purpose**: Test the 'Refresh' button in the Share tab on the Chats Side Bar to ensure the 'Shared with you' results refresh
   - **Functionality**: Tests:
     - Opening Sharing Center modal
     - Locating Refresh button
     - Clicking Refresh button
     - Verifying "Shared with you" section updates
     - Checking for loading indicator or state change

3. **test_share_button**
   - **Purpose**: Test the 'Share with Other' button in the Share modal
   - **Functionality**: Tests:
     - Opening Sharing Center
     - Clicking "Share with Other" button
     - Verifying user/group selection interface appears
     - Testing share functionality

---

## Common Test Patterns

### Helper Method: `create_folder(folder_name)`
- Creates a new folder via JavaScript alert
- Used for organizing artifacts or chats
- Includes alert handling

### Helper Method: `create_chat(chat_name)`
- Creates and names a new chat conversation
- Renames from "New Conversation" to custom name
- Used by artifact tests

### Helper Method: `delete_all_chats()`
- Cleanup method to remove all conversations
- Uses Prompt Handler with Select All functionality
- Used to ensure clean test environment

### Helper Method: `send_message(chat_name, message)`
- Sends a message in a specified chat
- Waits for response completion (15 seconds)
- Used for creating context for artifacts

### Helper Method: `create_artifact(chat_name, message)`
- Creates a chat and sends a message
- Hovers over the message response
- Clicks "Turn into Artifact" button
- Verifies artifact is created and visible
- Used as setup for artifact tests

### Artifacts Management Flow:
1. Create artifact (from chat message or upload)
2. Navigate to artifacts view
3. Hover over artifact to reveal action buttons
4. Perform action (copy, download, email, share, edit, delete)
5. Verify action completed
6. Verify artifact state updated

### Settings Configuration Flow:
1. Click User Menu button
2. Navigate to Settings tab/interface
3. Locate specific setting section
4. Modify settings as needed
5. Save settings
6. Verify settings persisted
7. Optionally verify settings take effect

### Sharing Flow:
1. Click User Menu button
2. Click Sharing Center option
3. View "Shared with you" section
4. Use Refresh to update shared items
5. Click "Share with Other" to initiate new shares
6. Select users/groups to share with
7. Confirm sharing
8. Verify share successful

### Artifact Versioning Flow:
1. Create initial artifact
2. Make modifications to create new versions
3. Switch between versions using version selector
4. View or edit specific version
5. Delete specific version or close version view
6. Verify version management works correctly

## Notes
- All tests run in headless mode by default
- Tests use explicit waits for element presence (WebDriverWait)
- Artifacts tab displays all created artifacts across conversations
- Artifacts can be created by:
  - Hovering over AI responses and clicking "Turn into Artifact"
  - Uploading artifact files
  - Copying existing artifacts
- Artifact types include: code snippets, images, diagrams, visualizations, documents
- Artifacts support versioning - multiple versions can be created and managed
- Hover actions reveal Copy, Download, Email, Share, Edit, and Delete buttons
- Settings tab provides centralized configuration for:
  - Assistant groups
  - Import/export functionality
  - Workflow configuration
  - Custom API management
  - Scheduled tasks
- Share tab provides two views:
  - Items shared with you (incoming shares)
  - Your items (outgoing shares)
- Sharing Center accessed via User Menu > Sharing Center
- Refresh button in Share tab updates "Shared with you" list
- test_delete_from_chat tests deleting artifacts directly from chat view without navigating to artifacts tab
- Artifact preview uses srcdoc format for rendering content
- Wait times vary (2-15 seconds) depending on operation complexity
- JavaScript alerts are used for folder creation
