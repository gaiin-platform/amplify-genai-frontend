import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from tests.base_test import BaseTest


class CSVExtractorTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Test CSV Extractor can be clicked -----------------
    """Ensure the CSV Extractor button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar"""

    def test_csv_extractor_is_interactable(self):
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        time.sleep(2)
        amplify_helper_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Amplify Helpers"), None
        )
        self.assertIsNotNone(
            amplify_helper_dropdown_button, "Amplify Helpers button should be present"
        )

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()

        # CSV Extractor is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "CSV Extractor"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "CSV Extractor"
        csv_extractor = next(
            (el for el in prompt_name_elements if el.text == "CSV Extractor"), None
        )
        self.assertIsNotNone(
            csv_extractor, "CSV Extractor should be visible in the dropdown"
        )

        # Ensure the parent button's
        csv_extractor_button = csv_extractor.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = csv_extractor_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        # Click to close the dropdown
        csv_extractor_button.click()

        # Ensure the csv_extractor Chat Label appears after selection
        csv_extractor_modal_title = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertIsNotNone(
            csv_extractor_modal_title,
            "CSV Extractor modal title should appear after selection",
        )

        # Extract the text from the element
        modal_text = csv_extractor_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text, "CSV Extractor", "Modal title should be 'CSV Extractor'"
        )

    # ----------------- Test CSV Extractor Shared window -----------------
    """Ensure the Share button on the CSV Extractor button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar and that it makes the Share Modal appear"""

    def test_csv_extractor_shared(self):
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        time.sleep(2)
        amplify_helper_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Amplify Helpers"), None
        )
        self.assertIsNotNone(
            amplify_helper_dropdown_button, "Amplify Helpers button should be present"
        )

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()

        # CSV Extractor is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "CSV Extractor"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "CSV Extractor"
        csv_extractor = next(
            (el for el in prompt_name_elements if el.text == "CSV Extractor"), None
        )
        self.assertIsNotNone(
            csv_extractor, "CSV Extractor should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        csv_extractor_button = csv_extractor.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = csv_extractor_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(csv_extractor_button).perform()

        # Locate and click the "Share" button
        share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "shareTemplate"))
        )
        self.assertIsNotNone(
            share_button, "Share button should be initialized and clicked"
        )
        share_button.click()

        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            share_modal_element.is_displayed(), "Share window element is visible"
        )

        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text,
            "Add People to Share With",
            "Modal title should be 'Add People to Share With'",
        )

    # ----------------- Test CSV Extractor Duplicate Window -----------------
    """Ensure the Duplicate Button on the CSV Extractor button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar and that it creates a duplicate in the prompts"""

    def test_csv_extractor_duplicate(self):
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        time.sleep(2)
        amplify_helper_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Amplify Helpers"), None
        )
        self.assertIsNotNone(
            amplify_helper_dropdown_button, "Amplify Helpers button should be present"
        )

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()

        # CSV Extractor is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "CSV Extractor"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "CSV Extractor"
        csv_extractor = next(
            (el for el in prompt_name_elements if el.text == "CSV Extractor"), None
        )
        self.assertIsNotNone(
            csv_extractor, "CSV Extractor should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        csv_extractor_button = csv_extractor.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = csv_extractor_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(csv_extractor_button).perform()

        # Locate and click the "Duplicate" button
        duplicate_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "duplicateTemplate"))
        )
        self.assertIsNotNone(
            duplicate_button, "Duplicate button should be initialized and clicked"
        )
        duplicate_button.click()

        # Locate all elements with ID "promptName" and find the one with text "CSV Extractor (copy)"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "CSV Extractor"
        csv_extractor_copy = next(
            (el for el in prompt_name_elements if el.text == "CSV Extractor (copy)"),
            None,
        )
        self.assertIsNotNone(
            csv_extractor_copy, "CSV Extractor (copy) should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        csv_extractor_copy_button = csv_extractor_copy.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = csv_extractor_copy_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        csv_extractor_copy_button.click()

        summary_modal_text_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )

        extracted_checked_text = summary_modal_text_element.text
        self.assertEqual(
            extracted_checked_text,
            "CSV Extractor (copy)",
            "The text extracted should be ",
        )

    # ----------------- CSV Extractor with Quotations Modal is interactable -----------------
    """Ensure the CSV Extractor button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar and the modal is interactable"""
    
    def test_create_visualization_modal_is_interactable_bullet(self):                        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Amplify Helpers"
        time.sleep(2)
        amplify_helper_dropdown_button = next((el for el in drop_name_elements if el.text == "Amplify Helpers"), None)
        self.assertIsNotNone(amplify_helper_dropdown_button, "Amplify Helpers button should be present")

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()
        
        # CSV Extractor is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "CSV Extractor"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "CSV Extractor"
        csv_extractor = next((el for el in prompt_name_elements if el.text == "CSV Extractor"), None)
        self.assertIsNotNone(csv_extractor, "CSV Extractor should be visible in the dropdown")
        
        # Ensure the parent button's
        csv_extractor_button = csv_extractor.find_element(By.XPATH, "./ancestor::button")
        button_id = csv_extractor_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")

        # Click to close the dropdown
        csv_extractor_button.click()

        # Ensure the csv_extractor Chat Label appears after selection
        csv_extractor_modal_title = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertIsNotNone(csv_extractor_modal_title, "CSV Extractor modal title should appear after selection")

        # Extract the text from the element
        modal_text = csv_extractor_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "CSV Extractor", "Modal title should be 'CSV Extractor'")
        
        time.sleep(2)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Submit"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(15)


if __name__ == "__main__":
    unittest.main(verbosity=2)
