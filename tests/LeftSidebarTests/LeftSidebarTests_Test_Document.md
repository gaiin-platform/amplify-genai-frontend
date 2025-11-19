# LeftSidebarTests Documentation

## Overview
This folder contains tests for the left sidebar (chat sidebar) functionality in Amplify, including conversation management, folder organization, logout functionality, bulk operations (delete/share), and conversation tagging system.

## Test Files

### test_Clean.py
**Test Class**: `MassDeleteTests`

#### Tests:
1. **test_clean_chats**
   - **Purpose**: Test that the Clean button in the Prompt Handler menu can be clicked and cleans up empty conversations
   - **Functionality**: Tests clicking the Clean button via the prompt handler and verifies empty conversations are removed from the sidebar

---

### test_FolderHandler.py
**Test Class**: `FolderHandlerLeftTests`

#### Tests:
1. **test_folder_sort_name**
   - **Purpose**: Test the three button handler can sort the created folders by name
   - **Functionality**: Tests:
     - Creating multiple folders
     - Opening Prompt Handler menu
     - Navigating to folders submenu
     - Selecting "Sort by Name"
     - Verifying folders are alphabetically sorted

2. **test_folder_delete**
   - **Purpose**: Test the three button handler can delete a folder
   - **Functionality**: Tests:
     - Creating multiple folders
     - Entering folder delete mode
     - Selecting specific folder via checkbox
     - Confirming deletion
     - Verifying folder is removed

3. **test_folder_all_delete**
   - **Purpose**: Test the three button handler can delete all created folders
   - **Functionality**: Tests:
     - Creating multiple folders
     - Entering folder delete mode
     - Using "Select All" checkbox
     - Confirming deletion
     - Verifying all folders are removed

4. **test_folder_share**
   - **Purpose**: Test the three button handler can share the specified folder
   - **Functionality**: Tests:
     - Selecting a folder for sharing
     - Clicking share button
     - Verifying share modal appears
     - Verifying folder is listed in share modal with checkbox pre-checked

5. **test_folder_all_share**
   - **Purpose**: Test the three button handler can share all folders
   - **Functionality**: Tests:
     - Entering folder share mode
     - Using "Select All" checkbox
     - Verifying share modal appears
     - Verifying all folders are listed with checkboxes pre-checked

6. **test_folder_share_with_individual_chat**
   - **Purpose**: Test the three button handler can share the folder and a chat inside the folder
   - **Functionality**: Tests:
     - Creating folder and chat
     - Dragging chat into folder
     - Sharing the folder
     - Verifying both folder and chat appear in share modal

7. **test_folder_share_with_multiple_chat**
   - **Purpose**: Test the three button handler can share the folder and all the chats inside the folder
   - **Functionality**: Tests:
     - Creating folder and multiple chats
     - Dragging multiple chats into folder
     - Sharing the folder
     - Verifying folder and all chats appear in share modal

8. **test_folder_share_with_inside_chat**
   - **Purpose**: Test the three button handler can delete all the empty folders
   - **Functionality**: Tests:
     - Creating folders with and without chats
     - Clicking Clean button in folder menu
     - Verifying empty folders are removed while folders with chats remain

9. **test_folder_open_all**
   - **Purpose**: Test the three button handler can open all folders to see contents inside
   - **Functionality**: Tests:
     - Creating multiple folders
     - Clicking "Open All" button
     - Verifying all folders show "Collapse folder" state

10. **test_folder_close_all**
    - **Purpose**: Test the three button handler can close all folders
    - **Functionality**: Tests:
      - Opening all folders first
      - Clicking "Close All" button
      - Verifying all folders show "Expand folder" state

---

### test_Logout.py
**Test Class**: `LogoutTests`

#### Tests:
1. **test_logout**
   - **Purpose**: This will test the logout button and ensure the user is logged out
   - **Functionality**: Tests:
     - Clicking the user menu button
     - Clicking the logout button
     - Waiting for redirect
     - Verifying login button is visible on the login page

---

### test_MassDelete.py
**Test Class**: `MassDeleteTests`

