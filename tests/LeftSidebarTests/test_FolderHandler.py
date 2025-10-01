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


class FolderHandlerLeftTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------
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

    # ----------------- Test Folder Sort Name -----------------
    """Test the three button handler can sort the created folders by name"""

    def test_folder_sort_name(self):
        time.sleep(10)
        self.delete_all_folders()
        self.create_chat("Temp")
        self.create_folder("Leon Kennedy")
        self.create_folder("Chris Redfield")
        self.create_folder("Jill Valentine")

        # Click the promptHandler Button
        prompt_handler_button = self.wait.until(EC.presence_of_element_located((By.ID, "promptHandler")))
        self.assertTrue(prompt_handler_button, "Expected element with ID 'promptHandler'")
        prompt_handler_button.click()

        time.sleep(3)

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

        # Hover over the second folderSort (nested one)
        nested_sub_menu = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "folderSort"))
        )
        self.assertGreater(
            len(nested_sub_menu),
            1,
            "Expected multiple buttons with ID 'folderSort'",
        )
        nested_sub_menu[1].click()
        time.sleep(1)

        # Click the button with ID "Name"
        button = self.wait.until(EC.presence_of_element_located((By.ID, "Name")))
        button.click()

        time.sleep(3)

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection

        # Locate all elements with the ID 'dropName'
        drop_name_elements = left_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract text from all elements and strip whitespace
        drop_names = [element.text.strip() for element in drop_name_elements]
        
        drop_names.remove('Today')

        # Ensure the list is sorted in ascending order
        self.assertEqual(
            drop_names,
            sorted(drop_names),
            "Drop name elements should be sorted alphabetically",
        )

    # ----------------- Test Folder Sort Date ----------------- XXXXXXXXXXXX

    # ----------------- Test Folder Delete -----------------
    """Test the three button handler can delete a folder"""

    def test_folder_delete(self):
        self.delete_all_folders()
        self.create_chat("Temp")
        self.create_folder("Leon Kennedy")
        self.create_folder("Chris Redfield")
        self.create_folder("Jill Valentine")

        # Click the promptHandler Button
        prompt_handler_button = self.wait.until(EC.presence_of_element_located((By.ID, "promptHandler")))
        self.assertTrue(prompt_handler_button, "Expected element with ID 'promptHandler'")
        prompt_handler_button.click()

        time.sleep(3)

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
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Delete")))
        button[-1].click()

        time.sleep(1)  # Give time for the menu to appear

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection

        # Locate all elements with the ID 'dropName'
        drop_name_elements = left_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(1)  # Give time for the menu to appear

        # Check if any of the elements contain "Chris Redfield"
        folder_in_list = next(
            (el for el in drop_name_elements if el.text == "Chris Redfield"), None
        )
        self.assertIsNotNone(
            folder_in_list, "Chris Redfield should be visible in the dropdown"
        )

        # Navigate up to the parent container
        parent_container = folder_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='folderContainer']"
        )

        time.sleep(1)  # Give time for the menu to appear

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Chris Redfield should be present"
        )

        # Click the checkbox
        checkbox.click()

        time.sleep(1)  # Give time for the menu to appear

        # Click the Delete Button
        confirm_delete_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()

        time.sleep(1)  # Give time for the menu to appear

        # Locate all elements with ID "dropName" and find the one with text "Chris Redfield"
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(
            drop_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements do not contain "Chris Redfield"
        folder_in_list = next(
            (el for el in drop_name_elements if el.text == "Chris Redfield"), None
        )
        self.assertIsNone(
            folder_in_list, "Chris Redfield should be visible in the dropdown"
        )

    # ----------------- Test Folder Delete All -----------------
    """Test the three button handler can delete all created folders"""

    def test_folder_all_delete(self):
        time.sleep(10)
        self.create_chat("Temp")
        self.create_folder("Leon Kennedy")
        self.create_folder("Chris Redfield")
        self.create_folder("Jill Valentine")

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

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection

        # Locate all elements with the ID 'dropName'
        drop_name_elements = left_panel.find_elements(By.ID, "dropName")
        self.assertEqual(
            len(drop_name_elements), 0, "No dropDown elements should be visible"
        )

    # ----------------- Test Folder Share -----------------
    """Test the three button handler can share the specified folder"""

    def test_folder_share(self):
        time.sleep(10)
        self.delete_all_folders()
        self.create_chat("Temp")
        self.create_folder("Leon Kennedy")
        self.create_folder("Chris Redfield")
        self.create_folder("Jill Valentine")

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

        # Click the button with ID "Share"
        share_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "Share"))
        )
        share_button[-1].click()
        time.sleep(2)  # Give time for the menu to appear

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection

        # Locate all elements with the ID 'dropName'
        drop_name_elements = left_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(1)  # Give time for the menu to appear

        # Check if any of the elements contain Jill Valentine
        folder_in_list = next(
            (el for el in drop_name_elements if el.text == "Jill Valentine"), None
        )
        self.assertIsNotNone(
            folder_in_list, "Jill Valentine should be visible in the dropdown"
        )

        # Navigate up to the parent container
        parent_container = folder_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='folderContainer']"
        )

        time.sleep(1)  # Give time for the menu to appear

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Jill Valentine should be present"
        )

        # Click the checkbox
        checkbox.click()

        time.sleep(1)  # Give time for the menu to appear

        # Click the Share Button
        confirm_share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_share_button, "Share Button should be initialized")
        confirm_share_button.click()

        time.sleep(1)  # Give time for the menu to appear

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            share_modal_element.is_displayed(), "Share window element is visible"
        )

        time.sleep(1)

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

        # Check if any of the elements contain "Jill Valentine"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Jill Valentine"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Jill Valentine should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Jill Valentine should be present"
        )

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        time.sleep(1)

    # ----------------- Test Folder Share All -----------------
    """Test the three button handler can share all folders"""

    def test_folder_all_share(self):
        time.sleep(10)
        self.delete_all_folders()
        self.create_chat("Temp")
        self.create_folder("Leon Kennedy")
        self.create_folder("Chris Redfield")
        self.create_folder("Jill Valentine")

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

        # Click the button with ID "Share"
        share_button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "Share"))
        )
        share_button[-1].click()
        time.sleep(2)  # Give time for the menu to appear

        # Click the select all checkbox
        select_all_check = self.wait.until(
            EC.presence_of_element_located((By.ID, "selectAllCheck"))
        )

        # Locate the checkbox within the parent container
        checkbox = select_all_check.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt All should be present")

        checkbox.click()

        time.sleep(1)

        # Click the Share All Button
        confirm_share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_share_button, "Share All Button should be initialized")
        confirm_share_button.click()

        time.sleep(1)

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            share_modal_element.is_displayed(), "Share window element is visible"
        )

        time.sleep(1)

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

        time.sleep(2)

        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "checkBoxName"))
        )
        self.assertTrue(
            checkbox_name_elements, "Checkbox name elements should be initialized"
        )

        # Check if any of the elements contain "Leon Kennedy"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Leon Kennedy"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Leon Kennedy should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Leon Kennedy should be present"
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

        # Check if any of the elements contain "Chris Redfield"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Chris Redfield"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Chris Redfield should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Chris Redfield should be present"
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

        # Check if any of the elements contain "Jill Valentine"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Jill Valentine"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Jill Valentine should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Jill Valentine should be present"
        )

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

    # ----------------- Test Folder Share with individual Chat -----------------
    """Test the three button handler can share the folder and a chat inside the folder"""

    def test_folder_share_with_individual_chat(self):
        self.delete_all_folders()
        self.create_folder("Leon Kennedy")
        self.create_folder("Jill Valentine")
        self.create_chat("Green Herb")

        # Locate all elements with ID "chatName"
        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(
            chat_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct chat in the dropdown list
        chat_in_list = next(
            (el for el in chat_name_elements if el.text == "Green Herb"), None
        )
        self.assertIsNotNone(
            chat_in_list, "Green Herb should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        # This is draggable
        chat_button = chat_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_button.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Leon Kennedy"
        folder_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Leon Kennedy"), None
        )
        self.assertIsNotNone(
            folder_dropdown_button, "Leon Kennedy button should be present"
        )

        # This is the droppable button
        drop_folder = folder_dropdown_button.find_element(
            By.XPATH, "./ancestor::button"
        )
        drop_folder_id = drop_folder.get_attribute("id")
        self.assertEqual(drop_folder_id, "dropDown", "Button should be called dropDown")

        # Perform the drag and drop action
        actions = ActionChains(self.driver)
        actions.drag_and_drop(chat_button, drop_folder).perform()

        time.sleep(3)  # Extra sleep to observe the effect

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

        # Click the button with ID "Share"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Share")))
        button[-1].click()

        time.sleep(1)  # Give time for the menu to appear

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection

        # Locate all elements with the ID 'dropName'
        drop_name_elements = left_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(1)  # Give time for the menu to appear

        # Check if any of the elements contain Leon Kennedy
        folder_in_list = next(
            (el for el in drop_name_elements if el.text == "Leon Kennedy"), None
        )
        self.assertIsNotNone(
            folder_in_list, "Leon Kennedy should be visible in the dropdown"
        )

        # Navigate up to the parent container
        parent_container = folder_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='folderContainer']"
        )

        time.sleep(1)  # Give time for the menu to appear

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Leon Kennedy should be present"
        )

        # Click the checkbox
        checkbox.click()

        time.sleep(1)  # Give time for the menu to appear

        # Click the Share Button
        confirm_share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_share_button, "Share Button should be initialized")
        confirm_share_button.click()

        time.sleep(1)  # Give time for the menu to appear

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            share_modal_element.is_displayed(), "Share window element is visible"
        )

        time.sleep(1)

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

        # Check if any of the elements contain "Leon Kennedy"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Leon Kennedy"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Leon Kennedy should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Leon Kennedy should be present"
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

        # Check if any of the elements contain "Green Herb"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Green Herb"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Green Herb should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Green Herb should be present"
        )

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        time.sleep(1)

    # ----------------- Test Folder Share with multiple Chat -----------------
    """Test the three button handler can share the folder and all the chats inside the folder"""

    def test_folder_share_with_multiple_chat(self):
        time.sleep(10)
        self.delete_all_folders()
        self.create_folder("Leon Kennedy")
        self.create_folder("Jill Valentine")
        self.create_chat("Green Herb")
        self.create_chat("Yellow Herb")

        # Locate all elements with ID "chatName"
        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(
            chat_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct chat in the dropdown list
        chat_in_list = next(
            (el for el in chat_name_elements if el.text == "Green Herb"), None
        )
        self.assertIsNotNone(
            chat_in_list, "Green Herb should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        # This is draggable
        chat_button = chat_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_button.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Leon Kennedy"
        folder_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Leon Kennedy"), None
        )
        self.assertIsNotNone(
            folder_dropdown_button, "Leon Kennedy button should be present"
        )

        # This is the droppable button
        drop_folder = folder_dropdown_button.find_element(
            By.XPATH, "./ancestor::button"
        )
        drop_folder_id = drop_folder.get_attribute("id")
        self.assertEqual(drop_folder_id, "dropDown", "Button should be called dropDown")

        # Perform the drag and drop action
        actions = ActionChains(self.driver)
        actions.drag_and_drop(chat_button, drop_folder).perform()

        time.sleep(3)  # Extra sleep to observe the effect

        # Locate all elements with ID "chatName"
        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(
            chat_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct chat in the dropdown list
        chat_in_list = next(
            (el for el in chat_name_elements if el.text == "Yellow Herb"), None
        )
        self.assertIsNotNone(
            chat_in_list, "Green Herb should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        # This is draggable
        chat_button = chat_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_button.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Leon Kennedy"
        folder_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Leon Kennedy"), None
        )
        self.assertIsNotNone(
            folder_dropdown_button, "Leon Kennedy button should be present"
        )

        # This is the droppable button
        drop_folder = folder_dropdown_button.find_element(
            By.XPATH, "./ancestor::button"
        )
        drop_folder_id = drop_folder.get_attribute("id")
        self.assertEqual(drop_folder_id, "dropDown", "Button should be called dropDown")

        # Perform the drag and drop action
        actions = ActionChains(self.driver)
        actions.drag_and_drop(chat_button, drop_folder).perform()

        time.sleep(3)  # Extra sleep to observe the effect

        # Click the promptHandler Button
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

        # Click the button with ID "Share"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Share")))
        button[-1].click()

        time.sleep(1)  # Give time for the menu to appear

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Locate all elements with the ID 'dropName'
        drop_name_elements = side_bar_detection.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(1)  # Give time for the menu to appear

        # Check if any of the elements contain Leon Kennedy
        folder_in_list = next(
            (el for el in drop_name_elements if el.text == "Leon Kennedy"), None
        )
        self.assertIsNotNone(
            folder_in_list, "Leon Kennedy should be visible in the dropdown"
        )

        # Navigate up to the parent container
        parent_container = folder_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='folderContainer']"
        )

        time.sleep(1)  # Give time for the menu to appear

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Leon Kennedy should be present"
        )

        # Click the checkbox
        checkbox.click()

        time.sleep(1)  # Give time for the menu to appear

        # Click the Share Button
        confirm_delete_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_delete_button, "Share Button should be initialized")
        confirm_delete_button.click()

        time.sleep(1)  # Give time for the menu to appear

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            share_modal_element.is_displayed(), "Share window element is visible"
        )

        time.sleep(1)

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

        # Check if any of the elements contain "Leon Kennedy"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Leon Kennedy"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Leon Kennedy should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Leon Kennedy should be present"
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

        # Check if any of the elements contain "Green Herb"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Green Herb"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Green Herb should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Green Herb should be present"
        )

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Yellow Herb should be present"
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

        # Check if any of the elements contain "Yellow Herb"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Yellow Herb"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Yellow Herb should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Yellow Herb should be present"
        )

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        time.sleep(1)

    # ----------------- Test Folder Clean -----------------
    """Test the three button handler can delete all the empty folders"""

    def test_folder_share_with_inside_chat(self):
        self.delete_all_folders()
        self.create_folder("Leon Kennedy")
        self.create_folder("Jill Valentine")
        self.create_folder("Chris Redfield")
        self.create_chat("Green Herb")
        self.create_chat("Yellow Herb")

        # Locate all elements with ID "chatName"
        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(
            chat_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct chat in the dropdown list
        chat_in_list = next(
            (el for el in chat_name_elements if el.text == "Green Herb"), None
        )
        self.assertIsNotNone(
            chat_in_list, "Green Herb should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        # This is draggable
        chat_button = chat_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_button.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Leon Kennedy"
        folder_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Leon Kennedy"), None
        )
        self.assertIsNotNone(
            folder_dropdown_button, "Leon Kennedy button should be present"
        )

        # This is the droppable button
        drop_folder = folder_dropdown_button.find_element(
            By.XPATH, "./ancestor::button"
        )
        drop_folder_id = drop_folder.get_attribute("id")
        self.assertEqual(drop_folder_id, "dropDown", "Button should be called dropDown")

        # Perform the drag and drop action
        actions = ActionChains(self.driver)
        actions.drag_and_drop(chat_button, drop_folder).perform()

        time.sleep(3)  # Extra sleep to observe the effect

        # Locate all elements with ID "chatName"
        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(
            chat_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct chat in the dropdown list
        chat_in_list = next(
            (el for el in chat_name_elements if el.text == "Yellow Herb"), None
        )
        self.assertIsNotNone(
            chat_in_list, "Green Herb should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        # This is draggable
        chat_button = chat_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_button.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Jill Valentine"
        folder_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Jill Valentine"), None
        )
        self.assertIsNotNone(
            folder_dropdown_button, "Jill Valentine button should be present"
        )

        # This is the droppable button
        drop_folder = folder_dropdown_button.find_element(
            By.XPATH, "./ancestor::button"
        )
        drop_folder_id = drop_folder.get_attribute("id")
        self.assertEqual(drop_folder_id, "dropDown", "Button should be called dropDown")

        # Perform the drag and drop action
        actions = ActionChains(self.driver)
        actions.drag_and_drop(chat_button, drop_folder).perform()

        time.sleep(3)  # Extra sleep to observe the effect

        # Click the promptHandler Button
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

        # Click the button with ID "Clean"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Clean")))
        button[-1].click()

        time.sleep(1)  # Give time for the menu to appear

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection

        # Locate all elements with the ID 'dropName'
        drop_name_elements = left_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(3)  # Give time for the clean

        # Check if any of the elements contain Chris Redfield
        folder_in_list = next(
            (el for el in drop_name_elements if el.text == "Chris Redfield"), None
        )
        self.assertIsNone(
            folder_in_list, "Chris Redfield should not be present in the list"
        )

    # ----------------- Test Folder Open All -----------------
    """Test the three button handler can open all folders to see contents inside"""

    def test_folder_open_all(self):
        self.delete_all_folders()
        self.create_chat("Temp")
        self.create_folder("Leon Kennedy")
        self.create_folder("Jill Valentine")
        self.create_folder("Chris Redfield")

        # Click the promptHandler Button
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
        
        # Click the button with ID "Clean"
        button = self.wait.until(EC.presence_of_element_located((By.ID, "Open All")))
        button.click()

        time.sleep(1)  # Give time for the menu to appear

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection

        # Locate all elements with the ID 'dropDown'
        drop_name_elements = left_panel.find_elements(By.ID, "dropDown")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract and print all title attributes for debugging
        titles = [element.get_attribute("title") for element in drop_name_elements]
        print("Extracted Titles:", titles)  # Debugging output

        # Extract and verify that all elements have the title "Collapse Folder"
        expected_title = "Collapse folder"
        exception_title = "Today folder (always expanded)"
        all_titles_match = all(
            element.get_attribute("title") == expected_title or element.get_attribute("title") == exception_title
            for element in drop_name_elements
        )

        self.assertTrue(
            all_titles_match,
            "All dropDown elements should have the title 'Collapse Folder'",
        )

    # ----------------- Test Folder Close All -----------------
    """Test the three button handler can close all folders"""

    def test_folder_close_all(self):
        self.delete_all_folders()
        self.create_chat("Temp")
        self.create_folder("Leon Kennedy")
        self.create_folder("Jill Valentine")
        self.create_folder("Chris Redfield")

        # Click the promptHandler Button
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
        
        # Click the button with ID "Clean"
        button = self.wait.until(EC.presence_of_element_located((By.ID, "Open All")))
        button.click()
        
        time.sleep(3)

        # Click the button with ID "Clean"
        button = self.wait.until(EC.presence_of_element_located((By.ID, "Close All")))
        button.click()

        time.sleep(1)  # Give time for the menu to appear

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection

        # Locate all elements with the ID 'dropDown'
        drop_name_elements = left_panel.find_elements(By.ID, "dropDown")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract and print all title attributes for debugging
        titles = [element.get_attribute("title") for element in drop_name_elements]
        print("Extracted Titles:", titles)  # Debugging output

        # Extract and verify that all elements have the title "Expand folder"
        expected_title = "Expand folder"
        exception_title = "Today folder (always expanded)"
        all_titles_match = all(
            element.get_attribute("title") == expected_title or element.get_attribute("title") == exception_title
            for element in drop_name_elements
        )

        self.assertTrue(
            all_titles_match,
            "All dropDown elements should have the title 'Expand Folder'",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)