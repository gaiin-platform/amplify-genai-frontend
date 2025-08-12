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

class DownloadModalTests(BaseTest):
    
    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)    
        
    # ----------------- Setup Test Data ------------------        
    def create_chat(self, chat_name):
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptButton")))
        self.assertTrue(prompt_buttons, "New Chat elements should be initialized")
        chat_add_button = next((el for el in prompt_buttons if el.text == "New Chat"), None)
        self.assertIsNotNone(chat_add_button, "New Chat button should be present")
        chat_add_button.click()
        
        time.sleep(2)
        
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "chatName")))
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        chats = next((el for el in chat_name_elements if el.text == "New Conversation"), None)
        self.assertIsNotNone(chats, "New Conversation button should be present")
        chat_click = chats.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")
        chat_click.click()

        rename_button = self.wait.until(EC.element_to_be_clickable((By.ID, "isRenaming")))
        self.assertIsNotNone(rename_button, "Rename button should be initialized and clicked")
        rename_button.click()

        rename_field = self.wait.until(EC.presence_of_element_located((By.ID, "isRenamingInput")))
        rename_field.clear()
        rename_field.send_keys(chat_name)
        rename_confirm_button = self.wait.until(EC.element_to_be_clickable((By.ID, "handleConfirm")))
        self.assertIsNotNone(rename_confirm_button, "Rename confirm button should be initialized and clicked")
        rename_confirm_button.click()
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "chatName")))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)
        
        folder = next((el for el in drop_name_elements if el.text == chat_name), None)
        self.assertIsNotNone(folder, "New Conversation button should be present")

    def send_message(self, chat_name, message):
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "chatName")))
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with chat name
        chat = next((el for el in chat_name_elements if el.text == chat_name), None)
        self.assertIsNotNone(chat, "Chat button should be present")
        chat_click = chat.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")
        chat_click.click()
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(EC.presence_of_element_located((By.ID, "messageChatInputText")))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        chat_input_bar.send_keys(message)
        
        time.sleep(2)
        
        # Locate the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located((By.ID, "sendMessage")))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        chat_send_message.click()
        time.sleep(15)   
            
    def delete_all_chats(self):
        prompt_handler_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "promptHandler"))
        )

        prompt_handler_button.click()

        time.sleep(2)

        # Click the button with ID "Delete"
        delete_button = self.wait.until(
            EC.presence_of_element_located((By.ID, "Delete"))
        )

        delete_button.click()

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
        
    def upper_check(self):
        try:
            # Hover over the upper menu to reveal the buttons
            upper_chat_hover = self.wait.until(
                EC.presence_of_element_located((By.ID, "chatUpperMenu"))
            )
            ActionChains(self.driver).move_to_element(upper_chat_hover).perform()
            time.sleep(1)

            # Else find and click the Pin button
            pin_button = self.driver.find_element(By.XPATH, '//button[@title="Pin Chatbar"]')
            pin_button.click()
            print("Pin Chatbar button clicked.")
            time.sleep(2)

        except:
            # Else find and click the Pin button
            unpin_button = self.driver.find_element(By.XPATH, '//button[@title="Unpin Chatbar"]')
            self.assertTrue(unpin_button, "Unpin Button is present")
            time.sleep(2)
            
            
# id="confirmationButton"
# id="optionsGrid"
# id="assistantHeaderText"
# id="userMessageHeaderText"
# id="messageHeaderText"
# id="conversationHeaderText"
# id="includeSelection"
# id="convoNameInclusionSelection"
# id="templateSelection"
# id="formatSelection"

