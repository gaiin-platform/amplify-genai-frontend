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
        
    def click_assistants_tab(self):
        time.sleep(5)
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()
        time.sleep(5)

    def create_assistant(self, assistant_name):
        assistant_add_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addAssistantButton"))
        )
        self.assertIsNotNone(
            assistant_add_button,
            "Add Assistant button should be initialized and clickable",
        )
        assistant_add_button.click()
        time.sleep(5)

        assistant_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantNameInput"))
        )
        self.assertIsNotNone(
            assistant_name_input, "Assistant Name input should be present"
        )
        time.sleep(2)
        assistant_name_input.clear()
        time.sleep(2)
        assistant_name_input.send_keys(assistant_name)
        time.sleep(2)

        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Save button should be present")
        
        save_button.click()

        time.sleep(5)
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "assistantName"))
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
        time.sleep(5)

        time.sleep(2)
        prompt_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptModalName"))
        )
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        time.sleep(2)
        prompt_name_input.clear()
        time.sleep(2)
        prompt_name_input.send_keys(prompt_name)
        time.sleep(2)

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

    def delete_all_assistants(self):

        prompt_handler_button = self.wait.until(EC.presence_of_element_located((By.ID, "promptHandler")))
        prompt_handler_button.click()
        time.sleep(2)
        
        delete_button = self.wait.until(EC.presence_of_element_located((By.ID, "Delete")))
        delete_button.click()
        time.sleep(2)  # Give time for the menu to appear

        select_all_check = self.wait.until(EC.presence_of_element_located((By.ID, "selectAllCheck")))

        checkbox = select_all_check.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt All should be present")
        checkbox.click()
        time.sleep(2)

        confirm_delete_button = self.wait.until(EC.element_to_be_clickable((By.ID, "confirmItem")))
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()
        time.sleep(2)

    # ----------------- Test Search Assistants -----------------
    """Ensure the Assistants searched in the Right Search Bar appear"""

    def test_search_assistant(self):
        
        self.click_assistants_tab()
        self.delete_all_assistants()
        self.create_assistant("Hammer Bro 1")
        self.create_assistant("Hammer Bro 2")
        
        # Click the searchBar Button
        search_bar = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        self.assertTrue(search_bar, "Expected element with ID 'SearchBar'")

        # Type "Hammer Bro 2" into the search bar
        time.sleep(1)
        search_bar.clear()  # Clears any existing text
        time.sleep(1)
        search_bar.send_keys("Hammer Bro 2")

        time.sleep(1)

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        right_panel = side_bar_detection

        # Locate all elements with the ID 'promptName'
        prompt_name_elements = right_panel.find_elements(By.ID, "assistantName")
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
        
        # Click the searchBar Button
        search_bar = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        self.assertTrue(search_bar, "Expected element with ID 'SearchBar'")

        # Type "Hammer Bro 2" into the search bar
        time.sleep(1)
        search_bar.clear()  # Clears any existing text
        time.sleep(1)
        search_bar.send_keys("Hammer Bro")

        time.sleep(1)
        
        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        right_panel = side_bar_detection

        # Locate all elements with the ID 'promptName'
        prompt_name_elements = right_panel.find_elements(By.ID, "assistantName")
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Extract and print all text values for debugging
        names = [element.text.strip() for element in prompt_name_elements]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the only extracted names match the expected
        expected_name = ["Hammer Bro 1", "Hammer Bro 2"]
        self.assertEqual(
            names,
            expected_name,
            "The search results should contain 'Hammer Bro 1' and 'Hammer Bro 2'",
        )

    # ----------------- Test Search Prompts -----------------
    """Ensure the Prompts searched in the Right Search Bar appear"""

    def test_search_prompt(self):
        
        self.click_assistants_tab()
        self.delete_all_assistants()
        self.create_prompt("Dry Bones 1")
        self.create_prompt("Dry Bones 2")
        
        # Click the searchBar Button
        search_bar = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        self.assertTrue(search_bar, "Expected element with ID 'SearchBar'")

        # Type "Hammer Bro 2" into the search bar
        time.sleep(1)
        search_bar.clear()  # Clears any existing text
        time.sleep(1)
        search_bar.send_keys("Dry Bones 1")

        time.sleep(1)

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        right_panel = side_bar_detection

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
        
        # Click the searchBar Button
        search_bar = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        self.assertTrue(search_bar, "Expected element with ID 'SearchBar'")

        # Type "Dry Bones" into the search bar
        time.sleep(1)
        search_bar.clear()  # Clears any existing text
        time.sleep(1)
        search_bar.send_keys("Dry Bones")

        time.sleep(1)
        
        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        right_panel = side_bar_detection

        # Locate all elements with the ID 'promptName'
        prompt_name_elements = right_panel.find_elements(By.ID, "promptName")
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Extract and print all text values for debugging
        names = [element.text.strip() for element in prompt_name_elements]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the only extracted names match the expected
        expected_name = ["Dry Bones 1", "Dry Bones 2"]
        self.assertEqual(sorted(names), sorted(expected_name), "Make sure lists are equal")

    # ----------------- Test Search Nothing -----------------
    """Ensure nothing appears after searching in the Right Search Bar"""

    def test_search_nothing(self):
        
        self.click_assistants_tab()
        self.delete_all_assistants()
        self.create_prompt("Ravenloft")
        
        # Click the searchBar Button
        search_bar = self.wait.until(
            EC.presence_of_element_located((By.ID, "SearchBar"))
        )
        self.assertTrue(search_bar, "Expected element with ID 'SearchBar'")

        time.sleep(1)
        # Type "DK" into the search bar
        search_bar.clear()  # Clears any existing text
        time.sleep(1)
        search_bar.send_keys("DK Country Returns 2")

        time.sleep(1)

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Elements with the ID 'promptName' should not be visible
        prompt_name_elements = EC.invisibility_of_element_located((By.ID, "assistantName"))
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should not be present"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
