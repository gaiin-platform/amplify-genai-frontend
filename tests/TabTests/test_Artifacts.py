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


class ArtifactsTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------
    def create_folder(self, folder_name):
        time.sleep(5)
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")
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

    def create_artifact(self, chat_name, message):
        # Create a chat
        self.create_chat(chat_name)
        self.send_message(chat_name, message)
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
        time.sleep(3)
        artifact_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "artifactsLabel"))
        )
        self.assertTrue(
            artifact_element.is_displayed(), "Artifact label element is visible"
        )

        time.sleep(3)

    # ----------------- Artifact Preview and View Code -----------------
    """This tests the Artifact preview and shows the tab has the viewable code"""
    
    def test_preview_and_view_code(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Wario", "WAAAAAARRIOOOO TIIIIIMME")
        
        # Find the Preview Artifact Button
        artifact_element_button = self.wait.until(EC.presence_of_element_located((By.ID, "previewArtifact")))
        self.assertTrue(artifact_element_button.is_displayed(), "Artifact preview button element is visible")
        
        artifact_element_button.click()
        
        # View the displayed srcdoc
        artifact_text_display = self.wait.until(EC.presence_of_element_located((By.ID, "renderedContent")))
        self.assertTrue(artifact_text_display.is_displayed(), "Preview is displayed as srcdoc")
        
        time.sleep(3)
        
        # Find the View Code Button
        view_code__button = self.wait.until(EC.presence_of_element_located((By.ID, "viewCode")))
        self.assertTrue(view_code__button.is_displayed(), "View Code button element is visible")
        
        view_code__button.click()
        
        # View the original displayed Artifacts Content Block
        artifact_text_display = self.wait.until(EC.presence_of_element_located((By.ID, "artifactsContentBlock")))
        self.assertTrue(artifact_text_display.is_displayed(), "Preview is displayed as Artifacts Content Block")
        
        time.sleep(2)

    # ----------------- Save Artifact -----------------
    """This tests the create artifact button and ensure's the artifact modal is present"""
    
    def test_save_artifact(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Mario", "WAAAHHOOOOOO")
        
        # Find the Save Artifact Button
        save_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "saveArtifact")))
        self.assertTrue(save_artifact_button.is_displayed(), "Save Artifact button element is visible")
        
        save_artifact_button.click()
        
        # Physically view artifact being saved, Only way to check is in AWS
        time.sleep(5)

    # ----------------- Upload Artifact to Amplify File Manager -----------------
    """This tests ensure's the artifact can be uploaded to the Amplify File Manager
       This is only visible in AWS. So this simply checks visibly on the UI that the
       artifact is saved"""
    
    def test_upload_artifact(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Cheep Cheep", "Glub glub")
        
        # Find the Upload Artifact to Amplify File Manager Button
        upload_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "uploadArtifactAFM")))
        self.assertTrue(upload_artifact_button.is_displayed(), "Upload Artifact button element is visible")
        
        upload_artifact_button.click()
        
        # Physically view artifact being saved, Only way to check is in AWS
        time.sleep(5)

    # ----------------- Add Version Copy to Artifact List -----------------
    """This test ensures that when a new artifact version is created that it appears in the chat"""
    
    def test_add_copy_to_artifact_list(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Cheep Cheep", "Glub glub")
        
        # Find the Add Version Copy to Artifact Button
        version_copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "addVersionCopy")))
        self.assertTrue(version_copy_button.is_displayed(), "Add Version Copy button element is visible")
        
        version_copy_button.click()
        
        time.sleep(3)
        
        # artifactsButtonBlock
        artifact_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "artifactsButtonBlock")))

        # Assert that there are exactly two versions present
        self.assertEqual(len(artifact_list), 2, f"Expected 2 artifactsButtonBlock elements, but found {len(artifact_list)}")

    # ----------------- Copy Artifact -----------------
    """This test ensures that you can copy the text displayed in an artifact by pressing the copy button"""
    
    def test_copy(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("King of Skill", "Howdy")
        
        # Find the Copy Artifact Button
        copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "copyArtifact")))
        self.assertTrue(copy_button.is_displayed(), "Copy button element is visible")
        
        copy_button.click()
        
        time.sleep(3)
        
        # Get chat content block element
        chat_content = self.driver.find_element("id", "artifactsContentBlock")
        expected_message = chat_content.get_attribute("data-original-content")
        
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
        self.assertEqual(expected_message, copied_text, "Copied text does not match expected message.")

    # ----------------- Download Artifact -----------------
    """This test ensures that you can download the text displayed in an artifact by pressing the download button"""
    
    def test_download(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("King of Skill", "Who is the King of Skill?")
        
        # Find the Download Artifact Button
        download_button = self.wait.until(EC.presence_of_element_located((By.ID, "downlaodArtifact")))
        self.assertTrue(download_button.is_displayed(), "Download button element is visible")
        
        download_button.click()
        
        time.sleep(3)
        
        # Define Download Path
        download_dir = os.path.expanduser("~/Downloads")  # Adjust if using a different directory

        # Generate the expected filename with MM-DD format
        expected_filename = f"Artifact.docx"
        expected_filepath = os.path.join(download_dir, expected_filename)

        # Wait for the file to appear
        timeout = 30  # Max wait time in seconds
        start_time = time.time()

        while time.time() - start_time < timeout:
            if os.path.exists(expected_filepath):
                print(f"Download successful! File found: {expected_filepath}")
                break
            time.sleep(1)
        else:
            self.fail(f"Download failed: Expected file '{expected_filename}' not found in {download_dir}")

        # Assert file exists
        self.assertTrue(os.path.exists(expected_filepath), f"Expected downloaded file '{expected_filename}' to exist.")

    # ----------------- Email Artifact -----------------
    """This test ensures that you can email the text displayed in an artifact by pressing the email button"""
    
    def test_email(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("TCNick3", "Who am I?")
        
        # Find the Email Artifact to Amplify File Manager Button
        email_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "emailArtifact")))
        self.assertTrue(email_artifact_button.is_displayed(), "Email Artifact button element is visible")
        
        email_artifact_button.click()
        
        # Physically view email app opening
        time.sleep(5)

    # ----------------- Share Artifact -----------------
    """This test ensures that you can share the text displayed in an artifact by pressing the share button
       It also ensures the share modal will open"""
    
    def test_share(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Vernias", "BIRDDOOOOOOO!")
        
        # Find the Share Artifact to Amplify File Manager Button
        share_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "shareArtifact")))
        self.assertTrue(share_artifact_button.is_displayed(), "Share Artifact button element is visible")
        
        share_artifact_button.click()
        
        time.sleep(3)
        
        # Find the Share Artifact Modal
        share_artifact_modal = self.wait.until(EC.presence_of_element_located((By.ID, "shareArtifactModal")))
        self.assertTrue(share_artifact_modal.is_displayed(), "Share Artifact modal element is visible")

    # ----------------- Share Artifact Modal Test-----------------
    """This test ensures that the share modal works as intended in correlation with the aritifacts"""
    
    def test_share_modal(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Vernias", "BIRDDOOOOOOO!")

        # Find the Share Artifact Button
        share_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "shareArtifact")))
        self.assertTrue(share_artifact_button.is_displayed(), "Share Artifact button element is visible")
        
        share_artifact_button.click()

        time.sleep(3)
        
        # Find the Share Artifact Modal
        share_artifact_modal = self.wait.until(EC.presence_of_element_located((By.ID, "shareArtifactModal")))
        self.assertTrue(share_artifact_modal.is_displayed(), "Share Artifact modal element is visible")
        
        # Find the Cancel Button
        cancel_button = self.wait.until(EC.presence_of_element_located((By.ID, "cancelArtifact")))
        self.assertTrue(cancel_button.is_displayed(), "Share Artifact modal element is visible")
        
        cancel_button.click()

        time.sleep(1)
        
        # Find the Share Artifact Button
        share_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "shareArtifact")))
        self.assertTrue(share_artifact_button.is_displayed(), "Share Artifact button element is visible")
        
        share_artifact_button.click()

        time.sleep(1)
        
       # Locate the chatbar to input in "emailInput"
        email_input_bar = self.wait.until(EC.presence_of_element_located((By.ID, "emailInput")))
        self.assertTrue(email_input_bar, "Email input bar should be initialized")
        email_input_bar.send_keys("temp_email@email.com, temp_email_2@email.com")
        
        # Find the Add Account Button
        add_account_button = self.wait.until(EC.presence_of_element_located((By.ID, "addAccount")))
        self.assertTrue(add_account_button.is_displayed(), "Add account button element is visible")
        
        add_account_button.click()
        
        time.sleep(1)
        
        # Find the Submit Button
        submit_button = self.wait.until(EC.presence_of_element_located((By.ID, "submitArtifact")))
        self.assertTrue(submit_button.is_displayed(), "Submit button element is visible")
        
        submit_button.click()
        
        try:
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")
            time.sleep(3)
            alert.accept()
        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
        
        # The Share Artifact Modal is not visible
        share_artifact_modal = self.wait.until(EC.invisibility_of_element_located((By.ID, "shareArtifactModal")))
        self.assertTrue(share_artifact_modal, "Share Artifact modal element is visible")

    # ----------------- Edit Artifact -----------------
    """This test ensures that you can edit the text displayed in an artifact by pressing the edit button"""
    
    def test_edit(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Sophist", "Yeah")
        
        # Find the Edit Artifact Button
        edit_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "editArtifact")))
        self.assertTrue(edit_artifact_button.is_displayed(), "Edit Artifact button element is visible")
        
        edit_artifact_button.click()
        
        time.sleep(3)
        
        # Find the Edit Artifact Modal
        edit_artifact_modal = self.wait.until(EC.presence_of_element_located((By.ID, "editModal")))
        self.assertTrue(edit_artifact_modal.is_displayed(), "Edit Artifact modal element is visible")
        
        # Find the Cancel Button
        cancel_button = self.wait.until(EC.presence_of_element_located((By.ID, "cancelEdit")))
        self.assertTrue(cancel_button.is_displayed(), "Share Artifact modal element is visible")
        
        cancel_button.click()
        
        time.sleep(1)
        
        # Find the Edit Artifact Button
        edit_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "editArtifact")))
        self.assertTrue(edit_artifact_button.is_displayed(), "Edit Artifact button element is visible")
        
        edit_artifact_button.click()
        
        time.sleep(3)
        
        # Find the Edit Artifact Modal
        edit_artifact_modal = self.wait.until(EC.presence_of_element_located((By.ID, "editModal")))
        self.assertTrue(edit_artifact_modal.is_displayed(), "Edit Artifact modal element is visible")
        
        # Find the Submit Button
        submit_button = self.wait.until(EC.presence_of_element_located((By.ID, "confirmEdit")))
        self.assertTrue(submit_button.is_displayed(), "Submit button element is visible")
        
        submit_button.click()
        
        time.sleep(2)
        
        # Find the Edit Artifact Modal
        edit_artifact_modal = self.wait.until(EC.invisibility_of_element_located((By.ID, "editModal")))
        self.assertTrue(edit_artifact_modal, "Edit Artifact modal element is visible")

    # ----------------- Delete Artifact -----------------
    """This test ensures that you can delete the versions of the artifacts in the artifact modal"""
    
    def test_delete(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Bryce", "Chill")
        
        # Find the Add Version Copy to Artifact Button
        version_copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "addVersionCopy")))
        self.assertTrue(version_copy_button.is_displayed(), "Add Version Copy button element is visible")
        
        version_copy_button.click()
        
        time.sleep(3)
        
        # Find the Add Version Copy to Artifact Button
        version_copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "addVersionCopy")))
        self.assertTrue(version_copy_button.is_displayed(), "Add Version Copy button element is visible")
        
        version_copy_button.click()
        
        time.sleep(3)
        
        # artifactsButtonBlock
        artifact_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "artifactsButtonBlock")))

        # Assert that there are exactly three versions present
        self.assertEqual(len(artifact_list), 3, f"Expected 3 artifactsButtonBlock elements, but found {len(artifact_list)}")
        
        # Find the Delete Artifact Button
        delete_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "deleteVersion")))
        self.assertTrue(delete_artifact_button.is_displayed(), "Delete Artifact button element is visible")
        
        delete_artifact_button.click()
        
        time.sleep(3)
        
        # Find the Version Number
        version_text = self.wait.until(EC.presence_of_element_located((By.ID, "versionNumber")))
        self.assertTrue(version_text.is_displayed(), "Version Number element is visible")
        
        # Extract text and get the version part
        full_text = version_text.text
        version_part = full_text.partition(" - Version: ")[1] + full_text.partition(" - Version: ")[2]  # Keeps " - Version: X"
        
        self.assertTrue(version_part == " - Version: 2", f"Expected ' - Version: 2', but got '{version_part}'")

    # ----------------- Version Switch Artifact -----------------
    """This test esnures that you can switch between any of the different versions of the artifact created"""
    
    def test_version_switch(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Wendigoon", "Spooky spooky")
        
        # Find the Add Version Copy to Artifact Button
        version_copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "addVersionCopy")))
        self.assertTrue(version_copy_button.is_displayed(), "Add Version Copy button element is visible")
        
        version_copy_button.click()
        
        time.sleep(3)
        
        # Find the Add Version Copy to Artifact Button
        version_copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "addVersionCopy")))
        self.assertTrue(version_copy_button.is_displayed(), "Add Version Copy button element is visible")
        
        version_copy_button.click()
        
        time.sleep(3)
        
        # artifactsButtonBlock
        artifact_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "artifactsButtonBlock")))

        # Assert that there are exactly three versions present
        self.assertEqual(len(artifact_list), 3, f"Expected 3 artifactsButtonBlock elements, but found {len(artifact_list)}")
        
        # Find the Version Number
        version_text = self.wait.until(EC.presence_of_element_located((By.ID, "versionNumber")))
        self.assertTrue(version_text.is_displayed(), "Version Number element is visible")
        
        # Extract text and get the version part
        full_text = version_text.text
        version_part = full_text.partition(" - Version: ")[1] + full_text.partition(" - Version: ")[2]  # Keeps " - Version: X"
        
        self.assertTrue(version_part == " - Version: 3", f"Expected ' - Version: 2', but got '{version_part}'")
        
        time.sleep(3)
        
        # indexButton
        index_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "indexButton")))
        
        index_buttons[0].click()
        
        time.sleep(2)
        
        # Find the Version Number
        version_text = self.wait.until(EC.presence_of_element_located((By.ID, "versionNumber")))
        self.assertTrue(version_text.is_displayed(), "Version Number element is visible")
        
        # Extract text and get the version part
        full_text = version_text.text
        version_part = full_text.partition(" - Version: ")[1] + full_text.partition(" - Version: ")[2]  # Keeps " - Version: X"
        
        self.assertTrue(version_part == " - Version: 2", f"Expected ' - Version: 2', but got '{version_part}'")

    # ----------------- Version Delete Artifact -----------------
    """This test ensures that you can delete the versions of the artifacts in the chat area
       This test specifically creates multiple versions and deletes a few of them"""
    
    def test_version_switch_delete(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Wendigoon", "Spooky spooky")
        
        # Find the Add Version Copy to Artifact Button
        version_copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "addVersionCopy")))
        self.assertTrue(version_copy_button.is_displayed(), "Add Version Copy button element is visible")
        
        version_copy_button.click()
        
        time.sleep(3)
        
        # Find the Add Version Copy to Artifact Button
        version_copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "addVersionCopy")))
        self.assertTrue(version_copy_button.is_displayed(), "Add Version Copy button element is visible")
        
        version_copy_button.click()
        
        time.sleep(3)
        
        # Find the Add Version Copy to Artifact Button
        version_copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "addVersionCopy")))
        self.assertTrue(version_copy_button.is_displayed(), "Add Version Copy button element is visible")
        
        version_copy_button.click()
        
        time.sleep(3)
        
        # artifactsButtonBlock
        artifact_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "artifactsButtonBlock")))

        # Assert that there are exactly three versions present
        self.assertEqual(len(artifact_list), 4, f"Expected 4 artifactsButtonBlock elements, but found {len(artifact_list)}")
        
        # Find the Version Number
        version_text = self.wait.until(EC.presence_of_element_located((By.ID, "versionNumber")))
        self.assertTrue(version_text.is_displayed(), "Version Number element is visible")
        
        # Extract text and get the version part
        full_text = version_text.text
        version_part = full_text.partition(" - Version: ")[1] + full_text.partition(" - Version: ")[2]  # Keeps " - Version: X"
        
        self.assertTrue(version_part == " - Version: 4", f"Expected ' - Version: 4', but got '{version_part}'")
        
        time.sleep(3)
        
        # indexButton
        index_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "indexButton")))
        index_buttons[0].click()
        
        time.sleep(1)
        
        # indexButton
        index_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "indexButton")))
        index_buttons[0].click()
        
        time.sleep(1)
        
        # indexButton
        index_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "indexButton")))
        index_buttons[0].click()
        
        time.sleep(1)
        
        # Find the Version Number
        version_text = self.wait.until(EC.presence_of_element_located((By.ID, "versionNumber")))
        self.assertTrue(version_text.is_displayed(), "Version Number element is visible")
        
        # Extract text and get the version part
        full_text = version_text.text
        version_part = full_text.partition(" - Version: ")[1] + full_text.partition(" - Version: ")[2]  # Keeps " - Version: X"
        
        self.assertTrue(version_part == " - Version: 1", f"Expected ' - Version: 1', but got '{version_part}'")
        
        # Find the Delete Artifact Button
        delete_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "deleteVersion")))
        self.assertTrue(delete_artifact_button.is_displayed(), "Delete Artifact button element is visible")
        
        delete_artifact_button.click()
        
        time.sleep(3)
        
        # Find the Version Number
        version_text = self.wait.until(EC.presence_of_element_located((By.ID, "versionNumber")))
        self.assertTrue(version_text.is_displayed(), "Version Number element is visible")
        
        # Extract text and get the version part
        full_text = version_text.text
        version_part = full_text.partition(" - Version: ")[1] + full_text.partition(" - Version: ")[2]  # Keeps " - Version: X"
        
        self.assertTrue(version_part == " - Version: 2", f"Expected ' - Version: 2', but got '{version_part}'")
        
        # indexButton
        index_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "indexButton")))
        index_buttons[-1].click()
        
        time.sleep(1)
        
        # Find the Delete Artifact Button
        delete_artifact_button = self.wait.until(EC.presence_of_element_located((By.ID, "deleteVersion")))
        self.assertTrue(delete_artifact_button.is_displayed(), "Delete Artifact button element is visible")
        
        delete_artifact_button.click()
        
        time.sleep(3)
    
        # Find the Version Number
        version_text = self.wait.until(EC.presence_of_element_located((By.ID, "versionNumber")))
        self.assertTrue(version_text.is_displayed(), "Version Number element is visible")
        
        # Extract text and get the version part
        full_text = version_text.text
        version_part = full_text.partition(" - Version: ")[1] + full_text.partition(" - Version: ")[2]  # Keeps " - Version: X"
        
        self.assertTrue(version_part == " - Version: 4", f"Expected ' - Version: 4', but got '{version_part}'")

    # ----------------- Close Artifact Version -----------------
    """This test ensures that you can close the artifiact version modal by selecting the close modal button"""
    
    def test_close_artifact_version(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Wendigoon", "Spooky spooky")
        
        time.sleep(3)
        
        # Find the Close Artifact Window Button
        close_window_button = self.wait.until(EC.presence_of_element_located((By.ID, "closeArtifactWindow")))
        self.assertTrue(close_window_button.is_displayed(), "Close Artifact Window button element is visible")
        
        close_window_button.click()
        
        time.sleep(3)
        
        # Find the Share Artifact Modal
        artifact_label = self.wait.until(EC.invisibility_of_element_located((By.ID, "artifactsLabel")))
        self.assertTrue(artifact_label, "Artifacts label element is not visible")

    # ----------------- Delete Artifact from Chat -----------------
    """This test ensures that you can delete an artificat from the chat by using the delete buttton"""
    
    def test_delete_from_chat(self):
        
        # Delete all chats
        self.delete_all_chats()
        
        # Create an Artifact
        self.create_artifact("Wendigoon", "Spooky spooky")
        
        # Find the Add Version Copy to Artifact Button
        version_copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "addVersionCopy")))
        self.assertTrue(version_copy_button.is_displayed(), "Add Version Copy button element is visible")
        
        version_copy_button.click()
        
        time.sleep(3)
        
        # Find the Add Version Copy to Artifact Button
        version_copy_button = self.wait.until(EC.presence_of_element_located((By.ID, "addVersionCopy")))
        self.assertTrue(version_copy_button.is_displayed(), "Add Version Copy button element is visible")
        
        version_copy_button.click()
        
        time.sleep(3)
        
        # Find the Close Artifact Window Button
        close_window_button = self.wait.until(EC.presence_of_element_located((By.ID, "closeArtifactWindow")))
        self.assertTrue(close_window_button.is_displayed(), "Close Artifact Window button element is visible")
        
        close_window_button.click()
        
        time.sleep(3)
        
        # Find the Share Artifact Modal
        artifact_label = self.wait.until(EC.invisibility_of_element_located((By.ID, "artifactsLabel")))
        self.assertTrue(artifact_label, "Artifacts label element is not visible")
        
        # artifactsButtonBlock
        artifact_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "artifactsButtonBlock")))

        # Assert that there are exactly three versions present
        self.assertEqual(len(artifact_list), 3, f"Expected 3 artifactsButtonBlock elements, but found {len(artifact_list)}")
        
        # Hover over artifact_list[1]
        ActionChains(self.driver).move_to_element(artifact_list[1]).perform()

        # Find the "removeArtifactFromConversation" button and click it
        remove_button = self.wait.until(EC.element_to_be_clickable((By.ID, "removeArtifactFromConversation")))
        remove_button.click()

        # Add a wait to ensure the artifact is removed
        time.sleep(2)

        # Re-fetch the artifact list to verify removal
        updated_artifact_list = self.driver.find_elements(By.ID, "artifactsButtonBlock")

        # Assert that there are now only two artifacts left
        self.assertEqual(len(updated_artifact_list), 2, f"Expected 2 artifactsButtonBlock elements after removal, but found {len(updated_artifact_list)}")
        

if __name__ == "__main__":
    unittest.main(verbosity=2)