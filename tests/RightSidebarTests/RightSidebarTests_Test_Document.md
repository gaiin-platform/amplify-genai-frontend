# RightSidebarTests Documentation

## Overview
This folder contains tests for assistants sidebar functionality, including assistants management, prompt templates, folder organization, search functionality, and bulk operations.

## Test Files

### test_ActiveAssistantsList.py
**Test Class**: `ActiveAssistantsListTests`

#### Tests:
1. **test_active_assistants_list_visibility**
   - **Purpose**: Tests that the active assistants list is visible in the assistants sidebar
   - **Functionality**: Verifies active assistants panel is accessible and displays correctly

2. **test_add_assistant_to_active_list**
   - **Purpose**: Tests adding an assistant to the active assistants list
   - **Functionality**: Tests:
     - Selecting an assistant
     - Adding to active list
     - Verifying assistant appears in active list

3. **test_remove_assistant_from_active_list**
   - **Purpose**: Tests removing an assistant from the active assistants list
   - **Functionality**: Tests:
     - Locating active assistant
     - Clicking remove button
     - Verifying assistant removed from list

4. **test_reorder_active_assistants**
   - **Purpose**: Tests reordering assistants in the active list
   - **Functionality**: Tests:
     - Drag and drop to reorder
     - Verifying new order persists

---

### test_AssistantsPage.py
**Test Class**: `AssistantsPageTests`

#### Tests:
1. **test_assistants_page_navigation**
   - **Purpose**: Tests navigating to the assistants page
   - **Functionality**: Verifies assistants tab/page loads correctly

2. **test_assistants_list_display**
   - **Purpose**: Tests that the list of available assistants is displayed
   - **Functionality**: Verifies:
     - Assistants are listed
     - Assistant names visible
     - Assistant folders expandable

3. **test_assistant_details_view**
   - **Purpose**: Tests viewing detailed information about an assistant
   - **Functionality**: Tests:
     - Clicking on assistant
     - Viewing description
     - Viewing configuration

4. **test_filter_assistants**
   - **Purpose**: Tests filtering assistants by category or type
   - **Functionality**: Tests:
     - Using filter options
     - Verifying filtered results
     - Clearing filters

---

### test_CreateFolder.py
**Test Class**: `CreateFolderTests`

#### Tests:
1. **test_create_folder_button_presence**
   - **Purpose**: Tests that the create folder button is present in the assistants sidebar
   - **Functionality**: Verifies create folder button is visible and accessible

2. **test_create_folder_dialog**
   - **Purpose**: Tests opening the create folder dialog
   - **Functionality**: Tests:
     - Clicking create folder button
     - Verifying dialog/alert appears
     - Entering folder name

3. **test_create_new_folder**
   - **Purpose**: Tests creating a new folder with a specified name
   - **Functionality**: Tests:
     - Creating folder with custom name
     - Verifying folder appears in list
     - Verifying folder is empty initially

4. **test_cancel_folder_creation**
   - **Purpose**: Tests canceling folder creation
   - **Functionality**: Tests:
     - Opening create dialog
     - Canceling without creating
     - Verifying no folder created

---

### test_FolderHandler.py
**Test Class**: `FolderHandlerTests`

#### Tests:
1. **test_create_folder**
   - **Purpose**: Tests creating a new folder in the assistants sidebar
   - **Functionality**: Verifies folder creation workflow

2. **test_rename_folder**
   - **Purpose**: Tests renaming an existing folder
   - **Functionality**: Tests:
     - Hovering over folder
     - Clicking rename button
     - Entering new name
     - Verifying name updated

3. **test_delete_folder**
   - **Purpose**: Tests deleting a folder
   - **Functionality**: Tests:
     - Selecting folder
     - Clicking delete
     - Confirming deletion
     - Verifying folder removed

4. **test_move_assistant_to_folder**
   - **Purpose**: Tests moving assistants/prompts into folders
   - **Functionality**: Tests:
     - Drag and drop assistant to folder
     - Verifying assistant appears in folder

5. **test_folder_expand_collapse**
   - **Purpose**: Tests expanding and collapsing folder views
   - **Functionality**: Tests:
     - Clicking folder to expand/collapse
     - Verifying contents visibility

---

### test_MassDelete.py
**Test Class**: `MassDeleteTests`

#### Tests:
1. **test_mass_delete_button_presence**
   - **Purpose**: Tests that the mass delete button/option is present
   - **Functionality**: Verifies mass delete option accessible in assistants sidebar

