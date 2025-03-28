import unittest
import time
import os
import re
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

class ChatBarMiscTests(unittest.TestCase):
    
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
    def create_assistant(self, assistant_name):
        assistant_add_button = self.wait.until(EC.element_to_be_clickable((By.ID, "addAssistantButton")))
        self.assertIsNotNone(assistant_add_button, "Add Assistant button should be initialized and clickable")
        assistant_add_button.click()
        
        assistant_name_input = self.wait.until(EC.presence_of_element_located((By.ID, "assistantName")))
        self.assertIsNotNone(assistant_name_input, "Assistant Name input should be present")
        assistant_name_input.clear()
        assistant_name_input.send_keys(assistant_name)
        
        assistant_save_button = self.wait.until(EC.element_to_be_clickable((By.ID, "saveButton")))
        self.assertIsNotNone(assistant_save_button, "Save button should be initialized and clickable")
        assistant_save_button.click()
        
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
        
        prompt_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "promptName")))
        self.assertTrue(prompt_name_elements, "Prompt name elements should be initialized")
        assistant_in_list = next((el for el in prompt_name_elements if el.text == assistant_name), None)
        self.assertIsNotNone(assistant_in_list, f"{assistant_name} should be visible in the dropdown")
            
    

    
    # ----------------- Test Upload Files -----------------
    """This test ensures that the upolad files button can be hit and that the system-generated 
       file upload window appears. This is only confirmable by viewing."""
    
    def test_upload_files_visible(self):
        # A little more time to load
        time.sleep(3)
        
        # Find the Select Enabled Features Button
        upload_files_button = self.wait.until(EC.presence_of_element_located((By.ID, "uploadFile")))
        self.assertTrue(upload_files_button.is_displayed(), "Select Upload Files Button element is visible")

        # Click the Upload button
        upload_files_button.click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # Selenium can't detect and/or interact with a system-generated window

        
    
    # ----------------- Test Select Assistants -----------------
    """This test ensures that Assistant chat labels can be selected."""
    
    def test_select_assistants(self):
        
        self.create_assistant("Ninji")
        
        # A little more time to load
        time.sleep(3)
        
        # Find the Select Assistants Button
        select_assistants_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectAssistants")))
        self.assertTrue(select_assistants_button.is_displayed(), "Select Assistants Button element is visible")

        # Click the assistants button
        select_assistants_button.click()
        
        time.sleep(2)
        
        # Find the standard_conversation Button
        standard_conversation_button = self.wait.until(EC.presence_of_element_located((By.ID, "standardConversation")))
        self.assertTrue(standard_conversation_button.is_displayed(), "Select standard_conversation Button element is visible")

        # Click the standard_conversation button
        standard_conversation_button.click()
        
        time.sleep(2)  
        
        # Locate the <select> dropdown
        select_element = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "select.w-full.cursor-pointer"))
        )
        
        # Use Selenium's Select class to interact with the dropdown
        dropdown = Select(select_element)

        # Select the option by visible text "Ninji"
        dropdown.select_by_visible_text("Ninji")

        time.sleep(2)  # Allow any UI updates

        # Ensure the Assistant Chat Label appears after selection
        assistant_chat_label = self.wait.until(EC.presence_of_element_located(
            (By.ID, "assistantChatLabel")
        ))
        self.assertIsNotNone(assistant_chat_label, "Assistant chat label should appear after selection")
    
    
    
    # ----------------- Test Collapse Left Sidebar -----------------
    """This test ensures that the left sidebar can be collapsed"""
    
    def test_collapse_left_sidebar(self):
        # A little more time to load
        time.sleep(3)
        
        # Find the Select Collapse Left Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Collapse the Left Sidebar
        sidebar_collapse_buttons[0].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # id="tabSelection" is not visible
        tab_selection = self.wait.until(EC.invisibility_of_element_located((By.ID, "tabSelection")))
        self.assertTrue(tab_selection, "tabSelection should not be visible after collapsing sidebar")
    
    
    
    # ----------------- Test Collapse Right Sidebar -----------------
    """This test ensures that the right sidebar can be collapsed"""
    
    def test_collapse_right_sidebar(self):
        # A little more time to load
        time.sleep(3)
        
        # Find the Select Collapse Right Sidebar Button
        sidebar_collapse_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "collapseSidebar")))
        self.assertTrue(sidebar_collapse_buttons, "collapseSidebar should be initialized")

        # Click the Right Sidebar
        sidebar_collapse_buttons[-1].click()
        
        time.sleep(3)  # Give time for any UI changes
        
        # id="addAssistantButton" is not visible
        add_assistant_selection = self.wait.until(EC.invisibility_of_element_located((By.ID, "addAssistantButton")))
        self.assertTrue(add_assistant_selection, "addAssistantButton should not be visible after collapsing sidebar")
        
        
        
    
if __name__ == "__main__":
    unittest.main(verbosity=2)