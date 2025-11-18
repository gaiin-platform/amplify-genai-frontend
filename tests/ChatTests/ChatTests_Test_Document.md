# ChatTests Documentation

## Overview
This folder contains tests for the core chat interface functionality, including chat interactions, file handling, response management, and feature selection.

## Test Files

### test_AddAction.py
**Test Class**: `AddActionTests`

#### Tests:
1. **test_add_action_presence**
   - **Purpose**: Test the Presence of all the elements in the Scheduled Tasks Modal
   - **Functionality**: Verifies Add Action button, tabs (Actions, Action Sets), API operations dropdown, and selection options

2. **test_add_action_presence_api_and_tools**
   - **Purpose**: Test the Presence of all the elements in the Scheduled Tasks Modal
   - **Functionality**: Verifies API items and Tool items are visible with their respective IDs (apiItem, apiClick, apiName, toolItem, toolClick, toolName)

3. **test_view_action_non_custom**
   - **Purpose**: Test the Presence of all the elements in the Scheduled Tasks Modal
   - **Functionality**: Tests viewing a non-custom action (Write File From String), including:
     - Operation name and description verification
     - Custom name and description input
     - Parameter testing (File Path, Content)
     - Toggle button functionality
     - Technical details display
     - Add and cancel button functionality

#### Helper Methods:
- `normalize_text(s)`: Collapses whitespace for text comparison

---

### test_ChatBarMisc.py
**Test Class**: `ChatBarMiscTests`

#### Tests:
1. **test_upload_files_visible**
   - **Purpose**: This test ensures that the upload files button can be hit and that the system-generated file upload window appears. This is only confirmable by viewing.
   - **Functionality**: Tests file upload button visibility and click action
   - **Note**: Cannot test system file dialog interaction via Selenium

2. **test_select_assistants**
   - **Purpose**: This test ensures that Assistant chat labels can be selected
   - **Functionality**: Tests:
     - Selecting assistants via dropdown
     - Standard conversation mode
     - Assistant chat label appearance

3. **test_collapse_left_sidebar**
   - **Purpose**: This test ensures that the chat sidebar can be collapsed
   - **Functionality**: Tests sidebar collapse/expand functionality

4. **test_collapse_right_sidebar**
   - **Purpose**: This test ensures that the assistants sidebar can be collapsed
   - **Functionality**: Tests assistants sidebar collapse/expand

#### Helper Methods:
- `sidebar_press()`: Ensures sidebar is open before tests
- `click_assistants_tab()`: Navigates to assistants tab
- `create_assistant(assistant_name)`: Creates a test assistant

---

### test_ChatHome.py
**Test Class**: `ChatHomeTests`

#### Tests:
1. **test_send_chat**
   - **Purpose**: This tests the chat bar and that a message can be sent
   - **Functionality**: Tests basic message sending in a conversation

2. **test_change_model**
   - **Purpose**: This test ensures that in the chat settings you can change each of the different models and that all of the models are present
   - **Functionality**: Tests model selection for all available models:
     - Claude 3 Haiku, Opus, Sonnet, 3.5 Sonnet, 3.5 Sonnet V2, 3.7 Sonnet
     - DeepSeek r1
     - GPT-4o, GPT-4o-mini
     - Llama 3.2 90b instruct
     - Mistral 7B, Large, Mixtral 8*7B
     - o1 Mini, o1 Preview

3. **test_store_convo_in_cloud**
   - **Purpose**: This test ensures that you can store a conversation to the cloud by clicking the save to cloud button
   - **Functionality**: Tests conversation cloud storage toggle

4. **test_advanced_convo_settings**
   - **Purpose**: This test ensures that the Advanced Conversation Settings can be viewed
   - **Functionality**: Tests visibility of advanced settings panel

5. **test_custom_settings**
   - **Purpose**: This test ensures that the custom instructions selection can be any of the assistants and prompts
   - **Functionality**: Tests custom instructions dropdown contains all available assistants and custom instructions

6. **test_temperature_slider**
   - **Purpose**: This test ensures that the interactive slider that measures the temperature of a response works as intended
   - **Functionality**: Tests temperature slider from 1.0 to 0.0 in 0.1 increments

7. **test_length_slider**
   - **Purpose**: This test ensures that the interactive slider that measures the length of a response works as intended
   - **Functionality**: Tests length slider decreasing and increasing (0.0 to 6.0)

8. **test_length_slider_with_chat**
   - **Purpose**: This test ensures that the interactive slider that measures the length of a response works as intended with sending a chat
   - **Functionality**: Tests that length slider affects response length by comparing two chats with different slider values

