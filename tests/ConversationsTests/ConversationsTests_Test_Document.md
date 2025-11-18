# ConversationsTests Documentation

## Overview
This folder contains tests for conversation management functionality, including creating and managing chats, organizing them into folders, and searching for conversations.

## Test Files

### test_CreateChatFolders.py
**Test Class**: `CreateChatFolderTests`

#### Tests:
1. **test_add_folder**
   - **Purpose**: This test will create a folder and ensure it is present in the list
   - **Functionality**: Tests creating a new folder named "Mario Party" and verifying its presence

2. **test_pin_folder**
   - **Purpose**: This test ensures that the created folder is pinned to the top of the list of folders when the pin button on the specified folder is pressed
   - **Functionality**: Tests:
     - Creating a folder named "Going Merry"
     - Hovering over folder to reveal pin button
     - Clicking pin button
     - Verifying folder appears at top of list

3. **test_rename_folder**
   - **Purpose**: This test ensures that the created folder is renamed when the rename button on the specified folder is pressed
   - **Functionality**: Tests:
     - Creating folder "GOING MERRY"
     - Testing cancel rename flow
     - Testing confirm rename flow (adds " V2")
     - Verifying renamed folder "GOING MERRY V2" exists

4. **test_delete_folder**
   - **Purpose**: This test ensures that the created folder is deleted when the delete button on the specified folder is pressed
   - **Functionality**: Tests:
     - Creating folder "River Raiders"
     - Hovering over folder to reveal delete button
     - Clicking delete with confirmation
     - Verifying folder no longer exists

5. **test_rename_folder** (duplicate method name - tests drag and drop)
   - **Purpose**: This test ensures that the created folder can get a conversation variable added into the folder via drag and drop
   - **Functionality**: Tests:
     - Creating folder "GOING MERRY"
     - Creating chat "Movable Converstation"
     - Drag and drop chat into folder
     - Verifying successful move

#### Helper Methods:
- `create_chat()`: Creates a test chat named "Movable Converstation"

---

### test_CreateChats.py
**Test Class**: `CreateChatTests`

#### Tests:
1. **test_create_chat**
   - **Purpose**: Tests basic chat creation functionality
   - **Functionality**: Creates two new chats by clicking "New Chat" button twice

2. **test_rename_chat**
   - **Purpose**: This test creates a new chat and will rename the chat's name via the rename button
   - **Functionality**: Tests:
     - Creating "New Conversation"
     - Clicking on chat context menu
     - Clicking rename button
     - Adding " V2" to name
     - Confirming rename
     - Verifying "New Conversation V2" exists

3. **test_delete_chat**
   - **Purpose**: This test creates a new chat and then tests the delete conversation button
   - **Functionality**: Tests:
     - Creating "New Conversation"
     - Renaming to "New Conversation V3"
     - Clicking on chat context menu
     - Clicking delete button
     - Confirming deletion
     - Verifying chat no longer exists

---

### test_LeftSearchBar.py
**Test Class**: `LeftSideBarSearchTests`

#### Tests:
1. **test_search_bar_presence**
   - **Purpose**: Tests that the search bar element is present in the chat sidebar
   - **Functionality**: Verifies the search bar is visible and accessible

2. **test_search_bar_functionality**
   - **Purpose**: Tests that the search bar can accept input and filter conversations based on search terms
   - **Functionality**: Tests:
     - Entering search text
     - Verifying filtered results
     - Verifying matching conversations appear

3. **test_search_bar_clear**
   - **Purpose**: Tests the clear button functionality to reset the search bar
   - **Functionality**: Tests:
     - Entering search text
     - Clicking clear button
     - Verifying all conversations reappear

## Common Test Patterns

### Folder Management Flow:
1. Click "Create Folder" button
2. Handle JavaScript alert to name folder
3. Hover over folder to reveal action buttons
4. Test specific action (pin, rename, delete)
5. Verify expected behavior

### Chat Management Flow:
1. Click "New Chat" button
2. Locate "New Conversation" in chat list
3. Click on chat to open context menu
4. Select action (rename, delete)
5. Confirm action if required
6. Verify expected result

### Drag and Drop Flow:
1. Locate draggable element (chat)
2. Locate drop target (folder)
3. Use ActionChains to perform drag_and_drop
4. Verify element moved to target location

## Notes
- Folder and chat names can be customized via JavaScript alerts
- Hover interactions require ActionChains for revealing hidden buttons
- The rename function for folders uses inline editing (renameInput field)
- The rename function for chats uses a separate modal (isRenamingInput field)
- Delete operations require confirmation dialog
- Drag and drop uses Selenium's ActionChains.drag_and_drop method
