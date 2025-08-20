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


class MassShareTests(BaseTest):

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

    def create_folder(self, folder_name):
        time.sleep(5)
        folder_add_button = self.wait.until(EC.presence_of_element_located((By.ID, "createFolderButton")))
        self.assertTrue(folder_add_button, "Expected multiple buttons with ID 'createFolderButton'")
        folder_add_button.click()

        try:
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")
            time.sleep(3)
            alert.send_keys(folder_name)
            time.sleep(3)
            alert.accept()
        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")

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
        
    def delete_all_folders(self):
        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
        prompt_handler_button.click()
        time.sleep(2)
        
        # Select First Submenu
        sub_menu = self.wait.until(EC.presence_of_element_located((By.ID, "subMenu")))
        self.assertTrue(sub_menu, "Element with id='subMenu' is present")
        time.sleep(1)  # Give time for the menu to appear
        
        # Click the id="folderSort"
        visible_sub_menu = self.wait.until(
            EC.presence_of_element_located((By.ID, "folderSort"))
        )
        self.assertTrue(visible_sub_menu, "Element with id='folderSort' is present")
        visible_sub_menu.click()
        time.sleep(1)

        # Click the button with ID "Delete"
        delete_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "Delete"))
        )
        delete_button[-1].click()
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

    # ----------------- Test Share Mass Assistants -----------------
    """This test ensures multiple assistants can be shared individually via the 
    three dots handler on the Right Side Bar"""

    def test_share_mass_assistants(self):
        
        self.click_assistants_tab()
        self.delete_all_folders()
        self.delete_all_assistants()
        self.create_folder("Mario Party")
        self.create_assistant("Goomba 1")
        self.create_assistant("Goomba 2")

        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "assistantName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct assistant in the dropdown list
        assistant_in_list = next(
            (el for el in prompt_name_elements if el.text == "Goomba 1"), None
        )
        self.assertIsNotNone(
            assistant_in_list, "Goomba 1 should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        # This is draggable
        assistant_button = assistant_in_list.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(
            button_id, "assistantClick", "Button should be called promptClick"
        )

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Mario Party"
        assistant_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Mario Party"), None
        )
        self.assertIsNotNone(
            assistant_dropdown_button, "Mario Party button should be present"
        )

        # This is the droppable button
        drop_folder = assistant_dropdown_button.find_element(
            By.XPATH, "./ancestor::button"
        )
        drop_folder_id = drop_folder.get_attribute("id")
        self.assertEqual(drop_folder_id, "dropDown", "Button should be called dropDown")

        # Perform the drag and drop action
        actions = ActionChains(self.driver)
        actions.drag_and_drop(assistant_button, drop_folder).perform()

        time.sleep(3)  # Extra sleep to observe the effect

        # Click the promptHandler Button
        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
        prompt_handler_button.click()

        time.sleep(3)

        # Click the Share Button
        delete_button = self.wait.until(EC.element_to_be_clickable((By.ID, "Share")))
        self.assertTrue(delete_button, "Share Button should be initialized")
        delete_button.click()

        time.sleep(3)

        # Locate all elements with ID "assistantName" and find the one with text "Goomba 1"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "assistantName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Goomba 1"
        prompt_in_list = next(
            (el for el in prompt_name_elements if el.text == "Goomba 1"), None
        )
        self.assertIsNotNone(
            prompt_in_list, "Goomba 1 should be visible in the dropdown"
        )

        # Navigate up to the parent container
        parent_container = prompt_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='promptEncompass']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Goomba 1 should be present"
        )

        # Click the checkbox
        checkbox.click()
        
        time.sleep(2)

        # Locate all elements with ID "promptName" and find the one with text "Goomba 1"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "assistantName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Goomba 2"
        prompt_in_list = next(
            (el for el in prompt_name_elements if el.text == "Goomba 2"), None
        )
        self.assertIsNotNone(
            prompt_in_list, "Goomba 2 should be visible in the dropdown"
        )

        # Navigate up to the parent container
        parent_container = prompt_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='promptEncompass']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Goomba 2 should be present"
        )

        # Click the checkbox
        checkbox.click()

        time.sleep(3)

        # Click the Share Button
        confirm_share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_share_button, "Share Button should be initialized")
        confirm_share_button.click()
        
        time.sleep(2)

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            share_modal_element.is_displayed(), "Share window element is visible"
        )

        time.sleep(3)

        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text,
            "Add People to Share With",
            "Modal title should be 'Add People to Share With'",
        )
        
        print("Huh 5")

        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "checkBoxName"))
        )
        self.assertTrue(
            checkbox_name_elements, "Checkbox name elements should be initialized"
        )
        
        print("Huh 4.5")

        # Check if any of the elements contain "Goomba 1"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Goomba 1"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Goomba 1 should be visible in Share"
        )
        
        print("Huh 4")

        time.sleep(3)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )
        
        print("Huh 3.5")

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Goomba 1 should be present"
        )
        
        print("Huh 3")

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        time.sleep(3)

        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "checkBoxName"))
        )
        self.assertTrue(
            checkbox_name_elements, "Checkbox name elements should be initialized"
        )
        
        print("Huh 2")

        # Check if any of the elements contain "Goomba 2"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Goomba 2"), None
        )
        self.assertIsNotNone(
            prompt_in_list, "Goomba 2 should be visible in Share"
        )

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )
        
        print("Huh 1")

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Goomba 2 should be present"
        )
        
        print("Huh 0")

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

    # ----------------- Test Share Mass Prompts -----------------
    """This test ensures multiple prompts can be shared individually via the 
    three dots handler on the Right Side Bar"""

    def test_share_mass_prompts(self):
        
        self.click_assistants_tab()
        self.delete_all_folders()
        self.delete_all_assistants()
        self.create_folder("Mario Party")
        self.create_prompt("Boo 1")
        self.create_prompt("Boo 2")
        
        # Click the promptHandler Button
        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
        prompt_handler_button.click()

        time.sleep(3)

        # Click the Share Button
        delete_button = self.wait.until(EC.element_to_be_clickable((By.ID, "Share")))
        self.assertTrue(delete_button, "Share Button should be initialized")
        delete_button.click()

        time.sleep(3)

        # Locate all elements with ID "promptName" and find the one with text "Boo 1"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Boo 1"
        prompt_in_list = next(
            (el for el in prompt_name_elements if el.text == "Boo 1"), None
        )
        self.assertIsNotNone(prompt_in_list, "Boo 1 should be visible in the dropdown")

        # Navigate up to the parent container
        parent_container = prompt_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='promptEncompass']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt Boo 1 should be present")

        # Click the checkbox
        checkbox.click()
        
        time.sleep(2)

        # Locate all elements with ID "promptName" and find the one with text "Goomba 1"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Boo 2"
        prompt_in_list = next(
            (el for el in prompt_name_elements if el.text == "Boo 2"), None
        )
        self.assertIsNotNone(prompt_in_list, "Boo 2 should be visible in the dropdown")

        # Navigate up to the parent container
        parent_container = prompt_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='promptEncompass']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt Boo 2 should be present")

        # Click the checkbox
        checkbox.click()

        time.sleep(3)

        # Click the Share Button
        confirm_share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_share_button, "Share Button should be initialized")
        confirm_share_button.click()
        
        time.sleep(2)

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            share_modal_element.is_displayed(), "Share window element is visible"
        )

        time.sleep(3)

        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text,
            "Add People to Share With",
            "Modal title should be 'Add People to Share With'",
        )

        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "checkBoxName"))
        )
        self.assertTrue(
            checkbox_name_elements, "Checkbox name elements should be initialized"
        )

        # Check if any of the elements contain "Boo 1"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Boo 1"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Boo 1 should be visible in the dropdown"
        )

        time.sleep(3)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt Boo 1 should be present")

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        time.sleep(3)

        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "checkBoxName"))
        )
        self.assertTrue(
            checkbox_name_elements, "Checkbox name elements should be initialized"
        )

        # Check if any of the elements contain "Boo 2"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Boo 2"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Boo 2 should be visible in the dropdown"
        )

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt Boo 2 should be present")

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

    # ----------------- Test Share Everything -----------------
    """This test ensures everything can be selected and shared via the 
    three dots handler on the Right Side Bar"""

    def test_share_everything(self):
        
        self.click_assistants_tab()
        self.delete_all_folders()
        self.delete_all_assistants()
        self.create_folder("Mario Party")
        self.create_assistant("Goomba 1")
        self.create_assistant("Goomba 2")
        self.create_prompt("Boo 1")
        self.create_prompt("Boo 2")

        # Click the promptHandler Button
        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
        prompt_handler_button.click()

        time.sleep(3)

        # Click the Share Button
        delete_button = self.wait.until(EC.element_to_be_clickable((By.ID, "Share")))
        self.assertTrue(delete_button, "Share Button should be initialized")
        delete_button.click()

        time.sleep(3)

        # Click the select all checkbox
        select_all_check = self.wait.until(
            EC.presence_of_element_located((By.ID, "selectAllCheck"))
        )

        # Locate the checkbox within the parent container
        checkbox = select_all_check.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt All should be present")

        checkbox.click()

        time.sleep(3)

        # Click the Share ALL Button
        confirm_delete_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_delete_button, "Share All Button should be initialized")
        confirm_delete_button.click()

        time.sleep(3)

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            share_modal_element.is_displayed(), "Share window element is visible"
        )

        time.sleep(3)

        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text,
            "Add People to Share With",
            "Modal title should be 'Add People to Share With'",
        )

        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "checkBoxName"))
        )
        self.assertTrue(
            checkbox_name_elements, "Checkbox name elements should be initialized"
        )

        # Check if any of the elements contain "Boo 1"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Boo 1"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Boo 1 should be visible in Share"
        )

        time.sleep(3)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt Boo 1 should be present")

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "checkBoxName"))
        )
        self.assertTrue(
            checkbox_name_elements, "Checkbox name elements should be initialized"
        )

        # Check if any of the elements contain "Boo 2"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Boo 2"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Boo 2 should be visible in Share"
        )

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt Boo 2 should be present")

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "checkBoxName"))
        )
        self.assertTrue(
            checkbox_name_elements, "Checkbox name elements should be initialized"
        )

        # Check if any of the elements contain "Goomba 1"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Goomba 1"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Goomba 1 should be visible in Share"
        )

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Goomba 1 should be present"
        )

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "checkBoxName"))
        )
        self.assertTrue(
            checkbox_name_elements, "Checkbox name elements should be initialized"
        )

        # Check if any of the elements contain "Goomba 2"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Goomba 2"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Goomba 2 should be visible in Share"
        )

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Goomba 2 should be present"
        )

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")


if __name__ == "__main__":
    unittest.main(verbosity=2)
