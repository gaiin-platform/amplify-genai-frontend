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

class UpperChatTests(BaseTest):
    
    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------
    def create_folder(self, folder_name):
        time.sleep(5)
        folder_add_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "createFolderButton")))
        self.assertGreater(len(folder_add_buttons), 1, "Expected multiple buttons with ID 'createFolderButton'")
        folder_add_buttons[0].click()
        
        try:
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")
            time.sleep(3)
            alert.send_keys(folder_name)
            time.sleep(3)
            alert.accept()
        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
    
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
        time.sleep(1)

        rename_button = self.wait.until(EC.element_to_be_clickable((By.ID, "isRenaming")))
        self.assertIsNotNone(rename_button, "Rename button should be initialized and clicked")
        rename_button.click()
        time.sleep(1)

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
        
    def create_artifact(self, chat_name, message):
        # Create a chat
        self.create_chat(chat_name)
        self.send_message(chat_name, message)
        chat_hover = self.wait.until(EC.presence_of_all_elements_located((By.ID, "chatHover")))
        self.assertGreater(len(chat_hover), 1, "Expected multiple buttons with ID 'chatHover'")
        ActionChains(self.driver).move_to_element(chat_hover[-1]).perform()
        
        time.sleep(3)
        
        # Click the Artifact button
        artifact_button = self.driver.find_element("id", "turnIntoArtifact")
        artifact_button.click()
        artifact_element = self.wait.until(EC.presence_of_element_located((By.ID, "artifactsLabel")))
        self.assertTrue(artifact_element.is_displayed(), "Artifact label element is visible")
        
        time.sleep(3)
        
    def delete_all_chats(self):
        prompt_handler_button = self.wait.until(EC.presence_of_element_located((By.ID, "promptHandler")))
        prompt_handler_button.click()
        time.sleep(2)

        # Click the button with ID "Delete"
        delete_button = self.wait.until(EC.presence_of_element_located((By.ID, "Delete")))
        delete_button.click()
        time.sleep(2)  # Give time for the menu to appear

        # Click the select all checkbox
        select_all_check = self.wait.until(EC.presence_of_element_located((By.ID, "selectAllCheck")))

        # Locate the checkbox within the parent container
        checkbox = select_all_check.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f"Checkbox for prompt All should be present")
        checkbox.click()
        time.sleep(2)

        # Click the Delete Button
        confirm_delete_button = self.wait.until(EC.element_to_be_clickable((By.ID, "confirmItem")))
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()
        time.sleep(2)


    # ----------------- Test Chat Settings -----------------
    """Test to ensure the upper chat settings button is accessible."""

    def test_upper_chat_settings(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Wario")
        
        # Send a Message
        self.send_message("Wario", "WAAAAAAARIO TIIIIIIIME!!!")
        
        # id="chatUpperMenu"
        upper_chat_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatUpperMenu"))
        )
        
        ActionChains(self.driver).move_to_element(upper_chat_hover).perform()

        time.sleep(3)
        
        upper_chat_settings = self.wait.until(EC.presence_of_element_located((By.ID, "modelChatSettings")))
        self.assertTrue(upper_chat_settings, "Upper Chat Settings button should be initialized")
        upper_chat_settings.click()
        
        time.sleep(2)
        
        # Scroll down to make sure the slider is in view
        chat_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "chatScrollWindow")))
        self.driver.execute_script("arguments[0].scrollTop = 0;", chat_scroll_window)
        
        time.sleep(3)
        
        model_change = self.wait.until(EC.presence_of_element_located((By.ID, "modelSelect")))
        self.assertTrue(model_change, "Model Change button should be initialized")
    
    # ----------------- Test Clear Messages -----------------
    """Test to ensure the upper chat clear button is accessible."""
    
    def test_upper_chat_clear(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Bitsy")
        
        # Send a Message
        self.send_message("Bitsy", "Is it a Charcoal Grylla or a Propane Grylla?")
        
        # id="chatUpperMenu"
        upper_chat_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatUpperMenu"))
        )
        
        ActionChains(self.driver).move_to_element(upper_chat_hover).perform()

        time.sleep(3)
        
        upper_chat_clear = self.wait.until(EC.presence_of_element_located((By.ID, "clearMessages")))
        self.assertTrue(upper_chat_clear, "Upper Chat Clear button should be initialized")
        upper_chat_clear.click()
        
        time.sleep(2)
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
        
        user_message = self.wait.until(EC.invisibility_of_element_located((By.ID, "userMessage")))
        self.assertTrue(user_message, "userMessage should not be visible after clearing message button")
    
    # ----------------- Test Share Messages -----------------
    """Test to ensure the upper chat share button is accessible."""
    
    def test_upper_share(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Chuckles")
        
        # Send a Message
        self.send_message("Chuckles", "There's a wild Gorilla on the loose!!!")
        
        # id="chatUpperMenu"
        upper_chat_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatUpperMenu"))
        )
        
        ActionChains(self.driver).move_to_element(upper_chat_hover).perform()

        time.sleep(3)
        
        share_chat_upper = self.wait.until(
            EC.presence_of_element_located((By.ID, "shareChatUpper"))
        )
        share_chat_upper.click()
        
        time.sleep(2)
        
        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        time.sleep(2)
        
        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Add People to Share With", "Modal title should be 'Add People to Share With'")
        
        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "checkBoxName")
        ))
        self.assertTrue(checkbox_name_elements, "Checkbox name elements should be initialized")

        # Check if any of the elements contain "Chuckles"
        checkbox_name_in_list = next((el for el in checkbox_name_elements if el.text == "Chuckles"), None)
        self.assertIsNotNone(checkbox_name_in_list, "Chuckles should be visible in the dropdown")
        
        time.sleep(2)
        
        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(By.XPATH, "./ancestor::div[@id='checkBoxItem']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Chuckles should be present')
        
        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")
        
    # ----------------- Test Download -----------------
    """Test to ensure the upper download button is accessible."""
    
    def test_upper_download(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Torbek")
        
        # Send a Message
        self.send_message("Torbek", "Torbek doesn't mean to alarm you...")
        
        # id="chatUpperMenu"
        upper_chat_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatUpperMenu"))
        )
        
        ActionChains(self.driver).move_to_element(upper_chat_hover).perform()

        time.sleep(3)
        
        upper_chat_download = self.wait.until(EC.presence_of_element_located((By.ID, "downloadUpper")))
        self.assertTrue(upper_chat_download, "Upper Chat Download button should be initialized")
        upper_chat_download.click()
        
        time.sleep(2)
        
        # Verify the presence of the Window element after clicking the Edit button
        download_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(download_modal_element.is_displayed(), "Download window element is visible")
        
        time.sleep(2)
        
        # Extract the text from the element
        modal_text = download_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Download", "Modal title should be 'Download'")
        
        # Locate all elements with ID "checkBoxName" and find the one with text
        checkbox_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "checkBoxName")
        ))
        self.assertTrue(checkbox_name_elements, "Checkbox name elements should be initialized")

        # Check if any of the elements contain "Torbek"
        checkbox_name_in_list = next((el for el in checkbox_name_elements if el.text == "Torbek"), None)
        self.assertIsNotNone(checkbox_name_in_list, "Torbek should be visible in the dropdown")
        
        time.sleep(2)
        
        # Navigate up to the parent container
        parent_container = checkbox_name_in_list.find_element(By.XPATH, "./ancestor::div[@id='checkBoxItem']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Torbek should be present')
        
        # Verify if the checkbox is checked
        is_checked = checkbox.get_attribute("checked") is not None
        self.assertTrue(is_checked, "Checkbox should be checked")

    # ----------------- Test Add Artifact to Conversation -----------------
    """Test to ensure the upper chat artifact button is accessible."""

    def test_upper_artifact(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create artifact
        self.create_artifact("Bitsy", "Hello, my names Bitsy and I can run really faaaast. I got kicked out of Potsville for believing you can't make lemon juice from lemons.")
        
        time.sleep(5)
        
        # Find the Close Artifact Window Button
        close_window_button = self.wait.until(EC.presence_of_element_located((By.ID, "closeArtifactWindow")))
        self.assertTrue(close_window_button.is_displayed(), "Close Artifact Window button element is visible")
        
        close_window_button.click()
        
        time.sleep(2)
        
        artifact_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "artifactsButtonBlock")))
        
        # Assert that there are exactly two versions present
        self.assertEqual(len(artifact_list), 1, f"Expected 1 artifactsButtonBlock elements, but found {len(artifact_list)}")
        
        # Hover over artifact_list[1]
        ActionChains(self.driver).move_to_element(artifact_list[0]).perform()

        # Find the "removeArtifactFromConversation" button and click it
        remove_button = self.wait.until(EC.element_to_be_clickable((By.ID, "removeArtifactFromConversation")))
        remove_button.click()

        # Add a wait to ensure the artifact is removed
        time.sleep(2)
        
        # id="chatUpperMenu"
        upper_chat_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatUpperMenu"))
        )
        
        ActionChains(self.driver).move_to_element(upper_chat_hover).perform()

        time.sleep(3)
        
        # title="Add Artifacts To Conversation"
        
        upper_chat_artifacts = self.wait.until(EC.presence_of_element_located((
            By.XPATH, '//button[@title="Add Artifacts To Conversation"]'
        )))
        self.assertTrue(upper_chat_artifacts.is_displayed(), "Upper Chat Artifacts button is visible")
        
        upper_chat_artifacts.click()
        
        time.sleep(1)
        
        # Verify that the artifacts list is present
        artifacts_list = self.wait.until(EC.presence_of_element_located((By.ID, "artifactsList")))
        self.assertTrue(artifacts_list.is_displayed(), "Artifacts list is visible")
        
        time.sleep(2)
        
        # Find all list items inside the artifacts list
        artifact_items = self.wait.until(EC.presence_of_all_elements_located((By.ID, "artifactInList")))
        self.assertTrue(artifact_items, "Artifacts are present in the list")
        
        # Select the first artifact in the list
        artifact_items[0].click()
        
        time.sleep(8)
        
        artifact_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "artifactsButtonBlock")))

        # Assert that there are exactly two versions present
        self.assertEqual(len(artifact_list), 1, f"Expected 1 artifactsButtonBlock elements, but found {len(artifact_list)}")
        
    # ----------------- Test Privacy -----------------
    """Test to ensure the upper chat privacy button is accessible."""
    
    def test_upper_download(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Bitsy")
        
        # Send a Message
        self.send_message("Bitsy", "Yes and I think there's gonna be a Gorilla")
        
        # id="chatUpperMenu"
        upper_chat_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatUpperMenu"))
        )
        
        ActionChains(self.driver).move_to_element(upper_chat_hover).perform()

        time.sleep(3)
        
        upper_chat_privacy = self.wait.until(EC.presence_of_element_located((
            By.XPATH, '//button[@title="This conversation is currently set to private and only accessible from this browser. "]'
        )))
        self.assertTrue(upper_chat_privacy.is_displayed(), "Upper Chat Privacy button is visible")
        
        upper_chat_privacy.click()
        
        time.sleep(2)
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(5)
        
        # id="chatUpperMenu"
        upper_chat_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatUpperMenu"))
        )
        
        ActionChains(self.driver).move_to_element(upper_chat_hover).perform()

        time.sleep(3)
        
        upper_chat_privacy_change_back = self.wait.until(EC.presence_of_element_located((
            By.XPATH, '//button[@title="This conversation is currently stored in the cloud for access from any device. "]'
        )))
        self.assertTrue(upper_chat_privacy_change_back.is_displayed(), "Upper Chat Privacy button is visible")
        
        upper_chat_privacy_change_back.click()
        
        time.sleep(2)
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(5)
        
        # id="chatUpperMenu"
        upper_chat_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatUpperMenu"))
        )
        
        ActionChains(self.driver).move_to_element(upper_chat_hover).perform()

        time.sleep(3)
        
        upper_chat_privacy = self.wait.until(EC.presence_of_element_located((
            By.XPATH, '//button[@title="This conversation is currently set to private and only accessible from this browser. "]'
        )))
        self.assertTrue(upper_chat_privacy.is_displayed(), "Upper Chat Privacy button is visible")
        
    # # ----------------- Test Depricated -----------------
    # # Data Sources button in upper chat no longer exists
    
    # # ----------------- Test Data Sources -----------------
    # """Test to ensure the upper chat data sources button is accessible."""
    
    # def test_upper_data_sources(self):
    #     # Delete all conversations from previous tests
    #     self.delete_all_chats()
        
    #     # Create a chat
    #     self.create_chat("Torbek")
        
    #     # Send a Message
    #     self.send_message("Torbek", "Torbek doesn't mean to alarm you...")
        
    #     upper_chat_data_sources = self.wait.until(EC.presence_of_element_located((By.ID, "dateSources")))
    #     self.assertTrue(upper_chat_data_sources, "Upper Chat Data Sources button should be initialized")
    #     upper_chat_data_sources.click()
        
    #     time.sleep(2)
    
    #     file_title = self.wait.until(EC.presence_of_element_located((By.ID, "Your Files")))
    #     self.assertTrue(file_title, "File Title 'Your Files' should be initialized")
        
    #     time.sleep(2)
        
    #     close_button = self.wait.until(EC.presence_of_element_located((By.ID, "Close")))
    #     self.assertTrue(close_button, "Close button should be initialized")
    #     close_button.click()
        
    #     time.sleep(2)
        
    #     user_message = self.wait.until(EC.presence_of_element_located((By.ID, "userMessage")))
    #     self.assertTrue(user_message, "User Message should be initialized")
    
    # # ----------------- Test Depricated -----------------
    # # Add Tags button in upper chat no longer exists
    
    # # ----------------- Test Add Tags -----------------
    # """Test to ensure the upper chat add tags button is accessible."""
    
    # def test_add_tags(self):
    #     # Delete all conversations from previous tests
    #     self.delete_all_chats()
        
    #     # Create a chat
    #     self.create_chat("Gricko")
        
    #     # Send a Message
    #     self.send_message("Gricko", "Mmmmmmmm Bananyas...")
        
    #     # Scroll down to make sure the slider is in view
    #     chat_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "chatScrollWindow")))
    #     self.driver.execute_script("arguments[0].scrollTop = 0;", chat_scroll_window)
        
    #     time.sleep(3)
        
    #     # id="addTag"
    #     upper_chat_add_tag = self.wait.until(EC.presence_of_element_located((By.ID, "addTag")))
    #     self.assertTrue(upper_chat_add_tag, "Upper Add Tag button should be initialized")
    #     upper_chat_add_tag.click()
        
    #     time.sleep(3)
    
    #     try:
    #         # Switch to the JavaScript alert
    #         alert = self.wait.until(EC.alert_is_present())
    #         self.assertIsNotNone(alert, "Alert prompt should be present")

    #         time.sleep(3)

    #         # Clear existing text and send new text
    #         alert.send_keys("Goblin, Druid, Owl Bear Father")
            
    #         time.sleep(3)

    #         # Accept the alert (clicks the "OK" button)
    #         alert.accept()

    #     except UnexpectedAlertPresentException as e:
    #         self.fail(f"Unexpected alert present: {str(e)}")
        
    #     time.sleep(2)
        
    #     # Verify the Tag name is correct
    #     tag_names_second = self.wait.until(EC.presence_of_all_elements_located(
    #         (By.ID, "tagName")
    #     ))
    #     self.assertTrue(tag_names_second, "tagName are present")
        
    #     # Extract and print all text values for debugging
    #     names = [element.text.strip() for element in tag_names_second]
    #     # print("Extracted Names:", names)  # Debugging output

    #     # Ensure the extracted names are "Goblin", "Druid", and "Owl Bear Father"
    #     expected_names = ["Goblin", "Druid", "Owl Bear Father"]
    #     self.assertEqual(names, expected_names, "The extracted names are correct")
        
    # ----------------- Test Pin Upper Chat -----------------
    """Test to ensure the upper chat pin button successfully pins the upper chat to the top 
       of the chat menu."""
       
    def test_pin_upper_chat_menu(self):
        # Delete all conversations from previous tests
        self.delete_all_chats()
        
        # Create a chat
        self.create_chat("Mr. Light")
        
        # Send a Message
        self.send_message("Mr. Light", "Children have been goin missin, It could be Grylla of the woods")
        
        # id="chatUpperMenu"
        upper_chat_hover = self.wait.until(
            EC.presence_of_element_located((By.ID, "chatUpperMenu"))
        )
        
        ActionChains(self.driver).move_to_element(upper_chat_hover).perform()

        time.sleep(3)
        
        upper_chat_pin = self.wait.until(EC.presence_of_element_located((
            By.XPATH, '//button[@title="Pin Chatbar"]'
        )))
        self.assertTrue(upper_chat_pin.is_displayed(), "Upper Chat Pin button is visible")
        
        upper_chat_pin.click()
        
        time.sleep(2)
        
        upper_chat_clear = self.wait.until(EC.presence_of_element_located((By.ID, "clearMessages")))
        self.assertTrue(upper_chat_clear, "Upper Chat Clear button should be initialized")
        
        share_chat_upper = self.wait.until(EC.presence_of_element_located((By.ID, "shareChatUpper")))
        self.assertTrue(share_chat_upper, "Upper Chat Share button should be initialized")
        
        upper_chat_download = self.wait.until(EC.presence_of_element_located((By.ID, "downloadUpper")))
        self.assertTrue(upper_chat_download, "Upper Chat Download button should be initialized")
        
        upper_chat_artifacts = self.wait.until(EC.presence_of_element_located((By.XPATH, '//button[@title="Add Artifacts To Conversation"]')))
        self.assertTrue(upper_chat_artifacts.is_displayed(), "Upper Chat Artifacts button is visible")
        
        upper_chat_privacy = self.wait.until(EC.presence_of_element_located((By.XPATH, '//button[@title="This conversation is currently set to private and only accessible from this browser. "]')))
        self.assertTrue(upper_chat_privacy.is_displayed(), "Upper Chat Privacy button is visible")
        
        # Click the pin button and then prompt to check the visibility of all the buttons
        upper_chat_unpin = self.wait.until(EC.presence_of_element_located((
            By.XPATH, '//button[@title="Unpin Chatbar"]'
        )))
        self.assertTrue(upper_chat_unpin.is_displayed(), "Upper Chat Unpin button is visible")
        
        upper_chat_unpin.click()
        
        time.sleep(2)
        
        upper_chat_unpin = self.wait.until(EC.invisibility_of_element_located((
            By.XPATH, '//button[@title="Unpin Chatbar"]'
        )))
        self.assertTrue(upper_chat_unpin, "Upper Chat Unpin button is not visible")


if __name__ == "__main__":
    unittest.main(verbosity=2)