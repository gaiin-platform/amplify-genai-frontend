import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import UnexpectedAlertPresentException
from tests.base_test import BaseTest
from selenium.webdriver.common.keys import Keys


class ActiveAssistantsListTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------ 
    """The following tests already ensure that a path is created and the path used in these
       tests is a predefined path."""
       
    def open_page(self):
        
        time.sleep(8)
        self.driver.get("http://localhost:3000/assistants/mmmm_banana")
        
        time.sleep(12)
        title_element = self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameTitle")))
        title_text = title_element.text
        self.assertEqual(title_text, 'Assistant', "Assistant title should be 'Assistant'")
        # self.assertEqual(title_text, 'Donkey Kong', "Assistant title should be 'Donkey Kong'")
        
    def click_assistants_tab(self):
        time.sleep(5)
        tab_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        assistants_button = next((btn for btn in tab_buttons if "Assistants" in btn.get_attribute("title")), None)
        self.assertIsNotNone(assistants_button, "'Assistants' tab button not found")
        assistants_button.click()
        time.sleep(5)

    # ----------------- Test Publish Assistant Path is visibile -----------------
    """This test goes through to ensure the Publish Assistant Path option is interactable"""
    
    def test_assistant_advanced_fields(self):
        
        self.click_assistants_tab()
        
        time.sleep(3)
        
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        time.sleep(2)
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantNameInput")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys("Donkey Kong 2")
        
        time.sleep(2)
        
        assistant_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "assistantModalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", assistant_scroll_window)
        
        time.sleep(2)
        
        advanced_button = self.wait.until(EC.presence_of_element_located((By.ID, "expandComponent")))
        self.assertIsNotNone(advanced_button, "Advanced Button should be present")
        advanced_button.click()
        
        time.sleep(2)
        
        path_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "pathNameInput")))
        self.assertIsNotNone(assistant_name_input, "Path Name input should be present")
        path_name_input.clear()
        time.sleep(2)
        path_name_input.send_keys("mmmm_banana_2")
        
        publish_to_users_check = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='publish-to-all-users']")))
        self.assertIsNotNone(publish_to_users_check, "Publish to all users check should be present")
        
        time.sleep(2) # Wait for the path to be created and check for availability of path
        
        allow_request_access = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='allowRequestAccess']")))
        self.assertIsNotNone(allow_request_access, "Allow request access check should be present")
        allow_request_access.click()
        time.sleep(2)
        allow_request_access.click()
        
        time.sleep(15)
        
        path_available = self.wait.until(EC.presence_of_element_located((By.ID, "pathAvailable")))
        self.assertIsNotNone(path_available, "Path Available should be present")
        
        time.sleep(2)
        
        path_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "pathNameInput")))
        self.assertIsNotNone(assistant_name_input, "Path Name input should be present")
        time.sleep(2)
        path_name_input.clear()
        time.sleep(2)
        path_name_input.send_keys("mmmm_banana")
        
        time.sleep(2)
        
        allow_request_access = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='allowRequestAccess']")))
        self.assertIsNotNone(allow_request_access, "Allow request access check should be present")
        allow_request_access.click()
        time.sleep(2)
        allow_request_access.click()
        
        time.sleep(15)
        
        path_error = self.wait.until(EC.presence_of_element_located((By.ID, "pathError")))
        self.assertIsNotNone(path_error, "Path Error should be present")
        
    # ----------------- Test an Existing Assistant page can be opened -----------------
    """Test that an existing Assistants page can be opened.
       The following page is: 'http://localhost:3000/assistants/mmmm_banana' """
    
    def test_open_existing_page(self):
        
        time.sleep(8)  # After login, wait on the starting page

        # Navigate to the existing Assistant page
        self.driver.get("http://localhost:3000/assistants/mmmm_banana")
        
        time.sleep(12)  # Wait for new page to load

        # Extract the title text via id="assistantNameTitle"
        title_element = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantNameTitle"))
        )
        title_text = title_element.text

        # Make sure the extracted text is equal to 'Donkey Kong'
        # self.assertEqual(title_text, 'Donkey Kong', "Assistant title should be 'Donkey Kong'")
        self.assertEqual(title_text, 'Assistant', "Assistant title should be 'Assistant'")
        
    # ----------------- Test Model can be changed -----------------
    """Test that an the model select can be changed """
    
    def test_model_change(self):
        
        self.open_page()
        
        # List of all model IDs to test
        model_ids = [
            "us.amazon.nova-premier-v1:0", "o1", "mistral.mistral-large-2402-v1:0", "gemini-2.0-flash",
            "o1-mini", "us.anthropic.claude-3-5-haiku-20241022-v1:0", "anthropic.claude-3-haiku-20240307-v1:0",
            "amazon.nova-pro-v1:0", "us.deepseek.r1-v1:0", "anthropic.claude-3-sonnet-20240229-v1:0",
            "o1-preview", "mistral.mistral-7b-instruct-v0:2", "gpt-4.1-mini",
            "us.anthropic.claude-3-7-sonnet-20250219-v1:0", "gemini-2.5-pro-preview-03-25",
            "mistral.mixtral-8x7b-instruct-v0:1", "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
            "amazon.nova-lite-v1:0", "us.anthropic.claude-3-opus-20240229-v1:0", "gpt-4o",
            "gpt-4o-mini", "anthropic.claude-3-5-sonnet-20240620-v1:0", "o3-mini",
            "us.meta.llama3-2-90b-instruct-v1:0"
        ]

        for model_id in model_ids:
            # Open the model dropdown
            model_select = self.wait.until(EC.element_to_be_clickable((By.ID, "modelSelect")))
            model_select.click()
            
            # Wait for the model list to appear
            self.wait.until(EC.presence_of_element_located((By.ID, "modelList")))
            time.sleep(1)
            
            try:
                # Click the model
                model_option = self.wait.until(EC.element_to_be_clickable((By.ID, model_id)))
                model_option.click()
                time.sleep(2)
            except Exception as e:
                self.fail(f"Failed to select model with ID: {model_id} due to: {e}")

    # ----------------- Test Misc Features -----------------
    """Test that the Hide settings button works, the description appears when hovering the title,
       and the legend appears when hovering it."""
    
    def test_misc_features(self):
        
        self.open_page()
        
        # Hover the legend info button
        legend_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "legendHover"))
        )
        self.assertTrue(legend_hover.is_displayed(), "The Legend pin is visible")
        
        action = ActionChains(self.driver)
        action.move_to_element(legend_hover).perform()
        
        time.sleep(2)

        legend = self.wait.until(
            EC.presence_of_element_located((By.ID, "modelLegend"))
        )
        self.assertTrue(legend.is_displayed(), "The Legend is visible")
        
        time.sleep(2)
        
        # Hover the Assistant Page title
        assistant_name_title = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantNameTitle"))
        )
        self.assertTrue(assistant_name_title.is_displayed(), "The assistant page title is visible")
        
        # Hover over the "Going Merry" button to make the "Pin" button visible        
        action = ActionChains(self.driver)
        action.move_to_element(assistant_name_title).perform()
        
        time.sleep(2)
        
        description_box = self.wait.until(
            EC.presence_of_element_located((By.ID, "hoverIDDescriptionBlock"))
        )
        self.assertTrue(description_box.is_displayed(), "The description box is visible")
        
        time.sleep(2)
        
        hide_settings = self.wait.until(
            EC.element_to_be_clickable((By.ID, "hideSettings"))
        )
        self.assertTrue(hide_settings.is_displayed(), "The hide settings button is clickable")
        hide_settings.click()
        
        time.sleep(2)
        
        legend_hover = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "legendHover"))
        )
        self.assertTrue(legend_hover, "The Legend pin is not visible")
        
        time.sleep(2)
        
        hide_settings = self.wait.until(
            EC.element_to_be_clickable((By.ID, "hideSettings"))
        )
        self.assertTrue(hide_settings.is_displayed(), "The hide settings button is clickable")
        hide_settings.click()
        
        time.sleep(2)
        
        legend_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "legendHover"))
        )
        self.assertTrue(legend_hover, "The Legend pin is visible")
        
    # ----------------- Test Single Chat -----------------
    """Test sending a single chat message and the functionality of the Assistant Page"""
    
    def test_single_chat(self):
        
        self.open_page()
        
        # Send a chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("OOOOOHH BANANA")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage0"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage1"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage1"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
    # ----------------- Test Multiple Chat -----------------
    """Test sending a multiple chat messages and the functionality of the Assistant Page"""
    
    def test_multiple_chat(self):
        
        self.open_page()
        
        # Send a chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("OOOOOHH BANANA NANA")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage0"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage1"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage1"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
        # Send a second chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("*Diddy Kong dances with Boombox in hand*")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage2"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage2"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage3"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage3"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
    # ----------------- Test Copy User Chat Message -----------------
    """Test copy user chat messages"""
    
    def test_copy_user_chat(self):
        
        self.open_page()
        
        # Send a chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("OOOOOHH BANANA NANA")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage0"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage1"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage1"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
        # id="copy-message-0"
        copy_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "copy-message-0"))
        )
        self.assertTrue(user_message, "The first user message can be copied with the copy button")
        copy_message.click()

        time.sleep(1)

        # Send copied chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()

        # Try pasting with COMMAND (for Mac), fallback to CONTROL (for Windows/Linux)
        try:
            assistant_chat_input_field.send_keys(Keys.COMMAND, "v")  # Mac paste
        except Exception:
            assistant_chat_input_field.send_keys(Keys.CONTROL, "v")  # Windows/Linux paste

        time.sleep(1)  # Wait for paste to complete

        # Get the pasted text
        copied_text = assistant_chat_input_field.get_attribute("value")

        # Assert copied text matches changed message
        self.assertEqual(
            "OOOOOHH BANANA NANA", copied_text, "Copied text does not match changed message."
        )
        
    # ----------------- Test Edit User Chat Message -----------------
    """Test edit user chat messages"""
    
    def test_edit_user_chat(self):
        
        self.open_page()
        
        # Send a chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("OOOOOHH BANANA NANA")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage0"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage1"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage1"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
        # id="edit-message-0"
        edit_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "edit-message-0"))
        )
        self.assertTrue(user_message, "The first user message can be editted with the edit button")
        edit_message.click()

        time.sleep(2)
        
        edit_user_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "editUserMessage"))
        )
        edit_user_input_field.clear()
        edit_user_input_field.send_keys("OOOOOHH BA NAH NAAAAH NAH... NAH NAH NAAAAAH NAH... HEY HEY HEY... GOODBYYEEE")
        
        time.sleep(2)
        
        cancel_edit_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "cancelEdit"))
        )
        self.assertTrue(cancel_edit_message, "The first user message can be editted with the edit button")
        
        save_edit_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "saveEdit"))
        )
        self.assertTrue(save_edit_message, "The first user message can be editted with the edit button")
        save_edit_message.click()
        
        time.sleep(20)
        
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        editted_text = user_message.text
        
        # Assert copied text matches changed message
        self.assertEqual(
            "OOOOOHH BA NAH NAAAAH NAH... NAH NAH NAAAAAH NAH... HEY HEY HEY... GOODBYYEEE", editted_text, "Copied text does not match changed message."
        )
        
    # ----------------- Test Delete User Chat Message -----------------
    """Test delete user chat messages"""
    
    def test_delete_user_chat(self):
        
        self.open_page()
        
        # Send a chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("OOOOOHH BANANA NANA")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage0"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage1"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage1"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
        # id="delete-message-0"
        delete_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "delete-message-0"))
        )
        self.assertTrue(user_message, "The first user message can be deleted with the delete button")
        delete_message.click()

        time.sleep(2)
        
        user_message = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is not present in the chat")
        
        assistant_message = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "assistantMessage1"))
        )
        self.assertTrue(assistant_message, "The first assistant message is not present in the chat")

    # ----------------- Test Multiple Delete User Chat Message -----------------
    """Test delete one of multiple user chat messages"""
    
    def test_delete_multiple_user_chat(self):
        
        self.open_page()
        
        # Send a chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("OOOOOHH BANANA NANA")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage0"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage1"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage1"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
        # Send a second chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("*Diddy Kong dances with Boombox in hand*")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage2"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage2"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage3"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage3"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
        time.sleep(2)
        
        # id="delete-message-2"
        delete_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "delete-message-2"))
        )
        self.assertTrue(user_message, "The second user message can be deleted with the delete button")
        delete_message.click()

        time.sleep(2)
        
        user_message = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "userMessage2"))
        )
        self.assertTrue(user_message, "The second user message is not present in the chat")
        
        assistant_message = self.wait.until(
            EC.invisibility_of_element_located((By.ID, "assistantMessage3"))
        )
        self.assertTrue(assistant_message, "The second assistant message is not present in the chat")
        
    # ----------------- Test Copy Response Chat Message -----------------
    """Test copy the response chat message"""
    
    def test_copy_response_chat(self):
        
        self.open_page()
        
        # Send a chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("OOOOOHH BANANA NANA")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage0"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage1"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage1"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
        assistant_text = assistant_message.get_attribute("data-original-content")
        
        time.sleep(1)
        
        # id="copy-message-1"
        copy_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "copy-message-1"))
        )
        self.assertTrue(user_message, "The first response can be copied with the copy button")
        copy_message.click()

        time.sleep(2)
        
        # Send copied chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()

        # Try pasting with COMMAND (for Mac), fallback to CONTROL (for Windows/Linux)
        try:
            assistant_chat_input_field.send_keys(Keys.COMMAND, "v")  # Mac paste
        except Exception:
            assistant_chat_input_field.send_keys(Keys.CONTROL, "v")  # Windows/Linux paste

        time.sleep(2)  # Wait for paste to complete

        # Get the pasted text
        copied_text = assistant_chat_input_field.get_attribute("value")
        
        # Assert copied text matches changed message
        self.assertEqual(
            assistant_text, copied_text, "Copied text does not match changed message."
        )
        
    # ----------------- Test Download Response as file -----------------
    """Test download the response chat message"""
    
    def test_download_response_chat(self):
        
        self.open_page()
        
        # Send a chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("OOOOOHH BANANA NANA")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage0"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage1"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage1"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
        time.sleep(1)
        
        # id="download-message-1"
        download_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "download-message-1"))
        )
        self.assertTrue(download_message, "The first response can be downloaded with the download button")
        download_message.click()

        time.sleep(5) # View downloaded
        
    # ----------------- Test Email Response as file -----------------
    """Test email the response chat message"""
    
    def test_email_response_chat(self):
        
        self.open_page()
        
        # Send a chat in the message bar
        assistant_chat_input_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantChatInput"))
        )
        assistant_chat_input_field.clear()
        assistant_chat_input_field.send_keys("OOOOOHH BANANA NANA")
        
        time.sleep(2)
        
        send_message = self.wait.until(
            EC.element_to_be_clickable((By.ID, "sendMessageButton"))
        )
        self.assertTrue(send_message, "The send message button is clickable and clicked")
        send_message.click()
        
        time.sleep(20) # process message
        
        # id="userMessage0"
        user_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "userMessage0"))
        )
        self.assertTrue(user_message, "The first user message is present in the chat")
        
        # id="assistantMessage1"
        assistant_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "assistantMessage1"))
        )
        self.assertTrue(assistant_message, "The first assistant message is present in the chat")
        
        time.sleep(1)
        
        # id="email-message-1"
        email_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "email-message-1"))
        )
        self.assertTrue(email_message, "The first response can be emailed with the email button")
        email_message.click()

        time.sleep(5) # View emailed
    

if __name__ == "__main__":
    unittest.main(verbosity=2)
