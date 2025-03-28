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

def load_env():
    # List of possible locations for .env.local
    possible_locations = [
        os.getenv('ENV_FILE'),  # From bash script
        os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'),  # Two levels up
        os.path.join(os.path.dirname(__file__), '..', '.env.local'),  # One level up
        os.path.join(os.path.dirname(__file__), '.env.local'),  # Same directory
    ]

    for location in possible_locations:
        if location and os.path.isfile(location):
            load_dotenv(location)
            # print(f"Loaded environment from: {location}")
            return True
    
    print("Warning: .env.local file not found")
    return False

class MassDeleteTests(unittest.TestCase):
    
    # ----------------- Setup -----------------
    def setUp(self, headless=True):
        
        # Load environment variables from .env.local
        load_env()

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
        
        # Create Setup Test Variables 
        # self.setup_test_data(num_assistants=2, num_prompts=2)

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

    
    
    # ----------------- Test Delete Chats -----------------
    """This test ensures multiple chats can be deleted individually via the 
       three dots handler on the Left Side Bar"""
    
    def test_delete_individual_chats(self):
        
        self.create_chat("Pawmot")
        self.create_chat("Incineroar")
        self.create_chat("Rillaboom")
        self.create_chat("Typhlosion")

       # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        
        prompt_handler_buttons_plural[0].click()
        
        time.sleep(3)
        
        # Click the Delete Button
        delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "Delete")
        ))
        self.assertTrue(delete_button, "Delete Button should be initialized")
        delete_button.click()
        
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
        
        # Check for chat named Pawmot
        chat_in_list = next((el for el in chat_name_elements if el.text == "Pawmot"), None)
        self.assertIsNotNone(chat_in_list, "Pawmot should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = chat_in_list.find_element(By.XPATH, "./ancestor::div[@id='chat']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Pawmot should be present')

        # Click the checkbox
        checkbox.click()
        
        time.sleep(2)
        
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
        
        # Check for chat named Rillaboom
        chat_in_list = next((el for el in chat_name_elements if el.text == "Rillaboom"), None)
        self.assertIsNotNone(chat_in_list, "Rillaboom should be visible in the dropdown")
        
        # Navigate up to the parent container
        parent_container = chat_in_list.find_element(By.XPATH, "./ancestor::div[@id='chat']")
        
        # Locate the checkbox within the parent container
        checkbox = parent_container.find_element(By.XPATH, ".//input[@type='checkbox']")
        self.assertIsNotNone(checkbox, f'Checkbox for prompt Rillaboom should be present')

        # Click the checkbox
        checkbox.click()
        
        time.sleep(2)
    
        # Click the Delete Button
        confirm_delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()
        
        # Locate all elements with ID "chatName" and find the one with text "Pawmot"
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "chatName")
        ))
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")

        # Check if any of the elements do not contain "Pawmot"
        chat_in_list = next((el for el in chat_name_elements if el.text == "Pawmot"), None)
        self.assertIsNone(chat_in_list, "Pawmot should be visible in the dropdown")
        
        # Check if any of the elements do not contain "Rillaboom"
        chat_in_list = next((el for el in chat_name_elements if el.text == "Rillaboom"), None)
        self.assertIsNone(chat_in_list, "Rillaboom should be visible in the dropdown")
        
    
    # ----------------- Test Delete Mass Chats -----------------
    """This test ensures that all chats can be selected and deleted via the three dots handler
       on the left Side Bar"""
    def test_delete_mass_chats(self):
        
        self.create_chat("Flamigo")
        self.create_chat("Porygon 2")
        self.create_chat("Weezing")
        self.create_chat("Moraidon")

       # Click the promptHandler Button
        prompt_handler_buttons_plural = self.wait.until(EC.presence_of_all_elements_located(
            (By.ID, "promptHandler")
        ))
        self.assertGreater(len(prompt_handler_buttons_plural), 1, "Expected multiple buttons with ID 'promptHandler'")
        
        prompt_handler_buttons_plural[0].click()
        
        time.sleep(3)
        
        # Click the Delete Button
        delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "Delete")
        ))
        self.assertTrue(delete_button, "Delete Button should be initialized")
        delete_button.click()
        
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
        
        # Click the Delete Button
        confirm_delete_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "confirmItem")
        ))
        self.assertTrue(confirm_delete_button, "Delete Button should be initialized")
        confirm_delete_button.click()
        
        time.sleep(3)
        
        # Ensure no promptName elements are present
        self.assertTrue(
            self.wait.until(EC.invisibility_of_element_located((By.ID, "chatName"))),
            "Chat elements should NOT be present"
        )
    
    
    
if __name__ == "__main__":
    unittest.main(verbosity=2)
    
   