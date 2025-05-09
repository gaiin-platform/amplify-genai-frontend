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


class SearchBarRightTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------

    def setup_test_data(self, num_assistants=2, num_prompts=2):
        """Creates a folder, a specified number of assistants, and prompts."""
        for i in range(1, num_assistants + 1):
            self.create_assistant(f"Hammer Bro {i}")

        for i in range(1, num_prompts + 1):
            self.create_prompt(f"Dry Bones {i}")

    def create_assistant(self, assistant_name):
        assistant_add_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addAssistantButton"))
        )
        self.assertIsNotNone(
            assistant_add_button,
            "Add Assistant button should be initialized and clickable",
        )
        assistant_add_button.click()

        assistant_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantName"))
        )
        self.assertIsNotNone(
            assistant_name_input, "Assistant Name input should be present"
        )
        assistant_name_input.clear()
        assistant_name_input.send_keys(assistant_name)

        assistant_save_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "saveButton"))
        )
        self.assertIsNotNone(
            assistant_save_button, "Save button should be initialized and clickable"
        )
        assistant_save_button.click()

        time.sleep(8)
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        assistant_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Assistants"), None
        )
        self.assertIsNotNone(
            assistant_dropdown_button, "Assistants button should be present"
        )

        # Ensure the parent button's title is "Collapse folder" before clicking
        parent_button = assistant_dropdown_button.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_title = parent_button.get_attribute("title")
        if button_title != "Collapse folder":
            assistant_dropdown_button.click()

        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )
        assistant_in_list = next(
            (el for el in prompt_name_elements if el.text == assistant_name), None
        )
        self.assertIsNotNone(
            assistant_in_list, f"{assistant_name} should be visible in the dropdown"
        )

    def create_prompt(self, prompt_name):
        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")
        prompt_add_button = next(
            (el for el in prompt_buttons if el.text == "Prompt Template"), None
        )
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")
        prompt_add_button.click()

        time.sleep(2)
        prompt_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptModalName"))
        )
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys(prompt_name)

        time.sleep(2)
        confirmation_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "confirmationButton"))
        )
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        save_button = next(
            (el for el in confirmation_button if el.text == "Save"), None
        )
        self.assertIsNotNone(save_button, "Save button should be present")
        save_button.click()

        time.sleep(2)
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )
        prompt_in_list = next(
            (el for el in prompt_name_elements if el.text == prompt_name), None
        )
        self.assertIsNotNone(
            prompt_in_list, f"{prompt_name} should be visible in the dropdown"
        )

    def delete_everything(self):
        prompt_handler_buttons_plural = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptHandler"))
        )
        self.assertGreater(
            len(prompt_handler_buttons_plural),
            1,
            "Expected multiple buttons with ID 'createFolderButton'",
        )
        prompt_handler_buttons_plural[-1].click()

        delete_button = self.wait.until(EC.element_to_be_clickable((By.ID, "Delete")))
        self.assertTrue(delete_button, "Delete Button should be initialized")
        delete_button.click()

        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        amplify_helper_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Amplify Helpers"), None
        )
        self.assertIsNotNone(
            amplify_helper_dropdown_button, "Amplify Helpers button should be present"
        )
        amplify_helper_dropdown_button.click()

        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        custom_instructions_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Custom Instructions"), None
        )
        self.assertIsNotNone(
            custom_instructions_dropdown_button,
            "Custom Instructions button should be present",
        )
        custom_instructions_dropdown_button.click()

        select_all_check = self.wait.until(
            EC.presence_of_element_located((By.ID, "selectAllCheck"))
        )
        checkbox = select_all_check.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt All should be present")
        checkbox.click()

        confirm_delete_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()

        time.sleep(2)

    # ----------------- Test Search Assistants -----------------
    """Ensure the Assistants searched in the Right Search Bar appear"""

    def test_search_assistant(self):
        # Click the searchBar Button
        search_bars_plural = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "SearchBar"))
        )
        self.assertGreater(
            len(search_bars_plural), 1, "Expected multiple buttons with ID 'SearchBar'"
        )

        # Select the last search bar (assumed to be the relevant one)
        search_bar = search_bars_plural[-1]

        # Type "Hammer Bro 2" into the search bar
        search_bar.clear()  # Clears any existing text
        search_bar.send_keys("Hammer Bro 2")

        time.sleep(1)

        side_bar_detection = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "sideBar"))
        )
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection[-1]

        # Locate all elements with the ID 'promptName'
        prompt_name_elements = right_panel.find_elements(By.ID, "promptName")
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Extract and print all text values for debugging
        names = [element.text.strip() for element in prompt_name_elements]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the only extracted name is "Hammer Bro 2"
        expected_name = ["Hammer Bro 2"]
        self.assertEqual(
            names,
            expected_name,
            "The search results should only contain 'Hammer Bro 2'",
        )

    # ----------------- Test Search Prompts -----------------
    """Ensure the Prompts searched in the Right Search Bar appear"""

    def test_search_prompt(self):
        # Click the searchBar Button
        search_bars_plural = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "SearchBar"))
        )
        self.assertGreater(
            len(search_bars_plural), 1, "Expected multiple buttons with ID 'SearchBar'"
        )

        # Select the last search bar (assumed to be the relevant one)
        search_bar = search_bars_plural[-1]

        # Type "Dry Bones 1" into the search bar
        search_bar.clear()  # Clears any existing text
        search_bar.send_keys("Dry Bones 1")

        time.sleep(1)

        side_bar_detection = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "sideBar"))
        )
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection[-1]

        # Locate all elements with the ID 'promptName'
        prompt_name_elements = right_panel.find_elements(By.ID, "promptName")
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Extract and print all text values for debugging
        names = [element.text.strip() for element in prompt_name_elements]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the only extracted name is "Dry Bones 1"
        expected_name = ["Dry Bones 1"]
        self.assertEqual(
            names, expected_name, "The search results should only contain 'Dry Bones 1'"
        )

    # ----------------- Test Search Nothing -----------------
    """Ensure nothing appears after searching in the Right Search Bar"""

    def test_search_nothing(self):
        # Click the searchBar Button
        search_bars_plural = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "SearchBar"))
        )
        self.assertGreater(
            len(search_bars_plural), 1, "Expected multiple buttons with ID 'SearchBar'"
        )

        # Select the last search bar (assumed to be the relevant one)
        search_bar = search_bars_plural[-1]

        # Type "DK" into the search bar
        search_bar.clear()  # Clears any existing text
        search_bar.send_keys("DK")

        time.sleep(1)

        side_bar_detection = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "sideBar"))
        )
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection[-1]

        # Locate all elements with the ID 'promptName'
        prompt_name_elements = right_panel.find_elements(By.ID, "promptName")
        self.assertEqual(
            prompt_name_elements, [], "Prompt name elements should be initialized"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