# Go through the download chat template and test every field

    # ----------------- Test Download Chat Modal Fields -----------------
    """This test tests the fields in the Download Chat Modal."""

    def test_download_chat_modal_fields(self):
        
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Kazuya")
        
        # Send a Message
        self.send_message("Kazuya", "Kazuya Mishima... Wins...")
        
        self.upper_check()
        
        time.sleep(2)
        
        upper_chat_download = self.wait.until(EC.presence_of_element_located((By.ID, "downloadUpper")))
        self.assertTrue(upper_chat_download, "Upper Chat Download button should be initialized")
        upper_chat_download.click()
        
        time.sleep(2)
        
        # Scroll up to make sure the slider is in view id="modalScroll"
        download_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = 0;", download_scroll_window)
        
        time.sleep(2)
        
        # Verify the presence of the Window element after clicking the Edit button
        download_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(download_modal_element, "Download window element is visible")
        
        time.sleep(2)
        
        # Extract the text from the element
        modal_text = download_modal_element.text
        
        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")
        
        # id="formatSelection"
        # Verify the presence of the select element
        format_selection = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        self.assertTrue(format_selection, "Format selection dropdown is visible")

        # Verify the presence of "Word" and "PowerPoint" options
        format_options = format_selection.find_elements(By.TAG_NAME, "option")
        format_values = [option.text for option in format_options]
        self.assertIn("Word", format_values, "Word format should be selectable")
        self.assertIn("PowerPoint", format_values, "PowerPoint format should be selectable")

        time.sleep(3)

        # id="templateSelection"
        # Locate the formatSelection div and then find the select element inside it
        format_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        format_selection = Select(format_selection_div.find_element(By.TAG_NAME, "select"))

        # Select "Word" and verify "none" is an option in templateSelection
        format_selection.select_by_visible_text("Word")

        template_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "templateSelection")))
        template_selection = Select(template_selection_div.find_element(By.TAG_NAME, "select"))

        word_template_options = [option.text for option in template_selection.options]
        self.assertIn("none", word_template_options, "None template should be selectable when Word is selected")

        time.sleep(3)

        # Select "PowerPoint" and verify "vapor.pptx" is an option
        format_selection.select_by_visible_text("PowerPoint")

        pptx_template_options = [option.text for option in template_selection.options]
        self.assertIn("vapor.pptx", pptx_template_options, "vapor.pptx template should be selectable when PowerPoint is selected")

        time.sleep(3)

        # id="convoNameInclusionSelection"
        # Verify "Yes" and "No" options are selectable
        convo_name_selection = self.wait.until(EC.presence_of_element_located((By.ID, "convoNameInclusionSelection")))
        convo_options = [option.text for option in convo_name_selection.find_elements(By.TAG_NAME, "option")]
        self.assertIn("Yes", convo_options, "Yes option should be present in convoNameInclusionSelection")
        self.assertIn("No", convo_options, "No option should be present in convoNameInclusionSelection")

        time.sleep(3)

        # id="includeSelection"
        # Verify "Assistant Messages", "User Prompts", and "All Messages & Prompts" options
        include_selection = self.wait.until(EC.presence_of_element_located((By.ID, "includeSelection")))
        include_options = [option.text for option in include_selection.find_elements(By.TAG_NAME, "option")]
        self.assertIn("Assistant Messages", include_options, "Assistant Messages option should be present")
        self.assertIn("User Prompts", include_options, "User Prompts option should be present")
        self.assertIn("All Messages & Prompts", include_options, "All Messages & Prompts option should be present")

        time.sleep(3)

        # id="conversationHeaderText"
        # Enter text into the textarea
        convo_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "conversationHeaderText")))
        convo_header_textarea = convo_header_div.find_element(By.TAG_NAME, "textarea")
        convo_header_textarea.send_keys("This is my conversation header")

        time.sleep(3)

        # id="messageHeaderText"
        message_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "messageHeaderText")))
        message_header_textarea = message_header_div.find_element(By.TAG_NAME, "textarea")
        message_header_textarea.send_keys("This is my message header")

        time.sleep(3)

        # id="userMessageHeaderText"
        user_message_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "userMessageHeaderText")))
        user_message_header_textarea = user_message_header_div.find_element(By.TAG_NAME, "textarea")
        user_message_header_textarea.send_keys("This is my user message header")

        time.sleep(3)

        # id="assistantHeaderText"
        assistant_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "assistantHeaderText")))
        assistant_header_textarea = assistant_header_div.find_element(By.TAG_NAME, "textarea")
        assistant_header_textarea.send_keys("This is my assistant header")

        time.sleep(3)

        # id="confirmationButton"
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Download", button_texts, "Download button should be present")

    # ----------------- Test Download Chat -----------------
    """This test tests the fields in the Download Chat is visible."""
    
    def test_download_chat(self):
        
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Jin")
        
        # Send a Message
        self.send_message("Jin", "Jin Kazama... Wins...")
        
        self.upper_check()
        
        time.sleep(2)
        
        upper_chat_download = self.wait.until(EC.presence_of_element_located((By.ID, "downloadUpper")))
        self.assertTrue(upper_chat_download, "Upper Chat Download button should be initialized")
        upper_chat_download.click()
        
        time.sleep(2)
        
        # Scroll up to make sure the slider is in view id="modalScroll"
        download_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "modalScroll")))
        self.driver.execute_script("arguments[0].scrollTop = 0;", download_scroll_window)
        
        time.sleep(2)
        
        # Verify the presence of the Window element after clicking the Edit button
        download_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(download_modal_element, "Download window element is visible")
        
        time.sleep(2)
        
        # Extract the text from the element
        modal_text = download_modal_element.text
        
        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")
        
        # id="formatSelection"
        # Verify the presence of the select element
        format_selection = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        self.assertTrue(format_selection, "Format selection dropdown is visible")

        # Verify the presence of "Word" and "PowerPoint" options
        format_options = format_selection.find_elements(By.TAG_NAME, "option")
        format_values = [option.text for option in format_options]
        self.assertIn("Word", format_values, "Word format should be selectable")
        self.assertIn("PowerPoint", format_values, "PowerPoint format should be selectable")

        time.sleep(3)

        # id="templateSelection"
        # Locate the formatSelection div and then find the select element inside it
        format_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        format_selection = Select(format_selection_div.find_element(By.TAG_NAME, "select"))

        # Select "Word" and verify "none" is an option in templateSelection
        format_selection.select_by_visible_text("Word")

        template_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "templateSelection")))
        template_selection = Select(template_selection_div.find_element(By.TAG_NAME, "select"))

        word_template_options = [option.text for option in template_selection.options]
        self.assertIn("none", word_template_options, "None template should be selectable when Word is selected")

        time.sleep(3)

        # id="convoNameInclusionSelection"
        # Verify "Yes" and "No" options are selectable
        convo_name_selection = self.wait.until(EC.presence_of_element_located((By.ID, "convoNameInclusionSelection")))
        specific_name_selection = Select(convo_name_selection.find_element(By.TAG_NAME, "select"))
        specific_name_selection.select_by_visible_text("Yes")

        time.sleep(3)

        # id="conversationHeaderText"
        # Enter text into the textarea
        convo_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "conversationHeaderText")))
        convo_header_textarea = convo_header_div.find_element(By.TAG_NAME, "textarea")
        convo_header_textarea.send_keys("Convo with Jin")

        time.sleep(3)

        # id="messageHeaderText"
        message_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "messageHeaderText")))
        message_header_textarea = message_header_div.find_element(By.TAG_NAME, "textarea")
        message_header_textarea.send_keys("Hello Hello")

        time.sleep(3)

        # id="userMessageHeaderText"
        user_message_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "userMessageHeaderText")))
        user_message_header_textarea = user_message_header_div.find_element(By.TAG_NAME, "textarea")
        user_message_header_textarea.send_keys("How are you this fine day?")

        time.sleep(3)

        # id="assistantHeaderText"
        assistant_header_div = self.wait.until(EC.presence_of_element_located((By.ID, "assistantHeaderText")))
        assistant_header_textarea = assistant_header_div.find_element(By.TAG_NAME, "textarea")
        assistant_header_textarea.send_keys("I am here to assist you.")

        time.sleep(3)

        # id="confirmationButton"
        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Download", button_texts, "Download button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(10) # Wait for the load
        
        download_click = self.wait.until(EC.presence_of_element_located((By.ID, "downloadClick")))
        self.assertTrue(download_click, "Download click is visible")
        download_click.click()
        
        time.sleep(5) # View Download visible

    # ----------------- Test Download Response Modal Fields -----------------
    """This test tests the fields in the Download Chat Response Modal."""

    def test_download_response_modal_fields(self):
        
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Mario")
        
        # Send a Message
        self.send_message("Mario", "MAAAAAARRRIOOO TIIIIIMMEE!!!")
        
        # Hover the chat response
        chat_hover = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatHover")
        ))
        self.assertGreater(len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'")
        
        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()
        
        time.sleep(3)
        
        # Click the download button
        download_button = self.driver.find_element("id", "downloadResponse")
        download_button.click()

        # Verify the presence of the Window element after clicking the Edit button
        download_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(download_modal_element, "Download window element is visible")
        
        time.sleep(2)
        
        # Extract the text from the element
        modal_text = download_modal_element.text
        
        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")
        
        # id="formatSelection"
        # Verify the presence of the select element
        format_selection = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        self.assertTrue(format_selection, "Format selection dropdown is visible")

        # Verify the presence of "Word" and "PowerPoint" options
        format_options = format_selection.find_elements(By.TAG_NAME, "option")
        format_values = [option.text for option in format_options]
        self.assertIn("Word", format_values, "Word format should be selectable")
        self.assertIn("PowerPoint", format_values, "PowerPoint format should be selectable")

        time.sleep(3)

        # id="templateSelection"
        # Locate the formatSelection div and then find the select element inside it
        format_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        format_selection = Select(format_selection_div.find_element(By.TAG_NAME, "select"))

        # Select "Word" and verify "none" is an option in templateSelection
        format_selection.select_by_visible_text("Word")

        template_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "templateSelection")))
        template_selection = Select(template_selection_div.find_element(By.TAG_NAME, "select"))

        word_template_options = [option.text for option in template_selection.options]
        self.assertIn("none", word_template_options, "None template should be selectable when Word is selected")

        time.sleep(3)

        # Select "PowerPoint" and verify "vapor.pptx" is an option
        format_selection.select_by_visible_text("PowerPoint")

        pptx_template_options = [option.text for option in template_selection.options]
        self.assertIn("vapor.pptx", pptx_template_options, "vapor.pptx template should be selectable when PowerPoint is selected")

        time.sleep(3)

        # id="convoNameInclusionSelection"
        # Verify "Yes" and "No" options are selectable
        convo_name_selection = self.wait.until(EC.presence_of_element_located((By.ID, "convoNameInclusionSelection")))
        convo_options = [option.text for option in convo_name_selection.find_elements(By.TAG_NAME, "option")]
        self.assertIn("Yes", convo_options, "Yes option should be present in convoNameInclusionSelection")
        self.assertIn("No", convo_options, "No option should be present in convoNameInclusionSelection")

        time.sleep(3)

        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Download", button_texts, "Download button should be present")
        
        close = self.wait.until(EC.presence_of_element_located((
            By.XPATH, '//button[@title="Close"]'
        )))
        self.assertTrue(close, "Close button is visible")
        
        close.click()
        
        time.sleep(3)

    # ----------------- Test Download Response Modal -----------------
    """This tests the download response modal download."""

    def test_download_response_modal(self):
    
        self.delete_all_chats()
    
        # Create a chat
        self.create_chat("Luigi")
        
        # Send a Message
        self.send_message("Luigi", "LUUIGIII TIIIIIMMEE!!!")
        
        # Hover the chat response
        chat_hover = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatHover")
        ))
        self.assertGreater(len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'")
        
        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()
        
        time.sleep(3)
        
        # Click the download button
        download_button = self.driver.find_element("id", "downloadResponse")
        download_button.click()
        
        # Verify the presence of the download modal after clicking the downloadResponse button
        download_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(download_modal_element, "Download window element is visible")
        
        time.sleep(3)
        
        # Extract the text from the element
        modal_text = download_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")
        
        # id="templateSelection"
        # Locate the formatSelection div and then find the select element inside it
        format_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "formatSelection")))
        format_selection = Select(format_selection_div.find_element(By.TAG_NAME, "select"))

        # Select "Word" and verify "none" is an option in templateSelection
        format_selection.select_by_visible_text("Word")

        template_selection_div = self.wait.until(EC.presence_of_element_located((By.ID, "templateSelection")))
        template_selection = Select(template_selection_div.find_element(By.TAG_NAME, "select"))

        word_template_options = [option.text for option in template_selection.options]
        self.assertIn("none", word_template_options, "None template should be selectable when Word is selected")

        time.sleep(3)

        convo_name_selection = self.wait.until(EC.presence_of_element_located((By.ID, "convoNameInclusionSelection")))
        specific_name_selection = Select(convo_name_selection.find_element(By.TAG_NAME, "select"))
        specific_name_selection.select_by_visible_text("Yes")

        time.sleep(3)

        # Verify that there are two buttons, one with "Cancel" and one with "Download"
        confirmation_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "confirmationButton")))
        button_texts = [button.text for button in confirmation_buttons]
        self.assertIn("Cancel", button_texts, "Cancel button should be present")
        self.assertIn("Download", button_texts, "Download button should be present")
        
        confirmation_buttons[-1].click()
        
        time.sleep(10) # Wait for the load
        
        download_click = self.wait.until(EC.presence_of_element_located((By.ID, "downloadClick")))
        self.assertTrue(download_click, "Download click is visible")
        download_click.click()
        
        time.sleep(5) # View Download visible
        

if __name__ == "__main__":
    unittest.main(verbosity=2)