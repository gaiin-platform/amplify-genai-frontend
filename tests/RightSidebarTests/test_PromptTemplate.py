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


class PromptTemplateTests(BaseTest):

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

    # ----------------- Prompt created, saved, and appeared in list -----------------
    """This test goes through to create a prompt and ensure that it appears in the list below."""

    def test_add_prompt_in_dropdown(self):
        
        self.click_assistants_tab()

        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")

        prompt_add_button = next(
            (el for el in prompt_buttons if el.text == "Prompt Template"), None
        )
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")

        # Click open Add prompt menu
        prompt_add_button.click()

        time.sleep(2)

        # Locate the Prompt Name input field, clear it, and type "Prompt Kyogre"
        prompt_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptModalName"))
        )
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt Kyogre")

        time.sleep(2)

        # Locate and click the Save button
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

        # Locate all elements with ID "promptName" and find the one with text "Prompt Kyogre"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Prompt Kyogre"
        prompt_in_list = next(
            (el for el in prompt_name_elements if el.text == "Prompt Kyogre"), None
        )
        self.assertIsNotNone(
            prompt_in_list, "Prompt Kyogre should be visible in the dropdown"
        )

    # ----------------- Test prompt is clickable -----------------
    """This test goes through to create a prompt and ensure that the prompt appearing below
       in the list below is clickable and displays the necessary prompt window."""

    def test_prompt_is_interactable(self):
        
        self.click_assistants_tab()

        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")

        prompt_add_button = next(
            (el for el in prompt_buttons if el.text == "Prompt Template"), None
        )
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")

        # Click open Add prompt menu
        prompt_add_button.click()

        time.sleep(2)

        # Locate the Prompt Name input field, clear it, and type "Prompt Groudon"
        prompt_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptModalName"))
        )
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt Groudon")

        time.sleep(2)

        # Locate and click the Save button
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

        # Locate all elements with ID "promptName" and find the one with text "Prompt Groudon"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Check if any of the elements contain "Prompt Groudon"
        prompt_in_list = next(
            (el for el in prompt_name_elements if el.text == "Prompt Groudon"), None
        )
        self.assertIsNotNone(
            prompt_in_list, "Prompt Groudon should be visible in the dropdown"
        )

        # Ensure the parent button's
        prompt_button = prompt_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = prompt_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        # Click to open window
        prompt_button.click()

        time.sleep(2)

        # Ensure the Prompt Title appears after selection
        prompt_modal_title = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertIsNotNone(
            prompt_modal_title, "Prompt Title should appear after selection"
        )

        # Extract the text from the element
        modal_text = prompt_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text, "Prompt Groudon", "Modal title should be 'Prompt Groudon'"
        )

    # ----------------- Test multiple prompts in a list -----------------
    """This test goes through to create a prompt and then creates a second prompt
       afterwards. Once both prompts are created, it checks to make sure both are 
       present."""

    def test_with_multiple_prompts(self):
        
        self.click_assistants_tab()

        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")

        prompt_add_button = next(
            (el for el in prompt_buttons if el.text == "Prompt Template"), None
        )
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")

        # Click open Add prompt menu
        prompt_add_button.click()

        time.sleep(2)

        # Locate the Prompt Name input field, clear it, and type "Prompt Mario"
        prompt_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptModalName"))
        )
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt Mario")

        time.sleep(2)

        # Locate and click the Save button
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

        # Locate the Prompt Add button for a second time
        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")

        prompt_add_button = next(
            (el for el in prompt_buttons if el.text == "Prompt Template"), None
        )
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")

        # Click open Add prompt menu
        prompt_add_button.click()

        time.sleep(2)

        # Locate the Prompt Name input field, clear it, and type "Prompt Luigi"
        prompt_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptModalName"))
        )
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt Luigi")

        time.sleep(2)

        # Locate and click the Save button
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

        # Locate all elements with ID "promptName" and find the one with text "Assistant Aiba"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct prompt in the dropdown list
        first_prompt_in_list = next(
            (el for el in prompt_name_elements if el.text == "Prompt Mario"), None
        )
        self.assertIsNotNone(
            first_prompt_in_list, "Prompt Mario should be visible in the dropdown"
        )

        # Find the correct prompt in the dropdown list
        second_prompt_in_list = next(
            (el for el in prompt_name_elements if el.text == "Prompt Luigi"), None
        )
        self.assertIsNotNone(
            second_prompt_in_list, "Prompt Luigi should be visible in the dropdown"
        )

    # ----------------- Test Duplicate Template Button -----------------
    """This test goes through to create a prompt and then upon hovering over a prompt,
       it clicks the the "Duplicate Template" button and tests the button creates a
       duplicated prompt."""

    def test_duplicate_button(self):
        
        self.click_assistants_tab()
        
        # Locate the Prompt Add button
        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")

        prompt_add_button = next(
            (el for el in prompt_buttons if el.text == "Prompt Template"), None
        )
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")

        # Click open Add prompt menu
        prompt_add_button.click()

        time.sleep(2)

        # Locate the Prompt Name input field, clear it, and type "Prompt WARIO"
        prompt_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptModalName"))
        )
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt WARIO")

        time.sleep(2)

        # Locate and click the Save button
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

        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct assistant in the dropdown list
        assistant_in_list = next(
            (el for el in prompt_name_elements if el.text == "Prompt WARIO"), None
        )
        self.assertIsNotNone(
            assistant_in_list, "Prompt WARIO should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()

        # Locate and click the "Duplicate" button
        duplicate_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "duplicateTemplate"))
        )
        self.assertIsNotNone(
            duplicate_button, "Duplicate button should be initialized and clicked"
        )
        duplicate_button.click()

        # Find the correct assistant in the dropdown list
        assistant_in_list = next(
            (el for el in prompt_name_elements if el.text == "Prompt WARIO (copy)"),
            None,
        )
        self.assertIsNotNone(
            assistant_in_list, "Prompt WARIO (copy) should be visible in the dropdown"
        )

    # ----------------- Test Edit Template Button -----------------
    """This test goes through to create an prompt and then upon hovering over an prompt,
       it clicks the the "Edit Template" button and tests to ensure the Edit window 
       pops up as intended."""

    def test_edit_button(self):
        
        self.click_assistants_tab()
        
        # Locate the Prompt Add button
        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")

        prompt_add_button = next(
            (el for el in prompt_buttons if el.text == "Prompt Template"), None
        )
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")

        # Click open Add prompt menu
        prompt_add_button.click()

        time.sleep(2)

        # Locate the Prompt Name input field, clear it, and type "Prompt WALUIGI"
        prompt_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptModalName"))
        )
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt WALUIGI")

        time.sleep(2)

        # Locate and click the Save button
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

        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct assistant in the dropdown list
        assistant_in_list = next(
            (el for el in prompt_name_elements if el.text == "Prompt WALUIGI"), None
        )
        self.assertIsNotNone(
            assistant_in_list, "Prompt WALUIGI should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()

        # Locate and click the "Edit" button
        edit_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "editTemplate"))
        )
        self.assertIsNotNone(
            edit_button, "Edit button should be initialized and clicked"
        )
        edit_button.click()

        # Verify the presence of the Window element after clicking the Edit button
        edit_window_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "modalTitle"))
        )
        self.assertTrue(
            edit_window_element, "Edit window element is visible"
        )

        # Extract the text from the element
        modal_text = edit_window_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(
            modal_text, "Prompt Template", "Modal title should be 'Prompt Template'"
        )

    # ----------------- Test Share Template Button -----------------
    """This test goes through to create an prompt and then upon hovering over an prompt,
       it clicks the the "Share Template" button and tests to ensure the share window 
       pops up as intended."""

    def test_share_button(self):
        
        self.click_assistants_tab()
        
        # Locate the Prompt Add button
        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")

        prompt_add_button = next(
            (el for el in prompt_buttons if el.text == "Prompt Template"), None
        )
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")

        # Click open Add prompt menu
        prompt_add_button.click()

        time.sleep(2)

        # Locate the Prompt Name input field, clear it, and type "Prompt Yoshi"
        prompt_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptModalName"))
        )
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt Yoshi")

        time.sleep(2)

        # Locate and click the Save button
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

        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct assistant in the dropdown list
        assistant_in_list = next(
            (el for el in prompt_name_elements if el.text == "Prompt Yoshi"), None
        )
        self.assertIsNotNone(
            assistant_in_list, "Prompt Yoshi should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()

        # Locate and click the "Share" button
        share_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "shareTemplate"))
        )
        self.assertIsNotNone(
            share_button, "Share button should be initialized and clicked"
        )
        share_button.click()

        # Verify the presence of the Window element after clicking the Share button
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

    # ----------------- Test Delete Button -----------------
    """This test goes through to create an assistant and then upon hovering over a prompt,
       it clicks the the "Delete Template" button and tests the "Confirm" and "Cancel" buttons
       to ensure the prompts are deleted and remain visible as intended."""

    def test_delete_button(self):
        
        self.click_assistants_tab()
        
        # Locate the Prompt Add button
        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")

        prompt_add_button = next(
            (el for el in prompt_buttons if el.text == "Prompt Template"), None
        )
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")

        # Click open Add prompt menu
        prompt_add_button.click()

        time.sleep(2)

        # Locate the Prompt Name input field, clear it, and type "Prompt Daisy"
        prompt_name_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptModalName"))
        )
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt Daisy")

        time.sleep(2)

        # Locate and click the Save button
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

        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptName"))
        )
        self.assertTrue(
            prompt_name_elements, "Prompt name elements should be initialized"
        )

        # Find the correct assistant in the dropdown list
        assistant_in_list = next(
            (el for el in prompt_name_elements if el.text == "Prompt Daisy"), None
        )
        self.assertIsNotNone(
            assistant_in_list, "Prompt Daisy should be visible in the dropdown"
        )

        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(
            By.XPATH, "./ancestor::button"
        )
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(
            button_id, "promptClick", "Button should be called promptClick"
        )

        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()

        # Locate and click the "Delete" button
        delete_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "deleteTemplate"))
        )
        self.assertIsNotNone(
            delete_button, "Delete button should be initialized and clicked"
        )
        delete_button.click()

        # Locate and click the "Delete" button
        cancel_button = self.wait.until(EC.element_to_be_clickable((By.ID, "cancel")))
        self.assertIsNotNone(
            cancel_button, "Cancel button should be initialized and clicked"
        )
        cancel_button.click()

        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()

        # Locate and click the "Delete" button
        delete_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "deleteTemplate"))
        )
        self.assertIsNotNone(
            delete_button, "Delete button should be initialized and clicked"
        )
        delete_button.click()

        # Locate and click the "Delete" button
        confirm_button = self.wait.until(EC.element_to_be_clickable((By.ID, "confirm")))
        self.assertIsNotNone(
            cancel_button, "Confirm button should be initialized and clicked"
        )
        confirm_button.click()


if __name__ == "__main__":
    unittest.main(verbosity=2)
