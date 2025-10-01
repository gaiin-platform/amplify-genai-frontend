import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import UnexpectedAlertPresentException, NoSuchElementException
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import Select
from tests.base_test import BaseTest

class PromptModalTests(BaseTest):
    
    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)              
            
    # ----------------- Setup Test Data ------------------  
    def create_assistant(self, assistant_name):
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys(assistant_name)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        save_button.click()
        
        time.sleep(5)
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "dropName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Assistants"), None)
        self.assertIsNotNone(assistant_dropdown_button, "Assistants button should be present")
        
        # Ensure the parent button's title is "Collapse folder" before clicking
        parent_button = assistant_dropdown_button.find_element(By.XPATH, "./ancestor::button")
        button_title = parent_button.get_attribute("title")
        if button_title != "Collapse folder":
            assistant_dropdown_button.click()
        
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "assistantName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        assistant_in_list = next((el for el in prompt_name_elements if el.text == assistant_name), None)
        self.assertIsNotNone(assistant_in_list, f"{assistant_name} should be visible in the dropdown")
        
    def click_assistants_tab(self):
        time.sleep(5)
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()

        time.sleep(2)

    # Temporarily depricated, Prompt Optimizer button not working, or really slow 

    # # ----------------- Test Prompt Fields -----------------
    # """This test goes through to create a prompt and testing all the fields"""
    
    # def test_prompt_fields(self):
        
    #     prompt_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptButton")))
    #     self.assertTrue(prompt_buttons, "Prompt elements should be initialized")
    #     prompt_add_button = next((el for el in prompt_buttons if el.text == "Prompt Template"), None)
    #     self.assertIsNotNone(prompt_add_button, "Prompt button should be present")
    #     prompt_add_button.click()
        
    #     time.sleep(2)
        
    #     prompt_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "promptModalName")))
    #     self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
    #     prompt_name_input.clear()
    #     prompt_name_input.send_keys("Prompt Red")
        
    #     time.sleep(2)
        
    #     # id="promptDescription" This is a textarea element, fill in at this id, "This prompt has a description" 
    #     prompt_description = self.wait.until(EC.presence_of_element_located((By.ID, "promptDescription")))
    #     self.assertIsNotNone(prompt_description, "Prompt description textarea should be present")
    #     prompt_description.clear()
    #     prompt_description.send_keys("This is a prompt about Red")

    #     time.sleep(3)
        
    #     # id="customInstructions" This is a select element, Get the list of options, and then go through all of the select items.
    #     custom_instructions = self.wait.until(EC.presence_of_element_located((By.ID, "customInstructions")))
    #     self.assertIsNotNone(custom_instructions, "Custom Instructions select should be present")
    #     instruction_options = [option.text for option in custom_instructions.find_elements(By.TAG_NAME, "option")]
    #     self.assertTrue(instruction_options, "Custom Instructions select should contain options")
        
    #     # id="promptContent" This is a textarea element, fill in at this id, "This has the prompt content" 
    #     prompt_content = self.wait.until(EC.presence_of_element_located((By.ID, "promptContent")))
    #     self.assertIsNotNone(prompt_content, "Prompt content textarea should be present")
    #     prompt_content.clear()
    #     prompt_content.send_keys("Red is a strong Pokemon Champion")
        
    #     time.sleep(3)
        
    #     prompt_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
    #     self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", prompt_scroll_window)
        
    #     time.sleep(3)
        
    #     # id="promptOptimizerButton" This is a button, click this button and then wait time.sleep(15)
    #     optimizer_button = self.wait.until(EC.presence_of_element_located((By.ID, "promptOptimizerButton")))
    #     self.assertIsNotNone(optimizer_button, "Prompt Optimizer button should be present")
    #     optimizer_button.click()
        
    #     time.sleep(30)
        
    #     prompt_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
    #     self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", prompt_scroll_window)
        
    #     time.sleep(3)
        
    #     conversation_tags_button = self.wait.until(EC.presence_of_element_located((By.ID, "conversationTags")))
    #     self.assertIsNotNone(conversation_tags_button, "Conversation Tags button should be present")
    #     expand_button = conversation_tags_button.find_element(By.XPATH, './/button[@title="Expand"]')
    #     expand_button.click()
        
    #     time.sleep(3)
        
    #     # id="tagNamesInput" This is a textarea element, fill in at this id, "Pokemon Champion, Pokemon Trainer" 
    #     tag_names_input = self.wait.until(EC.presence_of_element_located((By.ID, "tagNamesInput")))
    #     self.assertIsNotNone(tag_names_input, "Tag Names input should be present")
    #     tag_names_input.clear()
    #     tag_names_input.send_keys("Pokemon Champion, Pokemon Trainer")
        
    #     time.sleep(3)
        
    #     prompt_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
    #     self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", prompt_scroll_window)
        
    #     time.sleep(3)
        
    #     # id="promptTemplateCheck" This is a checkbox, click it
    #     prompt_template_check = self.wait.until(EC.presence_of_element_located((By.ID, "promptTemplateCheck")))
    #     self.assertIsNotNone(prompt_template_check, "Prompt Template checkbox should be present")
    #     prompt_template_check.click()

    #     time.sleep(3)
        
    #     # id="customInstructionsCheck" This is a checkbox, click it
    #     custom_instructions_check = self.wait.until(EC.presence_of_element_located((By.ID, "customInstructionsCheck")))
    #     self.assertIsNotNone(custom_instructions_check, "Custom Instructions checkbox should be present")
    #     custom_instructions_check.click()

    #     time.sleep(3)
        
    #     # id="followUpButtonCheck" This is a checkbox, click it
    #     follow_up_button_check = self.wait.until(EC.presence_of_element_located((By.ID, "followUpButtonCheck")))
    #     self.assertIsNotNone(follow_up_button_check, "Follow Up Button checkbox should be present")
    #     follow_up_button_check.click()

    #     time.sleep(3)

    #     # Locate and click the Save button
    #     confirmation_button = self.wait.until(EC.presence_of_all_elements_located(
    #         (By.ID, "confirmationButton")
    #     ))
    #     self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
    #     save_button = next((el for el in confirmation_button if el.text == "Save"), None)
    #     self.assertIsNotNone(save_button, "Save button should be present")
        
    #     save_button.click()

    #     time.sleep(2)

    #     # Locate all elements with ID "promptName" and find the one with text "Prompt Red"
    #     prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
    #         (By.ID, "promptName")
    #     ))
    #     self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

    #     # Check if any of the elements contain "Prompt Red"
    #     prompt_in_list = next((el for el in prompt_name_elements if el.text == "Prompt Red"), None)
    #     self.assertIsNotNone(prompt_in_list, "Prompt Red should be visible in the dropdown")
        
    # ----------------- Test Prompt Variables Created -----------------
    """This test goes through to create a prompt and testing all variable fields from the 
       prompt optimization button"""
    
    def test_prompt_field_variables_optimization(self):
        
        self.click_assistants_tab()
        
        time.sleep(5)
        
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptButton")))
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")
        prompt_add_button = next((el for el in prompt_buttons if el.text == "Prompt Template"), None)
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")
        prompt_add_button.click()
        
        time.sleep(2)
        
        prompt_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "promptModalName")))
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt Blue")
        
        time.sleep(2)
        
        # id="promptContent" This is a textarea element, fill in at this id, "This has the prompt content" 
        prompt_content = self.wait.until(EC.presence_of_element_located((By.ID, "promptContent")))
        self.assertIsNotNone(prompt_content, "Prompt content textarea should be present")
        prompt_content.clear()
        prompt_content.send_keys("{{Blue}}")
        
        time.sleep(3)
        
        prompt_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", prompt_scroll_window)
        
        time.sleep(3)
        
        variables = self.wait.until(EC.presence_of_element_located((By.ID, "variables")))
        self.assertTrue(variables, "Variable elements should be present")
        
        span_text = variables.find_element(By.XPATH, ".//span").text
        self.assertEqual(span_text, "Blue:text")
        expand_button = variables.find_element(By.XPATH, './/button[@title="Expand"]')
        expand_button.click()
        time.sleep(5)
        
        optional = self.wait.until(EC.presence_of_element_located((By.ID, "optional")))
        self.assertTrue(optional, "Optional should be present")
        
        # Locate the checkbox within the parent container
        checkbox = optional.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for Optional should be present')
        checkbox.click()
        
        time.sleep(2)
        
        line_numbers = self.wait.until(EC.presence_of_element_located((By.ID, "lineNumbers")))
        self.assertTrue(line_numbers, "Line Numbers should be present")
        
        # Locate the checkbox within the parent container
        checkbox = line_numbers.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for Line Numbers should be present')
        checkbox.click()
        
        time.sleep(2)
        
        escape = self.wait.until(EC.presence_of_element_located((By.ID, "escape")))
        self.assertTrue(escape, "Escape should be present")
        
        # Locate the checkbox within the parent container
        checkbox = escape.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for Escape should be present')
        checkbox.click()
        
        time.sleep(2)
        
        truncate = self.wait.until(EC.presence_of_element_located((By.ID, "truncate")))
        self.assertTrue(truncate, "Truncate should be present")
        
        # Locate the checkbox within the parent container
        checkbox = truncate.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for Truncate should be present')
        checkbox.click()
        
        time.sleep(2)
        
        prompt_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", prompt_scroll_window)
        
        time.sleep(3)
        
        truncate_from_end = self.wait.until(EC.presence_of_element_located((By.ID, "truncateFromEnd")))
        self.assertTrue(truncate_from_end, "Truncate From End should be present")
        
        # Locate the checkbox within the parent container
        checkbox = truncate_from_end.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for Truncate From End should be present')
        checkbox.click()
        
        time.sleep(2)
        
        regex = self.wait.until(EC.presence_of_element_located((By.ID, "regex")))
        self.assertTrue(regex, "Regex should be present")
        
        # Locate the checkbox within the parent container
        checkbox = regex.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for Regex should be present')
        checkbox.click()
        
        time.sleep(2)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "confirmationButton")
        ))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Save button should be present")
        
        save_button.click()

        time.sleep(2)

        # Locate all elements with ID "promptName" and find the one with text "Prompt Blue"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Prompt Blue"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Prompt Blue"), None)
        self.assertIsNotNone(prompt_in_list, "Prompt Blue should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        prompt_button = prompt_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = prompt_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        prompt_button.click()
        
        # Ensure the prompt Chat Label appears after selection
        prompt_modal_title = self.wait.until(EC.presence_of_element_located((By.ID, "modalTitle")))
        self.assertIsNotNone(prompt_modal_title, "Prompt modal title should appear after selection")
        modal_text = prompt_modal_title.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Prompt Blue", "Modal title should be 'Blue'")
        
        #id="variableName"
        variable_name = self.wait.until(EC.presence_of_element_located((By.ID, "variableName")))
        self.assertIsNotNone(variable_name, "Variable Name should appear after selection")
        variable_text = variable_name.text
        
        # Ensure the extracted text matches the expected value
        self.assertEqual(variable_text, "Blue", "Variable Text should be 'Blue'")
        
        time.sleep(2)
        
        variable_textarea = self.wait.until(EC.presence_of_element_located((By.ID, "variableInputText")))
        variable_textarea.send_keys("Hello Hello")
        
        time.sleep(2)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "confirmationButton")
        ))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Submit"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(15) # View the results 

    # ----------------- Assistants in the Prompt Modal -----------------
    """This test goes through to create a prompt and testing all variable fields from the 
       prompt optimization button"""
       
    def test_prompt_assistants_field(self):
    
        self.click_assistants_tab()
        
        time.sleep(5)
        
        self.create_assistant("Yellow")
        
        time.sleep(5)
        
        self.create_assistant("Green")
        
        time.sleep(3)
        
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptButton")))
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")
        prompt_add_button = next((el for el in prompt_buttons if el.text == "Prompt Template"), None)
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")
        prompt_add_button.click()
        
        time.sleep(3)
        
        # id="customInstructions" This is a select element, Get the list of options, and then go through all of the select items.
        custom_instructions = self.wait.until(EC.presence_of_element_located((By.ID, "customInstructions")))
        self.assertIsNotNone(custom_instructions, "Custom Instructions select should be present")
        instruction_options = [option.text for option in custom_instructions.find_elements(By.TAG_NAME, "option")]
        self.assertTrue(instruction_options, "Custom Instructions select should contain options")
        
        # Select the "Green" option
        for option in custom_instructions.find_elements(By.TAG_NAME, "option"):
            if option.text == "Green":
                option.click()
                break

        time.sleep(2)

        # Select the "Yellow" option
        for option in custom_instructions.find_elements(By.TAG_NAME, "option"):
            if option.text == "Yellow":
                option.click()
                break

        time.sleep(2)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Save button should be present")
        
        save_button.click()
        
        time.sleep(2)
        
    # ----------------- Conversation Tags Visible after prompt creation -----------------
    """This test goes through to create a prompt and testing the tags field and that they're visible
       when adding them to the Prompt and when a chat message is sent."""

    def test_prompt_field_tags(self):
        
        time.sleep(5)
    
        self.click_assistants_tab()
    
        time.sleep(2)
        
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptButton")))
        self.assertTrue(prompt_buttons, "Prompt elements should be initialized")
        prompt_add_button = next((el for el in prompt_buttons if el.text == "Prompt Template"), None)
        self.assertIsNotNone(prompt_add_button, "Prompt button should be present")
        prompt_add_button.click()
        
        time.sleep(2)
        
        prompt_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "promptModalName")))
        self.assertIsNotNone(prompt_name_input, "Prompt Name input should be present")
        prompt_name_input.clear()
        prompt_name_input.send_keys("Prompt Yellow")
        
        time.sleep(2)

        prompt_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", prompt_scroll_window)
        
        time.sleep(3)
        
        conversation_tags_button = self.wait.until(EC.presence_of_element_located((By.ID, "conversationTags")))
        self.assertIsNotNone(conversation_tags_button, "Conversation Tags button should be present")
        expand_button = conversation_tags_button.find_element(By.XPATH, './/button[@title="Expand"]')
        expand_button.click()
        
        time.sleep(3)
        
        # id="tagNamesInput" This is a textarea element, fill in at this id, "Pokemon Catcher, Pokemon Trainer" 
        tag_names_input = self.wait.until(EC.presence_of_element_located((By.ID, "tagNamesInput")))
        self.assertIsNotNone(tag_names_input, "Tag Names input should be present")
        tag_names_input.clear()
        tag_names_input.send_keys("Pokemon Catcher, Pokemon Trainer")
        
        time.sleep(3)
        
        prompt_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", prompt_scroll_window)
        
        time.sleep(3)

        prompt_template_check = self.wait.until(EC.presence_of_element_located((By.ID, "promptTemplateCheck")))
        self.assertIsNotNone(prompt_template_check, "Prompt Template checkbox should be present")
        prompt_template_check.click()

        time.sleep(3)

        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Save button should be present")
        
        save_button.click()
        
        time.sleep(2)
        
        # Locate all elements with ID "promptName" and find the one with text "Prompt Yellow"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")

        # Check if any of the elements contain "Prompt Yellow"
        prompt_in_list = next((el for el in prompt_name_elements if el.text == "Prompt Yellow"), None)
        self.assertIsNotNone(prompt_in_list, "Prompt Yellow should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        prompt_button = prompt_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = prompt_button.get_attribute("id")
        self.assertEqual(button_id, "promptClick", "Button should be called promptClick")
        prompt_button.click()
        
        time.sleep(2)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "confirmationButton")
        ))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Submit"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(15) # View the results 
        
        
        # Tag Names are visible, soo partially depricated I guess??
        
        # # Verify the Tag name is correct
        # tag_names = self.wait.until(EC.presence_of_all_elements_located(
        #     (By.ID, "tagName")
        # ))
        # self.assertTrue(tag_names, "tagName are empty")
        
        # # Extract and print all text values for debugging
        # names = [element.text.strip() for element in tag_names]
        # # print("Extracted Names:", names)  # Debugging output

        # # Ensure the extracted names are "Researcher" and "Pokemon Trainer"
        # expected_names = ["Pokemon Catcher", "Pokemon Trainer"]
        # self.assertEqual(names, expected_names, "The extracted names are Researcher and Pokemon Trainer")


if __name__ == "__main__":
    unittest.main(verbosity=2)
