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

class ShareTabTests(unittest.TestCase):
    
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
            
    

    # ----------------- Test Share with other users button -----------------
    """Test the 'Share with Other Users' button in the Share tab on the 
       Left Side Bar to ensure that the share modal appears"""
    
    def test_share_tab_button(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        # Find the Share tab
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")

        # Find the tab with title="Share"
        share_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Share"), None)
        self.assertIsNotNone(share_tab, "The 'Share' tab should be present")

        # Click the 'Share' tab
        share_tab.click()
        
        time.sleep(2)
        
        # id="shareWithOtherUsers"
        # Click the Share Button
        share_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "shareWithOtherUsers")
        ))
        self.assertTrue(share_button, "Share Button should be initialized")
        share_button.click()
        
        # Verify the presence of the Window element after clicking the Edit button
        share_modal_element = self.wait.until(EC.presence_of_element_located(
            (By.ID, "modalTitle")
        ))
        self.assertTrue(share_modal_element.is_displayed(), "Share window element is visible")
        
        time.sleep(3)
        
        # Extract the text from the element
        modal_text = share_modal_element.text

        # Ensure the extracted text matches the expected value
        self.assertEqual(modal_text, "Add People to Share With", "Modal title should be 'Add People to Share With'")
        

    
    # ----------------- Test Refresh Button -----------------
    """Test the 'Refresh' button in the Share tab on the Left Side Bar
       to ensure the 'Shared with you' results refresh"""
    
    def test_share_tab_refresh(self):
        # Extra sleep for extra loading 
        time.sleep(5)
        
        # Find the Share tab
        tabs = self.wait.until(EC.presence_of_all_elements_located((By.ID, "tabSelection")))
        self.assertGreater(len(tabs), 1, "Expected multiple buttons with ID 'tabSelection'")

        # Find the tab with title="Share"
        share_tab = next((tab for tab in tabs if tab.get_attribute("title") == "Share"), None)
        self.assertIsNotNone(share_tab, "The 'Share' tab should be present")

        # Click the 'Share' tab
        share_tab.click()
        
        time.sleep(2)
        
        # id="refreshButton"
        # Click the Refresh Button
        refresh_button = self.wait.until(EC.element_to_be_clickable(
            (By.ID, "refreshButton")
        ))
        self.assertTrue(refresh_button, "Refresh Button should be initialized")
    
    
    
            
if __name__ == "__main__":
    unittest.main(verbosity=2)
    
    