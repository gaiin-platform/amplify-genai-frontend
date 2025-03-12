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

class TagTests(unittest.TestCase):
    
    # ----------------- Setup -----------------
    def setUp(self, headless=True):
        
        # Load environment variables from .env.local
        load_dotenv(".env.local")

        # Get values from environment variables
        base_url = os.getenv("NEXTAUTH_URL", "http://localhost:3000")
        username = os.getenv("SELENIUM_USERNAME", "default_username")
        password = os.getenv("SELENIUM_PASSWORD", "default_password")
        
        # Configure Chrome options based on headless parameter
        options = webdriver.ChromeOptions()
        if headless:
            options.add_argument("--headless")  # Run browser in headless mode
            options.add_argument("--disable-gpu")  # Disable GPU acceleration
            options.add_argument("--window-size=1920,1080")  # Set window size
        
        # Initialize WebDriver with the configured options
        self.driver = webdriver.Chrome(options=options if headless else None)
        self.driver.get(base_url)
        self.wait = WebDriverWait(self.driver, 10)
        self.login(username, password)  # Perform login during setup
        

    def tearDown(self):
        self.driver.quit()
        
    # ----------------- Login -----------------
    def login(self, username, password):
        """Helper method to perform login."""
        try:
            # Click the login button to reveal the login form
            login_button = self.wait.until(EC.element_to_be_clickable(
                (By.ID, "loginButton")
            ))
            login_button.click()

            # Wait for the username and password fields to appear
            username_field = self.wait.until(lambda d: next(
                (e for e in d.find_elements(By.NAME, "username") if e.is_displayed()), None
            ))
            password_field = self.wait.until(lambda d: next(
                (e for e in d.find_elements(By.NAME, "password") if e.is_displayed()), None
            ))

            # Enter username and password
            username_field.send_keys(username)
            password_field.send_keys(password)

            # Submit the login form            
            form = self.driver.find_element(By.TAG_NAME, "form")
            form.submit()
            
            # Add a short delay to wait for the loading screen
            time.sleep(8)  # Wait for 8 seconds before proceeding

            # Wait for a post-login element to ensure login was successful
            self.wait.until(EC.visibility_of_element_located(
                (By.ID, "messageChatInputText")  # Sidebar appears
            ))
        except Exception as e:
            self.fail(f"Login failed: {e}")   
            


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

    
    
    
    # ----------------- Test Add One Tag On Individual Chat -----------------
    """This test ensures that a tag can be added onto an individual chat
       via the three dot handler on the Left Side Bar"""
    
    def test_add_tag_individual_chat(self):
        
        self.create_chat("Kukui")
        self.create_chat("Accerola")

       # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'createFolderButton'")
        
        prompt_handler_buttons_plural[0].click()
        
        time.sleep(3)
        
        # Click the Tag Button
        tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "Tag")
        ))
        self.assertTrue(tag_button, "Tag Button should be initialized")
        tag_button.click()
        
        time.sleep(3)
        
       # Find Chats
        chats_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertGreater(len(chats_plural), 1, "Expected multiple buttons with ID 'chat'")
        
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        
        # Check for chat named Accerola
        chat_in_list = next((el for el in chat_name_elements if el.text == "Accerola"), None)
        self.assertIsNotNone(chat_in_list, "Accerola should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = chat_in_list.find_element(By.XPATH, "./ancestor::div[@id='chat']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Accerola should be present')

        # Click the checkbox
        checkbox.click()
        
        time.sleep(2)
        
        # Click the Tag Button
        confirm_tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_tag_button, "Tag Button should be initialized")
        confirm_tag_button.click()
    
        # Verify the presence of the Window element after clicking the Tag button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "tagAddModal")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        time.sleep(3)
        
        # Click the Add Tag Button
        add_tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "addTag")
        ))
        self.assertTrue(add_tag_button, "Tag Button should be initialized")
        add_tag_button.click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Elite Four Member")
            
            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
        
        # Click the Done Button
        done_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "doneButton")
        ))
        self.assertTrue(done_button, "Done Button should be initialized")
        done_button.click()
        
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with text "Accerola"
        chat = next((el for el in chat_name_elements if el.text == "Accerola"), None)
        self.assertIsNotNone(chat, "Accerola button should be present")
        
        chat_click = chat.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        chat_click.click()
        
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(EC.presence_of_element_located(
            (By.ID, "messageChatInputText")
        ))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        
        chat_input_bar.send_keys("Testing a chat")
        
        time.sleep(2)
        
        # Locate the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located(
            (By.ID, "sendMessage")
        ))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        
        chat_send_message.click()
        
        time.sleep(5)
        
        # Verify the presence of the Tag Area
        tag_list = self.wait.until(EC.presence_of_element_located(
            (By.ID, "tagContainer")
        ))
        self.assertTrue(tag_list.is_displayed(), "Tag Area element is visible")
        
        # Verify the Tag name is correct
        tag_name = self.wait.until(EC.presence_of_element_located(
            (By.ID, "tagName")
        ))
        self.assertTrue(tag_name.is_displayed(), "Specific Tag name is visible")
        
        extracted_tag_name = tag_name.text.strip()
        
        self.assertEqual(extracted_tag_name, "Elite Four Member", "The tag has the correct name'")
        
        
    
    # ----------------- Test Add Multiple Tags On Individual Chat -----------------
    """This test ensures that multiple tags can be added onto an individual chat
       via the three dot handler on the Left Side Bar"""
       
    def test_add_multiple_tags_individual_chat(self):
        
        self.create_chat("Kukui")
        self.create_chat("Accerola")

       # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'createFolderButton'")
        
        prompt_handler_buttons_plural[0].click()
        
        time.sleep(3)
        
        # Click the Tag Button
        tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "Tag")
        ))
        self.assertTrue(tag_button, "Tag Button should be initialized")
        tag_button.click()
        
        time.sleep(3)
        
       # Find Chats
        chats_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertGreater(len(chats_plural), 1, "Expected multiple buttons with ID 'chat'")
        
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        
        # Check for chat named Kukui
        chat_in_list = next((el for el in chat_name_elements if el.text == "Kukui"), None)
        self.assertIsNotNone(chat_in_list, "Kukui should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = chat_in_list.find_element(By.XPATH, "./ancestor::div[@id='chat']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Kukui should be present')

        # Click the checkbox
        checkbox.click()
        
        time.sleep(2)
        
        # Click the Tag Button
        confirm_tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_tag_button, "Tag Button should be initialized")
        confirm_tag_button.click()
    
        # Verify the presence of the Window element after clicking the Tag button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "tagAddModal")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        time.sleep(3)
        
        # Click the Add Tag Button
        add_tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "addTag")
        ))
        self.assertTrue(add_tag_button, "Tag Button should be initialized")
        add_tag_button.click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Professor, Pokemon Champion")
            
            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
        
        # Click the Done Button
        done_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "doneButton")
        ))
        self.assertTrue(done_button, "Done Button should be initialized")
        done_button.click()
        
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with text "Kukui"
        chat = next((el for el in chat_name_elements if el.text == "Kukui"), None)
        self.assertIsNotNone(chat, "Kukui button should be present")
        
        chat_click = chat.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        chat_click.click()
        
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(EC.presence_of_element_located(
            (By.ID, "messageChatInputText")
        ))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        
        chat_input_bar.send_keys("Testing a chat")
        
        time.sleep(2)
        
        # Locate the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located(
            (By.ID, "sendMessage")
        ))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        
        chat_send_message.click()
        
        time.sleep(5)
        
        # Verify the presence of the Tag Area
        tag_list = self.wait.until(EC.presence_of_element_located(
            (By.ID, "tagContainer")
        ))
        self.assertTrue(tag_list.is_displayed(), "Tag Area element is visible")
        
        # Verify the Tag name is correct
        tag_names = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "tagName")
        ))
        self.assertTrue(tag_names, "tagName are empty")
        
        # Extract and print all text values for debugging
        names = [element.text.strip() for element in tag_names]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the extracted names are "Professor" and "Pokemon Champion"
        expected_names = ["Professor", "Pokemon Champion"]
        self.assertEqual(names, expected_names, "The extracted names are Professor and Pokemon Champion")
    
    
    
    # ----------------- Test Add Multiple Tag On Multiple Chats -----------------
    """This test ensures that multiple tags can be added onto multiple chats
       via the three dot handler on the Left Side Bar"""
       
    def test_add_multiple_tags_multiple_chats(self):
        
        self.create_chat("Kukui")
        self.create_chat("Cynthia")

       # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'createFolderButton'")
        
        prompt_handler_buttons_plural[0].click()
        
        time.sleep(3)
        
        # Click the Tag Button
        tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "Tag")
        ))
        self.assertTrue(tag_button, "Tag Button should be initialized")
        tag_button.click()
        
        time.sleep(3)
        
        # Click the select all checkbox
        select_all_check = self.wait.until(EC.presence_of_element_located(
            (By.ID, "selectAllCheck")
        ))
    
        # Locate the checkbox within the parent container
        checkbox = select_all_check.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt All should be present')
        
        checkbox.click()
        
        time.sleep(3)
        
        # Click the Tag Button
        confirm_tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_tag_button, "Tag Button should be initialized")
        confirm_tag_button.click()
    
        # Verify the presence of the Window element after clicking the Tag button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "tagAddModal")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        time.sleep(3)
        
        # Click the Add Tag Button
        add_tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "addTag")
        ))
        self.assertTrue(add_tag_button, "Tag Button should be initialized")
        add_tag_button.click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Researcher, Pokemon Champion")
            
            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
        
        # Click the Done Button
        done_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "doneButton")
        ))
        self.assertTrue(done_button, "Done Button should be initialized")
        done_button.click()
        
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with text "Kukui"
        chat = next((el for el in chat_name_elements if el.text == "Kukui"), None)
        self.assertIsNotNone(chat, "Kukui button should be present")
        
        chat_click = chat.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        chat_click.click()
        
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(EC.presence_of_element_located(
            (By.ID, "messageChatInputText")
        ))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        
        chat_input_bar.send_keys("Testing a chat")
        
        time.sleep(2)
        
        # Locate the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located(
            (By.ID, "sendMessage")
        ))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        
        chat_send_message.click()
        
        time.sleep(5)
        
        # Verify the presence of the Tag Area
        tag_list = self.wait.until(EC.presence_of_element_located(
            (By.ID, "tagContainer")
        ))
        self.assertTrue(tag_list.is_displayed(), "Tag Area element is visible")
        
        # Verify the Tag name is correct
        tag_names = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "tagName")
        ))
        self.assertTrue(tag_names, "tagName are empty")
        
        # Extract and print all text values for debugging
        names = [element.text.strip() for element in tag_names]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the extracted names are "Researcher" and "Pokemon Champion"
        expected_names = ["Researcher", "Pokemon Champion"]
        self.assertEqual(names, expected_names, "The extracted names are Professor and Pokemon Champion")

        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with text "Cynthia"
        chat = next((el for el in chat_name_elements if el.text == "Cynthia"), None)
        self.assertIsNotNone(chat, "Cynthia button should be present")
        
        chat_click = chat.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        chat_click.click()
        
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(EC.presence_of_element_located(
            (By.ID, "messageChatInputText")
        ))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        
        chat_input_bar.send_keys("Testing a chat")
        
        time.sleep(2)
        
        # Locate the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located(
            (By.ID, "sendMessage")
        ))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        
        chat_send_message.click()
        
        time.sleep(5)
        
        # Verify the presence of the Tag Area
        tag_list = self.wait.until(EC.presence_of_element_located(
            (By.ID, "tagContainer")
        ))
        self.assertTrue(tag_list.is_displayed(), "Tag Area element is visible")
        
        # Verify the Tag name is correct
        tag_names = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "tagName")
        ))
        self.assertTrue(tag_names, "tagName are empty")
        
        # Extract and print all text values for debugging
        names = [element.text.strip() for element in tag_names]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the extracted names are "Researcher" and "Pokemon Champion"
        expected_names = ["Researcher", "Pokemon Champion"]
        self.assertEqual(names, expected_names, "The extracted names are Professor and Pokemon Champion")
    
    
    
    # ----------------- Test Remove Tags -----------------
    """This test ensures that a tag can be removed from an individual chat
       via the three dot handler on the Left Side Bar"""

    def test_remove_tags(self):
        
        self.create_chat("Kukui")
        self.create_chat("Accerola")

       # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'createFolderButton'")
        
        prompt_handler_buttons_plural[0].click()
        
        time.sleep(3)
        
        # Click the Tag Button
        tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "Tag")
        ))
        self.assertTrue(tag_button, "Tag Button should be initialized")
        tag_button.click()
        
        time.sleep(3)
        
       # Find Chats
        chats_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertGreater(len(chats_plural), 1, "Expected multiple buttons with ID 'chat'")
        
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        
        # Check for chat named Kukui
        chat_in_list = next((el for el in chat_name_elements if el.text == "Kukui"), None)
        self.assertIsNotNone(chat_in_list, "Kukui should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = chat_in_list.find_element(By.XPATH, "./ancestor::div[@id='chat']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Kukui should be present')

        # Click the checkbox
        checkbox.click()
        
        time.sleep(2)
        
        # Click the Tag Button
        confirm_tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_tag_button, "Tag Button should be initialized")
        confirm_tag_button.click()
    
        # Verify the presence of the Window element after clicking the Tag button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "tagAddModal")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        time.sleep(3)
        
        # Click the Add Tag Button
        add_tag_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "addTag")
        ))
        self.assertTrue(add_tag_button, "Tag Button should be initialized")
        add_tag_button.click()
        
        try:
            # Switch to the JavaScript alert
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")

            time.sleep(3)

            # Clear existing text and send new text
            alert.send_keys("Professor, Pokemon Champion, Masked Royale")
            
            time.sleep(3)

            # Accept the alert (clicks the "OK" button)
            alert.accept()

        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")
        
        time.sleep(2)
        
        # Click the Done Button
        done_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "doneButton")
        ))
        self.assertTrue(done_button, "Done Button should be initialized")
        done_button.click()
        
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with text "Kukui"
        chat = next((el for el in chat_name_elements if el.text == "Kukui"), None)
        self.assertIsNotNone(chat, "Kukui button should be present")
        
        chat_click = chat.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        chat_click.click()
        
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(EC.presence_of_element_located(
            (By.ID, "messageChatInputText")
        ))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        
        chat_input_bar.send_keys("Testing a chat")
        
        time.sleep(2)
        
        # Locate the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located(
            (By.ID, "sendMessage")
        ))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        
        chat_send_message.click()
        
        time.sleep(15)
        
        # Scroll the chatScrollWindow to the top
        chat_scroll_window = self.wait.until(EC.presence_of_element_located((By.ID, "chatScrollWindow")))
        self.driver.execute_script("arguments[0].scrollTop = 0;", chat_scroll_window)
        
        
        # Verify the Tag name is correct
        tag_names = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "tagName")
        ))
        self.assertTrue(tag_names, "tagName are present")
        
        # Extract and print all text values for debugging
        names = [element.text.strip() for element in tag_names]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the extracted names are "Professor" and "Pokemon Champion"
        expected_names = ["Professor", "Pokemon Champion", "Masked Royale"]
        self.assertEqual(names, expected_names, "The extracted names are correct")
        
        # Define the tag name to remove
        target_tag_name = "Pokemon Champion" 
        
        time.sleep(2)

        # Locate the specific tag and navigate to its remove button
        target_remove_button = None
        for tag in tag_names:
            if tag.text.strip() == target_tag_name:
                # Move up to the parent with id="tagContainer"
                tag_container = tag.find_element(By.XPATH, "./ancestor::*[@id='tagContainer']")
                
                # Locate the remove button inside the container
                target_remove_button = tag_container.find_element(By.ID, "removeTag")
                break  # Stop once we find the correct tag

        self.assertIsNotNone(target_remove_button, f"Remove button for tag '{target_tag_name}' should be present")

        # Click the remove button
        target_remove_button.click()
        
        time.sleep(2)
        
        # Verify the Tag name is correct
        tag_names_second = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "tagName")
        ))
        self.assertTrue(tag_names_second, "tagName are present")
        
        # Extract and print all text values for debugging
        names = [element.text.strip() for element in tag_names_second]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the extracted names are "Professor" and "Masked Royale"
        expected_names = ["Professor", "Masked Royale"]
        self.assertEqual(names, expected_names, "The extracted names are correct")
    
    

if __name__ == "__main__":
    unittest.main(verbosity=2)
    
    