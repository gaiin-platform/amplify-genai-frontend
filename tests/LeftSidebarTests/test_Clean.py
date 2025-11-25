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


class MassDeleteTests(BaseTest):
    """
    Test suite for the Clean functionality in the chat sidebar.

    The Clean button is designed to delete empty folders (folders that contain no chats).
    Note: This functionality does not fully work as expected in the current implementation,
    so these tests primarily verify that the UI interactions work correctly rather than
    validating complete functional behavior.
    """

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------
    def create_chat(self, chat_name):
        """
        Helper method to create and rename a new chat conversation.

        This method performs the following steps:
        1. Clicks the "New Chat" button
        2. Locates the newly created "New Conversation"
        3. Opens the rename interface
        4. Renames the conversation to the specified name

        Args:
            chat_name (str): The desired name for the new chat conversation
        """
        # Locate all prompt buttons and find the "New Chat" button
        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "New Chat elements should be initialized")
        chat_add_button = next(
            (el for el in prompt_buttons if el.text == "New Chat"), None
        )
        self.assertIsNotNone(chat_add_button, "New Chat button should be present")
        chat_add_button.click()

        # Wait for the UI to update after creating new chat
        time.sleep(2)

        # Locate the newly created chat with default name "New Conversation"
        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        chats = next(
            (el for el in chat_name_elements if el.text == "New Conversation"), None
        )
        self.assertIsNotNone(chats, "New Conversation button should be present")

        # Find the parent button element using XPath to access the clickable chat container
        chat_click = chats.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")
        chat_click.click()

        # Click the rename button to enter rename mode
        rename_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "isRenaming"))
        )
        self.assertIsNotNone(
            rename_button, "Rename button should be initialized and clicked"
        )
        rename_button.click()

        # Enter the new chat name and confirm
        rename_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "isRenamingInput"))
        )
        rename_field.clear()
        rename_field.send_keys(chat_name)

        # Click the confirm button to save the new name
        rename_confirm_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "handleConfirm"))
        )
        self.assertIsNotNone(
            rename_confirm_button,
            "Rename confirm button should be initialized and clicked",
        )
        rename_confirm_button.click()

        # Verify the chat was renamed successfully by locating it with the new name
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Wait for rename operation to complete
        time.sleep(2)

        # Confirm the chat now appears with the specified name
        folder = next((el for el in drop_name_elements if el.text == chat_name), None)
        self.assertIsNotNone(folder, "New Conversation button should be present")

    # ----------------- Test Clean Chats -----------------
    def test_clean_chats(self):
        """
        Test the Clean functionality in the chat sidebar.

        This test verifies the UI interaction for the Clean button, which is designed to
        delete empty folders (folders containing no chats).

        Note: The definition of an "empty conversation" is unclear in the current implementation,
        and this functionality doesn't fully work as expected. This test primarily validates
        that the button can be clicked and the UI responds, rather than validating the actual
        cleanup behavior.

        Test Steps:
        1. Create multiple chat conversations
        2. Open the prompt handler menu
        3. Click the Clean button
        4. Verify the UI responds to the Clean action
        """
        # Create multiple test chat conversations
        # These chats will be used to test the clean functionality
        self.create_chat("Gricko")
        self.create_chat("Frost")
        self.create_chat("Torbek")
        self.create_chat("Gideon")
        self.create_chat("Kremy")

        # Open the prompt handler menu (three-dot menu in sidebar)
        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
        self.assertTrue(prompt_handler_button, "Expected multiple buttons with ID 'createFolderButton'")

        prompt_handler_button.click()

        # Wait for the menu to fully appear
        time.sleep(3)

        # Click the Clean button to trigger the clean operation
        # This button is intended to remove empty folders from the sidebar
        clean_button = self.wait.until(EC.element_to_be_clickable((By.ID, "Clean")))
        self.assertTrue(clean_button, "Clean Button should be initialized")
        clean_button.click()

        # Wait for the clean operation to process
        # Note: This just verifies the UI interaction; actual cleanup behavior may vary
        time.sleep(3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