2. **test_mass_delete_selection**
   - **Purpose**: Tests selecting multiple assistants/prompts for mass deletion
   - **Functionality**: Tests:
     - Entering selection mode
     - Checking multiple items
     - Verifying selection count

3. **test_mass_delete_execution**
   - **Purpose**: Tests executing mass delete and verifying items are removed
   - **Functionality**: Tests:
     - Selecting items
     - Confirming deletion
     - Verifying items removed

---

### test_MassShare.py
**Test Class**: `MassShareTests`

#### Tests:
1. **test_mass_share_button_presence**
   - **Purpose**: Tests that the mass share button/option is present
   - **Functionality**: Verifies mass share option accessible

2. **test_mass_share_selection**
   - **Purpose**: Tests selecting multiple assistants/prompts for mass sharing
   - **Functionality**: Tests:
     - Entering share mode
     - Selecting multiple items
     - Verifying selection

3. **test_mass_share_execution**
   - **Purpose**: Tests executing mass share and verifying the sharing functionality
   - **Functionality**: Tests:
     - Opening share modal
     - Selecting recipients
     - Confirming share
     - Verifying share successful

---

### test_PromptTemplate.py
**Test Class**: `PromptTemplateTests`

#### Tests:
1. **test_prompt_template_list_display**
   - **Purpose**: Tests that prompt templates are listed in the assistants sidebar
   - **Functionality**: Verifies:
     - Templates are visible
     - Template names display correctly
     - Templates organized in folders

2. **test_select_prompt_template**
   - **Purpose**: Tests selecting a prompt template to use
   - **Functionality**: Tests:
     - Clicking template
     - Applying template to conversation
     - Verifying template loaded

3. **test_create_prompt_template**
   - **Purpose**: Tests creating a new custom prompt template
   - **Functionality**: Tests:
     - Clicking create template
     - Entering template details
     - Saving template
     - Verifying template appears in list

4. **test_edit_prompt_template**
   - **Purpose**: Tests editing an existing prompt template
   - **Functionality**: Tests:
     - Opening template editor
     - Modifying template content
     - Saving changes
     - Verifying updates persisted

5. **test_delete_prompt_template**
   - **Purpose**: Tests deleting a prompt template
   - **Functionality**: Tests:
     - Selecting template
     - Confirming deletion
     - Verifying template removed

---

### test_RightSearchBar.py
**Test Class**: `RightSearchBarTests`

#### Tests:
1. **test_right_search_bar_presence**
   - **Purpose**: Tests that the search bar is present in the assistants sidebar
   - **Functionality**: Verifies search bar visible and accessible

2. **test_search_assistants**
   - **Purpose**: Tests searching for assistants using the assistants sidebar search bar
   - **Functionality**: Tests:
     - Entering search query
     - Verifying filtered results show matching assistants
     - Clearing search

3. **test_search_prompts**
   - **Purpose**: Tests searching for prompt templates using the assistants sidebar search bar
   - **Functionality**: Tests:
     - Entering search query for prompts
     - Verifying filtered results
     - Verifying non-matching items hidden

4. **test_clear_search**
   - **Purpose**: Tests clearing the search in the assistants sidebar
   - **Functionality**: Tests:
     - Entering search query
     - Clicking clear button
     - Verifying all items reappear

---

## Common Test Patterns

### Assistant Management Flow:
1. Navigate to Assistants tab (assistants sidebar)
2. Locate assistant in list or folder
3. Perform action (activate, view details, configure)
4. Verify expected behavior
5. Check active assistants list if applicable

### Folder Management Flow:
1. Create or select folder
2. Perform operation (create/rename/delete/move items)
3. Handle dialogs/alerts for input
4. Verify folder state
5. Verify folder contents if applicable

### Bulk Operations Flow:
1. Access bulk operation mode (Delete/Share menu)
2. Select multiple items via checkboxes
3. Optionally use "Select All"
4. Click action button (Delete/Share)
5. Confirm action in dialog
6. Verify operation completed

### Search Flow:
1. Locate search bar in assistants sidebar
2. Enter search query
3. Wait for filtering to apply
4. Verify matching items shown
5. Verify non-matching items hidden
6. Clear search to restore full list

## Notes
- Right sidebar primarily manages assistants and prompt templates
- Assistants can be organized in folders (similar to chat sidebar for conversations)
- Search filters both assistants and prompts simultaneously
- Drag and drop supports moving items into folders
- Bulk operations (delete/share) require checkbox selection
- Active assistants list shows currently enabled assistants for conversation
- Prompt templates can be created, edited, and shared like assistants
- Right sidebar supports collapsing to maximize chat space
