
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


class CreateFolderTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)
        
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

    # ----------------- Test add Folder and that it appears -----------------
    """This test goes through to create a new folder and then check for the specific one
       in the list of Prompts."""

    def test_add_folder(self):
        
        self.click_assistants_tab()
        
        self.delete_all_folders()
        
        # Extra sleep for extra loading
        time.sleep(5)

        folder_add_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "createFolderButton"))
        )
        self.assertTrue(folder_add_button, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_button.click()

        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Thousand Sunny")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")

        time.sleep(2)

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(2)

        # Find the element with text "Thousand Sunny"
        folder = next(
            (el for el in drop_name_elements if el.text == "Thousand Sunny"), None
        )
        self.assertIsNotNone(folder, "Thousand Sunny button should be present")

    # ----------------- Test Pin Folder to the top -----------------
    """This test goes through to create a new folder and then check for the specific one
       in the list of Prompts."""

    def test_pin_folder(self):
        
        self.click_assistants_tab()
        
        # Extra sleep for extra loading
        time.sleep(5)

        folder_add_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "createFolderButton"))
        )
        self.assertTrue(folder_add_button, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_button.click()

        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Going Merry")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")

        time.sleep(2)

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(2)

        # Find the element with text "Going Merry"
        folder = next(
            (el for el in drop_name_elements if el.text == "Going Merry"), None
        )
        self.assertIsNotNone(folder, "Going Merry button should be present")

        # Hover over the "Going Merry" button to make the "Pin" button visible
        action = ActionChains(self.driver)
        action.move_to_element(folder).perform()

        # Locate and click the "Pin" button
        pin_button = self.wait.until(EC.element_to_be_clickable((By.ID, "pinButton")))
        self.assertIsNotNone(pin_button, "Pin button should be initialized and clicked")
        pin_button.click()

        side_bar_detection = self.wait.until(
            EC.presence_of_element_located((By.ID, "sideBar"))
        )
        self.assertTrue(side_bar_detection, "Expected multiple side bars")

        # Locate all elements with the ID 'dropName'
        drop_name_elements = side_bar_detection.find_elements(By.ID, "dropName")
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Extract the first element
        first_element = drop_name_elements[0]

        # Get its text and compare it to "Going Merry"
        self.assertEqual(
            first_element.text.strip(),
            "Going Merry",
            "First drop name element should be 'Going Merry'",
        )

    # ----------------- Test Rename Folder -----------------
    """This test goes through to create a new folder and then check for the specific one
       in the list of Prompts."""

    def test_rename_folder(self):
        
        self.click_assistants_tab()
        
        self.delete_all_folders()
        
        # Extra sleep for extra loading
        time.sleep(5)

        folder_add_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "createFolderButton"))
        )
        self.assertTrue(folder_add_button, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_button.click()

        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("GOING MERRY")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")

        time.sleep(2)

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(2)

        # Find the element with text "GOING MERRY"
        folder = next(
            (el for el in drop_name_elements if el.text == "GOING MERRY"), None
        )
        self.assertIsNotNone(folder, "GOING MERRY button should be present")

        # Hover over the "Temp Folder" button to make the "Rename" button visible
        action = ActionChains(self.driver)
        action.move_to_element(folder).perform()

        # Locate and click the "rename" button
        rename_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "renameButton"))
        )
        self.assertIsNotNone(
            rename_button, "Rename button should be initialized and clicked"
        )
        rename_button.click()

        rename_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "renameInput"))
        )

        # Add a " 2" onto the end of the "Temp Folder" name
        rename_field.send_keys(" V2")

        rename_cancel_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "cancel"))
        )
        self.assertIsNotNone(
            rename_cancel_button,
            "Rename cancel button should be initialized and clicked",
        )

        rename_cancel_button.click()

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(2)

        # Find the element with text "GOING MERRY"
        folder = next(
            (el for el in drop_name_elements if el.text == "GOING MERRY"), None
        )
        self.assertIsNotNone(folder, "GOING MERRY button should be present")

        # Hover over the "Temp Folder" button to make the "Rename" button visible
        action = ActionChains(self.driver)
        action.move_to_element(folder).perform()

        # Locate and click the "rename" button
        rename_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "renameButton"))
        )
        self.assertIsNotNone(
            rename_button, "Rename button should be initialized and clicked"
        )
        rename_button.click()

        rename_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "renameInput"))
        )

        # Add a " 2" onto the end of the "Temp Folder" name
        rename_field.send_keys(" V2")

        rename_confirm_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirm"))
        )
        self.assertIsNotNone(
            rename_confirm_button,
            "Rename confirm button should be initialized and clicked",
        )

        rename_confirm_button.click()

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(2)

        # Find the element with text "GOING MERRY"
        folder = next(
            (el for el in drop_name_elements if el.text == "GOING MERRY V2"), None
        )
        self.assertIsNotNone(folder, "GOING MERRY button should be present")

    # ----------------- Test Delete Folder -----------------
    """This test goes through to create a new folder and then check for the specific one
       in the list of Prompts."""

    def test_delete_folder(self):
        
        self.click_assistants_tab()
        
        self.delete_all_folders()
        
        # Extra sleep for extra loading
        time.sleep(5)

        folder_add_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "createFolderButton"))
        )
        self.assertTrue(folder_add_button, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_button.click()

        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("River Raiders")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")

        time.sleep(2)

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(2)

        # Find the element with text "River Raiders"
        folder = next(
            (el for el in drop_name_elements if el.text == "River Raiders"), None
        )
        self.assertIsNotNone(folder, "River Raiders button should be present")

        # Hover over the "River Raiders" button to make the "Delete" button visible
        action = ActionChains(self.driver)
        action.move_to_element(folder).perform()

        # Locate and click the "delete" button
        delete_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "deleteButton"))
        )
        self.assertIsNotNone(
            delete_button, "Delete button should be initialized and clicked"
        )
        delete_button.click()
        
        time.sleep(2)

        delete_confirm_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "confirm"))
        )
        self.assertIsNotNone(
            delete_confirm_button,
            "Delete confirm button should be initialized and clicked",
        )

        delete_confirm_button.click()
        
        time.sleep(2)

        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.invisibility_of_element((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

    # ----------------- Test Add Item to Folder -----------------
    """This test goes through to create a new folder and then check for the specific one
       in the list of Prompts."""

    def test_add_item_to_folder(self):
        
        self.click_assistants_tab()
        
        self.delete_all_folders()
        
        # Extra sleep for extra loading
        time.sleep(5)

        folder_add_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "createFolderButton"))
        )
        self.assertTrue(folder_add_button, "Expected multiple buttons with ID 'createFolderButton'")

        # Click the last button (assuming it's on the right)
        folder_add_button.click()

        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Mario Party")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")

        time.sleep(2)

        # Locate and click the Add Assistant button
        assistant_add_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "addAssistantButton"))
        )
        self.assertIsNotNone(
            assistant_add_button,
            "Add Assistant button should be initialized and clickable",
        )
        assistant_add_button.click()

        # Locate the Assistant Name input field, clear it, and type "Assistant Aiba"
        assistant_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantNameInput"))
        )
        self.assertIsNotNone(
            assistant_name_input, "Assistant Name input should be present"
        )
        time.sleep(3)
        assistant_name_input.clear()
        time.sleep(3)
        assistant_name_input.send_keys("Luigi")
        time.sleep(3)

        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Save button should be present")
        
        save_button.click()

        time.sleep(5)

        # # Locate all elements with the ID 'dropName'
        # drop_name_elements = self.wait.until(
        #     EC.presence_of_all_elements_located((By.ID, "dropName"))
        # )
        # self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # # Find the element with text "Assistants"
        # assistant_dropdown_button = next(
        #     (el for el in drop_name_elements if el.text == "Assistants"), None
        # )
        # self.assertIsNotNone(
        #     assistant_dropdown_button, "Assistants button should be present"
        # )

        # # Click to open the dropdown
        # assistant_dropdown_button.click()

        # Locate all elements with ID "assistantName"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "assistantName"))
        )
        self.assertTrue(
            prompt_name_elements, "Assistant name elements should be initialized"
        )
        
        print(prompt_name_elements)

        # Find the correct assistant in the dropdown list
        assistant_in_list = next(
            (el for el in prompt_name_elements if el.text == "Luigi"), None
        )
        self.assertIsNotNone(
            assistant_in_list, "Luigi should be visible in the dropdown"
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

        time.sleep(5)  # Extra sleep to observe the effect


if __name__ == "__main__":
    unittest.main(verbosity=2)