#### Tests:
1. **test_delete_individual_chats**
   - **Purpose**: This test ensures multiple chats can be deleted individually via the three dots handler on the Chats Side Bar
   - **Functionality**: Tests:
     - Creating multiple chats
     - Entering delete mode via Prompt Handler
     - Selecting specific chats via checkboxes
     - Confirming deletion
     - Verifying selected chats are removed

2. **test_delete_mass_chats**
   - **Purpose**: This test ensures that all chats can be selected and deleted via the three dots handler on the left Side Bar
   - **Functionality**: Tests:
     - Creating multiple chats
     - Entering delete mode
     - Using "Select All" checkbox
     - Confirming deletion
     - Verifying all chats are removed

---

### test_MassShare.py
**Test Class**: `MassShareTests`

#### Tests:
1. **test_share_individual_chats**
   - **Purpose**: This test ensures multiple chats can be shared individually via the three dots handler on the Chats Side Bar
   - **Functionality**: Tests:
     - Creating multiple chats
     - Entering share mode via Prompt Handler
     - Selecting specific chats via checkboxes
     - Confirming share action
     - Verifying share modal appears
     - Verifying selected chats are listed in modal with checkboxes pre-checked

2. **test_share_mass_chats**
   - **Purpose**: This test ensures all chats can be shared via the three dots handler on the Chats Side Bar
   - **Functionality**: Tests:
     - Creating multiple chats
     - Entering share mode
     - Using "Select All" checkbox
     - Confirming share action
     - Verifying share modal appears
     - Verifying all chats are listed in modal with checkboxes pre-checked

---

### test_Tags.py
**Test Class**: `TagTests`

#### Tests:
1. **test_add_tag_individual_chat**
   - **Purpose**: This test ensures that a tag can be added onto an individual chat via the three dot handler on the Chats Side Bar
   - **Functionality**: Tests:
     - Creating chats
     - Entering tag mode via Prompt Handler
     - Selecting a specific chat
     - Opening tag modal
     - Adding a tag via JavaScript alert prompt
     - Verifying tag is added

2. **test_add_multiple_tags_individual_chat**
   - **Purpose**: This test ensures that multiple tags can be added onto an individual chat via the three dot handler on the Chats Side Bar
   - **Functionality**: Tests:
     - Creating chats
     - Entering tag mode
     - Selecting a specific chat
     - Adding multiple comma-separated tags
     - Verifying tags are added

3. **test_add_multiple_tags_multiple_chats**
   - **Purpose**: This test ensures that multiple tags can be added onto multiple chats via the three dot handler on the Chats Side Bar
   - **Functionality**: Tests:
     - Creating multiple chats
     - Entering tag mode
     - Using "Select All" checkbox
     - Adding multiple comma-separated tags
     - Verifying tags are applied to all selected chats

## Common Test Patterns

### Helper Method: `create_chat(chat_name)`
- Creates and names a new chat conversation
- Used by most test files as a setup step
- Handles renaming from "New Conversation" to custom name

### Helper Method: `delete_all_chats()`
- Cleanup method to remove all conversations
- Uses Prompt Handler with Select All functionality
- Used to ensure clean test environment

### Helper Method: `delete_all_folders()`
- Cleanup method to remove all folders
- Navigates to folder submenu and deletes all
- Used to ensure clean test environment

### Helper Method: `create_folder(folder_name)`
- Creates a new folder via JavaScript alert prompt
- Used by folder tests for setup

### Bulk Operations Flow (Delete/Share/Tag):
1. Click Prompt Handler button (three dots menu)
2. Select operation mode (Delete, Share, or Tag)
3. Select items via checkboxes (individual or "Select All")
4. Click confirm button
5. Handle modal/alert if applicable
6. Verify operation completed

### Folder Operations Flow:
1. Click Prompt Handler button
2. Navigate to Folders submenu
3. Select operation (Sort, Delete, Share, Clean, Open All, Close All)
4. Complete operation-specific actions
5. Verify expected result

## Notes
- All tests run in headless mode by default
- Tests use explicit waits for element presence
- Prompt Handler (three dots menu) provides access to bulk operations
- Folder operations are accessed via Prompt Handler > Folders submenu
- Drag-and-drop is used for moving chats into folders
- Tags are added via JavaScript alert prompts with comma-separated values
- Share operations open modal showing selected items with pre-checked checkboxes
- Clean button removes empty conversations and empty folders
