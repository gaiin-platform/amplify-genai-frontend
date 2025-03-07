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

class CreateChatTests(unittest.TestCase):
    
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
        self.driver.quit()  # Always quit the browser
        
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



    # ----------------- Test Create Chat -----------------
    """This test creates a chat via the 'New Chat' Button
       This test creates two new chats called: 'New Conversation'"""
    
    def test_create_chat(self):
        
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptButton")
        ))
        self.assertTrue(prompt_buttons, "New Chat elements should be initialized")
        
        chat_add_button = next((el for el in prompt_buttons if el.text == "New Chat"), None)
        self.assertIsNotNone(chat_add_button, "New Chat button should be present")
        
        # Click create chat button
        chat_add_button.click()
        
        time.sleep(2)
        
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptButton")
        ))
        self.assertTrue(prompt_buttons, "New Chat elements should be initialized")
        
        chat_add_button = next((el for el in prompt_buttons if el.text == "New Chat"), None)
        self.assertIsNotNone(chat_add_button, "New Chat button should be present")
        
        # Click create chat button
        chat_add_button.click()
        
        time.sleep(2)
        
        
    # ----------------- Test Rename Chat -----------------
    """This test creates a new chat and will rename the chat's name
       via the rename button"""
       
    def test_rename_chat(self):
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptButton")
        ))
        self.assertTrue(prompt_buttons, "New Chat elements should be initialized")
        
        chat_add_button = next((el for el in prompt_buttons if el.text == "New Chat"), None)
        self.assertIsNotNone(chat_add_button, "New Chat button should be present")
        
        # Click open Add prompt menu
        chat_add_button.click()
        
        time.sleep(2)
        
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        
        # Find the element with text "New Conversation"
        chats = next((el for el in chat_name_elements if el.text == "New Conversation"), None)
        self.assertIsNotNone(chats, "New Conversation button should be present")

        chat_click = chats.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        chat_click.click()

        # Locate and click the "rename" button
        rename_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "isRenaming")
        ))
        self.assertIsNotNone(rename_button, "Rename button should be initialized and clicked")
        rename_button.click()

        rename_field = self.wait.until(EC.presence_of_element_located(
            (By.ID, "isRenamingInput")
        ))

        # Add a " V2" onto the end of the "New Conversation" name
        rename_field.send_keys(" V2")
        
        rename_confirm_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "handleConfirm")
        ))
        self.assertIsNotNone(rename_confirm_button, "Rename confirm button should be initialized and clicked")
        
        rename_confirm_button.click()
        
        # Locate all elements with the ID 'chatName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with text "New Conversation"
        folder = next((el for el in drop_name_elements if el.text == "New Conversation V2"), None)
        self.assertIsNotNone(folder, "New Conversation V2 should be present")
    


    # ----------------- Test Delete Chat -----------------
    """This test creates a new chat and then tests the delete conversation button"""
    
    def test_delete_chat(self):
        prompt_buttons = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptButton")
        ))
        self.assertTrue(prompt_buttons, "New Chat elements should be initialized")
        
        chat_add_button = next((el for el in prompt_buttons if el.text == "New Chat"), None)
        self.assertIsNotNone(chat_add_button, "New Chat button should be present")
        
        # Click open Add prompt menu
        chat_add_button.click()
        
        time.sleep(2)
        
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        
        # Find the element with text "New Conversation" to rename it
        chats = next((el for el in chat_name_elements if el.text == "New Conversation"), None)
        self.assertIsNotNone(chats, "New Conversation button should be present")

        chat_click = chats.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        chat_click.click()
        
        # Locate and click the "rename" button
        rename_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "isRenaming")
        ))
        self.assertIsNotNone(rename_button, "Rename button should be initialized and clicked")
        rename_button.click()

        rename_field = self.wait.until(EC.presence_of_element_located(
            (By.ID, "isRenamingInput")
        ))

        # Add a " V3" onto the end of the "New Conversation" name
        rename_field.send_keys(" V3")
        
        rename_confirm_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "handleConfirm")
        ))
        self.assertIsNotNone(rename_confirm_button, "Rename confirm button should be initialized and clicked")
        
        rename_confirm_button.click()
        
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        
        # Find the element with text "New Conversation V3" to delete it
        chats = next((el for el in chat_name_elements if el.text == "New Conversation V3"), None)
        self.assertIsNotNone(chats, "New Conversation button should be present")

        chat_click = chats.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")

        chat_click.click()

        # Locate and click the "delete" button
        delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "isDeleting")
        ))
        self.assertIsNotNone(delete_button, "Delete button should be initialized and clicked")
        delete_button.click()

        time.sleep(2)
        
        delete_confirm_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "handleConfirm")
        ))
        self.assertIsNotNone(delete_confirm_button, "Rename confirm button should be initialized and clicked")
        
        delete_confirm_button.click()
        
        # Locate all elements with the ID 'chatName'
        drop_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")
        
        time.sleep(2)
        
       # The element with text "New Conversation V3" should not exist
        chat = next((el for el in drop_name_elements if el.text == "New Conversation V3"), None)
        self.assertIsNone(chat, "New Conversation V3 chat should NOT be present")



if __name__ == "__main__":
    unittest.main(verbosity=2)
    
    