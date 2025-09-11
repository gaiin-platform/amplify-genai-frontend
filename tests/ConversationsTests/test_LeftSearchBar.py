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


class SearchBarLeftTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup function -----------------
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

        time.sleep(2)

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

    # ----------------- Test Search Chats -----------------
    """Ensure the Chats searched in the Left Search Bar appear"""

    def test_search_assistant(self):
        
        self.delete_all_chats()

        self.create_chat("Birdo")

        # Click the searchBar Button
        search_bar = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        self.assertTrue(search_bar, "Expected element with ID 'SearchBar'")

        # Type "Birdo" into the search bar
        search_bar.clear()  # Clears any existing text
        search_bar.send_keys("Birdo")

        time.sleep(1)

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection

        # Locate all elements with the ID 'promptName'
        prompt_name_elements = left_panel.find_elements(By.ID, "chatName")
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Extract and print all text values for debugging
        names = [element.text.strip() for element in prompt_name_elements]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the only extracted name is "Birdo"
        expected_name = ["Birdo"]
        self.assertEqual(
            names, expected_name, "The search results should only contain 'Birdo'"
        )

    # ----------------- Test Search Nothing -----------------
    """Ensure nothing appears after searching in the Left Search Bar"""

    def test_search_nothing(self):
        
        self.delete_all_chats()

        self.create_chat("Birdo")

        # Click the searchBar Button
        search_bar = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        self.assertTrue(search_bar, "Expected multiple buttons with ID 'SearchBar'")

        # Type "Yoshi" into the search bar
        search_bar.clear()  # Clears any existing text
        search_bar.send_keys("Yoshi")

        time.sleep(1)

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection

        # Locate all elements with the ID 'chatName'
        prompt_name_elements = left_panel.find_elements(By.ID, "chatName")
        self.assertFalse(prompt_name_elements, "chatNames are empty")

        # Extract and print all text values for debugging
        names = [element.text.strip() for element in prompt_name_elements]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the no names appear
        expected_name = []
        self.assertEqual(
            names, expected_name, "The search results should only contain empty"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