9. **test_legend_hover**
   - **Purpose**: This test ensures that the interactive legend that appears when you hover over it
   - **Functionality**: Tests legend hover interaction and visibility

#### Helper Methods:
- `create_folder(folder_name)`: Creates a folder for organizing chats
- `click_assistants_tab()`: Navigates to assistants tab
- `create_chat(chat_name)`: Creates and names a new chat
- `send_message(chat_name, message)`: Sends a message in a specific chat

---

### test_FileInclusions.py
**Test Class**: `FileInclusionTests`

#### Tests:
1. **test_file_inclusions_menu**
   - **Purpose**: This test ensures that an uploaded txt file can be viewed in the Files Menu
   - **Functionality**: Tests file upload and verification in files menu (Test_3.txt)

2. **test_file_inclusions_doc_menu**
   - **Purpose**: This test ensures that an uploaded pdf can be viewed in the Files Menu
   - **Functionality**: Tests PDF file appears in docs section (Test_4.pdf)

3. **test_file_inclusions_powerpoint_menu**
   - **Purpose**: This test ensures that an uploaded pptx can be viewed in the Files Menu
   - **Functionality**: Tests PowerPoint file appears in slide section (Test_5.pptx)

4. **test_file_inclusions_word_in_doc_menu**
   - **Purpose**: Test that Word doc (.docx) appears in the docs section menu
   - **Functionality**: Tests Word document appears in docs section (Test_6.docx)

5. **test_file_inclusions_markdown_in_doc_menu**
   - **Purpose**: Test that Markdown (.md) appears in the docs section menu
   - **Functionality**: Tests Markdown file appears in docs section (Test_7.md)

6. **test_file_inclusions_html_in_doc_menu**
   - **Purpose**: Test that HTML (.html) appears in the docs section menu
   - **Functionality**: Tests HTML file appears in docs section (Test_8.html)

7. **test_file_inclusions_csv_not_in_doc_menu**
   - **Purpose**: Test that CSV appears in the normal section menu but not in docs
   - **Functionality**: Tests CSV file categorization (Test_10.csv should NOT appear in docs section)

#### Helper Methods:
- `upload_file(filename)`: Uploads files using file input element
- `sidebar_press()`: Ensures sidebar is open
- `send_message(message)`: Sends a test message with uploaded file

#### Notes:
- Supported file types in docs section: Word, PDF, Markdown, Text, HTML
- Supported file types in slide section: PowerPoint, Google Slides
- CSV files appear in general files but not in docs section

---

### test_ResponseChatHandler.py
**Test Class**: `ResponseChatHandlerTests`

#### Tests:
1. **test_copy_response**
   - **Purpose**: This test ensures that after sending a message that the Amplify Response can be copied via Copy Response Button and that the copied text is correct
   - **Functionality**: Tests copy-to-clipboard functionality for AI responses

2. **test_turn_into_artifact**
   - **Purpose**: This test ensures that after sending a message that the Amplify Response can be turned into an Artifact via the Turn into Artifact Button
   - **Functionality**: Tests artifact creation from response

3. **test_download_response**
   - **Purpose**: This test ensures that after sending a message that the Amplify Response can make the Download Modal appear via the Download Response Button
   - **Functionality**: Tests download modal opens for responses

4. **test_email_response**
   - **Purpose**: This test ensures that after sending a message that the Amplify Response can be emailed via the Email Response Button
   - **Functionality**: Tests email functionality (opens email client)

5. **test_edit_response**
   - **Purpose**: This test ensures that after sending a message that the Amplify Response can be edited via the Edit Response button
   - **Functionality**: Tests response editing with cancel and confirm flows

6. **test_branch_conversation**
   - **Purpose**: This test ensures that after sending a message that the Amplify Response can be branched off into a new conversation via the Branch Into New Conversation Button
   - **Functionality**: Tests conversation branching from response

7. **test_copy_prompt**
   - **Purpose**: This test ensures that after sending a message that the Amplify Prompt Message can be copied and that the copied text is correct
   - **Functionality**: Tests copy functionality for user prompts

8. **test_download_prompt**
   - **Purpose**: This test ensures that after sending a message that the Amplify Prompt Message can be downloaded via the Download Prompt button
   - **Functionality**: Tests download modal for prompts

9. **test_edit_prompt**
   - **Purpose**: This test ensures that after sending a message that the Amplify Prompt Message can be edited via the Edit Prompt button
   - **Functionality**: Tests prompt editing with cancel and confirm flows

