import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import (
    UnexpectedAlertPresentException,
    NoSuchElementException,
)
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys
from tests.base_test import BaseTest


class ResponseChatHandlerTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------
    def create_folder(self, folder_name):
        time.sleep(5)
        folder_add_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "createFolderButton"))
        )
        self.assertGreater(
            len(folder_add_buttons),
            1,
            "Expected multiple buttons with ID 'createFolderButton'",
        )
        folder_add_buttons[0].click()

        try:
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")
            time.sleep(3)
            alert.send_keys(folder_name)
            time.sleep(3)
            alert.accept()
        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")

    def create_chat(self, chat_name):
        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "New Chat elements should be initialized")
        chat_add_button = next(
            (el for el in prompt_buttons if el.text == "New Chat"), None
        )
        self.assertIsNotNone(chat_add_button, "New Chat button should be present")
        chat_add_button.click()

        time.sleep(2)

        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        chats = next(
            (el for el in chat_name_elements if el.text == "New Conversation"), None
        )
        self.assertIsNotNone(chats, "New Conversation button should be present")
        chat_click = chats.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")
        chat_click.click()

        rename_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "isRenaming"))
        )
        self.assertIsNotNone(
            rename_button, "Rename button should be initialized and clicked"
        )
        rename_button.click()

        rename_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "isRenamingInput"))
        )
        rename_field.clear()
        rename_field.send_keys(chat_name)
        rename_confirm_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "handleConfirm"))
        )
        self.assertIsNotNone(
            rename_confirm_button,
            "Rename confirm button should be initialized and clicked",
        )
        rename_confirm_button.click()
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(2)

        folder = next((el for el in drop_name_elements if el.text == chat_name), None)
        self.assertIsNotNone(folder, "New Conversation button should be present")

    def send_message(self, chat_name, message):
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")

        time.sleep(2)

        # Find the element with chat name
        chat = next((el for el in chat_name_elements if el.text == chat_name), None)
        self.assertIsNotNone(chat, "Chat button should be present")
        chat_click = chat.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")
        chat_click.click()
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(
            EC.presence_of_element_located((By.ID, "messageChatInputText"))
        )
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        chat_input_bar.send_keys(message)

        time.sleep(2)

        # Locate the send message button
        chat_send_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "sendMessage"))
        )
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        chat_send_message.click()
        time.sleep(15)
        
    def delete_all_chats(self):
        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )

        prompt_handler_button.click()

        time.sleep(2)

        # Click the button with ID "Delete"
        delete_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "Delete"))
        )

        delete_button.click()

        time.sleep(2)  # Give time for the menu to appear

        # Click the select all checkbox
        select_all_check = self.wait.until(
            EC.presence_of_element_located((By.ID, "selectAllCheck"))
        )

        # Locate the checkbox within the parent container
        checkbox = select_all_check.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt All should be present")

        checkbox.click()

        time.sleep(2)

        # Click the Delete Button
        confirm_delete_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()

        time.sleep(2)

    # ----------------- Test Copy Response -----------------
    """This test ensures that after sending a message that the Amplify Response
       can be copied via Copy Response Button and that the copied text is correct"""

    def test_copy_response(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Waluigi")

        # Send a Message
        self.send_message("Waluigi", "WAAAALUIIIIGIII TIIIIIIIME!!!")

        # Get chat content block element
        chat_content = self.driver.find_element("id", "chatContentBlock")
        expected_message = chat_content.get_attribute("data-original-content")

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover', there are two: chat and response"
        )

        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()

        time.sleep(3)

        # Click the copy button
        copy_button = self.driver.find_element("id", "copyResponse")
        copy_button.click()

        time.sleep(1)

        # Focus on the input field
        input_field = self.driver.find_element(By.ID, "messageChatInputText")
        input_field.click()

        # Try pasting with COMMAND (for Mac), fallback to CONTROL (for Windows/Linux)
        try:
            input_field.send_keys(Keys.COMMAND, "v")  # Mac paste
        except Exception:
            input_field.send_keys(Keys.CONTROL, "v")  # Windows/Linux paste

        time.sleep(1)  # Wait for paste to complete

        # Get the pasted text
        copied_text = input_field.get_attribute("value")

        # Assert copied text matches expected message
        self.assertEqual(
            expected_message,
            copied_text,
            "Copied text does not match expected message.",
        )

    # ----------------- Test Turn Into Artifact -----------------
    """This test ensures that after sending a message that the Amplify Response
       can be turned into an Artifact via the Turn into Artifact Button"""

    def test_turn_into_artifact(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Mario")

        # Send a Message
        self.send_message("Mario", "WAAAA HOOOOOOO!!!")

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()

        time.sleep(3)

        # Click the copy button
        artifact_button = self.driver.find_element("id", "turnIntoArtifact")
        artifact_button.click()

        # Verify the presence of the Artifact label after clicking the artifact button
        artifact_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "artifactsLabel"))
        )
        self.assertTrue(
            artifact_element.is_displayed(), "Artifact label element is visible"
        )

        time.sleep(3)

    # ----------------- Test Download Response -----------------
    """This test ensures that after sending a message that the Amplify Response
       can make the Download Modal appear via the Download Response Button"""

    def test_download_response(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Luigi")

        # Send a Message
        self.send_message("Luigi", "LUUIGIII TIIIIIMMEE!!!")

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()

        time.sleep(3)

        # Click the download button
        download_button = self.driver.find_element("id", "downloadResponse")
        download_button.click()

        # Verify the presence of the download modal after clicking the downloadResponse button
        download_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        
        time.sleep(1)
        
        self.assertTrue(
            download_modal_element.is_displayed(), "Download window element is visible"
        )

        time.sleep(3)

        # Extract the text from the element
        modal_text = download_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")

    # ----------------- Test Email Response -----------------
    """This test ensures that after sending a message that the Amplify Response
       can be emailed via the Email Response Button"""

    def test_email_response(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Daisy")

        # Send a Message
        self.send_message("Daisy", "DAISSSSYYYY!!!")

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()

        time.sleep(3)

        # Click the email button
        email_button = self.driver.find_element("id", "emailResponse")
        email_button.click()

        time.sleep(5)
        # No way to confirm except visual
        # You'll need to get out of the email app that automatically opens

    # ----------------- Test Edit Response -----------------
    """This test ensures that after sending a message that the Amplify Response
       can be edited via the Edit Response button"""

    def test_edit_response(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Yoshi")

        # Send a Message
        self.send_message("Yoshi", "YOSHIIIIIII!!!")

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()

        time.sleep(2)

        # Click the edit button and cancel first
        edit_button = self.driver.find_element("id", "editResponse")
        edit_button.click()

        time.sleep(2)

        text_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "textEditResponse"))
        )
        text_field.clear()
        text_field.send_keys("Hello")

        time.sleep(2)

        text_cancel_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "cancelTextChange"))
        )
        self.assertIsNotNone(text_cancel_button, "Text change cancel clicked")
        text_cancel_button.click()

        time.sleep(2)

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()

        time.sleep(2)

        # Click the edit button and confirm
        edit_button = self.driver.find_element("id", "editResponse")
        edit_button.click()

        text_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "textEditResponse"))
        )
        text_field.clear()
        text_field.send_keys("YOSHIIIIIIIIIIIIII!!!")

        time.sleep(2)

        text_confirm_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "saveTextChange"))
        )
        self.assertIsNotNone(text_confirm_button, "Text change confirm clicked")
        text_confirm_button.click()

        time.sleep(2)

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()

        time.sleep(2)

        # Click the copy button
        copy_button = self.driver.find_element("id", "copyResponse")
        copy_button.click()

        time.sleep(1)

        # Focus on the input field
        input_field = self.driver.find_element(By.ID, "messageChatInputText")
        input_field.click()

        # Try pasting with COMMAND (for Mac), fallback to CONTROL (for Windows/Linux)
        try:
            input_field.send_keys(Keys.COMMAND, "v")  # Mac paste
        except Exception:
            input_field.send_keys(Keys.CONTROL, "v")  # Windows/Linux paste

        time.sleep(1)  # Wait for paste to complete

        # Get the pasted text
        copied_text = input_field.get_attribute("value")

        # Assert copied text matches changed message
        self.assertEqual(
            "YOSHIIIIIIIIIIIIII!!!",
            copied_text,
            "Copied text does not match changed message.",
        )

    # ----------------- Test Branch Into New Conversation -----------------
    """This test ensures that after sending a message that the Amplify Response
       can be branched off into a new conversation via the Branch Into New Conversation Button"""

    def test_branch_conversation(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Luma")

        # Send a Message
        self.send_message("Luma", "WEEEEEEE!!!")

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()

        time.sleep(3)

        # Click the branch button
        branch_button = self.driver.find_element("id", "branchIntoNewConversation")
        branch_button.click()

        time.sleep(2)

        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")

        # Extract text from each chat name element
        chat_names = [element.text for element in chat_name_elements]

        # Count occurrences of conversation
        count = chat_names.count("Luma")

        # Assert "Luma" appears twice
        self.assertEqual(
            count, 2, "'Luma' should appear exactly twice in the chat names list."
        )

    # ----------------- Test Copy Prompt -----------------
    """This test ensures that after sending a message that the Amplify Prompt Message
       can be copied and that the copied text is correct"""

    def test_copy_prompt(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Waluigi")

        # Send a Message
        self.send_message("Waluigi", "WAAAALUIIIIGIII TIIIIIIIME!!!")

        # Scroll the chatScrollWindow to the top
        chat_scroll_window = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatScrollWindow"))
        )
        self.driver.execute_script("arguments[0].scrollTop = 0;", chat_scroll_window)

        # Get chat content block element
        chat_content = self.driver.find_element("id", "userMessage")
        expected_message = chat_content.text

        # Remove the "@Amplify: " prefix
        text_content = expected_message.replace("@Amplify: ", "", 1)

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[0]).perform()

        time.sleep(3)

        # Click the copy button
        copy_button = self.driver.find_element("id", "copyPrompt")
        copy_button.click()

        time.sleep(1)

        # Focus on the input field
        input_field = self.driver.find_element(By.ID, "messageChatInputText")
        input_field.click()

        # Try pasting with COMMAND (for Mac), fallback to CONTROL (for Windows/Linux)
        try:
            input_field.send_keys(Keys.COMMAND, "v")  # Mac paste
        except Exception:
            input_field.send_keys(Keys.CONTROL, "v")  # Windows/Linux paste

        time.sleep(1)  # Wait for paste to complete

        # Get the pasted text
        copied_text = input_field.get_attribute("value")

        # Assert copied text matches changed message
        self.assertEqual(
            text_content, copied_text, "Copied text does not match changed message."
        )

    # ----------------- Test Download Prompt -----------------
    """This test ensures that after sending a message that the Amplify Prompt Message
       can be downloaded via the Download Prompt button"""

    def test_download_prompt(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Luigi")

        # Send a Message
        self.send_message("Luigi", "LUUIGIII TIIIIIMMEE!!!")

        # Scroll the chatScrollWindow to the top
        chat_scroll_window = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatScrollWindow"))
        )
        self.driver.execute_script("arguments[0].scrollTop = 0;", chat_scroll_window)

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[0]).perform()

        time.sleep(3)

        # Click the download button
        download_button = self.driver.find_element("id", "downloadPrompt")
        download_button.click()

        # Verify the presence of the download modal after clicking the downloadResponse button
        download_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        
        time.sleep(1)
        
        self.assertTrue(
            download_modal_element.is_displayed(), "Download window element is visible"
        )

        time.sleep(3)

        # Extract the text from the element
        modal_text = download_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")

    # ----------------- Test Edit Prompt -----------------
    """This test ensures that after sending a message that the Amplify Prompt Message
       can be edited via the Edit Prompt button"""

    def test_edit_prompt(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Yoshi")

        # Send a Message
        self.send_message("Yoshi", "YOSHIIIIIII!!!")

        # Scroll the chatScrollWindow to the top
        chat_scroll_window = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatScrollWindow"))
        )
        self.driver.execute_script("arguments[0].scrollTop = 0;", chat_scroll_window)

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[0]).perform()

        time.sleep(2)

        # Click the edit button and cancel first
        edit_button = self.driver.find_element("id", "editPrompt")
        edit_button.click()

        time.sleep(2)

        text_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "editResponse"))
        )
        text_field.clear()
        text_field.send_keys("Hello")

        time.sleep(2)

        text_cancel_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "cancelTextChange"))
        )
        self.assertIsNotNone(text_cancel_button, "Text change cancel clicked")
        text_cancel_button.click()

        time.sleep(2)

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[0]).perform()

        time.sleep(2)

        # Click the edit button and confirm
        edit_button = self.driver.find_element("id", "editPrompt")
        edit_button.click()

        text_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "editResponse"))
        )
        text_field.clear()
        text_field.send_keys("YOSHIIIIIIIIIIIIII!!!")

        time.sleep(2)

        text_confirm_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "saveTextChange"))
        )
        self.assertIsNotNone(text_confirm_button, "Text change confirm clicked")
        text_confirm_button.click()

        time.sleep(2)

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreaterEqual(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[0]).perform()

        time.sleep(2)

        # Get chat content block element
        chat_content = self.driver.find_element("id", "userMessage")
        expected_message = chat_content.text

        # Remove the "@Amplify: " prefix
        text_content = expected_message.replace("@Amplify: ", "", 1)

        # Assert copied text matches expected message
        self.assertEqual(
            "YOSHIIIIIIIIIIIIII!!!",
            text_content,
            "Copied text does not match expected message.",
        )

    # ----------------- Test Branch Prompt -----------------
    """This test ensures that after sending a message that the Amplify Prompt Message
       can be branched off into a new conversation via the Branch Into New Conversation Button"""

    def test_branch_prompt(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Luma")

        # Send a Message
        self.send_message("Luma", "WEEEEEEE!!!")

        # Scroll the chatScrollWindow to the top
        chat_scroll_window = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatScrollWindow"))
        )
        self.driver.execute_script("arguments[0].scrollTop = 0;", chat_scroll_window)

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[0]).perform()

        time.sleep(3)

        # Click the branch button
        branch_button = self.driver.find_element("id", "branchPrompt")
        branch_button.click()

        time.sleep(2)

        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")

        # Extract text from each chat name element
        chat_names = [element.text for element in chat_name_elements]

        # Count occurrences of conversation
        count = chat_names.count("Luma")

        # Assert "Luma" appears twice
        self.assertEqual(
            count, 2, "'Luma' should appear exactly twice in the chat names list."
        )

    # ----------------- Test Delete Prompt -----------------
    """This test ensures that after sending a message that the Amplify Prompt Message
       can be deleted via the Delete Prompt Button"""

    def test_delete_prompt(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Mario")

        # Send a Message
        self.send_message("Mario", "MAAAARRRRIOOOO!!!")

        # Scroll the chatScrollWindow to the top
        chat_scroll_window = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatScrollWindow"))
        )
        self.driver.execute_script("arguments[0].scrollTop = 0;", chat_scroll_window)

        # Hover the chat response
        chat_hover = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatHover"))
        )
        self.assertGreater(
            len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'"
        )

        ActionChains(self.driver).move_to_element(chat_hover[0]).perform()

        time.sleep(3)

        # Click the delete button
        delete_button = self.driver.find_element("id", "deletePromptChat")
        delete_button.click()

        time.sleep(2)

        chat_title = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatTitle"))
        )
        extracted_text = chat_title.text

        self.assertEqual(
            extracted_text,
            "Start a new conversation.",
            "The text extracted should be 'Start a new conversation.'",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)