import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import Select
from tests.base_test import BaseTest


class SummaryWithQuotationsTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)
        
    def click_assistants_tab(self):
        
        time.sleep(5)
        
        tab_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "tabSelection"))
        )

        # Search for the one with title including 'Assistants'
        assistants_button = next(
            (btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")),
            None
        )

        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")

        # Click the Assistants button
        assistants_button.click()

        # Wait briefly for UI to respond
        time.sleep(2)
        
    def upload_file(self, filename: str):
        try:
            # Build the full path to the test file
            current_dir = os.path.dirname(os.path.abspath(__file__))  # tests/AmplifyHelperTests/
            file_path = os.path.abspath(os.path.join(current_dir, "..", "test_files", filename))

            # Locate the hidden file input element
            file_input = self.wait.until(
                EC.presence_of_element_located((By.ID, "__idVarFile0"))
            )

            # Send the full path to the input
            file_input.send_keys(file_path)

            time.sleep(20)  # Give it a sec to process the upload

        except Exception as e:
            self.fail(f"Failed to upload file '{filename}': {e}")

    # ----------------- Test drop down collapses and expands -----------------
    """Ensure the Amplify Helpers folder can be clicked and that the folder expands
       on the Right Side Bar"""

    def test_dropdown_closes_after_selection(self):
        
        self.click_assistants_tab()
        
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

        # Ensure the parent button's title is "Collapse folder"
        parent_button = amplify_helper_dropdown_button.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_title = parent_button.get_attribute("title")
        self.assertEqual(
            button_title,
            "Collapse folder",
            "Button should change to 'Collapse folder' after clicking",
        )

        # Click to close the dropdown
        amplify_helper_dropdown_button.click()

        # Ensure the button's title is back to "Expand folder"
        button_title = parent_button.get_attribute("title")
        self.assertEqual(
            button_title,
            "Expand folder",
            "Button should change back to 'Expand folder' after clicking again",
        )

    # ----------------- Test Summary with Quotations can be clicked -----------------
    """Ensure the Summary with Quotations button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar"""

    def test_summary_with_quotations_is_interactable(self):
        
        self.click_assistants_tab()
        
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

        # Summary with Quotations is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Summary with Quotations"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Summary with Quotations"
        summary_with_quotations = next(
            (el for el in prompt_name_elements if el.text == "Summary with Quotations"),
            None,
        )
        self.assertIsNotNone(
            summary_with_quotations,
            "Summary with Quotations should be visible in the dropdown",
        )

        # Ensure the parent button's
        summary_with_quotations_button = summary_with_quotations.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = summary_with_quotations_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        # Click to close the dropdown
        summary_with_quotations_button.click()

        # Ensure the summary_with_quotations Chat Label appears after selection
        summary_with_quotations_modal_title = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertIsNotNone(
            summary_with_quotations_modal_title,
            "Summary with Quotations modal title should appear after selection",
        )

        # Extract the text from the element
        modal_text = summary_with_quotations_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text,
            "Summary with Quotations",
            "Modal title should be 'Summary with Quotations'",
        )

    # ----------------- Test Summary with Shared window -----------------
    """Ensure the Share button on the Summary with Quotations button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar and that it makes the Share Modal appear"""

    def test_share_button(self):
        
        self.click_assistants_tab()
        
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

        # Summary with Quotations is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Summary with Quotations"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Summary with Quotations"
        summary_with_quotations = next(
            (el for el in prompt_name_elements if el.text == "Summary with Quotations"),
            None,
        )
        self.assertIsNotNone(
            summary_with_quotations,
            "Summary with Quotations should be visible in the dropdown",
        )

        # Ensure the parent button's is visible
        summary_with_quotations_button = summary_with_quotations.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = summary_with_quotations_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(summary_with_quotations_button).perform()

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

    # ----------------- Test Summary with Quotations Duplicate Window -----------------
    """Ensure the Duplicate Button on the Summary with Quotations button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar and that it creates a duplicate in the prompts"""

    def test_summary_with_quotations_duplicate(self):
        
        self.click_assistants_tab()
        
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

        # Summary with Quotations is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Summary with Quotations"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Summary with Quotations"
        summary_with_quotations = next(
            (el for el in prompt_name_elements if el.text == "Summary with Quotations"),
            None,
        )
        self.assertIsNotNone(
            summary_with_quotations,
            "Summary with Quotations should be visible in the dropdown",
        )

        # Ensure the parent button's is visible
        summary_with_quotations_button = summary_with_quotations.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = summary_with_quotations_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(summary_with_quotations_button).perform()

        # Locate and click the "Duplicate" button
        duplicate_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "duplicateTemplate"))
        )
        self.assertIsNotNone(
            duplicate_button, "Duplicate button should be initialized and clicked"
        )
        duplicate_button.click()

        # Locate all elements with ID "promptName" and find the one with text "Summary with Quotations (copy)"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Summary with Quotations"
        summary_with_quotations_copy = next(
            (
                el
                for el in prompt_name_elements
                if el.text == "Summary with Quotations (copy)"
            ),
            None,
        )
        self.assertIsNotNone(
            summary_with_quotations_copy,
            "Summary with Quotations (copy) should be visible in the dropdown",
        )

        # Ensure the parent button's is visible
        summary_with_quotations_copy_button = summary_with_quotations_copy.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = summary_with_quotations_copy_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        summary_with_quotations_copy_button.click()

        summary_modal_text_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )

        extracted_checked_text = summary_modal_text_element.text
        self.assertEqual(
            extracted_checked_text,
            "Summary with Quotations (copy)",
            "The text extracted should be ",
        )

    # ----------------- Test Summary with Quotations Modal is interactable bullet points -----------------
    """Ensure the Summary with Quotations button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar and the modal is interactable with bullet points"""
    
    def test_summary_with_quotations_modal_is_interactable_bullet(self):   
        
        self.click_assistants_tab()
                             
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
        
        # Summary with Quotations is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Summary with Quotations"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Summary with Quotations"
        summary_with_quotations = next((el for el in prompt_name_elements if el.text == "Summary with Quotations"), None)
        self.assertIsNotNone(summary_with_quotations, "Summary with Quotations should be visible in the dropdown")
        
        # Ensure the parent button's
        summary_with_quotations_button = summary_with_quotations.find_element(By.XPATH, "./ancestor::button")
        button_id = summary_with_quotations_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")

        # Click to close the dropdown
        summary_with_quotations_button.click()

        # Ensure the summary_with_quotations Chat Label appears after selection
        summary_with_quotations_modal_title = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertIsNotNone(summary_with_quotations_modal_title, "Summary with Quotations modal title should appear after selection")

        # Extract the text from the element
        modal_text = summary_with_quotations_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Summary with Quotations", "Modal title should be 'Summary with Quotations'")
        
        # id="__idVarFile0"
        self.upload_file("Test_3.txt")
        
        # Click the Model Select Button
        summarization_options = self.wait.until(EC.presence_of_element_located((By.ID, "selectTool")))
        self.assertTrue(summarization_options.is_displayed(), "Summarization Select Button is visible")
        
        # Use Selenium's Select class to pick by visible text or value
        select = Select(summarization_options)
        select.select_by_visible_text("Use numbers for quotations")
        
        time.sleep(1)
        
        # selectTool
        # Use bullets for quotations
        # Use numbers for quotations
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Submit"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(15)
        
        
        
    # ----------------- Test Summary with Quotations Modal is interactable Numbered List -----------------
    """Ensure the Summary with Quotations button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar and the modal is interactable with numbered list"""
    
    def test_summary_with_quotations_modal_is_interactable_number(self):  
        
        self.click_assistants_tab()
                              
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
        
        # Summary with Quotations is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Summary with Quotations"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Summary with Quotations"
        summary_with_quotations = next((el for el in prompt_name_elements if el.text == "Summary with Quotations"), None)
        self.assertIsNotNone(summary_with_quotations, "Summary with Quotations should be visible in the dropdown")
        
        # Ensure the parent button's
        summary_with_quotations_button = summary_with_quotations.find_element(By.XPATH, "./ancestor::button")
        button_id = summary_with_quotations_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")

        # Click to close the dropdown
        summary_with_quotations_button.click()

        # Ensure the summary_with_quotations Chat Label appears after selection
        summary_with_quotations_modal_title = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertIsNotNone(summary_with_quotations_modal_title, "Summary with Quotations modal title should appear after selection")

        # Extract the text from the element
        modal_text = summary_with_quotations_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Summary with Quotations", "Modal title should be 'Summary with Quotations'")
        
        time.sleep(2)
        
        # id="__idVarFile0"
        self.upload_file("Test_3.txt")
        
        # Click the Model Select Button
        summarization_options = self.wait.until(EC.presence_of_element_located((By.ID, "selectTool")))
        self.assertTrue(summarization_options.is_displayed(), "Summarization Select Button is visible")
        
        # Use Selenium's Select class to pick by visible text or value
        select = Select(summarization_options)
        select.select_by_visible_text("Use numbers for quotations")
        
        time.sleep(1)
        
        # selectTool
        # Use bullets for quotations
        # Use numbers for quotations
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Submit"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(15)


if __name__ == "__main__":
    unittest.main(verbosity=2)
