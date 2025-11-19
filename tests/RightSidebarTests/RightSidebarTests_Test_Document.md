# RightSidebarTests Documentation

## Overview
This folder contains tests for the right sidebar (assistants sidebar) functionality in Amplify, including assistants management, prompt templates, folder organization, search functionality, and bulk operations. The right sidebar is the primary interface for managing AI assistants, custom prompt templates, and organizing them into folders.

## Test Files

### test_ActiveAssistantsList.py
**Test Class**: `ActiveAssistantsListTests`

#### Tests:
1. **test_dropdown_opens_on_click**
   - **Purpose**: Test that the Assistants dropdown menu is clickable and collapses/expands
   - **Functionality**: Tests:
     - Clicking the Assistants folder to expand
     - Verifying dropdown opens and contents are visible
     - Testing collapse functionality

2. **test_dropdown_closes_after_selection**
   - **Purpose**: Test that the Assistants dropdown closes after selecting an assistant
   - **Functionality**: Tests:
     - Opening dropdown
     - Selecting an assistant
     - Verifying dropdown closes automatically

3. **test_add_assistant_and_in_dropdown**
   - **Purpose**: Test creating a new assistant and verifying it appears in the dropdown list
   - **Functionality**: Tests:
     - Clicking Add Assistant button
     - Creating new assistant with name
     - Verifying assistant appears in Assistants folder dropdown

4. **test_assistant_is_interactable**
   - **Purpose**: Test that an assistant in the list can be clicked and opened
   - **Functionality**: Tests:
     - Clicking on an assistant in the list
     - Verifying assistant modal/page opens
     - Verifying assistant details are displayed

5. **test_check_list_updates_with_multiple_assistants**
   - **Purpose**: Test that the assistants list properly updates when multiple assistants are added
   - **Functionality**: Tests:
     - Creating multiple assistants
     - Verifying all assistants appear in the list
     - Verifying list order and visibility

6. **test_edit_button**
   - **Purpose**: Test the Edit button on an assistant to open the edit modal
   - **Functionality**: Tests:
     - Hovering over assistant to reveal Edit button
     - Clicking Edit button
     - Verifying edit modal opens with assistant details

7. **test_share_button**
   - **Purpose**: Test the Share button on an assistant to open the share modal
   - **Functionality**: Tests:
     - Hovering over assistant to reveal Share button
     - Clicking Share button
     - Verifying share modal opens

8. **test_delete_button**
   - **Purpose**: Test the Delete button on an assistant to remove it
   - **Functionality**: Tests:
     - Hovering over assistant to reveal Delete button
     - Clicking Delete button
     - Confirming deletion
     - Verifying assistant is removed from list

---

### test_AssistantsPage.py
**Test Class**: `ActiveAssistantsListTests`

#### Tests:
1. **test_assistant_advanced_fields**
   - **Purpose**: Test that the Publish Assistant Path option is interactable on the assistants page
   - **Functionality**: Tests:
     - Opening Assistants tab
     - Accessing advanced fields
     - Verifying Publish Assistant Path option is visible and interactive

