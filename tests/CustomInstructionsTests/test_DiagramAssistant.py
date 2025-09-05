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


class DiagramAssistantsTests(BaseTest):

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

    # ----------------- Test Diagram Assistant can be clicked -----------------
    """Ensure the Diagram Assistant button in the Custom Instructions folder can be clicked 
       on the Right Side Bar"""

    def test_diagram_assistant_is_interactable(self):
        
        self.click_assistants_tab()
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Custom Instructions"
        time.sleep(2)
        amplify_helper_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Custom Instructions"), None
        )
        self.assertIsNotNone(
            amplify_helper_dropdown_button,
            "Custom Instructions button should be present",
        )

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()

        # Diagram Assistant is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Diagram Assistant"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Diagram Assistant"
        diagram_assistant = next(
            (el for el in prompt_name_elements if el.text == "Diagram Assistant"), None
        )
        self.assertIsNotNone(
            diagram_assistant, "Diagram Assistant should be visible in the dropdown"
        )

        # Ensure the parent button's
        diagram_assistant_button = diagram_assistant.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = diagram_assistant_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        # Click to close the dropdown
        diagram_assistant_button.click()

        # Ensure the diagram_assistant Chat Label appears after selection
        diagram_assistant_modal_title = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertIsNotNone(
            diagram_assistant_modal_title,
            "Diagram Assistant modal title should appear after selection",
        )

        # Extract the text from the element
        modal_text = diagram_assistant_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text,
            "Chat with Diagram Assistant",
            "Modal title should be 'Diagram Assistant'",
        )

    # ----------------- Test Diagram Assistant with Shared window -----------------
    """Ensure the Share button on the Diagram Assistant button in the Custom Instructions folder can be clicked 
       on the Right Side Bar and that it makes the Share Modal appear"""

    def test_share_button(self):
        
        self.click_assistants_tab()
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Custom Instructions"
        time.sleep(2)
        amplify_helper_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Custom Instructions"), None
        )
        self.assertIsNotNone(
            amplify_helper_dropdown_button,
            "Custom Instructions button should be present",
        )

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()

        # Diagram Assistant is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Diagram Assistant"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Diagram Assistant"
        diagram_assistant = next(
            (el for el in prompt_name_elements if el.text == "Diagram Assistant"), None
        )
        self.assertIsNotNone(
            diagram_assistant, "Diagram Assistant should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        diagram_assistant_button = diagram_assistant.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = diagram_assistant_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(diagram_assistant_button).perform()

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

    # ----------------- Test Diagram Assistant Duplicate Window -----------------
    """Ensure the Duplicate Button on the Diagram Assistant button in the Custom Instructions folder can be clicked 
       on the Right Side Bar and that it creates a duplicate in the prompts"""

    def test_diagram_assistant_duplicate(self):
        
        self.click_assistants_tab()
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "dropName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Custom Instructions"
        time.sleep(2)
        amplify_helper_dropdown_button = next(
            (el for el in drop_name_elements if el.text == "Custom Instructions"), None
        )
        self.assertIsNotNone(
            amplify_helper_dropdown_button,
            "Custom Instructions button should be present",
        )

        # Click to open the dropdown
        amplify_helper_dropdown_button.click()

        # Diagram Assistant is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Diagram Assistant"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Diagram Assistant"
        diagram_assistant = next(
            (el for el in prompt_name_elements if el.text == "Diagram Assistant"), None
        )
        self.assertIsNotNone(
            diagram_assistant, "Diagram Assistant should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        diagram_assistant_button = diagram_assistant.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = diagram_assistant_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(diagram_assistant_button).perform()

        # Locate and click the "Duplicate" button
        duplicate_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "duplicateTemplate"))
        )
        self.assertIsNotNone(
            duplicate_button, "Duplicate button should be initialized and clicked"
        )
        duplicate_button.click()

        # Locate all elements with ID "promptName" and find the one with text "Diagram Assistant (copy)"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Diagram Assistant"
        diagram_assistant_copy = next(
            (
                el
                for el in prompt_name_elements
                if el.text == "Diagram Assistant (copy)"
            ),
            None,
        )
        self.assertIsNotNone(
            diagram_assistant_copy,
            "Diagram Assistant (copy) should be visible in the dropdown",
        )

        # Ensure the parent button's is visible
        diagram_assistant_copy_button = diagram_assistant_copy.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = diagram_assistant_copy_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        diagram_assistant_copy_button.click()

        summary_modal_text_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )

        extracted_checked_text = summary_modal_text_element.text
        self.assertEqual(
            extracted_checked_text,
            "Chat with Diagram Assistant (copy)",
            "The text extracted should be ",
        )

    # ----------------- Diagram Assistant Modal is interactable -----------------
    """Ensure the Diagram Assistant button in the Diagram Assistant folder can be clicked 
       on the Right Side Bar and the modal is interactable"""
    
    def test_diagram_assistant_modal_is_interactable(self): 
        
        self.click_assistants_tab()
                               
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Diagram Assistant"
        time.sleep(2)
        custom_instructions_dropdown_button = next((el for el in drop_name_elements if el.text == "Custom Instructions"), None)
        self.assertIsNotNone(custom_instructions_dropdown_button, "Diagram Assistant button should be present")

        # Click to open the dropdown
        custom_instructions_dropdown_button.click()
        
        # Diagram Assistant is visible in drop down menu
        # Locate all elements with ID "promptName" and find the one with text "Diagram Assistant"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Diagram Assistant"
        diagram_assistant = next((el for el in prompt_name_elements if el.text == "Diagram Assistant"), None)
        self.assertIsNotNone(diagram_assistant, "Diagram Assistant should be visible in the dropdown")
        
        # Ensure the parent button's
        diagram_assistant_button = diagram_assistant.find_element(By.XPATH, "./ancestor::button")
        button_id = diagram_assistant_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")

        # Click to close the dropdown
        diagram_assistant_button.click()

        # Ensure the diagram_assistant Chat Label appears after selection
        diagram_assistant_modal_title = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertIsNotNone(diagram_assistant_modal_title, "Diagram Assistant modal title should appear after selection")

        # Extract the text from the element
        modal_text = diagram_assistant_modal_title.text

        # Ensure the extracted text matches the expected value 
        # Might be 'Chat with Diagram Assistant'
        self.assertEqual(modal_text, "Chat with Diagram Assistant", "Modal title should be 'Diagram Assistant'")
        
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
