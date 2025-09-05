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

class AssistantModalTests(BaseTest):
    
    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)  
 
    # ----------------- Setup Test Data ------------------  
    def create_assistant(self, assistant_name):
        time.sleep(5)
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()
        time.sleep(2)
        
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        time.sleep(2)
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys(assistant_name)
        time.sleep(2)
        
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
        

    def upload_file(self, filename):
        print("Starting upload_file function...")
        if not filename:
            print("Filename is empty or None!")
            return

        file_path = os.path.join(os.path.dirname(__file__), "..", "test_files", filename)
        file_path = os.path.normpath(file_path)
        # print(f"Resolved absolute file path: {file_path}")

        # Ensure the file exists
        if not os.path.exists(file_path):
            print(f"File does NOT exist: {file_path}")
            return
        else:
            print("File exists!")
        
        # print(f"Uploading file: {file_path}")
        
        file_input = self.driver.find_element(By.ID, "__attachFile_assistant_add_assistant")
        self.driver.execute_script("arguments[0].classList.remove('sr-only');", file_input)
        self.driver.execute_script("arguments[0].style.display = 'block';", file_input)
        # print("Sending file to input field...")
        file_input.send_keys(file_path)
        time.sleep(15)
        
        
    def send_message(self, message):
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(EC.presence_of_element_located((By.ID, "messageChatInputText")))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        chat_input_bar.send_keys(message)
        
        time.sleep(2)
        
        # Locate the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located((By.ID, "sendMessage")))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        chat_send_message.click()
        time.sleep(30)
        
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

    # ----------------- Test Assistant Fields -----------------
    """This test goes through to create an Assistant and testing all the fields"""
    
    def test_assistant_fields(self):
        
        time.sleep(5)
        
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()
        
        time.sleep(3)
        
        self.delete_all_assistants()
        
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        time.sleep(2)
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys("Link")
        
        time.sleep(2)
        
        assistant_description_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantDescription")))
        self.assertIsNotNone(assistant_description_input, "Assistant description input should be present")
        assistant_description_input.send_keys("The Legendary Knight of Hyrule")
        
        time.sleep(2)
        
        assistant_instructions_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantInstructions")))
        self.assertIsNotNone(assistant_instructions_input, "Assistant instructions input should be present")
        assistant_instructions_input.send_keys("{{Cool Sword}}")
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(2)
        
        assistant_disclaimer_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantDisclaimer")))
        self.assertIsNotNone(assistant_disclaimer_input, "Assistant disclaimer input should be present")
        assistant_disclaimer_input.send_keys("He has a house... woah")
        
        time.sleep(2)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(10)
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Assistants"
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Assistants"), None)
        self.assertIsNotNone(assistant_dropdown_button, "Assistants button should be present")

        parent_button = assistant_dropdown_button.find_element(By.XPATH, "./ancestor::button")
        button_title = parent_button.get_attribute("title")
        if button_title != "Collapse folder":
            assistant_dropdown_button.click()
        
        time.sleep(3)
        
        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "assistantName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Find the correct assistant in the dropdown list
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Link"), None)
        self.assertIsNotNone(assistant_in_list, "Link should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(button_id, "assistantClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()
        
        # Locate and click the "Edit" button
        edit_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "editTemplate")
        ))
        self.assertIsNotNone(edit_button, "Edit button should be initialized and clicked")
        edit_button.click()
        
        time.sleep(5)
        
        # Verify the values in the reopened modal
        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput"))).get_attribute("value"),
            "Link",
            "Assistant Name should match the input value"
        )

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantDescription"))).get_attribute("value"),
            "The Legendary Knight of Hyrule",
            "Assistant Description should match the input value"
        )

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantInstructions"))).get_attribute("value"),
            "{{Cool Sword}}",
            "Assistant Instructions should match the input value"
        )
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantDisclaimer"))).get_attribute("value"),
            "He has a house... woah",
            "Assistant Disclaimer should match the input value"
        )

    # ----------------- Test Assistant Auto Populate -----------------
    """This test goes through to create an Assistant and then create another one that utilizes the
       autopopulate functionality"""
    
    def test_assistant_fields_auto(self):
    
        time.sleep(5)
        
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()
        
        time.sleep(3)
        
        self.delete_all_assistants()
        
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        time.sleep(2)
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys("Zelda")
        
        time.sleep(2)
        
        assistant_description_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantDescription")))
        self.assertIsNotNone(assistant_description_input, "Assistant description input should be present")
        assistant_description_input.send_keys("The Legendary Princess of Hyrule")
        
        time.sleep(2)
        
        assistant_instructions_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantInstructions")))
        self.assertIsNotNone(assistant_instructions_input, "Assistant instructions input should be present")
        assistant_instructions_input.send_keys("{{Cool Sheikah Slate}}")
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(2)
        
        assistant_disclaimer_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantDisclaimer")))
        self.assertIsNotNone(assistant_disclaimer_input, "Assistant disclaimer input should be present")
        assistant_disclaimer_input.send_keys("She got a frog... woah")
        
        time.sleep(2)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(10)
        
        self.create_assistant("Jingle")
        
        time.sleep(10)
        
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        time.sleep(2)
        
        # id="autoPopulateSelect" This is a select element, Get the list of options, and then go through all of the select items.
        auto_populate_select = self.wait.until(EC.presence_of_element_located((By.ID, "autoPopulateSelect")))
        self.assertIsNotNone(auto_populate_select, "Auto Populate Select select should be present")
        auto_options = [option.text for option in auto_populate_select.find_elements(By.TAG_NAME, "option")]
        self.assertTrue(auto_options, "Auto Populate Select select should contain options")
        
        # Select the "Zelda" option
        for option in auto_populate_select.find_elements(By.TAG_NAME, "option"):
            if option.text == "Zelda":
                option.click()
                break

        time.sleep(2)
        
        # id="fillInTemplateButton"
        
        auto_populate_button = self.wait.until(EC.element_to_be_clickable((By.ID, "fillInTemplateButton")))
        self.assertIsNotNone(auto_populate_button, "Auto Populate Confirm button should be initialized and clickable")
        auto_populate_button.click()
        
        time.sleep(2)
        
        # Verify the values in the reopened modal
        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput"))).get_attribute("value"),
            "Zelda (Copy)",
            "Assistant Name should match the input value"
        )

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantDescription"))).get_attribute("value"),
            "The Legendary Princess of Hyrule",
            "Assistant Description should match the input value"
        )

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantInstructions"))).get_attribute("value"),
            "{{Cool Sheikah Slate}}",
            "Assistant Instructions should match the input value"
        )
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantDisclaimer"))).get_attribute("value"),
            "She got a frog... woah",
            "Assistant Disclaimer should match the input value"
        )
    
    # ----------------- Test Assistant Advanced Fields -----------------
    """This test goes through to create an Assistant and testing all the fields, including the Advanced ones"""
    
    def test_assistant_advanced_fields(self):
        
        time.sleep(5)
        
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()
        
        time.sleep(3)
        
        self.delete_all_assistants()
        
        time.sleep(3)
        
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        time.sleep(2)
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys("Daruk")
        
        time.sleep(2)
        
        assistant_description_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantDescription")))
        self.assertIsNotNone(assistant_description_input, "Assistant description input should be present")
        assistant_description_input.send_keys("The Legendary Goron of Hyrule")
        
        time.sleep(2)
        
        assistant_instructions_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantInstructions")))
        self.assertIsNotNone(assistant_instructions_input, "Assistant instructions input should be present")
        assistant_instructions_input.send_keys("{{Cool Rhadania}}")
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(2)
        
        assistant_disclaimer_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantDisclaimer")))
        self.assertIsNotNone(assistant_disclaimer_input, "Assistant disclaimer input should be present")
        assistant_disclaimer_input.send_keys("Woah... Daruk's protection")
        
        time.sleep(2)
        
        advanced_button = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent")))
        self.assertIsNotNone(advanced_button, "Advanced Button should be present")
        advanced_button.click()
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(2)
        
        allow_request = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='allowRequestAccess']")))
        allow_request.click()
        
        time.sleep(2)
        
        include_message_ids_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='messageOptionFlags-includeMessageIds']")))
        include_message_ids_label.click()
        
        time.sleep(2)
        
        include_user_line_numbers_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='messageOptionFlags-includeUserLineNumbers']")))
        include_user_line_numbers_label.click()
        
        time.sleep(2)
        
        include_assistant_line_numbers_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='messageOptionFlags-includeAssistantLineNumbers']")))
        include_assistant_line_numbers_label.click()
        
        time.sleep(2)
        
        tag_input = self.wait.until(EC.presence_of_element_located((By.ID, "tagInput")))
        self.assertIsNotNone(tag_input, "Tag input should be present")
        tag_input.send_keys("Goron Champion, Stonebreak Swinger") 
        
        time.sleep(2)
        
        conversation_tag_input = self.wait.until(EC.presence_of_element_located((By.ID, "conversationTagInput")))
        self.assertIsNotNone(conversation_tag_input, "Conversation tag input should be present")
        conversation_tag_input.send_keys("Goron, Chief")
        
        time.sleep(2)
        
        # id="baseAssistantWorkflowTemplateAdd"
        base_assistant_workflow_template_add = self.wait.until(EC.presence_of_element_located((By.ID, "conversationTagInput")))
        self.assertIsNotNone(base_assistant_workflow_template_add, "Base assistant Workflow Template Add should be present")
        
        email_check = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='emailEvents']")))
        self.assertIsNotNone(email_check, "Submit button should be present")
        
        time.sleep(2)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(10)
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Assistants"
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Assistants"), None)
        self.assertIsNotNone(assistant_dropdown_button, "Assistants button should be present")

        # Click to open the dropdown
        parent_button = assistant_dropdown_button.find_element(By.XPATH, "./ancestor::button")
        button_title = parent_button.get_attribute("title")
        if button_title != "Collapse folder":
            assistant_dropdown_button.click()
            
        time.sleep(2)
        
        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "assistantName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Find the correct assistant in the dropdown list
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Daruk"), None)
        self.assertIsNotNone(assistant_in_list, "Daruk should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(button_id, "assistantClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()
        
        # Locate and click the "Edit" button
        edit_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "editTemplate")
        ))
        self.assertIsNotNone(edit_button, "Edit button should be initialized and clicked")
        edit_button.click()
        
        time.sleep(2)
        
        # Verify the values in the reopened modal
        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput"))).get_attribute("value"),
            "Daruk",
            "Assistant Name should match the input value"
        )

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantDescription"))).get_attribute("value"),
            "The Legendary Goron of Hyrule",
            "Assistant Description should match the input value"
        )

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantInstructions"))).get_attribute("value"),
            "{{Cool Rhadania}}",
            "Assistant Instructions should match the input value"
        )

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "assistantDisclaimer"))).get_attribute("value"),
            "Woah... Daruk's protection",
            "Assistant Disclaimer should match the input value"
        )
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(2)
        
        advanced_button = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent")))
        self.assertIsNotNone(advanced_button, "Advanced Button should be present")
        advanced_button.click()

        allow_request_checked = self.wait.until(EC.presence_of_element_located((By.ID, "allowRequestAccess")))
        self.assertTrue(allow_request_checked.is_selected(), "Include Message IDs checkbox should remain checked")
        
        include_message_ids_checked = self.wait.until(EC.presence_of_element_located((By.ID, "messageOptionFlags-includeMessageIds")))
        self.assertTrue(include_message_ids_checked.is_selected(), "Include Message IDs checkbox should remain checked")
        
        include_user_line_numbers_checked = self.wait.until(EC.presence_of_element_located((By.ID, "messageOptionFlags-includeUserLineNumbers")))
        self.assertTrue(include_user_line_numbers_checked.is_selected(), "Include User Line Numbers checkbox should remain checked")
        
        include_assistant_line_numbers_checked = self.wait.until(EC.presence_of_element_located((By.ID, "messageOptionFlags-includeAssistantLineNumbers")))
        self.assertTrue(include_assistant_line_numbers_checked.is_selected(), "Include Assistant Line Numbers checkbox should remain checked")

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "tagInput"))).get_attribute("value"),
            "Goron Champion,Stonebreak Swinger",
            "Assistant Tag should match the input value"
        )

        self.assertEqual(
            self.wait.until(EC.presence_of_element_located((By.ID, "conversationTagInput"))).get_attribute("value"),
            "Goron,Chief",
            "Assistant Conversation Tag should match the input value"
        )

    # ----------------- Test Assistant Data Source Options -----------------
    """This test goes through to create an Assistant and testing the Data Source Options in the Advanced Settings"""     
        
    def test_assistant_data_source_options(self):
        
        time.sleep(5)
        
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()
        
        time.sleep(3)
        
        self.delete_all_assistants()
        
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        time.sleep(2)
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys("Urbosa")
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(2)
        
        advanced_button = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent")))
        self.assertIsNotNone(advanced_button, "Advanced Button should be present")
        advanced_button.click()
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(2)
        
        manage_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertTrue(manage_buttons, "Manage Button elements should be initialized")
        manage_buttons[1].click()
        
        time.sleep(2)
        
        include_download_links_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='dataSourceFlags-includeDownloadLinks']")))
        include_download_links_label.click()

        time.sleep(2)

        rag_attached_documents_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='dataSourceFlags-ragAttachedDocuments']")))
        rag_attached_documents_label.click()

        time.sleep(2)

        insert_attached_documents_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='dataSourceFlags-insertAttachedDocuments']")))
        insert_attached_documents_label.click()
        time.sleep(1)
        insert_attached_documents_label.click()

        time.sleep(2)

        rag_conversation_documents_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='dataSourceFlags-ragConversationDocuments']")))
        rag_conversation_documents_label.click()
        time.sleep(1)
        rag_conversation_documents_label.click()

        time.sleep(2)

        insert_conversation_documents_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='dataSourceFlags-insertConversationDocuments']")))
        insert_conversation_documents_label.click()

        time.sleep(2)

        insert_attached_documents_metadata_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='dataSourceFlags-insertAttachedDocumentsMetadata']")))
        insert_attached_documents_metadata_label.click()

        time.sleep(2)

        insert_conversation_documents_metadata_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='dataSourceFlags-insertConversationDocumentsMetadata']")))
        insert_conversation_documents_metadata_label.click()

        time.sleep(2)

        disable_data_sources_label = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "label[for='dataSourceFlags-disableDataSources']")))
        disable_data_sources_label.click()
        
        time.sleep(2)
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(10)
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Assistants"
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Assistants"), None)
        self.assertIsNotNone(assistant_dropdown_button, "Assistants button should be present")

        # Click to open the dropdown
        parent_button = assistant_dropdown_button.find_element(By.XPATH, "./ancestor::button")
        button_title = parent_button.get_attribute("title")
        if button_title != "Collapse folder":
            assistant_dropdown_button.click()
            
        time.sleep(2)
        
        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "assistantName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Find the correct assistant in the dropdown list
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Urbosa"), None)
        self.assertIsNotNone(assistant_in_list, "Urbosa should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(button_id, "assistantClick", "Button should be called promptClick")
        
        action = ActionChains(self.driver)
        action.move_to_element(assistant_button).perform()
        
        # Locate and click the "Edit" button
        edit_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "editTemplate")
        ))
        self.assertIsNotNone(edit_button, "Edit button should be initialized and clicked")
        edit_button.click()
        
        time.sleep(2)
        
        advanced_button = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent")))
        self.assertIsNotNone(advanced_button, "Advanced Button should be present")
        advanced_button.click()
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(2)
        
        manage_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertTrue(manage_buttons, "Manage Button elements should be initialized")
        manage_buttons[1].click()
        
        time.sleep(2)
        
        include_download_links_label_checked = self.wait.until(EC.presence_of_element_located((By.ID, "dataSourceFlags-includeDownloadLinks")))
        self.assertTrue(include_download_links_label_checked.is_selected(), "Include Message Download Links checkbox should remain checked")

        rag_attached_documents_label_checked = self.wait.until(EC.presence_of_element_located((By.ID, "dataSourceFlags-ragAttachedDocuments")))
        self.assertTrue(rag_attached_documents_label_checked.is_selected(), "Rag Attached Documents checkbox should remain checked")

        insert_attached_documents_label_checked = self.wait.until(EC.presence_of_element_located((By.ID, "dataSourceFlags-insertAttachedDocuments")))
        self.assertTrue(insert_attached_documents_label_checked.is_selected(), "Insert Attached Documents checkbox should remain checked")

        rag_conversation_documents_label_checked = self.wait.until(EC.presence_of_element_located((By.ID, "dataSourceFlags-ragConversationDocuments")))
        self.assertTrue(rag_conversation_documents_label_checked.is_selected(), "Rag Conversation Documents checkbox should remain checked")

        insert_conversation_documents_label_checked = self.wait.until(EC.presence_of_element_located((By.ID, "dataSourceFlags-insertConversationDocuments")))
        self.assertTrue(insert_conversation_documents_label_checked.is_selected(), "Insert Conversation Documents checkbox should remain checked")

        insert_attached_documents_metadata_label_checked = self.wait.until(EC.presence_of_element_located((By.ID, "dataSourceFlags-insertAttachedDocumentsMetadata")))
        self.assertTrue(insert_attached_documents_metadata_label_checked.is_selected(), "Insert Attached Documents Metadata checkbox should remain checked")

        insert_conversation_documents_metadata_label_checked = self.wait.until(EC.presence_of_element_located((By.ID, "dataSourceFlags-insertConversationDocumentsMetadata")))
        self.assertTrue(insert_conversation_documents_metadata_label_checked.is_selected(), "Insert Conversation Documents Metadata checkbox should remain checked")
        
    # ----------------- Test Assistant Document and Sources -----------------
    """This test goes through to create an Assistant and test an added document makes the sources appear""" 
    
    def test_assistant_document_and_sources(self):
        
        time.sleep(5)
        
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()
        
        time.sleep(3)
        
        self.delete_all_assistants()
        
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        time.sleep(2)
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys("Mipha")
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(2)
        
        # id="assistantViewFile"
        assistant_view_file = self.wait.until(EC.element_to_be_clickable((By.ID, "assistantViewFile")))
        self.assertIsNotNone(assistant_view_file, "Click View file button should be initialized and clickable")
        assistant_view_file.click()
        
        time.sleep(2) # View interactable file manager
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(5)
        
        assistant_view_file = self.wait.until(EC.element_to_be_clickable((By.ID, "assistantViewFile")))
        self.assertIsNotNone(assistant_view_file, "Click View file button should be initialized and clickable")
        assistant_view_file.click()
        
        time.sleep(2)
        
        self.upload_file("Test_3.txt")
        
        # Locate and click the Save button
        confirmation_button = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        self.assertTrue(confirmation_button, "Drop name elements should be initialized")
        
        save_button = next((el for el in confirmation_button if el.text == "Save"), None)
        self.assertIsNotNone(save_button, "Submit button should be present")
        
        save_button.click()
        
        time.sleep(10)
        
        # Locate all elements with the ID 'dropName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "dropName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        # Find the element with text "Assistants"
        assistant_dropdown_button = next((el for el in drop_name_elements if el.text == "Assistants"), None)
        self.assertIsNotNone(assistant_dropdown_button, "Assistants button should be present")

        # Click to open the dropdown
        parent_button = assistant_dropdown_button.find_element(By.XPATH, "./ancestor::button")
        button_title = parent_button.get_attribute("title")
        if button_title != "Collapse folder":
            assistant_dropdown_button.click()
        
        # Locate all elements with ID "promptName"
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "assistantName")
        ))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Find the correct assistant in the dropdown list
        assistant_in_list = next((el for el in prompt_name_elements if el.text == "Mipha"), None)
        self.assertIsNotNone(assistant_in_list, "Mipha should be visible in the dropdown")
        
        # Ensure the parent button's is visible
        assistant_button = assistant_in_list.find_element(By.XPATH, "./ancestor::button")
        button_id = assistant_button.get_attribute("id")
        self.assertEqual(button_id, "assistantClick", "Button should be called promptClick")
        assistant_button.click()
        
        time.sleep(2)
        
        self.send_message("What document do you have attached and please tell me the contents of said attached document?")

        chat_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "chatScrollWindow")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", chat_scroll_window)
        
        time.sleep(2)
        
        manage_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertTrue(manage_buttons, "Manage Button elements should be initialized")
        manage_buttons[0].click()
        time.sleep(2)
        
        chat_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "chatScrollWindow")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", chat_scroll_window)
        
        time.sleep(2)
        
        manage_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "expandComponent")))
        self.assertTrue(manage_buttons, "Manage Button elements should be initialized")
        manage_buttons[1].click()
        
        time.sleep(2)
        
        chat_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "chatScrollWindow")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", chat_scroll_window)
        
        time.sleep(2)

        # id="sourceName"
        source_name = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sourceName")))
        source_name_text = source_name[0].text
        self.assertEqual(source_name_text, "Test_3.txt", "The text extracted should be Test_3.txt")


if __name__ == "__main__":
    unittest.main(verbosity=2)   