2. **test_open_existing_page**
   - **Purpose**: Test opening an existing assistant page via direct URL navigation
   - **Functionality**: Tests:
     - Navigating to predefined assistant path (http://localhost:3000/assistants/mmmm_banana)
     - Verifying page loads correctly
     - Verifying assistant title displays correctly

3. **test_model_change**
   - **Purpose**: Test changing the model selection for an assistant
   - **Functionality**: Tests:
     - Opening assistant settings
     - Changing model selection
     - Verifying model change is applied

4. **test_misc_features**
   - **Purpose**: Test miscellaneous features on the assistants page
   - **Functionality**: Tests various assistant configuration options

5. **test_single_chat**
   - **Purpose**: Test single chat interaction with an assistant
   - **Functionality**: Tests:
     - Sending a message to an assistant
     - Verifying response is received
     - Testing single conversation flow

6. **test_multiple_chat**
   - **Purpose**: Test multiple chat interactions with an assistant
   - **Functionality**: Tests:
     - Sending multiple messages
     - Verifying responses for all messages
     - Testing conversation continuity

7. **test_copy_user_chat**
   - **Purpose**: Test copying a user message from the chat
   - **Functionality**: Tests:
     - Hovering over user message
     - Clicking Copy button
     - Verifying message is copied to clipboard

8. **test_edit_user_chat**
   - **Purpose**: Test editing a user message in the chat
   - **Functionality**: Tests:
     - Hovering over user message
     - Clicking Edit button
     - Modifying message text
     - Saving edited message

9. **test_delete_user_chat**
   - **Purpose**: Test deleting a single user message from the chat
   - **Functionality**: Tests:
     - Hovering over user message
     - Clicking Delete button
     - Confirming deletion
     - Verifying message is removed

10. **test_delete_multiple_user_chat**
    - **Purpose**: Test deleting multiple user messages from the chat
    - **Functionality**: Tests:
      - Selecting multiple user messages
      - Deleting multiple messages at once
      - Verifying all selected messages are removed

11. **test_copy_response_chat**
    - **Purpose**: Test copying an assistant's response from the chat
    - **Functionality**: Tests:
      - Hovering over assistant response
      - Clicking Copy button
      - Verifying response is copied to clipboard

12. **test_download_response_chat**
    - **Purpose**: Test downloading an assistant's response
    - **Functionality**: Tests:
      - Hovering over assistant response
      - Clicking Download button
      - Verifying download modal appears or download initiates

13. **test_email_response_chat**
    - **Purpose**: Test emailing an assistant's response
    - **Functionality**: Tests:
      - Hovering over assistant response
      - Clicking Email button
      - Verifying email modal or functionality appears

---

### test_CreateFolder.py
**Test Class**: `CreateFolderTests`

#### Tests:
1. **test_add_folder**
   - **Purpose**: Test creating a new folder in the assistants sidebar
   - **Functionality**: Tests:
     - Clicking Add Folder button
     - Entering folder name via JavaScript alert
     - Verifying folder appears in the sidebar

2. **test_pin_folder**
   - **Purpose**: Test pinning a folder to keep it at the top of the list
   - **Functionality**: Tests:
     - Creating a folder
     - Clicking Pin button on folder
     - Verifying folder is pinned to top

3. **test_rename_folder**
   - **Purpose**: Test renaming an existing folder
   - **Functionality**: Tests:
     - Hovering over folder to reveal actions
     - Clicking Rename button
     - Entering new name via JavaScript alert
     - Verifying folder name is updated

4. **test_delete_folder**
   - **Purpose**: Test deleting a folder from the assistants sidebar
   - **Functionality**: Tests:
     - Hovering over folder to reveal actions
     - Clicking Delete button
     - Confirming deletion
     - Verifying folder is removed

5. **test_add_item_to_folder**
   - **Purpose**: Test adding an assistant or prompt to a folder via drag and drop
   - **Functionality**: Tests:
     - Creating folder and assistant/prompt
     - Dragging item to folder
     - Verifying item appears inside folder

---

### test_FolderHandler.py
**Test Class**: `FolderHandlerTests`

#### Tests:
1. **test_folder_sort_name**
   - **Purpose**: Test sorting folders by name via the Prompt Handler menu
   - **Functionality**: Tests:
     - Creating multiple folders
     - Opening Prompt Handler menu
     - Navigating to Folders submenu
     - Selecting "Sort by Name"
     - Verifying folders are alphabetically sorted

2. **test_folder_delete**
   - **Purpose**: Test deleting a specific folder via the Prompt Handler menu
   - **Functionality**: Tests:
     - Creating multiple folders
     - Entering folder delete mode via Prompt Handler
     - Selecting specific folder via checkbox
     - Confirming deletion
     - Verifying folder is removed

3. **test_folder_all_delete**
   - **Purpose**: Test deleting all folders via the Prompt Handler menu
   - **Functionality**: Tests:
     - Creating multiple folders
     - Entering folder delete mode
     - Using "Select All" checkbox
     - Confirming deletion
     - Verifying all folders are removed

4. **test_folder_share**
   - **Purpose**: Test sharing a specific folder via the Prompt Handler menu
   - **Functionality**: Tests:
     - Selecting a folder for sharing
     - Clicking Share button
     - Verifying share modal appears
     - Verifying folder is listed in share modal with checkbox pre-checked

5. **test_folder_all_share**
   - **Purpose**: Test sharing all folders via the Prompt Handler menu
   - **Functionality**: Tests:
     - Entering folder share mode
     - Using "Select All" checkbox
     - Verifying share modal appears
     - Verifying all folders are listed with checkboxes pre-checked

6. **test_folder_clean**
   - **Purpose**: Test cleaning empty folders (removing folders with no content)
   - **Functionality**: Tests:
     - Creating folders with and without content
     - Clicking Clean button in folder menu
     - Verifying empty folders are removed
     - Verifying folders with content remain

---

### test_MassDelete.py
**Test Class**: `MassDeleteTests`

#### Tests:
1. **test_delete_mass_assistants**
   - **Purpose**: Test deleting multiple assistants at once via the Prompt Handler menu
   - **Functionality**: Tests:
     - Creating multiple assistants
     - Entering delete mode via Prompt Handler
     - Selecting multiple assistants via checkboxes
     - Confirming deletion
     - Verifying all selected assistants are removed

2. **test_delete_mass_prompts**
   - **Purpose**: Test deleting multiple prompt templates at once via the Prompt Handler menu
   - **Functionality**: Tests:
     - Creating multiple prompts
     - Entering delete mode
     - Selecting multiple prompts via checkboxes
     - Confirming deletion
     - Verifying all selected prompts are removed

3. **test_delete_everything**
   - **Purpose**: Test deleting all assistants and prompts using Select All functionality
   - **Functionality**: Tests:
     - Creating multiple assistants and prompts
     - Entering delete mode
     - Using "Select All" checkbox
     - Confirming deletion
     - Verifying all items are removed

---

### test_MassShare.py
**Test Class**: `MassShareTests`

#### Tests:
1. **test_share_mass_assistants**
   - **Purpose**: Test sharing multiple assistants at once via the Prompt Handler menu
   - **Functionality**: Tests:
     - Creating multiple assistants
     - Entering share mode via Prompt Handler
     - Selecting multiple assistants via checkboxes
     - Confirming share action
     - Verifying share modal appears
     - Verifying selected assistants are listed in modal with checkboxes pre-checked

2. **test_share_mass_prompts**
   - **Purpose**: Test sharing multiple prompt templates at once via the Prompt Handler menu
   - **Functionality**: Tests:
     - Creating multiple prompts
     - Entering share mode
     - Selecting multiple prompts via checkboxes
     - Confirming share action
     - Verifying share modal appears
     - Verifying selected prompts are listed in modal with checkboxes pre-checked

3. **test_share_everything**
   - **Purpose**: Test sharing all assistants and prompts using Select All functionality
   - **Functionality**: Tests:
     - Creating multiple assistants and prompts
     - Entering share mode
     - Using "Select All" checkbox
     - Confirming share action
     - Verifying share modal appears
     - Verifying all items are listed with checkboxes pre-checked

---

### test_PromptTemplate.py
**Test Class**: `PromptTemplateTests`

#### Tests:
1. **test_add_prompt_in_dropdown**
   - **Purpose**: Test creating a new prompt template and verifying it appears in the dropdown list
   - **Functionality**: Tests:
     - Clicking Add Prompt button
     - Creating new prompt with name and configuration
     - Saving prompt
     - Verifying prompt appears in Prompts folder dropdown

2. **test_prompt_is_interactable**
   - **Purpose**: Test that a prompt in the list can be clicked and opened
   - **Functionality**: Tests:
     - Clicking on a prompt in the list
     - Verifying prompt modal/editor opens
     - Verifying prompt details are displayed

3. **test_with_multiple_prompts**
   - **Purpose**: Test that multiple prompts can be created and managed simultaneously
   - **Functionality**: Tests:
     - Creating multiple prompts
     - Verifying all prompts appear in list
     - Testing interaction with multiple prompts

4. **test_duplicate_button**
   - **Purpose**: Test the Duplicate button on a prompt to create a copy
   - **Functionality**: Tests:
     - Hovering over prompt to reveal Duplicate button
     - Clicking Duplicate button
     - Verifying duplicate prompt is created with modified name
     - Verifying both original and duplicate appear in list

5. **test_edit_button**
   - **Purpose**: Test the Edit button on a prompt to open the edit modal
   - **Functionality**: Tests:
     - Hovering over prompt to reveal Edit button
     - Clicking Edit button
     - Verifying edit modal opens with prompt details

6. **test_share_button**
   - **Purpose**: Test the Share button on a prompt to open the share modal
   - **Functionality**: Tests:
     - Hovering over prompt to reveal Share button
     - Clicking Share button
     - Verifying share modal opens

7. **test_delete_button**
   - **Purpose**: Test the Delete button on a prompt to remove it
   - **Functionality**: Tests:
     - Hovering over prompt to reveal Delete button
     - Clicking Delete button
     - Confirming deletion
     - Verifying prompt is removed from list

---

### test_RightSearchBar.py
**Test Class**: `SearchBarRightTests`

#### Tests:
1. **test_search_assistant**
   - **Purpose**: Test searching for assistants using the search bar in the assistants sidebar
   - **Functionality**: Tests:
     - Creating assistants with different names
     - Entering search query in search bar
     - Verifying matching assistants are displayed
     - Verifying non-matching assistants are hidden

2. **test_search_prompt**
   - **Purpose**: Test searching for prompt templates using the search bar
   - **Functionality**: Tests:
     - Creating prompts with different names
     - Entering search query
     - Verifying matching prompts are displayed
     - Verifying non-matching prompts are hidden

3. **test_search_nothing**
   - **Purpose**: Test searching with a query that returns no results
   - **Functionality**: Tests:
     - Entering search query with no matches
     - Verifying no items are displayed
     - Verifying empty state or "no results" message

---

## Common Test Patterns

### Helper Method: `click_assistants_tab()`
- Navigates to the Assistants tab in the right sidebar
- Used by all test files as a setup step
- Includes waits for UI rendering

### Helper Method: `delete_all_assistants()`
- Cleanup method to remove all assistants
- Uses Prompt Handler with Select All functionality
- Used to ensure clean test environment

### Helper Method: `open_page()`
- Navigates to a specific assistant page via direct URL
- Used in AssistantsPage tests
- Verifies page loads correctly

### Assistant Management Flow:
1. Navigate to Assistants tab (right sidebar)
2. Locate assistant in list or folder
3. Perform action (click, edit, share, delete)
4. Verify expected behavior
5. Check list updates correctly

### Prompt Template Management Flow:
1. Navigate to Assistants tab
2. Expand Prompts folder
3. Locate prompt in list
4. Perform action (click, edit, duplicate, share, delete)
5. Verify expected behavior

### Folder Management Flow:
1. Create or select folder
2. Perform operation (create/rename/delete/pin/move items)
3. Handle JavaScript alerts for input (folder name, etc.)
4. Verify folder state
5. Verify folder contents if applicable

### Bulk Operations Flow (Delete/Share):
1. Click Prompt Handler button (three dots menu)
2. Select operation mode (Delete or Share)
3. Select items via checkboxes (individual or "Select All")
4. Click confirm button
5. Handle modal if applicable
6. Verify operation completed

### Search Flow:
1. Locate search bar in assistants sidebar
2. Enter search query
3. Wait for filtering to apply
4. Verify matching items shown
5. Verify non-matching items hidden
6. Clear search to restore full list

## Notes
- All tests run in headless mode by default
- Tests use explicit waits for element presence (WebDriverWait)
- Right sidebar primarily manages assistants and prompt templates
- Assistants and prompts can be organized in folders (similar to left chat sidebar)
- Search filters both assistants and prompts simultaneously
- Drag and drop supports moving items into folders
- Bulk operations (delete/share) use checkbox selection via Prompt Handler menu
- Hover actions reveal Edit, Share, Delete, and Duplicate buttons for items
- Folder operations are accessed via Prompt Handler > Folders submenu
- JavaScript alerts are used for folder naming (create/rename)
- Share operations open modal showing selected items with pre-checked checkboxes
- test_AssistantsPage.py uses predefined assistant path (http://localhost:3000/assistants/mmmm_banana)
- Some tests in test_FolderHandler.py are commented out (test_folder_open_all, test_folder_close_all)
- Pin functionality keeps folders at the top of the list
- Clean button removes empty folders but preserves folders with content