10. **test_branch_prompt**
    - **Purpose**: This test ensures that after sending a message that the Amplify Prompt Message can be branched off into a new conversation via the Branch Into New Conversation Button
    - **Functionality**: Tests conversation branching from prompt

11. **test_delete_prompt**
    - **Purpose**: This test ensures that after sending a message that the Amplify Prompt Message can be deleted via the Delete Prompt Button
    - **Functionality**: Tests prompt deletion

#### Helper Methods:
- `create_folder(folder_name)`: Creates test folder
- `create_chat(chat_name)`: Creates test chat
- `send_message(chat_name, message)`: Sends test message
- `delete_all_chats()`: Cleanup method to delete all conversations

---

### test_SelectEnabledFeatures.py
**Test Class**: `SelectEnabledFeaturesTests`

#### Tests:
1. **test_select_enabled_features_menu**
   - **Purpose**: This test ensures that the Select Enabled Features Movable Button is selectable and that the menu appears
   - **Functionality**: Tests enabled features menu visibility

2. **test_select_enabled_features_click_n_drag**
   - **Purpose**: This test ensures the Select Enabled Features button is draggable to all four corners of its container
   - **Functionality**: Tests drag functionality to: bottom-left, top-left, top-right, bottom-right

3. **test_select_enabled_features_click_n_drag_with_menu**
   - **Purpose**: This test ensures the Select Enabled Features button is draggable to all four corners of its container when the menu is open
   - **Functionality**: Tests drag functionality with menu open

4. **test_code_interpretor**
   - **Purpose**: This test ensures the Select Enabled Features Code Interpretor button is selectable
   - **Functionality**: Tests code interpreter activation and usage

5. **test_clear_all_features**
   - **Purpose**: This test ensures the Select Enabled Features Clear All Enabled Features button is selectable
   - **Functionality**: Tests clearing all enabled features

#### Helper Methods:
- `drag_element(element, target_x, target_y)`: Drags element to coordinates
- `find_top_y_value()`: Finds topmost Y position for draggable
- `find_far_x_value()`: Finds rightmost X position for draggable
- `send_message(message)`: Sends test message

---

### test_UpperChat.py
**Test Class**: `UpperChatTests`

#### Tests:
1. **test_upper_chat_settings**
   - **Purpose**: Test to ensure the upper chat settings button is accessible
   - **Functionality**: Tests upper chat settings hover and click functionality

2. **test_upper_chat_clear**
   - **Purpose**: Test to ensure the upper chat clear button is accessible
   - **Functionality**: Tests clear messages button with alert confirmation

3. **test_upper_share**
   - **Purpose**: Test to ensure the upper chat share button is accessible
   - **Functionality**: Tests share modal and checkbox functionality

4. **test_upper_download**
   - **Purpose**: Test to ensure the upper download button is accessible
   - **Functionality**: Tests download modal and checkbox functionality

5. **test_upper_artifact**
   - **Purpose**: Test to ensure the upper chat artifact button is accessible
   - **Functionality**: Tests adding/removing artifacts to conversation

6. **test_upper_download** (duplicate method name)
   - **Purpose**: Test to ensure the upper chat privacy button is accessible
   - **Functionality**: Tests privacy toggle (cloud vs local storage)

7. **test_pin_upper_chat_menu**
   - **Purpose**: Test to ensure the upper chat pin button successfully pins the upper chat to the top of the chat menu
   - **Functionality**: Tests pin/unpin functionality for upper chat bar

#### Helper Methods:
- `create_folder(folder_name)`: Creates test folder
- `create_chat(chat_name)`: Creates test chat
- `send_message(chat_name, message)`: Sends test message
- `create_artifact(chat_name, message)`: Creates test artifact
- `delete_all_chats()`: Cleanup method

## Common Test Patterns

### Chat Creation Flow:
1. Click "New Chat" button
2. Rename conversation
3. Send messages
4. Test specific functionality

### File Upload Flow:
1. Locate file input element
2. Make element visible (remove 'sr-only')
3. Send file path
4. Wait for processing
5. Verify file appears in appropriate section

### Response Interaction Flow:
1. Send message to get response
2. Hover over chat response
3. Click specific action button (copy, download, edit, etc.)
4. Verify expected behavior

## Notes
- Tests use persistent Chrome profile for authentication
- File uploads require absolute paths to test_files directory
- Clipboard operations use platform-specific keys (COMMAND for Mac, CONTROL for Windows/Linux)
- Many tests include cleanup methods (delete_all_chats) to ensure test isolation
