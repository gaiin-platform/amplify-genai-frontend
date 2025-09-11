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


class FolderHandlerTests(BaseTest):

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
            
    def click_assistants_tab(self):
        time.sleep(5)
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()
        time.sleep(5)
            
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

    # ----------------- Test Folder Sort Name -----------------
    """Test the three button handler can sort the created folders by name"""

    def test_folder_sort_name(self):
        self.click_assistants_tab()
        self.delete_all_folders()
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")

        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
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
        button = self.wait.until(EC.element_to_be_clickable((By.ID, "Name")))
        button.click()

        time.sleep(3)

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Use the right sidebar
        right_panel = side_bar_detection

        # Locate all elements with the ID 'dropName'
        drop_name_elements = right_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract text from all elements and strip whitespace
        drop_names = [element.text.strip() for element in drop_name_elements]

        # Ensure the list is sorted in ascending order
        self.assertEqual(
            drop_names,
            sorted(drop_names),
            "Drop name elements should be sorted alphabetically",
        )

    # ----------------- Test Folder Sort Date -----------------
    # HELD OFF FOR NOW, MIGHT INCLUDE BACKEND

    # ----------------- Test Folder Delete -----------------
    """Test the three button handler can delete a folder"""

    def test_folder_delete(self):
        self.click_assistants_tab()
        self.delete_all_folders()
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")

        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
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

        # Use the right sidebar
        right_panel = side_bar_detection

        # Locate all elements with the ID 'dropName'
        drop_name_elements = right_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(1)  # Give time for the menu to appear

        # Check if any of the elements contain Folder
        folder_in_list = next(
            (el for el in drop_name_elements if el.text == "Baby Park"), None
        )
        self.assertIsNotNone(
            folder_in_list, "Baby Park should be visible in the dropdown"
        )

        # Navigate up to the parent container
        parent_container = folder_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='folderContainer']"
        )

        time.sleep(1)  # Give time for the menu to appear

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Baby Park should be present"
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

        # Locate all elements with ID "dropName" and find the one with text "Baby Park"
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(
            drop_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements do not contain "Baby Park"
        folder_in_list = next(
            (el for el in drop_name_elements if el.text == "Baby Park"), None
        )
        self.assertIsNone(folder_in_list, "Baby Park should be visible in the dropdown")

    # ----------------- Test Folder Delete All -----------------
    """Test the three button handler can delete all created folders"""

    def test_folder_all_delete(self):
        self.click_assistants_tab()
        self.delete_all_folders()
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")

        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
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

        # Click the select all checkbox
        select_all_check = self.wait.until(
            EC.presence_of_element_located((By.ID, "selectAllCheck"))
        )

        # Locate the checkbox within the parent container
        checkbox = select_all_check.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt All should be present")

        checkbox.click()

        time.sleep(3)

        # Click the Delete Button
        confirm_delete_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirmItem"))
        )
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()

        time.sleep(3)

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.invisibility_of_element((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

    # ----------------- Test Folder Share -----------------
    """Test the three button handler can share the specified folder"""

    def test_folder_share(self):
        self.click_assistants_tab()
        self.delete_all_folders()
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")

        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
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

        # Click the button with ID "Share"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Share")))
        button[-1].click()

        time.sleep(1)  # Give time for the menu to appear

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected side bar")

        # Use the right sidebar
        right_panel = side_bar_detection

        # Locate all elements with the ID 'dropName'
        drop_name_elements = right_panel.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(1)  # Give time for the menu to appear

        # Check if any of the elements contain Luigi's Mansion
        folder_in_list = next(
            (el for el in drop_name_elements if el.text == "Luigi's Mansion"), None
        )
        self.assertIsNotNone(
            folder_in_list, "Luigi's Mansion should be visible in the dropdown"
        )

        # Navigate up to the parent container
        parent_container = folder_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='folderContainer']"
        )

        time.sleep(1)  # Give time for the menu to appear

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Luigis Mansion should be present"
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

        # Check if any of the elements contain "Luigi's Mansion"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Luigi's Mansion"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Luigi's Mansion should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Luigis Mansion should be present"
        )

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

        time.sleep(1)

    # ----------------- Test Folder Share All -----------------
    """Test the three button handler can share all folders"""

    def test_folder_all_share(self):
        self.click_assistants_tab()
        self.delete_all_folders()
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")

        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
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

        # Click the button with ID "Share"
        button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "Share")))
        button[-1].click()

        time.sleep(1)  # Give time for the menu to appear

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

        # Check if any of the elements contain "Luigi's Mansion"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Luigi's Mansion"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Luigi's Mansion should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Luigis Mansion should be present"
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

        # Check if any of the elements contain "Baby Park"
        checkbox_name_in_list = next(
            (el for el in checkbox_name_elements if el.text == "Baby Park"), None
        )
        self.assertIsNotNone(
            checkbox_name_in_list, "Baby Park should be visible in the dropdown"
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Baby Park should be present"
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

        # Check if any of the elements contain "Admiral Bobbery's Ship"
        checkbox_name_in_list = next(
            (
                el
                for el in checkbox_name_elements
                if el.text == "Admiral Bobbery's Ship"
            ),
            None,
        )
        self.assertIsNotNone(
            checkbox_name_in_list,
            "Admiral Bobbery's Ship should be visible in the dropdown",
        )

        time.sleep(1)

        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(
            By.XPATH, "./ancestor::div[@id='checkBoxItem']"
        )

        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(
            checkbox, f"Checkbox for prompt Admiral Bobberys Ship should be present"
        )

        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

    # ----------------- Test Folder Clean -----------------
    """Test the three button handler can delete all the empty folders"""

    def test_folder_clean(self):
        self.click_assistants_tab()
        self.delete_all_folders()
        self.create_folder("Luigi's Mansion")
        self.create_folder("Admiral Bobbery's Ship")
        self.create_assistant("Paper Mario")

        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "assistantName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct assistant in the dropdown list
        assistant_in_list = next(
            (el for el in prompt_name_elements if el.text == "Paper Mario"), None
        )
        self.assertIsNotNone(
            assistant_in_list, "Paper Mario should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        # This is draggable
        assistant_button = assistant_in_list.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(
            button_id, "assistantClick", "Button should be called assistantClick"
        )

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Admiral Bobbery's Ship"
        assistant_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Admiral Bobbery's Ship"),
            None,
        )
        self.assertIsNotNone(
            assistant_dropdown_button, "Admiral Bobbery's Ship button should be present"
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

        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
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

        # Click the button with ID "Clean"
        button = self.wait.until(EC.element_to_be_clickable((By.ID, "Clean")))
        button.click()

        time.sleep(1)  # Give time for the menu to appear

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract the text of each element into a list
        actual_names = [el.text for el in drop_name_elements]
        
        expected_names = ["Admiral Bobbery's Ship"]
        
        # Assert they are exactly equal
        self.assertEqual(
            actual_names,
            expected_names,
            f"Dropdown names do not match.\nExpected: {expected_names}\nActual: {actual_names}"
        )

    # ----------------- Test Folder Open All -----------------
    """Test the three button handler can open all folders to see contents inside"""

    def test_folder_open_all(self):
        self.click_assistants_tab()
        self.delete_all_folders()
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")

        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
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

        # Click the button with ID "Share"
        button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "Open All"))
        )
        button[-1].click()

        time.sleep(1)  # Give time for the menu to appear

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected side bar")

        # Use the right sidebar
        right_panel = side_bar_detection

        # Locate all elements with the ID 'dropDown'
        drop_name_elements = right_panel.find_elements(By.ID, "dropDown")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract and print all title attributes for debugging
        titles = [element.get_attribute("title") for element in drop_name_elements]
        print("Extracted Titles:", titles)  # Debugging output

        # Extract and verify that all elements have the title "Collapse Folder"
        expected_title = "Collapse folder"
        all_titles_match = all(
            element.get_attribute("title") == expected_title
            for element in drop_name_elements
        )

        self.assertTrue(
            all_titles_match,
            "All dropDown elements should have the title 'Collapse Folder'",
        )

    # ----------------- Test Folder Close All -----------------
    """Test the three button handler can close all folders"""

    def test_folder_close_all(self):
        self.click_assistants_tab()
        self.delete_all_folders()
        self.create_folder("Luigi's Mansion")
        self.create_folder("Baby Park")
        self.create_folder("Admiral Bobbery's Ship")

        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )
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

        # Click the button with ID "Open All"
        button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "Open All"))
        )
        button[-1].click()

        time.sleep(1)  # Give time for the menu to appear

        # Click the button with ID "Close All"
        button = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "Close All"))
        )
        button[-1].click()

        time.sleep(1)  # Give time for the menu to appear

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected side bar")

        # Use the right sidebar
        right_panel = side_bar_detection

        # Locate all elements with the ID 'dropDown'
        drop_name_elements = right_panel.find_elements(By.ID, "dropDown")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract and print all title attributes for debugging
        titles = [element.get_attribute("title") for element in drop_name_elements]
        print("Extracted Titles:", titles)  # Debugging output

        # Extract and verify that all elements have the title "Expand Folder"
        expected_title = "Expand folder"
        all_titles_match = all(
            element.get_attribute("title") == expected_title
            for element in drop_name_elements
        )

        self.assertTrue(
            all_titles_match,
            "All dropDown elements should have the title 'Expand Folder'",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)