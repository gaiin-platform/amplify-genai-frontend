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

class SearchBarLeftTests(unittest.TestCase):
    
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
            
            
    # ----------------- Setup function ----------------- 
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

        time.sleep(2)
        
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
        
        
    # ----------------- Test Search Chats -----------------
    """Ensure the Chats searched in the Left Search Bar appear"""
    
    def test_search_assistant(self):
        
        self.create_chat("Birdo")
        
        # Click the searchBar Button
        search_bars_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "SearchBar")
        ))
        self.assertGreater(len(search_bars_plural), 1, "Expected multiple buttons with ID 'SearchBar'")
        
        # Select the first search bar
        search_bar = search_bars_plural[0]
        
        # Type "Birdo" into the search bar
        search_bar.clear()  # Clears any existing text
        search_bar.send_keys("Birdo")
        
        time.sleep(1)
        
        side_bar_detection = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBar")))
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection[0]
        
        # Locate all elements with the ID 'promptName'
        prompt_name_elements = left_panel.find_elements(By.ID, "chatName")
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        
        # Extract and print all text values for debugging
        names = [element.text.strip() for element in prompt_name_elements]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the only extracted name is "Birdo"
        expected_name = ["Birdo"]
        self.assertEqual(names, expected_name, "The search results should only contain 'Birdo'")
    
    
        
    # ----------------- Test Search Nothing -----------------
    """Ensure nothing appears after searching in the Left Search Bar"""
    
    def test_search_nothing(self):
        
        self.create_chat("Birdo")
        
        # Click the searchBar Button
        search_bars_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "SearchBar")
        ))
        self.assertGreater(len(search_bars_plural), 1, "Expected multiple buttons with ID 'SearchBar'")
        
        # Select the first search bar
        search_bar = search_bars_plural[0]
        
        # Type "Yoshi" into the search bar
        search_bar.clear()  # Clears any existing text
        search_bar.send_keys("Yoshi")
        
        time.sleep(1)
        
        side_bar_detection = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBar")))
        self.assertGreater(len(side_bar_detection), 1, "Expected multiple side bars")

        # Use the left sidebar
        left_panel = side_bar_detection[0]
        
        # Locate all elements with the ID 'chatName'
        prompt_name_elements = left_panel.find_elements(By.ID, "chatName")
        self.assertFalse(prompt_name_elements, "chatNames are empty")
        
        # Extract and print all text values for debugging
        names = [element.text.strip() for element in prompt_name_elements]
        print("Extracted Names:", names)  # Debugging output

        # Ensure the no names appear
        expected_name = []
        self.assertEqual(names, expected_name, "The search results should only contain empty")


if __name__ == "__main__":
    unittest.main(verbosity=2)
