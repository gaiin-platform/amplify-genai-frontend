import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from ..base_test import BaseTest


class CreateDiagramTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Test Create Diagram can be clicked -----------------
    """Ensure the Create Diagram button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar"""

    def test_create_diagram_is_interactable(self):
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

        # Create Diagram is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create Diagram"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Create Diagram"
        create_diagram = next(
            (el for el in prompt_name_elements if el.text == "Create Diagram"), None
        )
        self.assertIsNotNone(
            create_diagram, "Create Diagram should be visible in the dropdown"
        )

        # Ensure the parent button's
        create_diagram_button = create_diagram.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = create_diagram_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        # Click to close the dropdown
        create_diagram_button.click()

        # Ensure the create_diagram Chat Label appears after selection
        create_diagram_modal_title = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertIsNotNone(
            create_diagram_modal_title,
            "Create Diagram modal title should appear after selection",
        )

        # Extract the text from the element
        modal_text = create_diagram_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text, "Create Diagram", "Modal title should be 'Create Diagram'"
        )

    # ----------------- Test Summary with Shared window -----------------
    """Ensure the Share button on the Create Diagram button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar and that it makes the Share Modal appear"""

    def test_share_button(self):
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

        # Create Diagram is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create Diagram"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Create Diagram"
        create_diagram = next(
            (el for el in prompt_name_elements if el.text == "Create Diagram"), None
        )
        self.assertIsNotNone(
            create_diagram, "Create Diagram should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        create_diagram_button = create_diagram.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = create_diagram_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(create_diagram_button).perform()

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

    # ----------------- Test Create Diagram Duplicate Window -----------------
    """Ensure the Duplicate Button on the Create Diagram button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar and that it creates a duplicate in the prompts"""

    def test_create_diagram_duplicate(self):
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

        # Create Diagram is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create Diagram"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Create Diagram"
        create_diagram = next(
            (el for el in prompt_name_elements if el.text == "Create Diagram"), None
        )
        self.assertIsNotNone(
            create_diagram, "Create Diagram should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        create_diagram_button = create_diagram.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = create_diagram_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(create_diagram_button).perform()

        # Locate and click the "Duplicate" button
        duplicate_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "duplicateTemplate"))
        )
        self.assertIsNotNone(
            duplicate_button, "Duplicate button should be initialized and clicked"
        )
        duplicate_button.click()

        # Locate all elements with ID "promptName" and find the one with text "Create Diagram (copy)"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Create Diagram"
        create_diagram_copy = next(
            (el for el in prompt_name_elements if el.text == "Create Diagram (copy)"),
            None,
        )
        self.assertIsNotNone(
            create_diagram_copy,
            "Create Diagram (copy) should be visible in the dropdown",
        )

        # Ensure the parent button's is visible
        create_diagram_copy_button = create_diagram_copy.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = create_diagram_copy_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        create_diagram_copy_button.click()

        summary_modal_text_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )

        extracted_checked_text = summary_modal_text_element.text
        self.assertEqual(
            extracted_checked_text,
            "Create Diagram (copy)",
            "The text extracted should be ",
        )
        
    # ----------------- Create Diagram with Quotations Modal is interactable -----------------
    """Ensure the Create Diagram button in the Amplify Helpers folder can be clicked 
       on the Right Side Bar and the modal is interactable"""
    
    def test_create_diagram_modal_is_interactable_bullet(self):                        
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
        
        # Create Diagram is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Create Diagram"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Create Diagram"
        create_diagram = next((el for el in prompt_name_elements if el.text == "Create Diagram"), None)
        self.assertIsNotNone(create_diagram, "Create Diagram should be visible in the dropdown")
        
        # Ensure the parent button's
        create_diagram_button = create_diagram.find_element(By.XPATH, "./ancestor::button")
        button_id = create_diagram_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")

        # Click to close the dropdown
        create_diagram_button.click()

        # Ensure the create_diagram Chat Label appears after selection
        create_diagram_modal_title = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertIsNotNone(create_diagram_modal_title, "Create Diagram modal title should appear after selection")

        # Extract the text from the element
        modal_text = create_diagram_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Create Diagram", "Modal title should be 'Create Diagram'")
        
        time.sleep(2)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Submit"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(15)


    # Inspect Element Notes
    # Console Freeze: setTimeout( ()=>{ debugger }, 3000)

if __name__ == "__main__":
    unittest.main(verbosity=2)
