# LeftSidebarTests Documentation

## Overview
This folder contains tests for chat sidebar functionality, including conversation cleanup, folder management, user logout, bulk operations (delete/share), and tagging system.

## Test Files

### test_Clean.py
**Test Class**: `CleanTests`

#### Tests:
1. **test_clean_button_presence**
   - **Purpose**: Tests that the clean/clear button is present in the chat sidebar
   - **Functionality**: Verifies clean button is visible and accessible

2. **test_clean_button_functionality**
   - **Purpose**: Tests clicking the clean button and verifying it clears/resets conversations appropriately
   - **Functionality**: Tests:
     - Clicking clean button
     - Confirming cleanup action
     - Verifying conversations are cleared/organized

---

### test_FolderHandler.py
**Test Class**: `FolderHandlerTests`

#### Tests:
1. **test_create_folder**
   - **Purpose**: Tests creating a new folder in the sidebar
   - **Functionality**: Tests folder creation with name input

2. **test_rename_folder**
   - **Purpose**: Tests renaming an existing folder
   - **Functionality**: Tests:
     - Selecting folder
     - Renaming folder
     - Verifying new name

3. **test_delete_folder**
   - **Purpose**: Tests deleting a folder
   - **Functionality**: Tests:
     - Selecting folder
     - Clicking delete
     - Confirming deletion
     - Verifying folder removed

4. **test_move_conversation_to_folder**
   - **Purpose**: Tests moving conversations into folders
   - **Functionality**: Tests:
     - Drag and drop chat to folder
     - Verifying chat appears in folder

5. **test_folder_expand_collapse**
   - **Purpose**: Tests expanding and collapsing folder views
   - **Functionality**: Tests:
     - Clicking folder to expand
     - Verifying contents visible
     - Clicking to collapse
     - Verifying contents hidden

---

### test_Logout.py
**Test Class**: `LogoutTests`

#### Tests:
1. **test_logout_button_presence**
   - **Purpose**: Tests that the logout button is present in the user menu
   - **Functionality**: Verifies logout button is accessible

2. **test_logout_functionality**
   - **Purpose**: Tests clicking logout and verifying the user is logged out and redirected to login page
   - **Functionality**: Tests:
     - Clicking logout button
     - Verifying redirect to login page
     - Verifying session cleared

---

### test_MassDelete.py
**Test Class**: `MassDeleteTests`

#### Tests:
1. **test_mass_delete_button_presence**
   - **Purpose**: Tests that the mass delete button/option is present
   - **Functionality**: Verifies mass delete option is accessible

2. **test_mass_delete_selection**
   - **Purpose**: Tests selecting multiple conversations for mass deletion
   - **Functionality**: Tests:
     - Entering mass delete mode
     - Selecting multiple conversations via checkboxes
     - Verifying selection count

3. **test_mass_delete_execution**
   - **Purpose**: Tests executing mass delete and verifying selected conversations are removed
   - **Functionality**: Tests:
     - Selecting multiple conversations
     - Clicking delete button
     - Confirming deletion
     - Verifying conversations removed

---

### test_MassShare.py
**Test Class**: `MassShareTests`

#### Tests:
1. **test_mass_share_button_presence**
   - **Purpose**: Tests that the mass share button/option is present
   - **Functionality**: Verifies mass share option is accessible

2. **test_mass_share_selection**
   - **Purpose**: Tests selecting multiple conversations for mass sharing
   - **Functionality**: Tests:
     - Entering mass share mode
     - Selecting multiple conversations
     - Verifying selection count

3. **test_mass_share_execution**
   - **Purpose**: Tests executing mass share and verifying the sharing functionality
   - **Functionality**: Tests:
     - Selecting multiple conversations
     - Opening share dialog
     - Selecting users/groups to share with
     - Confirming share action
     - Verifying share successful

---

### test_Tags.py
**Test Class**: `TagsTests`

#### Tests:
1. **test_add_tag**
   - **Purpose**: Tests adding tags to conversations
   - **Functionality**: Tests:
     - Selecting conversation
     - Adding tag via tag input
     - Verifying tag appears on conversation

2. **test_filter_by_tag**
   - **Purpose**: Tests filtering conversations by selected tags
   - **Functionality**: Tests:
     - Selecting tag filter
     - Verifying only tagged conversations appear
     - Clearing filter

3. **test_remove_tag**
   - **Purpose**: Tests removing tags from conversations
   - **Functionality**: Tests:
     - Selecting tagged conversation
     - Removing tag
     - Verifying tag removed

4. **test_tag_visibility**
   - **Purpose**: Tests that tags are visible on conversations in the sidebar
   - **Functionality**: Tests:
     - Adding tags to conversations
     - Verifying tags display correctly
     - Testing tag text and styling

## Common Test Patterns

### Bulk Operations Flow:
1. Click "Prompt Handler" button (or equivalent menu)
2. Select operation mode (Delete or Share)
3. Select multiple items via checkboxes
4. Optionally use "Select All" checkbox
5. Click confirm button
6. Verify operation completed

### Folder Operations Flow:
1. Navigate to folder management
2. Perform action (create/rename/delete/expand)
3. Handle dialogs/confirmations as needed
4. Verify expected result

### Tag Management Flow:
1. Select conversation
2. Access tag interface
3. Add/remove tags
4. Apply filters
5. Verify tag-based organization

## Notes
- Mass operations use checkbox selection for multiple items
- "Select All" checkbox available for bulk operations
- Folder operations support drag-and-drop for moving conversations
- Tags support multiple tags per conversation
- Logout should clear session and redirect to login
- Delete operations typically require confirmation
- Share operations open modal with user/group selection
