import unittest
import time
import os
from dotenv import load_dotenv
from datetime import datetime
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

class SettingsTabTests(unittest.TestCase):
    
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
   
   
   
    # ----------------- Test Manage Accounts -----------------
    """Test the Manage Accounts button in the Settings tab on the Left Side Bar"""
    
    def test_settings_manage_accounts(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        # Find the Settings tab
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")

        # Find the tab with title="Settings"
        settings_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Settings"), None)
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()
    
        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBarButton")))
        self.assertGreater(len(side_bar_buttons), 1, "Expected multiple buttons with ID 'sideBarButton'")

        # Find the button that contains a span with text "Manage Accounts"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Manage Accounts":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(target_button, "The 'Manage Accounts' button should be present")

        # Click the button
        target_button.click()
        
        # id="accountModal"
        # Verify the presence of the Window element after clicking the Edit button
        account_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "accountModal")
        ))
        self.assertTrue(account_modal_element.is_displayed(), "Account modal is visible")
        
        time.sleep(3)
    
    
    # ----------------- Test Import Conversations -----------------
    """Test the Import Conversations button in the Settings tab on the Left Side Bar"""
    
    def test_settings_import_conversations(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        # Find the Settings tab
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")

        # Find the tab with title="Settings"
        settings_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Settings"), None)
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()
    
        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBarButton")))
        self.assertGreater(len(side_bar_buttons), 1, "Expected multiple buttons with ID 'sideBarButton'")

        # Find the button that contains a span with text "Import Conversations"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Import Conversations":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(target_button, "The 'Import Conversations' button should be present")

        # Click the button
        target_button.click()
    
        time.sleep(3)
        
        # Check if the file input becomes available
        file_input = self.wait.until(EC.presence_of_element_located((By.ID, "import-file")))
        self.assertIsNotNone(file_input, "The file picker should appear for importing conversations.")
    
            
            
    # ----------------- Test Export Conversations -----------------
    """Test the Export Conversations button in the Settings tab on the Left Side Bar"""
    
    def test_settings_export_conversations(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        # Find the Settings tab
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")

        # Find the tab with title="Settings"
        settings_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Settings"), None)
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()
    
        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBarButton")))
        self.assertGreater(len(side_bar_buttons), 1, "Expected multiple buttons with ID 'sideBarButton'")

        # Find the button that contains a span with text "Export Conversations"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Export Conversations":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(target_button, "The 'Export Conversations' button should be present")

        # Click the button
        target_button.click()
    
        time.sleep(3)
    
        # Define Download Path
        download_dir = os.path.expanduser("~/Downloads")  # Adjust if using a different directory

        # Generate the expected filename with MM-DD format
        current_date = datetime.now().strftime("%-m-%-d")  # Format MM-DD
        expected_filename = f"chatbot_ui_history_{current_date}.json"
        expected_filepath = os.path.join(download_dir, expected_filename)

        # Wait for the file to appear
        timeout = 30  # Max wait time in seconds
        start_time = time.time()

        while time.time() - start_time < timeout:
            if os.path.exists(expected_filepath):
                print(f"Download successful! File found: {expected_filepath}")
                break
            time.sleep(1)
        else:
            self.fail(f"Download failed: Expected file '{expected_filename}' not found in {download_dir}")

        # Assert file exists
        self.assertTrue(os.path.exists(expected_filepath), f"Expected downloaded file '{expected_filename}' to exist.")
    
    
    
    # ----------------- Test Settings Tab -----------------
    """Test the Settings button in the Settings tab on the Left Side Bar"""
    
    def test_settings_settings(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        # Find the Settings tab
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")

        # Find the tab with title="Settings"
        settings_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Settings"), None)
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()
    
        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBarButton")))
        self.assertGreater(len(side_bar_buttons), 1, "Expected multiple buttons with ID 'sideBarButton'")
    
        # Find the button that contains a span with text "Settings"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Settings":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(target_button, "The 'Settings' button should be present")

        # Click the button
        target_button.click()
        
        # Verify the presence of the Window element after clicking the Edit button
        settings_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(settings_modal_element.is_displayed(), "Settings window element is visible")
        
        # Extract the text from the element
        modal_text = settings_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Settings", "Modal title should be 'Settings'")
    
    
    
    # ----------------- Test Send Feedback -----------------
    """Test the Send Feedback button in the Settings tab on the Left Side Bar
       This will cause the email window to pop up"""
    
    def test_settings_send_feedback(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        # Find the Settings tab
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")

        # Find the tab with title="Settings"
        settings_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Settings"), None)
        self.assertIsNotNone(settings_tab, "The 'Settings' tab should be present")

        # Click the 'Settings' tab
        settings_tab.click()
    
        # Wait for all buttons with id="sideBarButton"
        side_bar_buttons = self.wait.until(EC.presence_of_all_elements_located((By.ID, "sideBarButton")))
        self.assertGreater(len(side_bar_buttons), 1, "Expected multiple buttons with ID 'sideBarButton'")
    
        # Find the button that contains a span with text "Send Feedback"
        target_button = None
        for button in side_bar_buttons:
            try:
                span_element = button.find_element(By.TAG_NAME, "span")
                if span_element.text.strip() == "Send Feedback":
                    target_button = button
                    break
            except:
                continue  # Skip if the span element is not found

        self.assertIsNotNone(target_button, "The 'Send Feedback' button should be present")

    
if __name__ == "__main__":
    unittest.main(verbosity=2)
    
        